import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Backdrop, TopTag} from '../components/Chrome';
import {Subtitles} from '../components/Subtitles';
import {progress} from '../lib/anim';
import {Timeline} from '../lib/timeline';
import {C, FONT} from '../theme';
import timeline from '../data/video1.timeline.json';
import {ActionsScene} from './ActionsScene';
import {EndingScene} from './EndingScene';
import {MailStage} from './MailStage';

export const tl1 = timeline as unknown as Timeline;

/** 影片一：釣魚信辨識（旁白與配樂在輸出後以 FFmpeg 合併） */
export const Video1: React.FC = () => {
  const f = useCurrentFrame();
  const fadeOut = progress(f, tl1.durationInFrames - 20, 20);
  return (
    <AbsoluteFill style={{background: C.bg, fontFamily: FONT}}>
      <Backdrop />
      <MailStage tl={tl1} />
      <ActionsScene tl={tl1} />
      <EndingScene tl={tl1} />
      <TopTag label="資安宣導｜釣魚信辨識" />
      <Subtitles tl={tl1} />
      <AbsoluteFill style={{background: C.bgDeep, opacity: fadeOut}} />
    </AbsoluteFill>
  );
};
