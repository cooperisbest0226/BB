import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Cursor, Ripple, Tracker} from '../components/Chrome';
import {easeIn, easeOut, keyframes, lerp, progress, visible} from '../lib/anim';
import {getScene, phraseAt, sceneEnd, Timeline} from '../lib/timeline';
import {C} from '../theme';
import {CAM, INBOX, MAIL, TITLE_H, WIN, mixCam} from './layout';
import {MailState, MailWindow} from './MailWindow';
import {DomainCompare, Question, StopBadge, Toast, ToneTags, UrlCallout, WarnChip} from './Overlays';

type Pt = {x: number; y: number};
const move = (f: number, t0: number, t1: number, a: Pt, b: Pt): Pt => {
  const t = keyframes(f, [t0, t1], [0, 1]);
  return {x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t)};
};

/** S1～S5：收件匣 → 開信 → 三看（同一個郵件視窗，鏡頭推移） */
export const MailStage: React.FC<{tl: Timeline}> = ({tl}) => {
  const f = useCurrentFrame();
  const s1 = getScene(tl, 's1_inbox');
  const s2 = getScene(tl, 's2_warning');
  const s3 = getScene(tl, 's3_sender');
  const s4 = getScene(tl, 's4_link');
  const s5 = getScene(tl, 's5_tone');
  const end = sceneEnd(s5);
  if (f >= end) return null;

  // ---------- 鏡頭
  const camT = (at: number) => keyframes(f, [at, at + 24], [0, 1]);
  let cam = CAM.full;
  cam = mixCam(cam, CAM.sender, camT(s3.from));
  cam = mixCam(cam, CAM.link, camT(s4.from));
  cam = mixCam(cam, CAM.tone, camT(s5.from));
  const enter = easeIn(f, 0, 15);
  const stageOpacity = Math.min(enter, easeOut(f, end - 12, 12));

  // ---------- S1 收件匣
  const arrive = s1.cues.mailArrive;
  const ask = phraseAt(s1, 1, 2); // 「你會怎麼做？」
  const click1 = s1.cues.rowClick;
  const rowPt = {x: WIN.x + INBOX.sideW + 520, y: WIN.y + TITLE_H + INBOX.headerH + 62};

  // ---------- S2 開信
  const stop2 = s2.lines[0].from; // 「先別急著點」
  const reach2 = Math.max(stop2, s2.from + 20); // 游標抵達按鈕旁（至少留 20 幀移動）
  const phish = phraseAt(s2, 1, 2); // 「這可能是一封釣魚信」
  const nearBtn = {x: WIN.x + MAIL.button.x + MAIL.button.w + 70, y: WIN.y + MAIL.button.y + MAIL.button.h + 40};

  // ---------- S4 連結
  const hoverStart = phraseAt(s4, 2, 1);
  const hoverAt = hoverStart + 18;
  const btnPt = {x: WIN.x + MAIL.button.x + MAIL.button.w - 70, y: WIN.y + MAIL.button.y + 40};

  // 游標位置與顯示
  let cursor: Pt | null = null;
  let cursorOpacity = 1;
  let hand = false;
  let press = 0;
  if (f >= ask - 6 && f < s3.from + 10) {
    cursor = move(f, ask - 6, ask + 20, {x: 1560, y: 860}, rowPt);
    if (f >= s2.from) cursor = move(f, s2.from + 2, reach2, rowPt, nearBtn);
    press = f >= click1 && f < click1 + 5 ? 1 : 0;
    cursorOpacity = Math.min(easeIn(f, ask - 6, 8), easeOut(f, s3.from, 10));
  }
  if (f >= hoverStart - 4 && f < s5.from + 8) {
    cursor = move(f, hoverStart - 4, hoverAt, {x: 1180, y: 840}, btnPt);
    hand = f >= hoverAt;
    cursorOpacity = Math.min(easeIn(f, hoverStart - 4, 8), easeOut(f, s5.from, 8));
  }

  // ---------- 郵件視窗狀態
  const redPulse = (() => {
    if (f < stop2) return 0;
    const k = f - stop2;
    const v = k < 50 ? 0.35 + 0.65 * Math.abs(Math.sin((k / 50) * Math.PI * 2.5)) : 1;
    return v * easeOut(f, s3.from, 15);
  })();

  const st: MailState = {
    mode: easeIn(f, s2.from, 14),
    newRow: easeIn(f, arrive, 14),
    rowHover: f >= ask + 20 ? 1 : 0,
    badge: f >= arrive ? 4 : 3,
    nameMark: progress(f, phraseAt(s3, 2, 1) + 4, 14),
    addrCircle: progress(f, phraseAt(s3, 2, 2), 18),
    s3Fade: easeOut(f, s4.from, 12),
    hover: f >= hoverAt && f < s5.from ? 1 : 0,
    status: Math.min(easeIn(f, hoverAt + 2, 8), easeOut(f, s5.from, 8)),
    urlCircle: f < s5.from ? progress(f, phraseAt(s4, 2, 3), 18) : 0,
    marks: {
      urgent: progress(f, phraseAt(s5, 2, 1), 12),
      hours: progress(f, phraseAt(s5, 2, 1) + 6, 12),
      now: progress(f, phraseAt(s5, 2, 1) + 12, 12),
      password: progress(f, phraseAt(s5, 2, 2), 14),
    },
    alarm: f >= phraseAt(s5, 2, 3) ? 1 : 0,
  };

  // 寄件人區塊的黃色聚焦框（「寄件人」）
  const focusIn = easeIn(f, phraseAt(s3, 1, 2), 10);
  const focusOut = easeOut(f, s3.lines[1].from, 10);

  const trackerOpacity = visible(f, s3.from, end, 12, 12);
  const activeLook = f < s4.from ? 0 : f < s5.from ? 1 : 2;
  const pulseAt = [s3, s4, s5][activeLook].lines[0].from;

  return (
    <AbsoluteFill style={{opacity: stageOpacity}}>
      {/* 世界座標層（鏡頭） */}
      <AbsoluteFill
        style={{
          transform: `translate(${cam.ax}px, ${cam.ay}px) scale(${cam.s * (0.94 + 0.06 * enter)}) translate(${-cam.fx}px, ${-cam.fy}px)`,
          transformOrigin: '0 0',
        }}
      >
        <MailWindow s={st} redFrame={redPulse} />
        {f >= s3.from && f < s3.lines[1].from + 10 && (
          <div
            style={{
              position: 'absolute',
              left: WIN.x + MAIL.padX - 16,
              top: WIN.y + MAIL.senderY - 14,
              width: 920,
              height: 96,
              borderRadius: 16,
              border: `5px solid ${C.yellow}`,
              opacity: Math.min(focusIn, focusOut),
              transform: `scale(${1.04 - 0.04 * focusIn})`,
            }}
          />
        )}
        {cursor && (
          <>
            <Ripple x={rowPt.x} y={rowPt.y} frame={f} at={click1} color={C.link} />
            <Cursor x={cursor.x} y={cursor.y} hand={hand} press={press} opacity={cursorOpacity} />
          </>
        )}
        {/* S1 問號、S2 別急著點、S4 不要點 */}
        {f < s2.from + 10 && (
          <Question frame={f} at={ask + 6} x={rowPt.x + 50} y={rowPt.y - 140} out={easeOut(f, s2.from, 10)} />
        )}
        {f >= s2.from && f < s3.from + 10 && (
          <StopBadge frame={f} at={reach2 + 2} x={nearBtn.x + 34} y={nearBtn.y - 70} opacity={easeOut(f, s3.from, 10)} />
        )}
        {f >= s4.from && f < s5.from + 10 && (
          <StopBadge
            frame={f}
            at={phraseAt(s4, 2, 2)}
            x={btnPt.x + 124}
            y={btnPt.y - 34}
            label="不要點"
            opacity={easeOut(f, s5.from, 10)}
          />
        )}
      </AbsoluteFill>

      {/* 畫面座標層（說明） */}
      {f < s2.from && <Toast frame={f} at={arrive} />}
      {f >= s2.from && f < s3.from + 12 && <WarnChip frame={f} at={phish} opacity={easeOut(f, s3.from, 12)} />}
      {f >= s3.from && f < s4.from + 12 && (
        <DomainCompare frame={f} at={phraseAt(s3, 2, 2) + 6} opacity={easeOut(f, s4.from, 12)} />
      )}
      {f >= s4.from && f < s5.from + 12 && (
        <UrlCallout frame={f} at={phraseAt(s4, 2, 3) + 8} opacity={easeOut(f, s5.from, 12)} />
      )}
      {f >= s5.from && (
        <ToneTags
          frame={f}
          urgentAt={phraseAt(s5, 2, 1) + 10}
          pwdAt={phraseAt(s5, 2, 2) + 10}
          stampAt={phraseAt(s5, 2, 3) + 2}
          opacity={1}
        />
      )}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 112,
          background: C.bgDeep,
          boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
          borderBottom: `2px solid ${C.panelLine}`,
          opacity: trackerOpacity,
        }}
      />
      <Tracker items={['看寄件人', '看連結', '看語氣']} active={activeLook} frame={f} pulseAt={pulseAt} opacity={trackerOpacity} />
    </AbsoluteFill>
  );
};
