import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Chip, popIn, slideUp} from '../components/Chrome';
import {Badge, Flag, Shield} from '../components/Icons';
import {easeIn, easeOut, pop} from '../lib/anim';
import {getScene, phraseAt, sceneEnd, Timeline} from '../lib/timeline';
import {BRAND} from '../brand';
import {C, FONT} from '../theme';

const APPROVED = ['AI 助理（公司版）', '文件翻譯工具', '程式碼助理'];
const OTHERS = ['瀏覽器 AI 外掛', '免費線上 AI 網站', '新下載的 AI App'];

const QuestionBadge: React.FC<{p: number}> = ({p}) => (
  <div
    style={{
      width: 70,
      height: 70,
      borderRadius: 35,
      background: C.yellow,
      color: C.bg,
      fontSize: 48,
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transform: `scale(${p}) rotate(${(1 - p) * -40}deg)`,
    }}
  >
    ?
  </div>
);

const Panel: React.FC<{
  x: number;
  title: string;
  titleBg: string;
  titleColor: string;
  icon: React.ReactNode;
  items: string[];
  at: number;
  frame: number;
  mark: (p: number) => React.ReactNode;
  dim?: boolean;
}> = ({x, title, titleBg, titleColor, icon, items, at, frame, mark, dim}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: 150,
      width: 720,
      borderRadius: 28,
      background: C.panel,
      border: `3px solid ${C.panelLine}`,
      overflow: 'hidden',
      boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
      ...slideUp(frame, at - 10, 30),
    }}
  >
    <div style={{height: 96, background: titleBg, color: titleColor, display: 'flex', alignItems: 'center', gap: 16, padding: '0 36px', fontSize: 42, fontWeight: 700}}>
      {icon}
      {title}
    </div>
    {items.map((it, i) => {
      const t = at + i * 8;
      return (
        <div
          key={it}
          style={{
            height: 126,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 36px',
            borderTop: i ? `2px solid ${C.panelLine}` : 'none',
            fontSize: 38,
            fontWeight: 700,
            color: dim ? C.muted : C.white,
            opacity: easeIn(frame, t, 10),
            transform: `translateX(${(1 - easeIn(frame, t, 10)) * -24}px)`,
          }}
        >
          {it}
          {frame >= t + 4 && mark(pop(frame, t + 4))}
        </div>
      );
    })}
  </div>
);

/** S5：優先使用公司核可的工具；新工具先交給資訊部確認 */
export const ToolsScene: React.FC<{tl: Timeline}> = ({tl}) => {
  const f = useCurrentFrame();
  const s = getScene(tl, 's5_tools');
  const end = sceneEnd(s);
  if (f < s.from || f >= end) return null;

  const opacity = Math.min(easeIn(f, s.from, 12), easeOut(f, end - 10, 10));
  const approvedAt = s.lines[0].from + 6;
  const othersAt = s.lines[1].from;
  const askAt = phraseAt(s, 2, 2); // 先問資訊部，交給 Henry 確認

  return (
    <AbsoluteFill style={{opacity, fontFamily: FONT}}>
      <Panel
        x={190}
        title="公司核可的工具"
        titleBg={C.green}
        titleColor={C.white}
        icon={<Shield size={46} color="#fff" fill="rgba(255,255,255,0.15)" check={1} />}
        items={APPROVED}
        at={approvedAt}
        frame={f}
        mark={(p) => <Badge kind="check" size={70} p={p} />}
      />
      {f >= othersAt - 10 && (
        <Panel
          x={1010}
          title="其他工具"
          titleBg={C.yellow}
          titleColor={C.bg}
          icon={<span style={{fontSize: 46}}>?</span>}
          items={OTHERS}
          at={othersAt}
          frame={f}
          mark={(p) => <QuestionBadge p={p} />}
          dim
        />
      )}
      {f >= askAt && (
        <div style={{position: 'absolute', left: 1010, width: 720, top: 745, display: 'flex', justifyContent: 'center', ...popIn(f, askAt, 0.5)}}>
          <Chip color={C.green} size={44} icon={<Flag size={48} />} style={{padding: '14px 40px'}}>
            資訊部 {BRAND.contact} 確認後再用
          </Chip>
        </div>
      )}
    </AbsoluteFill>
  );
};
