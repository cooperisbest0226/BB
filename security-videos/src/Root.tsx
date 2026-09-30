import React from 'react';
import {Composition} from 'remotion';
import {tl1, Video1} from './video1/Video1';
import {tl2, Video2} from './video2/Video2';
import {tl3, Video3} from './video3/Video3';
import {tl4, Video4} from './video4/Video4';
import {tl5, Video5} from './video5/Video5';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Video1" component={Video1} durationInFrames={tl1.durationInFrames} fps={tl1.fps} width={tl1.width} height={tl1.height} />
    <Composition id="Video2" component={Video2} durationInFrames={tl2.durationInFrames} fps={tl2.fps} width={tl2.width} height={tl2.height} />
    <Composition id="Video3" component={Video3} durationInFrames={tl3.durationInFrames} fps={tl3.fps} width={tl3.width} height={tl3.height} />
    <Composition id="Video4" component={Video4} durationInFrames={tl4.durationInFrames} fps={tl4.fps} width={tl4.width} height={tl4.height} />
    <Composition id="Video5" component={Video5} durationInFrames={tl5.durationInFrames} fps={tl5.fps} width={tl5.width} height={tl5.height} />
  </>
);
