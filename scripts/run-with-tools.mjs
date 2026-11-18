// 사용법: node scripts/run-with-tools.mjs <명령> [인자...]
// 크롬·FFmpeg 위치와 텔레메트리 끄기 설정을 환경 변수로 넣은 뒤 Remotion/Hyperframes CLI를 실행한다.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { ROOT, chrome, ffmpeg, ffprobe, headlessShell } from './lib/tools.mjs';

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error('실행할 명령이 없습니다. 예: node scripts/run-with-tools.mjs hyperframes render');
  process.exit(1);
}

const env = { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1', REMOTION_DISABLE_TELEMETRY: '1' };
const shell = headlessShell();
const browser = chrome();
if (shell) {
  env.PRODUCER_HEADLESS_SHELL_PATH ??= shell;
  env.REMOTION_BROWSER_EXECUTABLE ??= shell;
}
if (browser) env.PUPPETEER_EXECUTABLE_PATH ??= browser;
if (ffmpeg()) env.HYPERFRAMES_FFMPEG_PATH ??= ffmpeg();
if (ffprobe()) env.HYPERFRAMES_FFPROBE_PATH ??= ffprobe();

const bin = path.join(ROOT, 'node_modules', '.bin', cmd);
const child = spawn(bin, args, { stdio: 'inherit', env, cwd: process.cwd() });
child.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 0));
