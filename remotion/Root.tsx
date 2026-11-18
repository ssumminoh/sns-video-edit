import React from 'react';
import { Composition } from 'remotion';
import { CANVAS, DambaekReel, type DambaekReelProps } from './DambaekReel';

const FPS = 30;

// 샘플 클립(npm run samples)으로 만든 기본 예시. 실제 편집에서는 --props로 위치·음악·클립·자막을 넘긴다.
const defaultProps: DambaekReelProps = {
  place: { title: '서울, 올림픽공원', sub: '여름의 끝' },
  credit: 'TOIL, Gist - 몇 번의 여름',
  clips: [
    { src: 'samples/clip1.mp4', durationInFrames: 90 },
    { src: 'samples/clip2.mp4', durationInFrames: 90 },
    { src: 'samples/clip3.mp4', durationInFrames: 90 },
  ],
  captions: [
    { from: 0, durationInFrames: 90, main: '오늘은 조금 천천히 걸었다', subs: ['I walked a little slower today'] },
    { from: 180, durationInFrames: 90, main: '今日は少しゆっくり歩いた', subs: ['I walked a little slower today', '오늘은 조금 천천히 걸었다'] },
  ],
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="DambaekReel"
    component={DambaekReel}
    fps={FPS}
    width={CANVAS.width}
    height={CANVAS.height}
    defaultProps={defaultProps}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.max(1, props.clips.reduce((sum, c) => sum + c.durationInFrames, 0)),
    })}
  />
);
