// yt-dlp로 영상/음원을 inbox/에 내려받는다.
// 사용법: npm run fetch -- <URL> [--audio]
//   --audio : 음원만 m4a로 받기 (배경음악 후보 분석용)
// 본인이 올린 영상이나 사용 권한이 있는 콘텐츠에만 쓰세요.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { ROOT, ffmpeg, ytDlp } from './lib/tools.mjs';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
if (!url) {
  console.error('URL이 필요합니다. 예: npm run fetch -- https://www.youtube.com/watch?v=... --audio');
  process.exit(1);
}
const bin = ytDlp();
if (!bin) {
  console.error('yt-dlp가 없습니다. npm run setup 을 먼저 실행하세요.');
  process.exit(1);
}

const inbox = path.join(ROOT, 'inbox');
mkdirSync(inbox, { recursive: true });

const opts = ['--js-runtimes', 'node', '--no-playlist', '-o', path.join(inbox, '%(title).80s [%(id)s].%(ext)s'), '--write-info-json'];
if (ffmpeg()) opts.push('--ffmpeg-location', ffmpeg());
if (args.includes('--audio')) opts.push('-f', 'bestaudio[ext=m4a]/bestaudio', '-x', '--audio-format', 'm4a');
else opts.push('-f', 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b', '--merge-output-format', 'mp4');

const child = spawn(bin, [...opts, url], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 1));
