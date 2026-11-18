// 편집기가 쓰는 도구 5개가 제대로 설치됐는지 한 번에 확인한다: npm run check
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ROOT, WHISPER_DIR, WHISPER_MODEL, chrome, ffmpeg, headlessShell, ytDlp } from './lib/tools.mjs';

const rows = [];
const ok = (name, detail) => rows.push(['OK  ', name, detail]);
const bad = (name, detail) => rows.push(['없음', name, detail]);

function version(bin, args = ['--version']) {
  try {
    return execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).split('\n')[0].trim();
  } catch {
    return null;
  }
}
function pkgVersion(name) {
  const p = path.join(ROOT, 'node_modules', name, 'package.json');
  return existsSync(p) ? JSON.parse(execFileSync('cat', [p], { encoding: 'utf8' })).version : null;
}

const rv = pkgVersion('remotion');
rv ? ok('Remotion', `v${rv}`) : bad('Remotion', 'npm install 필요');

const hv = pkgVersion('hyperframes');
hv ? ok('HyperFrames', `v${hv}`) : bad('HyperFrames', 'npm install 필요');
existsSync(path.join(ROOT, 'hyperframes', 'vendor', 'gsap.min.js'))
  ? ok('  └ 로컬 GSAP·글꼴', 'hyperframes/vendor')
  : bad('  └ 로컬 GSAP·글꼴', 'node scripts/vendor.mjs 실행 필요');

const ff = ffmpeg();
if (ff) {
  ok('FFmpeg', version(ff, ['-version']) ?? ff);
  const filters = version(ff, ['-hide_banner', '-filters']) !== null
    ? execFileSync(ff, ['-hide_banner', '-filters'], { encoding: 'utf8' })
    : '';
  filters.includes('vidstabtransform')
    ? ok('  └ vidstab (고정 앵글)', '사용 가능')
    : bad('  └ vidstab (고정 앵글)', 'libvidstab 포함된 FFmpeg 필요');
} else bad('FFmpeg', 'apt-get install -y ffmpeg');

if (existsSync(path.join(WHISPER_DIR, 'main')) || existsSync(path.join(WHISPER_DIR, 'build', 'bin', 'main'))) {
  const models = readdirSync(WHISPER_DIR).filter((f) => f.startsWith('ggml-') && f.endsWith('.bin'));
  ok('Whisper (whisper.cpp)', WHISPER_DIR.replace(ROOT + '/', ''));
  models.length
    ? ok('  └ 모델', models.join(', '))
    : bad('  └ 모델', `ggml-${WHISPER_MODEL}.bin 없음 (huggingface.co 접속 후 npm run whisper:install)`);
} else bad('Whisper (whisper.cpp)', 'npm run whisper:install');

const yt = ytDlp();
yt ? ok('yt-dlp', version(yt) ?? yt) : bad('yt-dlp', 'npm run setup');

const shell = headlessShell() ?? chrome();
shell ? ok('렌더용 크롬', shell) : bad('렌더용 크롬', '첫 렌더 때 자동으로 내려받습니다');

for (const [state, name, detail] of rows) console.log(`${state}  ${name.padEnd(24)} ${detail}`);
process.exit(rows.some((r) => r[0] !== 'OK  ' && r[1] !== '렌더용 크롬') ? 1 : 0);
