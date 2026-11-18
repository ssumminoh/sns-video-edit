import React from 'react';
import { Composition, staticFile } from 'remotion';
import { CANVAS, FPS, layout } from '../shared/reel';
import type { ReelProps } from '../shared/types';
import { Reel } from './Reel';

// 샘플 클립(npm run samples)으로 만든 기본 예시. 편집기에서는 서버가 --props로 실제 값을 넘긴다.
const sample = (n: number) => staticFile(`samples/clip${n}.mp4`);
const defaultProps: ReelProps = {
  place: { title: '서울, 올림픽공원', sub: '여름의 끝' },
  credit: 'TOIL, Gist - 몇 번의 여름',
  clips: [
    { src: sample(1), trimBefore: 0, durationInFrames: 90, playbackRate: 1, transition: 'cut', caption: { main: '오늘은 조금 천천히 걸었다', subs: ['I walked a little slower today'] } },
    { src: sample(2), trimBefore: 0, durationInFrames: 90, playbackRate: 1, transition: 'dissolve' },
    { src: sample(3), trimBefore: 0, durationInFrames: 90, playbackRate: 1, transition: 'cut', caption: { main: '今日は少しゆっくり歩いた', subs: ['I walked a little slower today', '오늘은 조금 천천히 걸었다'] } },
  ],
  originalVolume: 0.35,
  fadeOut: true,
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Reel"
    component={Reel}
    fps={FPS}
    width={CANVAS.width}
    height={CANVAS.height}
    defaultProps={defaultProps}
    calculateMetadata={({ props }) => ({ durationInFrames: layout(props.clips).total })}
  />
);
