import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Chip, popIn, slideUp} from '../components/Chrome';
import {Shield, Stopwatch} from '../components/Icons';
import {Person} from '../components/Person';
import {easeIn, easeOut, keyframes, pop, progress} from '../lib/anim';
import {getScene, phraseAt, sceneEnd, Timeline} from '../lib/timeline';
import {C, FONT} from '../theme';

/** S7：萬一點了也別怕 → 結尾標語 */
export const EndingScene: React.FC<{tl: Timeline}> = ({tl}) => {
  const f = useCurrentFrame();
  const s = getScene(tl, 's7_ending');
  const end = sceneEnd(s);
  if (f < s.from || f >= end) return null;

  const clicked = s.lines[0].from; // 萬一已經點了
  const calm = phraseAt(s, 1, 2); // 也別怕
  const shieldAt = s.cues.shield; // 越快通知越好
  const slogan = s.lines[1].from; // 三看一不點
  const slogan2 = phraseAt(s, 2, 2); // 有疑問就回報

  const partA = Math.min(easeIn(f, s.from, 14), easeOut(f, slogan - 16, 12));
  const shift = keyframes(f, [shieldAt - 6, shieldAt + 12], [0, 1]); // 盾牌出現時插畫往左讓位
  const alert = f < calm ? pop(f, clicked + 2) : Math.max(0, 1 - (f - calm) / 8);
  const mood = easeIn(f, calm, 8);
  const sigh = progress(f, calm + 4, 50);

  return (
    <AbsoluteFill style={{fontFamily: FONT, color: C.white}}>
      {/* A：插畫 */}
      {partA > 0 && (
        <AbsoluteFill style={{opacity: partA}}>
          <div style={{position: 'absolute', left: 610 - 330 * shift, top: 150, transform: `translateY(${(1 - easeIn(f, s.from, 16)) * 30}px)`}}>
            <Person mood={mood} alert={alert} sigh={sigh} width={700} />
          </div>
          {f >= shieldAt && (
            <>
              <div style={{position: 'absolute', left: 1210, top: 170, ...popIn(f, shieldAt, 0.4)}}>
                <Shield size={260} check={easeIn(f, shieldAt + 8, 14)} />
              </div>
              <div style={{position: 'absolute', left: 1040, width: 600, top: 520, display: 'flex', justifyContent: 'center', ...slideUp(f, shieldAt + 8, 24)}}>
                <Chip color={C.green} size={40} icon={<Stopwatch size={48} />}>
                  越快通知越好
                </Chip>
              </div>
            </>
          )}
        </AbsoluteFill>
      )}

      {/* B：標語 */}
      {f >= slogan - 4 && (
        <AbsoluteFill>
          <div style={{position: 'absolute', left: 0, right: 0, top: 138, display: 'flex', justifyContent: 'center', ...popIn(f, slogan - 4, 0.5)}}>
            <Shield size={170} check={easeIn(f, slogan + 4, 14)} />
          </div>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 360,
              textAlign: 'center',
              fontSize: 150,
              fontWeight: 700,
              letterSpacing: 12,
              color: C.yellow,
              textShadow: '0 8px 30px rgba(0,0,0,0.45)',
              ...slideUp(f, slogan, 40, 14),
            }}
          >
            三看一不點
          </div>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 550,
              textAlign: 'center',
              fontSize: 118,
              fontWeight: 700,
              letterSpacing: 10,
              textShadow: '0 8px 30px rgba(0,0,0,0.45)',
              ...slideUp(f, slogan2, 40, 14),
            }}
          >
            有疑問就<span style={{color: '#4CC38A'}}>回報</span>
          </div>
          <div style={{position: 'absolute', left: 0, right: 0, top: 762, display: 'flex', justifyContent: 'center', gap: 18}}>
            {['看寄件人', '看連結', '看語氣', '不點'].map((t, i) => (
              <div
                key={t}
                style={{
                  padding: '10px 30px',
                  borderRadius: 999,
                  fontSize: 36,
                  fontWeight: 700,
                  border: `3px solid ${i === 3 ? C.red : C.yellow}`,
                  color: i === 3 ? '#FF6B6F' : C.yellow,
                  background: 'rgba(8,16,28,0.7)',
                  ...slideUp(f, slogan2 + 16 + i * 5, 20),
                }}
              >
                {t}
              </div>
            ))}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
