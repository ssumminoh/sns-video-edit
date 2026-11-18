// 영상의 말소리를 Whisper로 받아쓰고 자막 파일을 만든다.
// 사용법: npm run transcribe -- <영상 또는 음성 파일> [언어코드]
//   언어코드: ko, ja, en (생략하면 자동 감지)
// 결과: 같은 폴더에 <이름>.captions.json (문장별 시작·끝 ms), <이름>.srt
// 음악 위 노랫말은 잘 못 알아듣는다. 말소리(브이로그 내레이션) 받아쓰기와 타이밍 잡기용.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { serializeSrt } from '@remotion/captions';
import { WHISPER_DIR, WHISPER_MODEL, ffmpeg } from './lib/tools.mjs';

const [input, language] = process.argv.slice(2);
if (!input || !existsSync(input)) {
  console.error('받아쓸 파일 경로가 필요합니다. 예: npm run transcribe -- inbox/vlog.mp4 ko');
  process.exit(1);
}
if (!existsSync(WHISPER_DIR)) {
  console.error('Whisper가 설치되지 않았습니다. npm run whisper:install 을 먼저 실행하세요.');
  process.exit(1);
}

// whisper.cpp는 16kHz 모노 WAV만 받는다.
const work = mkdtempSync(path.join(tmpdir(), 'sns-whisper-'));
const wav = path.join(work, 'audio.wav');
try {
  execFileSync(ffmpeg(), ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav]);

  // whisper.cpp를 직접 실행해 문장 단위 결과(JSON)를 받는다.
  // 토큰 단위로 받으면 한국어·일본어 글자가 중간에서 잘려 깨진다.
  const model = path.join(WHISPER_DIR, `ggml-${WHISPER_MODEL}.bin`);
  if (!existsSync(model)) {
    console.error(`모델 파일이 없습니다: ${model}. npm run whisper:install 을 실행하세요.`);
    process.exit(1);
  }
  const outBase = path.join(work, 'result');
  const args = ['-m', model, '-f', wav, '-oj', '-of', outBase, '-l', language ?? 'auto'];
  execFileSync(path.join(WHISPER_DIR, 'main'), args, { stdio: ['ignore', 'ignore', 'ignore'] });
  const result = JSON.parse(readFileSync(`${outBase}.json`, 'utf8'));
  const lines = result.transcription
    .map((seg) => ({ text: seg.text.trim(), startMs: seg.offsets.from, endMs: seg.offsets.to }))
    .filter((l) => l.text.length > 0);

  const base = input.replace(/\.[^.]+$/, '');
  writeFileSync(`${base}.captions.json`, JSON.stringify(lines, null, 2));
  const srt = serializeSrt({
    lines: lines.map((l) => [{ text: l.text, startMs: l.startMs, endMs: l.endMs, timestampMs: null, confidence: null }]),
  });
  writeFileSync(`${base}.srt`, srt);

  console.log(`자막 ${lines.length}줄 생성: ${base}.srt, ${base}.captions.json`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
