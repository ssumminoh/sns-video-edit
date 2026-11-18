import { defineConfig } from 'vite';

const server = 'http://localhost:8787';

export default defineConfig({
  // React 플러그인 없이 Vite 기본 변환으로 JSX를 처리한다.
  oxc: { jsx: { runtime: 'automatic' } },
  server: { proxy: { '/api': server, '/media': server, '/out': server } },
});
