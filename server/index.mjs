// 편집기 서버: 영상 올리기·분석, 분위기 제안, 고정 변환, 렌더.
// 개발: npm run dev (Vite가 /api, /media, /out을 이 서버로 넘긴다) · 배포: npm run build && npm start
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { ROOT } from '../scripts/lib/tools.mjs';
import { aiConnected, analyzeClips, answerComment, translate } from './ai.mjs';
import { analyzeMusic, analyzeVideo, stabilize } from './media.mjs';

const PORT = Number(process.env.PORT ?? 8787);
const DATA = path.join(ROOT, 'data');
const MEDIA = path.join(DATA, 'media');
const OUT = path.join(ROOT, 'out');
const DIST = path.join(ROOT, 'dist');
const PROJECT_FILE = path.join(DATA, 'project.json');
for (const dir of [MEDIA, OUT]) mkdirSync(dir, { recursive: true });

const VIDEO_EXT = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv']);
const AUDIO_EXT = new Set(['.mp3', '.m4a', '.wav', '.aac', '.ogg', '.flac']);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mkv': 'video/x-matroska',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.flac': 'audio/flac',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const json = (res, body, status = 200) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new HttpError(400, '요청 형식이 올바르지 않습니다.');
  }
}

/** base 폴더 밖으로 나가지 못하게 막은 뒤 파일을 보낸다. 영상 탐색을 위해 Range를 지원한다. */
async function sendFile(req, res, base, relative) {
  const file = path.resolve(base, '.' + path.posix.normalize('/' + relative));
  if (file !== base && !file.startsWith(base + path.sep)) throw new HttpError(403, '접근할 수 없는 경로입니다.');
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) throw new HttpError(404, '파일이 없습니다.');
  const headers = { 'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'Accept-Ranges': 'bytes' };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    if (start > end || start >= info.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
      return res.end();
    }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${info.size}`, 'Content-Length': end - start + 1 });
    return pipeline(createReadStream(file, { start, end }), res).catch(() => {});
  }
  res.writeHead(200, { ...headers, 'Content-Length': info.size });
  return pipeline(createReadStream(file), res).catch(() => {});
}

/** 요청 본문을 그대로 data/media에 저장한다. 파일 이름은 서버가 새로 짓는다. */
async function saveUpload(req, url, allowed) {
  const name = (url.searchParams.get('name') ?? 'file').slice(0, 120);
  const ext = path.extname(name).toLowerCase();
  if (!allowed.has(ext)) throw new HttpError(415, `지원하지 않는 파일 형식입니다: ${ext || name}`);
  const id = randomUUID().slice(0, 8);
  const file = path.join(MEDIA, id + ext);
  await pipeline(req, createWriteStream(file));
  return { id, name, ext, file };
}

const mediaPath = (url) => path.join(MEDIA, path.basename(url));

// ---- 렌더 작업 ----

const jobs = new Map();

function startRender(props) {
  const id = randomUUID().slice(0, 8);
  const job = { status: 'rendering', progress: 0, file: null, error: null };
  jobs.set(id, job);
  const origin = `http://127.0.0.1:${PORT}`;
  const abs = (src) => (src.startsWith('/') ? origin + src : src);
  const full = { ...props, clips: props.clips.map((c) => ({ ...c, src: abs(c.src) })), music: props.music ? { ...props.music, src: abs(props.music.src) } : undefined };
  const propsFile = path.join(OUT, `${id}.json`);
  const outFile = path.join(OUT, `reel-${id}.mp4`);

  writeFile(propsFile, JSON.stringify(full))
    .then(() => {
      const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'run-with-tools.mjs'), 'remotion', 'render', 'src/reel/index.ts', 'Reel', outFile, `--props=${propsFile}`], { cwd: ROOT });
      let log = '';
      const onData = (d) => {
        log = (log + d).slice(-4000);
        const m = [...String(d).matchAll(/Rendered (\d+)\/(\d+)/g)].pop();
        if (m) job.progress = Number(m[1]) / Number(m[2]);
      };
      child.stdout.on('data', onData);
      child.stderr.on('data', onData);
      child.on('error', (err) => Object.assign(job, { status: 'error', error: err.message }));
      child.on('exit', (code) => {
        if (code === 0 && existsSync(outFile)) Object.assign(job, { status: 'done', progress: 1, file: `/out/reel-${id}.mp4` });
        else Object.assign(job, { status: 'error', error: log.trim().split('\n').slice(-6).join('\n') || '렌더에 실패했습니다.' });
        rm(propsFile, { force: true });
      });
    })
    .catch((err) => Object.assign(job, { status: 'error', error: err.message }));
  return id;
}

// ---- API ----

async function api(req, res, url) {
  const route = `${req.method} ${url.pathname}`;

  if (route === 'GET /api/project') {
    const project = existsSync(PROJECT_FILE) ? JSON.parse(await readFile(PROJECT_FILE, 'utf8')) : null;
    return json(res, { project, ai: aiConnected() });
  }
  if (route === 'PUT /api/project') {
    await writeFile(PROJECT_FILE, JSON.stringify(await readJson(req)));
    return json(res, { ok: true });
  }

  if (route === 'POST /api/clips') {
    const up = await saveUpload(req, url, VIDEO_EXT);
    try {
      const stats = await analyzeVideo(up.file, path.join(MEDIA, `${up.id}.jpg`));
      return json(res, { id: up.id, name: up.name, file: `/media/${up.id}${up.ext}`, thumb: `/media/${up.id}.jpg`, ...stats });
    } catch (err) {
      await rm(up.file, { force: true });
      throw new HttpError(422, `영상을 분석하지 못했습니다: ${err.message}`);
    }
  }
  if (req.method === 'DELETE' && url.pathname.startsWith('/api/clips/')) {
    const id = path.basename(url.pathname).replace(/[^a-z0-9-]/gi, '');
    for (const f of await readdir(MEDIA)) if (id && f.startsWith(id + '.')) await rm(path.join(MEDIA, f), { force: true });
    return json(res, { ok: true });
  }

  if (route === 'POST /api/music') {
    const up = await saveUpload(req, url, AUDIO_EXT);
    try {
      const stats = await analyzeMusic(up.file);
      return json(res, { file: `/media/${up.id}${up.ext}`, name: up.name.replace(/\.[^.]+$/, ''), offset: 0, ...stats });
    } catch (err) {
      await rm(up.file, { force: true });
      throw new HttpError(422, `음악을 분석하지 못했습니다: ${err.message}`);
    }
  }

  if (route === 'POST /api/analyze') {
    const { clips = [] } = await readJson(req);
    return json(res, await analyzeClips(clips, (clip) => mediaPath(clip.thumb)));
  }

  if (route === 'POST /api/translate') {
    if (!aiConnected()) throw new HttpError(501, 'AI가 연결되지 않았어요. 번역을 직접 입력해 주세요.');
    const { text = '', from, to = [] } = await readJson(req);
    if (!text.trim()) throw new HttpError(400, '번역할 문장이 없습니다.');
    return json(res, { subs: await translate(text, from, to) });
  }

  if (route === 'POST /api/comment') {
    if (!aiConnected()) throw new HttpError(501, 'AI가 연결되지 않아 댓글을 반영하지 못했어요. 서버에 ANTHROPIC_API_KEY를 설정해 주세요.');
    const body = await readJson(req);
    if (!body.comment?.trim()) throw new HttpError(400, '댓글 내용이 없습니다.');
    return json(res, await answerComment(body));
  }

  if (route === 'POST /api/stabilize') {
    const { file, mode } = await readJson(req);
    if (!['tripod', 'horizon'].includes(mode)) throw new HttpError(400, '고정 모드가 올바르지 않습니다.');
    const input = mediaPath(file ?? '');
    if (!existsSync(input)) throw new HttpError(404, '원본 영상이 없습니다.');
    const outName = `${path.basename(input, path.extname(input))}.${mode}.mp4`;
    await stabilize(input, path.join(MEDIA, outName), mode);
    return json(res, { mode, file: `/media/${outName}`, zoom: mode === 'tripod' ? 12 : 6 });
  }

  if (route === 'POST /api/render') {
    const { props } = await readJson(req);
    if (!props?.clips?.length) throw new HttpError(400, '렌더할 컷이 없습니다.');
    return json(res, { job: startRender(props) });
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/render/')) {
    const job = jobs.get(path.basename(url.pathname));
    if (!job) throw new HttpError(404, '렌더 작업을 찾을 수 없습니다.');
    return json(res, job);
  }

  throw new HttpError(404, '없는 주소입니다.');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.startsWith('/media/')) return await sendFile(req, res, MEDIA, pathname.slice('/media/'.length));
    if (pathname.startsWith('/out/')) return await sendFile(req, res, OUT, pathname.slice('/out/'.length));
    if (!existsSync(DIST)) throw new HttpError(404, '화면이 아직 빌드되지 않았습니다. npm run build 또는 npm run dev를 실행하세요.');
    const asset = path.extname(pathname) ? pathname : '/index.html';
    return await sendFile(req, res, DIST, asset);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(err);
    if (!res.headersSent) json(res, { error: err.message || '서버 오류가 났습니다.' }, status);
    else res.end();
  }
});

server.listen(PORT, () => console.log(`담백 편집기 서버: http://localhost:${PORT} (AI ${aiConnected() ? '연결됨' : '미연결'})`));
