import React, { useEffect, useState } from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, continueRender, delayRender, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import '@noonnu/chosun-sm/index.css';
import '@fontsource/shippori-mincho/400.css';
import '@fontsource/eb-garamond/400.css';
import './fonts.css';
import { CANVAS, DISSOLVE_FRAMES, FADE_OUT_FRAMES, layout } from '../shared/reel';
import type { ReelClip, ReelProps } from '../shared/types';

// 화면 구성: 9:16 검은 화면 정중앙에 1:1 영상, 그 위에 위치/도시, 영상 안 아래쪽에 자막.
const VIDEO_SIZE = CANVAS.width;
const VIDEO_TOP = (CANVAS.height - VIDEO_SIZE) / 2;

const TITLE_FONT = '"UnDinaru", sans-serif';
// 영어는 EB Garamond, 일본어는 Shippori Mincho, 한국어는 조선신명조가 받는다.
const CAPTION_FONT = '"EB Garamond", "Shippori Mincho", "ChosunSm", serif';

/** 글꼴이 다 불러와진 다음에 프레임을 찍도록 렌더를 잠시 멈춘다. */
function useFont(font: string, text: string) {
  const [handle] = useState(() => delayRender(`글꼴 불러오는 중: ${font}`));
  useEffect(() => {
    Promise.all([document.fonts.load(`400 40px ${font}`, text || '가'), document.fonts.ready]).finally(() => continueRender(handle));
  }, [font, text, handle]);
}

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const Place: React.FC<{ place: ReelProps['place'] }> = ({ place }) => {
  useFont(TITLE_FONT, `${place.title} ${place.sub ?? ''}`);
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
        fontFamily: TITLE_FONT,
        color: '#FFFFFF',
        textAlign: 'center',
        letterSpacing: '0.04em',
      }}
    >
      <div style={{ fontSize: 44 }}>{place.title}</div>
      {place.sub ? <div style={{ fontSize: 28, color: 'rgba(255,255,255,0.72)' }}>{place.sub}</div> : null}
    </div>
  );
};

/** 컷이 바뀌고 0.4초 뒤에 0.3초 동안 나타나고, 끝나기 0.3초 전에 사라진다. */
const Caption: React.FC<{ caption: NonNullable<ReelClip['caption']>; durationInFrames: number; credit?: string }> = ({ caption, durationInFrames, credit }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delay = Math.round(0.4 * fps);
  const fade = Math.round(0.3 * fps);
  const end = Math.max(delay + fade + 1, durationInFrames - fade);
  const opacity = interpolate(frame, [delay, delay + fade, end, end + fade], [0, 1, 1, 0], clamp);
  useFont(CAPTION_FONT, [credit ?? '', caption.main, ...caption.subs].join(' '));
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
        fontFamily: CAPTION_FONT,
        letterSpacing: '0.03em',
        textShadow: '0 1px 10px rgba(0,0,0,0.45)',
        opacity,
      }}
    >
      {credit ? <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>〈 {credit} 〉</div> : null}
      <div style={{ fontSize: 40, color: '#FFFFFF' }}>{caption.main}</div>
      {caption.subs.map((s, i) => (
        <div key={i} style={{ fontSize: 27, color: 'rgba(255,255,255,0.8)' }}>
          {s}
        </div>
      ))}
    </div>
  );
};

const ClipVideo: React.FC<{ clip: ReelClip; volume: number; dissolveIn: boolean }> = ({ clip, volume, dissolveIn }) => {
  const frame = useCurrentFrame();
  const opacity = dissolveIn ? interpolate(frame, [0, DISSOLVE_FRAMES], [0, 1], clamp) : 1;
  return (
    <OffthreadVideo
      src={clip.src}
      trimBefore={clip.trimBefore}
      playbackRate={clip.playbackRate}
      volume={volume}
      style={{ width: '100%', height: '100%', objectFit: 'cover', opacity }}
    />
  );
};

export const Reel: React.FC<ReelProps> = ({ place, credit, clips, music, originalVolume, fadeOut }) => {
  const frame = useCurrentFrame();
  const { starts, total } = layout(clips);
  const out = fadeOut ? interpolate(frame, [total - FADE_OUT_FRAMES, total], [1, 0], clamp) : 1;
  const firstCaption = clips.findIndex((c) => c.caption);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      {place.title ? <Place place={place} /> : null}

      <div style={{ position: 'absolute', left: 0, top: VIDEO_TOP, width: VIDEO_SIZE, height: VIDEO_SIZE, overflow: 'hidden', opacity: out }}>
        {clips.map((clip, i) => (
          <Sequence key={`${i}-${clip.src}`} from={starts[i]} durationInFrames={clip.durationInFrames}>
            <ClipVideo clip={clip} volume={originalVolume * out} dissolveIn={i > 0 && clip.transition === 'dissolve'} />
          </Sequence>
        ))}
        {/* 밝은 화면에서도 자막이 읽히도록 영상 아래쪽만 살짝 어둡게 */}
        <AbsoluteFill style={{ top: 'auto', height: '45%', background: 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.45) 70%, rgba(0,0,0,0.5))' }} />
      </div>

      {clips.map((clip, i) =>
        clip.caption ? (
          <Sequence key={`cap-${i}`} from={starts[i]} durationInFrames={clip.durationInFrames}>
            <Caption caption={clip.caption} durationInFrames={clip.durationInFrames} credit={i === firstCaption ? credit : undefined} />
          </Sequence>
        ) : null,
      )}

      {music ? <Audio src={music.src} trimBefore={music.trimBefore} volume={music.volume * out} /> : null}
    </AbsoluteFill>
  );
};
