// 수정 기록과 취향 메모.
// 사용자가 AI의 판단을 고칠 때마다(댓글, 추천과 다른 선택) 한 줄씩 쌓고,
// 그 기록을 바탕으로 취향 메모를 고쳐서 다음 제안에 반영한다. 프로젝트와 따로 보관해 계속 이어진다.
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from '../scripts/lib/tools.mjs';

const DATA = path.join(ROOT, 'data');
const HISTORY_FILE = path.join(DATA, 'history.json');
const TASTE_FILE = path.join(DATA, 'taste.md');
const DEFAULT_TASTE_FILE = path.join(ROOT, 'server', 'taste-default.md');
const MAX_ENTRIES = 500;

export async function readHistory() {
  if (!existsSync(HISTORY_FILE)) return [];
  try {
    return JSON.parse(await readFile(HISTORY_FILE, 'utf8'));
  } catch {
    return [];
  }
}

/** @param {{kind: string, summary: string}} entry */
export async function appendHistory(entry) {
  const entries = await readHistory();
  entries.push({ at: new Date().toISOString(), kind: String(entry.kind).slice(0, 40), summary: String(entry.summary).slice(0, 500) });
  await mkdir(DATA, { recursive: true });
  await writeFile(HISTORY_FILE, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  return entries.length;
}

export const readTaste = () => readFile(existsSync(TASTE_FILE) ? TASTE_FILE : DEFAULT_TASTE_FILE, 'utf8');

export async function writeTaste(text) {
  await mkdir(DATA, { recursive: true });
  await writeFile(TASTE_FILE, text);
}

/** AI에게 함께 보내는 글: 취향 메모와 최근 수정 기록. */
export async function tasteContext(recent = 30) {
  const [taste, entries] = await Promise.all([readTaste(), readHistory()]);
  const lines = entries.slice(-recent).map((e) => `- ${e.at.slice(0, 10)} [${e.kind}] ${e.summary}`);
  return `<취향 메모>\n${taste.trim()}\n</취향 메모>\n\n<최근 수정 기록>\n${lines.join('\n') || '(아직 없음)'}\n</최근 수정 기록>`;
}
