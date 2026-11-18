// 편집기 전체에서 쓰는 데이터 모양.

export type Fixability = 'fixed' | 'convertible' | 'hard';
export type FixMode = 'none' | 'horizon' | 'tripod';
export type Transition = 'cut' | 'dissolve';
export type Rhythm = 'slow' | 'normal' | 'chorus';
export type CaptionLang = 'ko' | 'ja' | 'en';

export type Clip = {
  id: string;
  name: string;
  /** 원본 영상 주소 (/media/...) */
  file: string;
  thumb: string;
  duration: number;
  width: number;
  height: number;
  /** 평균 밝기 0~255 */
  brightness: number;
  /** 평균 색 #rrggbb */
  color: string;
  /** 화면 움직임(작을수록 고정). 프레임 간 차이의 중앙값 */
  motion: number;
  /** 가장 안정적인 구간의 시작(초)과 길이(초) */
  steadyStart: number;
  steadyLen: number;
  fixability: Fixability;
  /** AI가 붙인 이름·장면 종류·샷 크기 (AI 미연결이면 비어 있음) */
  title?: string;
  scene?: string;
  shot?: string;

  included: boolean;
  /** 이 컷이 차지하는 박자 수 */
  beats: number;
  /** 원본에서 쓰기 시작할 지점(초) */
  trimStart: number;
  speed: number;
  fixMode: FixMode;
  /** 고정 변환을 마친 파일. 모드가 바뀌면 다시 만들어야 한다. */
  stabilized?: { mode: FixMode; file: string; zoom: number };
  /** 앞 컷에서 이 컷으로 넘어오는 방식 */
  transition: Transition;
  caption: { main: string; subs: string[] };
};

export type Mood = {
  name: string;
  /** 영상에서 읽은 것 */
  read: string;
  /** 이렇게 제안하는 이유 */
  why: string;
  rhythm: Rhythm;
  captionHint: string;
  colors: string[];
};

export type Music = { file: string; name: string; duration: number; bpm: number; offset: number };

/** 화면에 찍어 남긴 댓글. AI가 읽고 프로젝트를 고친 뒤 답을 단다. */
export type Comment = {
  id: string;
  /** 댓글을 남긴 단계 */
  step: string;
  /** 화면에서의 위치 (0~1) */
  x: number;
  y: number;
  target: { label: string; clipId?: string };
  text: string;
  status: 'pending' | 'done' | 'error';
  reply: string;
  /** 반영된 수정 개수 */
  applied: number;
};

export type Project = {
  clips: Clip[];
  /** 포함한 컷의 순서 (clip id) */
  order: string[];
  moods: Mood[];
  moodSource: 'ai' | 'heuristic' | null;
  suggestedOrder: string[];
  mood: number | null;
  ownMood: string;
  music: Music | null;
  bpm: number;
  rhythm: Rhythm;
  place: { title: string; sub: string };
  credit: string;
  captionLang: CaptionLang;
  musicVolume: number;
  originalVolume: number;
  fadeOut: boolean;
  comments: Comment[];
};

export const emptyProject = (): Project => ({
  clips: [],
  order: [],
  moods: [],
  moodSource: null,
  suggestedOrder: [],
  mood: null,
  ownMood: '',
  music: null,
  bpm: 84,
  rhythm: 'slow',
  place: { title: '', sub: '' },
  credit: '',
  captionLang: 'ko',
  musicVolume: 0.6,
  originalVolume: 0.35,
  fadeOut: true,
  comments: [],
});

// ---- 렌더(Remotion)로 넘기는 값 ----

export type ReelClip = {
  src: string;
  /** 원본에서 쓰기 시작할 프레임 */
  trimBefore: number;
  durationInFrames: number;
  playbackRate: number;
  transition: Transition;
  caption?: { main: string; subs: string[] };
};

export type ReelProps = {
  place: { title: string; sub?: string };
  credit?: string;
  clips: ReelClip[];
  music?: { src: string; trimBefore: number; volume: number };
  originalVolume: number;
  fadeOut: boolean;
};
