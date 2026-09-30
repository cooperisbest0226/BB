import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Chip, Cursor, Ripple, popIn, slideUp} from '../components/Chrome';
import {Sparkle, Stopwatch} from '../components/Icons';
import {easeIn, easeOut, keyframes, lerp, pop} from '../lib/anim';
import {getScene, phraseAt, Timeline} from '../lib/timeline';
import {C, FONT, MONO} from '../theme';

// 聊天視窗（畫面座標）
export const CHAT = {x: 330, y: 120, w: 1260, h: 760, titleH: 52};
const INPUT = {left: 32, right: 32, bottom: 28, h: 170};
const contentH = CHAT.h - CHAT.titleH;
const inputTop = CHAT.y + CHAT.titleH + contentH - INPUT.bottom - INPUT.h;
const SEND = {x: CHAT.x + CHAT.w - INPUT.right - 20 - 32, y: inputTop + INPUT.h - 20 - 32};

const ROW = ['王小明', '0912-345-678', '範例科技', 'NT$1,280,000'];
const COLS = [140, 240, 170, 230];

/** 客戶名單表格（第一列清楚，其餘以灰條表示還有很多筆） */
const CustomerTable: React.FC<{dark?: boolean}> = ({dark}) => {
  const ink = dark ? C.ink : '#FFFFFF';
  const sub = dark ? C.inkSoft : 'rgba(255,255,255,0.75)';
  const bar = dark ? '#D5DDE8' : 'rgba(255,255,255,0.28)';
  return (
    <div
      style={{
        marginTop: 12,
        padding: '12px 16px',
        borderRadius: 12,
        background: dark ? '#F3F6FA' : 'rgba(255,255,255,0.14)',
        fontSize: 24,
      }}
    >
      <div style={{display: 'flex', color: sub, fontWeight: 700}}>
        {['姓名', '電話', '公司', '報價'].map((h, i) => (
          <div key={h} style={{width: COLS[i]}}>
            {h}
          </div>
        ))}
      </div>
      <div style={{display: 'flex', color: ink, marginTop: 6}}>
        {ROW.map((v, i) => (
          <div key={v} style={{width: COLS[i], fontFamily: i === 1 || i === 3 ? MONO : FONT, fontSize: i === 1 || i === 3 ? 22 : 24}}>
            {v}
          </div>
        ))}
      </div>
      {[0, 1, 2].map((r) => (
        <div key={r} style={{display: 'flex', gap: 14, marginTop: 10}}>
          {COLS.map((w, i) => (
            <div key={i} style={{width: w - 24 - ((r + i) % 3) * 12, height: 12, borderRadius: 6, background: bar}} />
          ))}
        </div>
      ))}
      <div style={{marginTop: 10, color: sub, fontSize: 22}}>…共 1,238 筆客戶資料</div>
    </div>
  );
};

/** S1：趕報告，把整份客戶名單貼進 AI 聊天視窗 */
export const ChatScene: React.FC<{tl: Timeline}> = ({tl}) => {
  const f = useCurrentFrame();
  const s = getScene(tl, 's1_paste');
  const s2 = getScene(tl, 's2_upload');
  const morphEnd = s2.from + 22;
  if (f >= morphEnd) return null;

  const paste = s.cues.paste;
  const send = s.cues.send;
  const ask = phraseAt(s, 1, 3); // 「去了哪裡？」
  const pasted = f >= paste && f < send;
  const sent = f >= send;

  // 進場、以及轉到 S2 時縮進筆電螢幕
  const enter = easeIn(f, 0, 15);
  const m = keyframes(f, [s2.from, morphEnd], [0, 1]);
  const morph = `translate(${lerp(0, 455 - 960, m)}px, ${lerp(0, 447 - 500, m)}px) scale(${lerp(0.95 + 0.05 * enter, 0.27, m)})`;

  const cur = {x: lerp(1400, SEND.x + 6, keyframes(f, [send - 40, send - 4], [0, 1])), y: lerp(930, SEND.y + 8, keyframes(f, [send - 40, send - 4], [0, 1]))};
  const bubbleIn = easeIn(f, send, 14);

  return (
    <AbsoluteFill style={{fontFamily: FONT}}>
      <AbsoluteFill style={{transform: morph, transformOrigin: '960px 500px', opacity: Math.min(enter, 1 - m * 0.9)}}>
        <div
          style={{
            position: 'absolute',
            left: CHAT.x,
            top: CHAT.y,
            width: CHAT.w,
            height: CHAT.h,
            borderRadius: 22,
            background: C.paper,
            overflow: 'hidden',
            boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
          }}
        >
          <div
            style={{
              height: CHAT.titleH,
              background: '#E4EAF2',
              borderBottom: `2px solid ${C.paperLine}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              fontSize: 22,
              fontWeight: 700,
              color: C.inkSoft,
              position: 'relative',
            }}
          >
            <div style={{position: 'absolute', left: 22, display: 'flex', gap: 10}}>
              {['#F0A6A8', '#F5D38E', '#9FD9B8'].map((c) => (
                <div key={c} style={{width: 16, height: 16, borderRadius: 8, background: c}} />
              ))}
            </div>
            <Sparkle size={26} />
            AI 聊天助理
          </div>
          {/* AI 招呼 */}
          <div style={{position: 'absolute', left: 32, top: CHAT.titleH + 26, display: 'flex', gap: 16, alignItems: 'flex-start'}}>
            <div style={{width: 56, height: 56, borderRadius: 28, background: '#EFEBFF', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <Sparkle size={34} />
            </div>
            <div style={{background: '#EEF2F8', borderRadius: 18, padding: '14px 24px', fontSize: 27, color: C.ink}}>你好！今天需要我幫忙什麼？</div>
          </div>
          {/* 已送出的訊息 */}
          {sent && (
            <div
              style={{
                position: 'absolute',
                right: 32,
                top: CHAT.titleH + 118,
                width: 880,
                padding: '18px 24px',
                borderRadius: 20,
                background: C.link,
                color: '#fff',
                fontSize: 27,
                opacity: bubbleIn,
                transform: `translateY(${(1 - bubbleIn) * 280}px)`,
                boxShadow: f >= ask ? `0 0 0 ${6 + 4 * Math.sin((f - ask) / 5)}px rgba(245,165,36,0.55)` : 'none',
              }}
            >
              幫我把這份客戶名單整理成報告：
              <CustomerTable />
            </div>
          )}
          {/* 輸入框 */}
          <div
            style={{
              position: 'absolute',
              left: INPUT.left,
              right: INPUT.right,
              bottom: INPUT.bottom,
              height: INPUT.h,
              borderRadius: 20,
              border: `3px solid ${pasted ? C.link : C.paperLine}`,
              background: '#FFFFFF',
              padding: '16px 110px 16px 24px',
              boxSizing: 'border-box',
              overflow: 'hidden',
              fontSize: 25,
              color: C.inkSoft,
            }}
          >
            {pasted ? (
              <div style={{opacity: easeIn(f, paste, 6), color: C.ink, transform: 'scale(0.82)', transformOrigin: '0 0'}}>
                幫我把這份客戶名單整理成報告：
                <CustomerTable dark />
              </div>
            ) : (
              <span>輸入訊息…</span>
            )}
            <div
              style={{
                position: 'absolute',
                right: 20,
                bottom: 20,
                width: 64,
                height: 64,
                borderRadius: 32,
                background: pasted ? C.link : '#B7C2D2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${f >= send && f < send + 5 ? 0.88 : 1})`,
              }}
            >
              <svg width="30" height="30" viewBox="0 0 30 30">
                <path d="M15 25 V6 M6 14 L15 5 L24 14" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
        {/* Ctrl + V */}
        {f >= paste && f < paste + 45 && (
          <div style={{position: 'absolute', left: 1210, top: 560, display: 'flex', gap: 10, alignItems: 'center', ...popIn(f, paste, 0.5), opacity: Math.min(pop(f, paste) * 1.5, easeOut(f, paste + 35, 10))}}>
            {['Ctrl', '+', 'V'].map((k) =>
              k === '+' ? (
                <span key={k} style={{color: C.inkSoft, fontSize: 40, fontWeight: 700}}>
                  +
                </span>
              ) : (
                <span
                  key={k}
                  style={{
                    padding: '10px 22px',
                    borderRadius: 12,
                    background: C.bgDeep,
                    border: `3px solid ${C.muted}`,
                    boxShadow: `0 6px 0 ${C.panelLine}`,
                    color: C.white,
                    fontSize: 36,
                    fontWeight: 700,
                    fontFamily: MONO,
                  }}
                >
                  {k}
                </span>
              ),
            )}
          </div>
        )}
        {/* 送出後的問號 */}
        {f >= ask && (
          <div
            style={{
              position: 'absolute',
              left: 570,
              top: 330,
              width: 104,
              height: 104,
              borderRadius: 52,
              background: C.yellow,
              color: C.bg,
              fontSize: 72,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `scale(${pop(f, ask)}) rotate(${(1 - pop(f, ask)) * -30}deg)`,
              boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
            }}
          >
            ?
          </div>
        )}
        {f >= send - 40 && f < s2.from && (
          <>
            <Ripple x={SEND.x + 32} y={SEND.y + 32} frame={f} at={send} color={C.link} />
            <Cursor x={cur.x} y={cur.y} press={f >= send && f < send + 5 ? 1 : 0} opacity={Math.min(easeIn(f, send - 40, 8), easeOut(f, send + 24, 10))} />
          </>
        )}
      </AbsoluteFill>
      {/* 趕報告 */}
      {f < s2.from + 10 && (
        <div style={{position: 'absolute', right: 40, top: 30, ...slideUp(f, 8, -20), opacity: Math.min(easeIn(f, 8, 10), easeOut(f, s2.from, 10))}}>
          <Chip color={C.yellow} style={{color: C.bg}} size={32} icon={<Stopwatch size={40} color={C.bg} />}>
            17:00 前要交報告
          </Chip>
        </div>
      )}
    </AbsoluteFill>
  );
};

