import React from 'react';
import {useCurrentFrame} from 'remotion';
import {easeIn, easeOut} from '../lib/anim';
import {Timeline} from '../lib/timeline';
import {C, FONT} from '../theme';

const COLORS: Record<string, string> = {r: '#FF6B6F', g: '#4CC38A', y: C.yellow};

/** 「{r:釣魚信}」→ 強調色片段；字幕上的強調色比畫面主色略亮，確保在深底上的對比 */
export const RichText: React.FC<{text: string}> = ({text}) => {
  const parts = text.split(/(\{[rgy]:[^}]+\})/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\{([rgy]):([^}]+)\}$/);
        return m ? (
          <span key={i} style={{color: COLORS[m[1]]}}>
            {m[2]}
          </span>
        ) : (
          <span key={i}>{p}</span>
        );
      })}
    </>
  );
};

const HOLD = 6; // 旁白結束後字幕多停留的幀數

type Entry = {text: string; from: number; end: number};

/** 每句旁白可拆成多段字幕；每段顯示到下一段開始，最後一段顯示到旁白結束後 HOLD 幀 */
const entries = (tl: Timeline): Entry[] => {
  const lines = tl.scenes.flatMap((s) => s.lines);
  return lines.flatMap((l, i) => {
    const next = lines[i + 1];
    const lineEnd = Math.min(l.from + l.duration + HOLD, next ? next.from : Infinity);
    return l.subs.map((sub, k) => ({
      text: sub.text,
      from: k === 0 ? l.from : sub.from,
      end: k + 1 < l.subs.length ? l.subs[k + 1].from : lineEnd,
    }));
  });
};

export const Subtitles: React.FC<{tl: Timeline}> = ({tl}) => {
  const frame = useCurrentFrame();
  const all = entries(tl);
  const cur = all.find((e) => frame >= e.from - 2 && frame < e.end);
  if (!cur) return null;
  // 同一句內的分段之間不淡出，直接換字，避免閃爍
  const joinedPrev = all.some((e) => e.end === cur.from);
  const joinedNext = all.some((e) => e.from === cur.end);
  const o = Math.min(joinedPrev ? 1 : easeIn(frame, cur.from - 2, 5), joinedNext ? 1 : easeOut(frame, cur.end - 5, 5));
  const y = joinedPrev ? 0 : (1 - easeIn(frame, cur.from - 2, 6)) * 10;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 34,
        display: 'flex',
        justifyContent: 'center',
        opacity: o,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          fontFamily: FONT,
          fontWeight: 700,
          fontSize: 58,
          lineHeight: 1.3,
          letterSpacing: 2,
          color: C.white,
          background: 'rgba(5, 11, 20, 0.86)',
          border: '2px solid rgba(255,255,255,0.10)',
          borderRadius: 16,
          padding: '12px 40px 14px',
          maxWidth: 1760,
          whiteSpace: 'nowrap',
          textShadow: '0 2px 4px rgba(0,0,0,0.6)',
        }}
      >
        <RichText text={cur.text} />
      </div>
    </div>
  );
};
