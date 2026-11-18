import React, { useEffect, useState } from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import '@fontsource/noto-serif-kr/400.css';
import '@fontsource/noto-serif-jp/400.css';

export type Clip = { src: string; durationInFrames: number };
export type Caption = {
  /** 시작 프레임 */
  from: number;
  durationInFrames: number;
  /** 원문 가사·문장 (한국어·일본어·영어) */
  main: string;
  /** 원문 아래에 작게 들어가는 번역 줄 */
  subs: string[];
};
export type DambaekReelProps = {
  /** 영상 위에 들어가는 위치/도시. 예: { title: '서울, 올림픽공원', sub: '여름의 끝' } */
  place: { title: string; sub?: string };
  /** 첫 자막 위에 잠깐 보이는 음악 표기. 예: 'TOIL, Gist - 몇 번의 여름' */
  credit?: string;
  clips: Clip[];
  captions: Caption[];
};

// 레이아웃: 9:16(1080×1920) 검은 화면 정중앙에 1:1(1080×1080) 영상, 그 위에 위치/도시.
export const CANVAS = { width: 1080, height: 1920 };
const VIDEO_SIZE = 1080;
const VIDEO_TOP = (CANVAS.height - VIDEO_SIZE) / 2; // 420

const SERIF = '"Noto Serif KR", "Noto Serif JP", serif';

function useFonts(text: string) {
  // 명조체가 다 불러와진 다음에 프레임을 찍도록 렌더를 잠시 멈춘다.
  const [handle] = useState(() => delayRender('명조체 불러오는 중'));
  useEffect(() => {
    Promise.all([document.fonts.load(`400 40px ${SERIF}`, text), document.fonts.ready]).finally(() => continueRender(handle));
  }, [text, handle]);
}

function useFade(durationInFrames: number, fps: number, delay = 0.4, fade = 0.3) {
  const frame = useCurrentFrame();
  const a = Math.round(delay * fps);
  const f = Math.round(fade * fps);
  return interpolate(frame, [a, a + f, durationInFrames - f, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

const Place: React.FC<{ place: DambaekReelProps['place'] }> = ({ place }) => {
  useFonts(`${place.title} ${place.sub ?? ''}`);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: CANVAS.height - VIDEO_TOP + 56,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        fontFamily: SERIF,
        color: '#FFFFFF',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 44, letterSpacing: '0.04em' }}>{place.title}</div>
      {place.sub ? <div style={{ fontSize: 28, color: 'rgba(255,255,255,0.72)', letterSpacing: '0.04em' }}>{place.sub}</div> : null}
    </div>
  );
};

// 담백한 자막: 컷이 바뀌고 0.4초 뒤에 0.3초 동안 나타나고, 끝나기 0.3초 전에 사라진다. 영상 안 아래쪽.
const CaptionLine: React.FC<{ caption: Caption; fps: number; credit?: string }> = ({ caption, fps, credit }) => {
  const opacity = useFade(caption.durationInFrames, fps);
  useFonts([credit ?? '', caption.main, ...caption.subs].join(' '));
  return (
    <div
      style={{
        position: 'absolute',
        left: 120,
        right: 120,
        bottom: VIDEO_TOP + 72,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        textAlign: 'center',
        fontFamily: SERIF,
        letterSpacing: '0.03em',
        textShadow: '0 1px 10px rgba(0,0,0,0.45)',
        opacity,
      }}
    >
      {credit ? <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>〈 {credit} 〉</div> : null}
      <div style={{ fontSize: 40, color: '#FFFFFF' }}>{caption.main}</div>
      {caption.subs.map((s) => (
        <div key={s} style={{ fontSize: 27, color: 'rgba(255,255,255,0.8)' }}>
          {s}
        </div>
      ))}
    </div>
  );
};

export const DambaekReel: React.FC<DambaekReelProps & { fps?: number }> = ({ place, credit, clips, captions, fps = 30 }) => {
  let start = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      <Place place={place} />

      <div style={{ position: 'absolute', left: 0, top: VIDEO_TOP, width: VIDEO_SIZE, height: VIDEO_SIZE, overflow: 'hidden' }}>
        {clips.map((clip) => {
          const from = start;
          start += clip.durationInFrames;
          return (
            <Sequence key={`${clip.src}-${from}`} from={from} durationInFrames={clip.durationInFrames}>
              <OffthreadVideo
                src={clip.src.startsWith('http') ? clip.src : staticFile(clip.src)}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </Sequence>
          );
        })}
        {/* 밝은 화면에서도 자막이 읽히도록 영상 아래쪽만 살짝 어둡게 */}
        <AbsoluteFill
          style={{ top: 'auto', height: '45%', background: 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.45) 70%, rgba(0,0,0,0.5))' }}
        />
      </div>

      {captions.map((c, i) => (
        <Sequence key={`${c.from}-${c.main}`} from={c.from} durationInFrames={c.durationInFrames}>
          <CaptionLine caption={c} fps={fps} credit={i === 0 ? credit : undefined} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
