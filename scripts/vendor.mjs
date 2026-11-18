// npm install 뒤에 자동 실행된다(postinstall).
// Hyperframes 컴포지션이 인터넷 없이 렌더되도록 GSAP와 글꼴을 hyperframes/vendor/로 복사한다.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/tools.mjs';

const vendor = path.join(ROOT, 'hyperframes', 'vendor');
mkdirSync(vendor, { recursive: true });

cpSync(path.join(ROOT, 'node_modules', 'gsap', 'dist', 'gsap.min.js'), path.join(vendor, 'gsap.min.js'));

// [패키지, 폴더, CSS 파일, 글꼴 파일 폴더, 복사할 파일 끝말]
const FONTS = [
  ['@fontsource/shippori-mincho', 'jp', '400.css', 'files', '-400-normal.woff2'],
  ['@fontsource/eb-garamond', 'en', '400.css', 'files', '-400-normal.woff2'],
  ['@noonnu/chosun-sm', 'kr', 'index.css', 'fonts', '.woff'],
];
for (const [pkg, dir, cssFile, filesDir, suffix] of FONTS) {
  const src = path.join(ROOT, 'node_modules', pkg);
  if (!existsSync(src)) continue;
  const out = path.join(vendor, 'fonts', dir);
  mkdirSync(path.join(out, filesDir), { recursive: true });
  // woff2만 복사하는 글꼴은 CSS에서 woff 대체 경로를 지운다.
  let css = readFileSync(path.join(src, cssFile), 'utf8');
  if (suffix.endsWith('.woff2')) css = css.replace(/, url\([^)]*\.woff\) format\('woff'\)/g, '');
  writeFileSync(path.join(out, 'font.css'), css);
  for (const f of readdirSync(path.join(src, filesDir))) {
    if (f.endsWith(suffix)) cpSync(path.join(src, filesDir, f), path.join(out, filesDir, f));
  }
}
// 타이틀용 은디나루
mkdirSync(path.join(vendor, 'fonts', 'title'), { recursive: true });
cpSync(path.join(ROOT, 'fonts', 'UnDinaru.ttf'), path.join(vendor, 'fonts', 'title', 'UnDinaru.ttf'));

console.log('hyperframes/vendor 준비 완료 (GSAP, 은디나루, 조선신명조, Shippori Mincho, EB Garamond)');
