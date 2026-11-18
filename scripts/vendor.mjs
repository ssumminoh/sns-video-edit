// npm install 뒤에 자동 실행된다(postinstall).
// Hyperframes 컴포지션이 인터넷 없이 렌더되도록 GSAP와 명조체 글꼴을 hyperframes/vendor/로 복사한다.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/tools.mjs';

const vendor = path.join(ROOT, 'hyperframes', 'vendor');
mkdirSync(vendor, { recursive: true });

cpSync(path.join(ROOT, 'node_modules', 'gsap', 'dist', 'gsap.min.js'), path.join(vendor, 'gsap.min.js'));

for (const [pkg, dir] of [['noto-serif-kr', 'kr'], ['noto-serif-jp', 'jp']]) {
  const src = path.join(ROOT, 'node_modules', '@fontsource', pkg);
  if (!existsSync(src)) continue;
  const out = path.join(vendor, 'fonts', dir);
  mkdirSync(path.join(out, 'files'), { recursive: true });
  // woff2만 복사하므로 CSS에서 woff 대체 경로는 지운다.
  const css = readFileSync(path.join(src, '400.css'), 'utf8').replace(/, url\([^)]*\.woff\) format\('woff'\)/g, '');
  writeFileSync(path.join(out, '400.css'), css);
  for (const f of readdirSync(path.join(src, 'files'))) {
    if (f.endsWith('-400-normal.woff2')) cpSync(path.join(src, 'files', f), path.join(out, 'files', f));
  }
}

console.log('hyperframes/vendor 준비 완료 (GSAP, Noto Serif KR/JP)');
