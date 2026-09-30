import React from 'react';
import {Composition} from 'remotion';
import {tl1, Video1} from './video1/Video1';
import {tl2, Video2} from './video2/Video2';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Video1" component={Video1} durationInFrames={tl1.durationInFrames} fps={tl1.fps} width={tl1.width} height={tl1.height} />
    <Composition id="Video2" component={Video2} durationInFrames={tl2.durationInFrames} fps={tl2.fps} width={tl2.width} height={tl2.height} />
  </>
);
