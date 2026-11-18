// 서버 호출 모음. 실패하면 서버가 준 한국어 메시지를 Error로 던진다.
import type { Op } from './shared/ops';
import type { CaptionLang, Clip, FixMode, Mood, Music, Project, ReelProps } from './shared/types';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new Error('서버에 연결하지 못했어요. 서버가 켜져 있는지 확인해 주세요.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `요청에 실패했어요 (${res.status})`);
  return body as T;
}

const post = <T,>(path: string, data: unknown) =>
  call<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

export type ClipStats = Pick<Clip, 'id' | 'name' | 'file' | 'thumb' | 'duration' | 'width' | 'height' | 'brightness' | 'color' | 'motion' | 'steadyStart' | 'steadyLen' | 'fixability'>;
export type Analysis = { source: 'ai' | 'heuristic'; clips: Pick<Clip, 'id' | 'title' | 'scene' | 'shot'>[]; moods: Mood[]; order: string[]; warning?: string };
export type RenderJob = { status: 'rendering' | 'done' | 'error'; progress: number; file: string | null; error: string | null };

export type HistoryEntry = { at: string; kind: string; summary: string };

export const api = {
  loadProject: () => call<{ project: Project | null; ai: boolean }>('/api/project'),
  saveProject: (project: Project) => call('/api/project', { method: 'PUT', body: JSON.stringify(project) }),
  uploadClip: (file: File) => call<ClipStats>(`/api/clips?name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file }),
  deleteClip: (id: string) => call(`/api/clips/${id}`, { method: 'DELETE' }),
  uploadMusic: (file: File) => call<Music>(`/api/music?name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file }),
  analyze: (clips: Clip[]) => post<Analysis>('/api/analyze', { clips }),
  translate: (text: string, from: CaptionLang, to: CaptionLang[]) => post<{ subs: string[] }>('/api/translate', { text, from, to }),
  stabilize: (file: string, mode: FixMode) => post<NonNullable<Clip['stabilized']>>('/api/stabilize', { file, mode }),
  comment: (body: { comment: string; screen: string; target: { label: string; clipId?: string }; project: unknown }) => post<{ reply: string; ops: Op[] }>('/api/comment', body),
  history: () => call<{ entries: HistoryEntry[]; taste: string }>('/api/history'),
  saveTaste: (taste: string) => call('/api/taste', { method: 'PUT', body: JSON.stringify({ taste }) }),
  refreshTaste: () => post<{ taste: string }>('/api/taste/refresh', {}),
  render: (props: ReelProps) => post<{ job: string }>('/api/render', { props }),
  renderStatus: (job: string) => call<RenderJob>(`/api/render/${job}`),
};

/**
 * 수정 기록 한 줄을 남긴다. 사용자가 AI의 판단을 고쳤거나 스스로 방향을 정한 순간에 부른다.
 * 기록에 실패해도 편집은 계속되어야 하므로 오류를 삼킨다.
 */
export function logHistory(kind: string, summary: string) {
  post('/api/history', { kind, summary }).catch(() => {});
}
