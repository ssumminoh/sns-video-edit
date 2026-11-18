// Whisper(whisper.cpp)를 .whisper/에 빌드하고 음성 인식 모델을 내려받는다.
// 모델은 huggingface.co에서 받으므로 그 주소로 나가는 네트워크가 열려 있어야 한다.
// 모델 크기 바꾸기: SNS_WHISPER_MODEL=medium npm run whisper:install  (tiny, base, small, medium, large-v3)
import { downloadWhisperModel, installWhisperCpp } from '@remotion/install-whisper-cpp';
import { WHISPER_DIR, WHISPER_MODEL, WHISPER_VERSION } from './lib/tools.mjs';

await installWhisperCpp({ to: WHISPER_DIR, version: WHISPER_VERSION, printOutput: true });
console.log(`whisper.cpp ${WHISPER_VERSION} 설치 완료: ${WHISPER_DIR}`);

try {
  await downloadWhisperModel({ model: WHISPER_MODEL, folder: WHISPER_DIR, printOutput: true });
  console.log(`모델 ${WHISPER_MODEL} 준비 완료`);
} catch (err) {
  console.error(`모델 ${WHISPER_MODEL}을 내려받지 못했습니다: ${err.message}`);
  console.error('huggingface.co 접속이 막혀 있을 수 있습니다. 네트워크 허용 후 다시 실행하세요.');
  process.exit(1);
}
