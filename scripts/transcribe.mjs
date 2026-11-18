// 영상의 말소리를 Whisper로 받아쓰고 자막 파일을 만든다.
// 사용법: npm run transcribe -- <영상 또는 음성 파일> [언어코드]
//   언어코드: ko, ja, en (생략하면 자동 감지)
// 결과: 같은 폴더에 <이름>.captions.json (문장별 시작·끝 ms), <이름>.srt
// 음악 위 노랫말은 잘 못 알아듣는다. 말소리(브이로그 내레이션) 받아쓰기와 타이밍 잡기용.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { serializeSrt } from '@remotion/captions';
import { transcribe } from '@remotion/install-whisper-cpp';
import { WHISPER_DIR, WHISPER_MODEL, WHISPER_VERSION, ffmpeg } from './lib/tools.mjs';

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

  const result = await transcribe({
    inputPath: wav,
    whisperPath: WHISPER_DIR,
    whisperCppVersion: WHISPER_VERSION,
    model: WHISPER_MODEL,
    language: language ?? null,
    printOutput: false,
  });
  // 한국어·일본어는 토큰 단위로 자르면 글자가 깨지므로 문장(세그먼트) 단위 결과를 쓴다.
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
