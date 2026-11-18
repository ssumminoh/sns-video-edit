// 영상에서 분위기를 읽는다.
// Claude API 키가 있으면 썸네일을 보고 장면 종류·분위기·순서를 제안하고,
// 없으면 색·밝기·움직임 수치만으로 제안한다.
import { readFile } from 'node:fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

const MODEL = 'claude-opus-5-5';

export const aiConnected = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client;
const anthropic = () => (client ??= new Anthropic());

const Rhythm = z.enum(['slow', 'normal', 'chorus']);
const Analysis = z.object({
  clips: z.array(
    z.object({
      id: z.string(),
      title: z.string().describe('장면을 부르는 짧은 한국어 이름. 예: 언덕 위 두 사람'),
      scene: z.enum(['공간·풍경', '손·디테일', '음식·음료', '걷기·이동', '사람·얼굴', '창밖·빛']),
      shot: z.enum(['와이드', '미디엄', '클로즈업']),
    }),
  ),
  moods: z.array(
    z.object({
      name: z.string().describe('이 영상들만의 분위기를 한 줄로. 일반적인 장르 이름은 쓰지 않는다.'),
      read: z.string().describe('영상에서 실제로 보이는 것: 빛, 색, 사람, 카메라'),
      why: z.string().describe('이 분위기로 편집하면 좋은 이유와 방법'),
      rhythm: Rhythm.describe('slow: 컷당 4~8박, normal: 2~4박, chorus: 가운데만 빠르게'),
      captionHint: z.string().describe('어울리는 자막 방식 한 줄'),
    }),
  ),
  order: z.array(z.string()).describe('추천하는 컷 순서 (clip id). 모든 id를 한 번씩 포함한다.'),
});

const SYSTEM = `당신은 브이로그 원본으로 담백한 릴스를 만드는 편집자를 돕습니다.
사용자가 찍어둔 영상의 썸네일을 보고, 그 영상들에 실제로 담긴 것에서 분위기를 읽어 제안합니다.
정해진 템플릿이나 흔한 장르 이름을 붙이지 말고, 이 영상들에서만 나올 수 있는 구체적인 말로 씁니다.
분위기는 서로 다른 방향으로 3가지를 제안합니다. 모든 글은 한국어 해요체로 짧게 씁니다.
순서는 고정된 넓은 화면으로 시작하고 끝내며, 같은 크기의 화면이 3번 이상 이어지지 않게 잡습니다.`;

async function analyzeWithClaude(clips, readThumb) {
  const content = [];
  for (const clip of clips) {
    content.push({ type: 'text', text: `id: ${clip.id} · 길이 ${clip.duration.toFixed(1)}초 · 밝기 ${clip.brightness}/255 · 움직임 ${clip.motion} · ${clip.fixability}` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: (await readThumb(clip)).toString('base64') } });
  }
  content.push({ type: 'text', text: '각 영상의 이름·장면 종류·샷 크기, 분위기 제안 3가지, 추천 순서를 주세요.' });

  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: 'user', content }],
    output_config: { effort: 'medium', format: zodOutputFormat(Analysis) },
  });
  if (response.stop_reason === 'refusal' || !response.parsed_output) throw new Error('AI가 분석 결과를 돌려주지 않았습니다.');
  return response.parsed_output;
}

// ---- 수치만으로 내는 제안 (AI 미연결) ----

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function tone(clips) {
  const rgb = clips.map((c) => hexToRgb(c.color));
  const [r, g, b] = [0, 1, 2].map((i) => avg(rgb.map((v) => v[i])));
  const bright = avg(clips.map((c) => c.brightness));
  const light = bright < 70 ? '어두운 밤 빛' : bright < 125 ? '낮게 깔린 빛' : '밝은 낮 빛';
  const color = g > r + 8 && g > b + 8 ? '초록이 많은 화면' : b > r + 8 ? '푸른 기운' : r > b + 12 ? '따뜻한 주황 기운' : '담담한 무채색';
  return { light, color, bright };
}

function heuristic(clips) {
  const t = tone(clips);
  const fixed = clips.filter((c) => c.fixability === 'fixed').length;
  const hard = clips.filter((c) => c.fixability === 'hard').length;
  const spread = Math.max(...clips.map((c) => c.brightness)) - Math.min(...clips.map((c) => c.brightness));
  const colors = [...clips].sort((a, b) => b.brightness - a.brightness).map((c) => c.color);
  const pick = (n) => colors.filter((_, i) => i % Math.max(1, Math.floor(colors.length / n)) === 0).slice(0, n);

  const moods = [
    {
      name: `${t.light}, ${t.color}`,
      read: `영상 ${clips.length}개의 평균 밝기는 ${Math.round(t.bright)}/255이고, 거의 고정된 컷이 ${fixed}개 있어요.`,
      why: fixed >= clips.length / 2 ? '고정된 컷이 많아요. 한 컷을 길게 두고 화면 안에서 사람이 움직이게 두면 원본의 고요함이 살아요.' : '흔들리는 컷이 섞여 있어요. 안정적인 구간만 골라 조금 짧게 이으면 차분하게 보여요.',
      rhythm: fixed >= clips.length / 2 ? 'slow' : 'normal',
      captionHint: '짧은 독백 한 줄',
      colors: pick(4),
    },
  ];
  if (spread > 60) {
    moods.push({
      name: '빛이 바뀌어 가는 시간',
      read: `가장 밝은 컷과 가장 어두운 컷의 밝기 차이가 ${spread}이에요. 시간이 흐른 게 화면에 담겨 있어요.`,
      why: '밝은 컷에서 어두운 컷으로 차례로 이으면 빛이 바뀌는 것 자체가 이야기가 돼요. 순서를 섞지 않는 편이 좋아요.',
      rhythm: 'slow',
      captionHint: '노랫말 한 줄씩',
      colors: [colors[0], colors[Math.floor(colors.length / 2)], colors[colors.length - 1]],
    });
  }
  if (hard > 0) {
    moods.push({
      name: '멈춘 화면 사이로 지나가는 움직임',
      read: `많이 움직이는 컷이 ${hard}개, 고정된 컷이 ${fixed}개예요.`,
      why: '움직이는 컷과 멈춘 컷을 번갈아 두면 리듬이 생겨요. 움직이는 컷은 2박으로 짧게 쓰세요.',
      rhythm: 'chorus',
      captionHint: '가사 원문과 번역 두 줄',
      colors: pick(3),
    });
  }

  // 순서: 밝은 컷에서 어두운 컷으로, 가장 안정적인 컷 둘을 처음과 끝에.
  const byLight = [...clips].sort((a, b) => b.brightness - a.brightness);
  const steady = [...clips].sort((a, b) => a.motion - b.motion).slice(0, 2);
  const rest = byLight.filter((c) => !steady.includes(c));
  const [first, last] = steady.length === 2 && steady[0].brightness < steady[1].brightness ? [steady[1], steady[0]] : steady;
  const order = [first, ...rest, last].filter(Boolean).map((c) => c.id);

  return { clips: [], moods, order: [...new Set(order)] };
}

/** @returns {Promise<{source: 'ai'|'heuristic', clips: object[], moods: object[], order: string[], warning?: string}>} */
export async function analyzeClips(clips, thumbPath) {
  if (clips.length === 0) return { source: 'heuristic', clips: [], moods: [], order: [] };
  const base = heuristic(clips);
  if (!aiConnected()) return { source: 'heuristic', ...base };
  try {
    const out = await analyzeWithClaude(clips, (clip) => readFile(thumbPath(clip)));
    const colors = base.moods[0].colors;
    const ids = new Set(clips.map((c) => c.id));
    const order = out.order.filter((id) => ids.has(id));
    return {
      source: 'ai',
      clips: out.clips.filter((c) => ids.has(c.id)),
      moods: out.moods.slice(0, 3).map((m) => ({ ...m, colors })),
      order: order.length === clips.length ? order : base.order,
    };
  } catch (err) {
    const reason =
      err instanceof Anthropic.AuthenticationError ? 'API 키가 올바르지 않아요.'
      : err instanceof Anthropic.RateLimitError ? '요청이 많아 잠시 뒤에 다시 시도해야 해요.'
      : err instanceof Anthropic.APIConnectionError ? 'AI 서버에 연결하지 못했어요.'
      : err.message;
    return { source: 'heuristic', ...base, warning: `AI 분석 실패: ${reason} 색과 움직임만으로 제안했어요.` };
  }
}

const LANG = { ko: '한국어', en: '영어', ja: '일본어' };

/** 자막 원문을 아래에 붙일 언어들로 옮긴다. */
export async function translate(text, from, to) {
  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 2000,
    system: '영상 자막 번역가입니다. 감성적인 브이로그 자막이나 노랫말 한 줄을 뜻과 말맛을 살려 짧게 옮깁니다. 설명 없이 번역만 줍니다.',
    messages: [{ role: 'user', content: `${LANG[from]} 원문: ${text}\n옮길 언어(순서대로): ${to.map((c) => LANG[c]).join(', ')}` }],
    output_config: { effort: 'low', format: zodOutputFormat(z.object({ subs: z.array(z.string()) })) },
  });
  if (response.stop_reason === 'refusal' || !response.parsed_output) throw new Error('번역하지 못했습니다.');
  return response.parsed_output.subs.slice(0, to.length);
}

// ---- 댓글로 수정하기 ----

const CLIP_FIELDS = ['beats', 'trimStart', 'speed', 'fixMode', 'transition', 'included', 'captionMain', 'captionSubs'];
const PROJECT_FIELDS = ['order', 'bpm', 'rhythm', 'placeTitle', 'placeSub', 'credit', 'captionLang', 'musicVolume', 'originalVolume', 'musicOffset', 'fadeOut'];

const CommentAnswer = z.object({
  reply: z.string().describe('무엇을 어떻게 바꿨는지, 또는 왜 못 바꾸는지 한두 문장. 한국어 해요체.'),
  ops: z.array(
    z.object({
      clipId: z.string().nullable().describe('컷 하나를 고칠 때는 그 컷의 id, 프로젝트 전체 값을 고칠 때는 null'),
      field: z.enum([...CLIP_FIELDS, ...PROJECT_FIELDS]),
      value: z.string().describe('새 값을 문자열로'),
    }),
  ),
});

const COMMENT_SYSTEM = `당신은 릴스 편집기 안에서 사용자가 화면에 남긴 댓글을 읽고 편집 내용을 직접 고치는 편집 조수입니다.
댓글과 댓글이 찍힌 위치, 지금 프로젝트 상태를 받습니다. 댓글이 요구하는 만큼만 고치고, 요구하지 않은 것은 건드리지 않습니다.

컷(clipId 지정)에서 고칠 수 있는 값:
- beats: 이 컷의 박자 수 (정수, 1 이상)
- trimStart: 원본에서 쓰기 시작할 지점(초)
- speed: 재생 속도 (1, 1.5, 2)
- fixMode: none(원본) | horizon(창틀·수평만 고정) | tripod(삼각대 고정)
- transition: 앞 컷에서 넘어오는 방식. cut | dissolve
- included: 영상에 넣을지. true | false
- captionMain: 자막 원문 (빈 문자열이면 자막 없음)
- captionSubs: 원문 아래 번역 줄. 여러 줄이면 줄바꿈으로 구분

프로젝트 전체(clipId는 null)에서 고칠 수 있는 값:
- order: 컷 순서. 지금 order에 있는 모든 id를 쉼표로 이어서
- bpm: 정수 · rhythm: slow | normal | chorus (컷마다 박자 수를 다시 매김)
- placeTitle, placeSub: 영상 위 위치/도시 두 줄 · credit: 음악 표기
- captionLang: 자막 원문 언어. ko | ja | en (ko→영어 번역 1줄, ja→영어·한국어 2줄, en→한국어 1줄)
- musicVolume, originalVolume: 0~1 · musicOffset: 음악 시작 지점(초) · fadeOut: true | false

자막을 새로 쓰거나 고치면 captionLang에 맞는 번역 줄도 함께 채웁니다.
위 목록으로 할 수 없는 요청(화면 디자인 변경, 새 영상 촬영 등)은 ops를 비우고 reply에 이유와 대신 할 수 있는 것을 씁니다.`;

/** 댓글 하나를 읽고 수정 목록을 돌려준다. 실제 적용과 값 검증은 화면 쪽(src/shared/ops.ts)에서 한다. */
export async function answerComment({ comment, target, screen, project }) {
  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system: COMMENT_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `지금 프로젝트:\n${JSON.stringify(project)}\n\n댓글이 찍힌 화면: ${screen}\n댓글이 찍힌 곳: ${target.label}${target.clipId ? ` (컷 id: ${target.clipId})` : ''}\n\n댓글: ${comment}`,
      },
    ],
    output_config: { effort: 'medium', format: zodOutputFormat(CommentAnswer) },
  });
  if (response.stop_reason === 'refusal' || !response.parsed_output) throw new Error('AI가 답하지 못했습니다.');
  return response.parsed_output;
}
