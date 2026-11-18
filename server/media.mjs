// FFmpeg로 영상·음악을 분석한다: 길이, 썸네일, 평균 색·밝기, 화면 움직임, 가장 안정적인 구간, BPM.
import { execFile, spawn } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { ROOT, ffmpeg, ffprobe } from '../scripts/lib/tools.mjs';

const run = promisify(execFile);
const BIG = { maxBuffer: 64 * 1024 * 1024 };

async function probe(file) {
  const { stdout } = await run(ffprobe(), ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
  const info = JSON.parse(stdout);
  const video = info.streams.find((s) => s.codec_type === 'video');
  return { duration: Number(info.format.duration) || 0, width: video?.width ?? 0, height: video?.height ?? 0, hasVideo: !!video };
}

const median = (xs) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

const MOTION_FPS = 5;
/** 고정 컷으로 쓰려면 이만큼(초)은 안정적이어야 한다. */
const STEADY_WINDOW = 3;

/** 프레임 간 차이를 초당 5번 잰다. 값이 작을수록 화면이 덜 움직인다. */
async function motionSeries(file) {
  const filter = `fps=${MOTION_FPS},scale=160:-2,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-`;
  const { stdout } = await run(ffmpeg(), ['-hide_banner', '-loglevel', 'error', '-i', file, '-an', '-vf', filter, '-f', 'null', '-'], BIG);
  return [...stdout.matchAll(/YAVG=([0-9.]+)/g)].map((m) => Number(m[1])).slice(1);
}

/** 가장 덜 움직이는 구간을 찾는다. */
function steadiest(series, duration) {
  const size = Math.min(series.length, STEADY_WINDOW * MOTION_FPS);
  if (size === 0) return { start: 0, len: duration, mean: 0 };
  let sum = 0;
  for (let i = 0; i < size; i++) sum += series[i];
  let best = sum;
  let bestAt = 0;
  for (let i = size; i < series.length; i++) {
    sum += series[i] - series[i - size];
    if (sum < best) {
      best = sum;
      bestAt = i - size + 1;
    }
  }
  return { start: bestAt / MOTION_FPS, len: size / MOTION_FPS, mean: best / size };
}

// 기준값은 경험적으로 잡은 것. 화면 안에서 사람이 크게 움직여도 값이 올라간다.
const fixability = (steadyMean) => (steadyMean < 1.2 ? 'fixed' : steadyMean < 4 ? 'convertible' : 'hard');

export async function analyzeVideo(file, thumbFile) {
  const info = await probe(file);
  if (!info.hasVideo) throw new Error('영상 파일이 아닙니다.');
  const at = String(Math.max(0, info.duration / 2));
  const quiet = ['-hide_banner', '-loglevel', 'error', '-y'];
  const [, color, series] = await Promise.all([
    run(ffmpeg(), [...quiet, '-ss', at, '-i', file, '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', thumbFile]),
    run(ffmpeg(), [...quiet, '-ss', at, '-i', file, '-frames:v', '1', '-vf', 'scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { encoding: 'buffer' }),
    motionSeries(file),
  ]);
  const [r, g, b] = color.stdout;
  const steady = steadiest(series, info.duration);
  return {
    duration: info.duration,
    width: info.width,
    height: info.height,
    brightness: Math.round(0.299 * r + 0.587 * g + 0.114 * b),
    color: '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join(''),
    motion: Number(median(series).toFixed(2)),
    steadyStart: Number(steady.start.toFixed(1)),
    steadyLen: Number(steady.len.toFixed(1)),
    fixability: fixability(steady.mean),
  };
}

/** 음악의 BPM을 잰다: 소리 세기가 올라가는 지점들의 간격을 자기상관으로 찾는다. */
export async function analyzeMusic(file) {
  const info = await probe(file);
  const rate = 11025;
  const { stdout } = await run(ffmpeg(), ['-hide_banner', '-loglevel', 'error', '-t', '90', '-i', file, '-vn', '-ac', '1', '-ar', String(rate), '-f', 'f32le', '-'], {
    encoding: 'buffer',
    maxBuffer: 256 * 1024 * 1024,
  });
  const pcm = new Float32Array(stdout.buffer, stdout.byteOffset, Math.floor(stdout.byteLength / 4));
  const hop = 256;
  const frames = Math.floor(pcm.length / hop);
  const onset = new Float32Array(frames);
  let prev = 0;
  for (let i = 0; i < frames; i++) {
    let e = 0;
    for (let j = i * hop; j < (i + 1) * hop; j++) e += pcm[j] * pcm[j];
    e = Math.log1p(e);
    onset[i] = Math.max(0, e - prev);
    prev = e;
  }
  const perSecond = rate / hop;
  let bestBpm = 0;
  let bestScore = -1;
  for (let bpm = 60; bpm <= 180; bpm += 0.5) {
    const lag = (60 / bpm) * perSecond;
    let score = 0;
    for (let i = 0; i + Math.round(lag * 2) < frames; i++) score += onset[i] * (onset[i + Math.round(lag)] + 0.5 * onset[i + Math.round(lag * 2)]);
    if (score > bestScore) {
      bestScore = score;
      bestBpm = bpm;
    }
  }
  // 두 배 빠르게 잡히는 경우가 많아서 140을 넘으면 절반으로 본다. 화면에서 직접 고칠 수 있다.
  const bpm = bestBpm > 140 ? bestBpm / 2 : bestBpm;
  return { duration: info.duration, bpm: bpm > 0 ? Math.round(bpm) : 84 };
}

/** scripts/stabilize.sh로 고정 앵글 변환. */
export function stabilize(input, output, mode) {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [path.join(ROOT, 'scripts', 'stabilize.sh'), input, output, mode], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => (err += d));
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(err.trim() || '고정 변환에 실패했습니다.'))));
  });
}
