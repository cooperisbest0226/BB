import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Backdrop, TopTag} from '../components/Chrome';
import {Subtitles} from '../components/Subtitles';
import {progress} from '../lib/anim';
import {Timeline} from '../lib/timeline';
import {C, FONT} from '../theme';
import timeline from '../data/video2.timeline.json';
import {CategoriesScene} from './CategoriesScene';
import {ChatScene} from './ChatScene';
import {DeidScene} from './DeidScene';
import {ReviewScene} from './ReviewScene';
import {ToolsScene} from './ToolsScene';
import {UploadScene} from './UploadScene';

export const tl2 = timeline as unknown as Timeline;

/** 影片二：AI 工具使用規範（旁白與配樂在輸出後以 FFmpeg 合併） */
export const Video2: React.FC = () => {
  const f = useCurrentFrame();
  const fadeOut = progress(f, tl2.durationInFrames - 20, 20);
  return (
    <AbsoluteFill style={{background: C.bg, fontFamily: FONT}}>
      <Backdrop />
      <UploadScene tl={tl2} />
      <ChatScene tl={tl2} />
      <CategoriesScene tl={tl2} />
      <DeidScene tl={tl2} />
      <ToolsScene tl={tl2} />
      <ReviewScene tl={tl2} />
      <TopTag label="資安宣導｜AI 工具使用規範" />
      <Subtitles tl={tl2} />
      <AbsoluteFill style={{background: C.bgDeep, opacity: fadeOut}} />
    </AbsoluteFill>
  );
};
