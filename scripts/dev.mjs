// 개발용: 편집기 서버와 Vite를 함께 띄운다. 하나가 꺼지면 같이 끈다.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { ROOT } from './lib/tools.mjs';

const procs = [
  spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, stdio: 'inherit' }),
  spawn(path.join(ROOT, 'node_modules', '.bin', 'vite'), [], { cwd: ROOT, stdio: 'inherit' }),
];
const stop = () => procs.forEach((p) => p.kill());
procs.forEach((p) => p.on('exit', (code) => { stop(); process.exit(code ?? 0); }));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
