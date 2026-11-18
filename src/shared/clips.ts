// 컷을 프로젝트에 넣고 빼고 고치는 작은 함수들.
import type { ClipStats } from '../api';
import { beatsForRhythm, maxBeats, orderedClips } from './reel';
import type { Clip, Project, Rhythm } from './types';

export type Verdict = { kind: 'good' | 'trim' | 'exclude'; reason: string };

/** 쓸 만한 컷인지 수치로 판단한다. */
export function verdict(c: Pick<Clip, 'duration' | 'brightness' | 'fixability'>): Verdict {
  if (c.duration < 2) return { kind: 'exclude', reason: '2초 미만' };
  if (c.brightness < 25) return { kind: 'exclude', reason: '너무 어두움' };
  if (c.fixability === 'hard') return { kind: 'trim', reason: '많이 흔들림' };
  if (c.brightness < 45) return { kind: 'trim', reason: '어두움' };
  return { kind: 'good', reason: '' };
}

export function newClip(stats: ClipStats): Clip {
  return {
    ...stats,
    included: verdict(stats).kind !== 'exclude',
    beats: 4,
    trimStart: stats.steadyStart,
    speed: 1,
    fixMode: 'none',
    transition: 'cut',
    caption: { main: '', subs: [] },
  };
}

export const addClip = (p: Project, clip: Clip): Project => ({
  ...p,
  clips: [...p.clips, clip],
  order: clip.included ? [...p.order, clip.id] : p.order,
});

export const removeClip = (p: Project, id: string): Project => ({
  ...p,
  clips: p.clips.filter((c) => c.id !== id),
  order: p.order.filter((x) => x !== id),
  suggestedOrder: p.suggestedOrder.filter((x) => x !== id),
});

export const patchClip = (p: Project, id: string, patch: Partial<Clip>): Project => ({
  ...p,
  clips: p.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)),
});

export function setIncluded(p: Project, id: string, included: boolean): Project {
  const order = included ? (p.order.includes(id) ? p.order : [...p.order, id]) : p.order.filter((x) => x !== id);
  return { ...patchClip(p, id, { included }), order };
}

export function moveInOrder(p: Project, from: number, to: number): Project {
  if (from === to || to < 0 || to >= p.order.length) return p;
  const order = [...p.order];
  const [id] = order.splice(from, 1);
  order.splice(to, 0, id);
  return { ...p, order };
}

/** 박자 프리셋을 지금 순서에 적용한다. */
export function applyRhythm(p: Project, rhythm: Rhythm): Project {
  const clips = orderedClips(p);
  const beats = beatsForRhythm(rhythm, clips, p.bpm);
  const byId = new Map(clips.map((c, i) => [c.id, beats[i]]));
  return { ...p, rhythm, clips: p.clips.map((c) => (byId.has(c.id) ? { ...c, beats: byId.get(c.id)! } : c)) };
}

/** BPM이 바뀌면 원본 길이를 넘는 컷의 박자 수를 줄인다. */
export const setBpm = (p: Project, bpm: number): Project => ({
  ...p,
  bpm,
  clips: p.clips.map((c) => ({ ...c, beats: Math.min(c.beats, maxBeats(c, bpm)) })),
});
