// 프로젝트 → 타임라인 계산. 화면(미리보기)과 서버 렌더가 같은 함수를 쓴다.
import type { CaptionLang, Clip, Project, ReelClip, ReelProps, Rhythm } from './types';

export const FPS = 30;
export const CANVAS = { width: 1080, height: 1920 };
/** 디졸브로 겹치는 길이(프레임) */
export const DISSOLVE_FRAMES = 9;
/** 마지막 페이드아웃 길이(프레임) */
export const FADE_OUT_FRAMES = 30;

export const beatSeconds = (bpm: number) => 60 / Math.max(30, bpm);

export const orderedClips = (p: Project): Clip[] => {
  const byId = new Map(p.clips.map((c) => [c.id, c]));
  return p.order.map((id) => byId.get(id)).filter((c): c is Clip => !!c && c.included);
};

/** 원본 길이 안에서 이 컷이 쓸 수 있는 최대 박자 수 */
export const maxBeats = (clip: Clip, bpm: number) =>
  Math.max(1, Math.floor((clip.duration - clip.trimStart) / clip.speed / beatSeconds(bpm)));

export const RHYTHMS: Record<Rhythm, { name: string; sub: string; tip: string }> = {
  slow: {
    name: '느리게',
    sub: '컷당 4~8박',
    tip: '한 컷을 4박 이상 보여주면 보는 사람이 장면 안에 머무를 수 있어요. 첫 컷은 조금 길게, 마지막 컷은 8박으로 남겨 여운을 줍니다.',
  },
  normal: {
    name: '보통',
    sub: '컷당 2~4박',
    tip: '넓은 화면은 4박, 그 사이 컷은 2박으로 섞으면 지루하지 않으면서도 차분해요.',
  },
  chorus: {
    name: '가운데만 빠르게',
    sub: '중간 2박, 앞뒤는 길게',
    tip: '음악이 커지는 가운데 구간만 2박 컷으로 이어 붙이고 앞뒤는 느리게 둡니다. 빠른 구간은 색이 비슷한 컷끼리 묶어야 정신없지 않아요.',
  },
};

/** 박자 프리셋에 따라 순서대로 박자 수를 정한다. 원본이 짧으면 그만큼 줄인다. */
export function beatsForRhythm(rhythm: Rhythm, clips: Clip[], bpm: number): number[] {
  const n = clips.length;
  return clips.map((clip, i) => {
    const first = i === 0;
    const last = i === n - 1;
    let beats: number;
    if (rhythm === 'slow') beats = last ? 8 : first ? 6 : 4;
    else if (rhythm === 'normal') beats = first || last ? 4 : i % 2 === 1 ? 2 : 4;
    else beats = last ? 8 : first ? 6 : i >= n / 3 && i < (2 * n) / 3 ? 2 : 4;
    return Math.min(beats, maxBeats(clip, bpm));
  });
}

export const clipFrames = (clip: Clip, bpm: number) => Math.max(1, Math.round(clip.beats * beatSeconds(bpm) * FPS));

/** 각 컷이 타임라인에서 시작하는 프레임과 전체 길이. 디졸브는 앞 컷과 겹친다. */
export function layout(clips: Pick<ReelClip, 'durationInFrames' | 'transition'>[]) {
  let cursor = 0;
  const starts = clips.map((c, i) => {
    const overlap = i > 0 && c.transition === 'dissolve' ? Math.min(DISSOLVE_FRAMES, c.durationInFrames - 1) : 0;
    const from = Math.max(0, cursor - overlap);
    cursor = from + c.durationInFrames;
    return from;
  });
  return { starts, total: Math.max(1, cursor) };
}

/** 원문 언어에 따라 아래에 붙는 번역 줄: 한국어→영어, 일본어→영어·한국어, 영어→한국어 */
export const SUB_LANGS: Record<CaptionLang, { code: CaptionLang; label: string }[]> = {
  ko: [{ code: 'en', label: '영어' }],
  ja: [
    { code: 'en', label: '영어' },
    { code: 'ko', label: '한국어' },
  ],
  en: [{ code: 'ko', label: '한국어' }],
};

export function buildReelProps(p: Project): ReelProps {
  const subCount = SUB_LANGS[p.captionLang].length;
  const clips: ReelClip[] = orderedClips(p).map((clip, i) => {
    const useStabilized = clip.fixMode !== 'none' && clip.stabilized?.mode === clip.fixMode;
    const main = clip.caption.main.trim();
    return {
      src: useStabilized ? clip.stabilized!.file : clip.file,
      trimBefore: Math.round(clip.trimStart * FPS),
      durationInFrames: clipFrames(clip, p.bpm),
      playbackRate: clip.speed,
      transition: i === 0 ? 'cut' : clip.transition,
      caption: main ? { main, subs: clip.caption.subs.slice(0, subCount).map((s) => s.trim()).filter(Boolean) } : undefined,
    };
  });
  return {
    place: { title: p.place.title.trim(), sub: p.place.sub.trim() || undefined },
    credit: p.credit.trim() || undefined,
    clips,
    music: p.music ? { src: p.music.file, trimBefore: Math.round(p.music.offset * FPS), volume: p.musicVolume } : undefined,
    originalVolume: p.originalVolume,
    fadeOut: p.fadeOut,
  };
}

export const formatTime = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** 편집 프로그램식 시간 표기 00:00:SS:FF */
export const formatTimecode = (seconds: number) => {
  const frames = Math.max(0, Math.round(seconds * FPS));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `00:${pad(Math.floor(frames / FPS / 60))}:${pad(Math.floor(frames / FPS) % 60)}:${pad(frames % FPS)}`;
};

export const FIX_LABEL = { fixed: '원래 고정', convertible: '변환하면 가능', hard: '고정 어려움' } as const;
export const FIX_MODES = {
  tripod: { name: '삼각대 고정', zoom: 12, help: '배경 전체를 첫 프레임에 고정해요. 사람과 차만 움직입니다. 카메라를 따라 돌린 컷에는 쓸 수 없어요.' },
  horizon: { name: '창틀·수평만 고정', zoom: 6, help: '크게 흔들리는 것만 잡고 풍경은 흐르게 둬요. 버스나 지하철 안에서 찍은 컷에 맞아요.' },
  none: { name: '원본', zoom: 0, help: '보정하지 않고 그대로 씁니다.' },
} as const;

export type Note = { ok: boolean; text: string };

/** 지금 순서에 대한 메모. 제안일 뿐, 순서는 사용자가 정한다. */
export function orderNotes(clips: Clip[]): Note[] {
  if (clips.length === 0) return [];
  const notes: Note[] = [];
  const first = clips[0];
  const last = clips[clips.length - 1];
  notes.push(
    first.fixability === 'hard'
      ? { ok: false, text: '첫 컷이 많이 흔들려요. 고정된 컷으로 시작하면 어디인지 편하게 보여줄 수 있어요.' }
      : { ok: true, text: '첫 컷이 안정적이라 장소가 편하게 보여요.' },
  );
  const shots = clips.map((c) => c.shot).filter(Boolean);
  if (shots.length === clips.length) {
    let run = 1;
    let flagged = false;
    for (let i = 1; i < clips.length && !flagged; i++) {
      run = clips[i].shot === clips[i - 1].shot ? run + 1 : 1;
      if (run === 3) {
        notes.push({ ok: false, text: `${i - 1}~${i + 1}번이 모두 ${clips[i].shot}예요. 사이에 다른 크기의 컷을 넣으면 덜 단조로워요.` });
        flagged = true;
      }
    }
    if (!flagged) notes.push({ ok: true, text: '같은 크기의 화면이 3번 이상 이어지지 않아요.' });
  }
  let jump = 0;
  for (let i = 1; i < clips.length; i++) {
    if (Math.abs(clips[i].brightness - clips[i - 1].brightness) > 70 && jump === 0) jump = i;
  }
  notes.push(
    jump
      ? { ok: false, text: `${jump}번에서 ${jump + 1}번으로 넘어갈 때 밝기가 크게 바뀌어요. 디졸브를 쓰거나 순서를 옮겨보세요.` }
      : { ok: true, text: '이웃한 컷끼리 밝기가 자연스럽게 이어져요.' },
  );
  notes.push(
    last.fixability === 'hard'
      ? { ok: false, text: '마지막 컷이 흔들려요. 고정된 컷으로 닫으면 더 차분해요.' }
      : { ok: true, text: '마지막 컷이 안정적이라 여운이 남아요.' },
  );
  return notes;
}
