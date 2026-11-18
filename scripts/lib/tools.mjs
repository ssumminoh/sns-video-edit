// 편집기가 쓰는 외부 도구(크롬, FFmpeg, yt-dlp, Whisper)의 위치를 한곳에서 찾는다.
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function which(bin) {
  try {
    return execFileSync('which', [bin], { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

function firstExisting(list) {
  return list.find((p) => p && existsSync(p)) ?? null;
}

// 렌더링용 헤드리스 크롬. 환경 변수 > 미리 설치된 Playwright 브라우저 순서로 찾는다.
// 아무것도 없으면 null을 돌려주고, 그때는 Remotion/Hyperframes가 각자 크롬을 내려받는다.
export function headlessShell() {
  return firstExisting([
    process.env.SNS_HEADLESS_SHELL,
    '/opt/pw-browsers/chromium_headless_shell-1243/chrome-linux/headless_shell',
    '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
  ]);
}

export function chrome() {
  return firstExisting([
    process.env.SNS_CHROME,
    '/opt/pw-browsers/chromium/chrome-linux/chrome',
    '/opt/pw-browsers/chromium-1243/chrome-linux/chrome',
    '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
    which('chromium'),
    which('google-chrome'),
  ]);
}

export function ffmpeg() {
  return process.env.SNS_FFMPEG ?? which('ffmpeg');
}

export function ffprobe() {
  return process.env.SNS_FFPROBE ?? which('ffprobe');
}

export function ytDlp() {
  return firstExisting([path.join(ROOT, '.venv', 'bin', 'yt-dlp'), which('yt-dlp')]);
}

export const WHISPER_DIR = path.join(ROOT, '.whisper', 'whisper.cpp');
export const WHISPER_VERSION = '1.5.5';
export const WHISPER_MODEL = process.env.SNS_WHISPER_MODEL ?? 'small';
