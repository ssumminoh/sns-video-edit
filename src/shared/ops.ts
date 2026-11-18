// 댓글에 대한 AI의 답(수정 목록)을 프로젝트에 반영한다.
// AI가 준 값은 그대로 믿지 않고, 항목마다 허용 범위 안으로 맞춘 뒤 적용한다.
import { applyRhythm, patchClip, setBpm, setIncluded } from './clips';
import { maxBeats } from './reel';
import type { CaptionLang, FixMode, Project, Rhythm, Transition } from './types';

export type Op = { clipId: string | null; field: string; value: string };

const num = (v: string, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
};
const oneOf = <T extends string>(v: string, options: readonly T[]) => (options.includes(v as T) ? (v as T) : null);
const bool = (v: string) => (v === 'true' ? true : v === 'false' ? false : null);

function applyClipOp(p: Project, id: string, field: string, value: string): Project | null {
  const clip = p.clips.find((c) => c.id === id);
  if (!clip) return null;
  switch (field) {
    case 'beats': {
      const n = num(value, 1, maxBeats(clip, p.bpm));
      return n === null ? null : patchClip(p, id, { beats: Math.round(n) });
    }
    case 'trimStart': {
      const n = num(value, 0, Math.max(0, clip.duration - 0.5));
      return n === null ? null : patchClip(p, id, { trimStart: n, beats: Math.min(clip.beats, maxBeats({ ...clip, trimStart: n }, p.bpm)) });
    }
    case 'speed': {
      const n = num(value, 0.5, 2);
      return n === null ? null : patchClip(p, id, { speed: n, beats: Math.min(clip.beats, maxBeats({ ...clip, speed: n }, p.bpm)) });
    }
    case 'fixMode': {
      const m = oneOf<FixMode>(value, ['none', 'horizon', 'tripod']);
      return m && patchClip(p, id, { fixMode: m });
    }
    case 'transition': {
      const t = oneOf<Transition>(value, ['cut', 'dissolve']);
      return t && patchClip(p, id, { transition: t });
    }
    case 'included': {
      const b = bool(value);
      return b === null ? null : setIncluded(p, id, b);
    }
    case 'captionMain':
      return patchClip(p, id, { caption: { ...clip.caption, main: value } });
    case 'captionSubs':
      return patchClip(p, id, { caption: { ...clip.caption, subs: value.split('\n').map((s) => s.trim()).filter(Boolean) } });
    default:
      return null;
  }
}

function applyProjectOp(p: Project, field: string, value: string): Project | null {
  switch (field) {
    case 'order': {
      const ids = value.split(',').map((s) => s.trim()).filter(Boolean);
      const current = new Set(p.order);
      const valid = ids.length === current.size && new Set(ids).size === ids.length && ids.every((id) => current.has(id));
      return valid ? { ...p, order: ids } : null;
    }
    case 'bpm': {
      const n = num(value, 40, 220);
      return n === null ? null : setBpm(p, Math.round(n));
    }
    case 'rhythm': {
      const r = oneOf<Rhythm>(value, ['slow', 'normal', 'chorus']);
      return r && applyRhythm(p, r);
    }
    case 'placeTitle':
      return { ...p, place: { ...p.place, title: value } };
    case 'placeSub':
      return { ...p, place: { ...p.place, sub: value } };
    case 'credit':
      return { ...p, credit: value };
    case 'captionLang': {
      const l = oneOf<CaptionLang>(value, ['ko', 'ja', 'en']);
      return l && { ...p, captionLang: l };
    }
    case 'musicVolume':
    case 'originalVolume': {
      const n = num(value, 0, 1);
      return n === null ? null : { ...p, [field]: n };
    }
    case 'musicOffset': {
      const n = num(value, 0, p.music?.duration ?? 0);
      return n === null || !p.music ? null : { ...p, music: { ...p.music, offset: n } };
    }
    case 'fadeOut': {
      const b = bool(value);
      return b === null ? null : { ...p, fadeOut: b };
    }
    default:
      return null;
  }
}

/** 수정 목록을 차례로 적용한다. 적용하지 못한 항목은 skipped로 돌려준다. */
export function applyOps(project: Project, ops: Op[]): { project: Project; applied: Op[]; skipped: Op[] } {
  const applied: Op[] = [];
  const skipped: Op[] = [];
  let p = project;
  for (const op of ops) {
    const next = op.clipId ? applyClipOp(p, op.clipId, op.field, op.value) : applyProjectOp(p, op.field, op.value);
    if (next) {
      p = next;
      applied.push(op);
    } else skipped.push(op);
  }
  return { project: p, applied, skipped };
}
