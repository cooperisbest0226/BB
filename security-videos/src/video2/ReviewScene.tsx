import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Chip, Circle, popIn, slideUp} from '../components/Chrome';
import {Lock, Magnifier, Shield, Sparkle, WarningTriangle} from '../components/Icons';
import {easeIn, easeOut, progress} from '../lib/anim';
import {getScene, phraseAt, phraseFrac, sceneEnd, Timeline} from '../lib/timeline';
import {BRAND} from '../brand';
import {C, FONT} from '../theme';

/** S6：AI 也會出錯 → 結尾標語 */
export const ReviewScene: React.FC<{tl: Timeline}> = ({tl}) => {
  const f = useCurrentFrame();
  const s = getScene(tl, 's6_review');
  const end = sceneEnd(s);
  if (f < s.from || f >= end) return null;

  const wrongAt = phraseFrac(s, 1, 1, 0.55); // 「出錯」
  const checkAt = phraseAt(s, 1, 2); // 「產出的內容要自己檢查」
  const slogan = s.lines[1].from; // 貼之前先想一想
  const slogan2 = phraseAt(s, 2, 2); // 機密資料不外送

  const partA = Math.min(easeIn(f, s.from, 12), easeOut(f, slogan - 16, 12));

  return (
    <AbsoluteFill style={{fontFamily: FONT, color: C.white}}>
      {partA > 0 && (
        <AbsoluteFill style={{opacity: partA}}>
          <div
            style={{
              position: 'absolute',
              left: 330,
              top: 170,
              width: 1260,
              borderRadius: 26,
              background: C.paper,
              boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
              padding: '30px 50px 36px',
              boxSizing: 'border-box',
              color: C.ink,
              ...slideUp(f, s.from + 2, 40, 14),
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: 14, fontSize: 28, fontWeight: 700, color: C.inkSoft}}>
              <div style={{width: 52, height: 52, borderRadius: 26, background: '#EFEBFF', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <Sparkle size={32} />
              </div>
              AI 回答
            </div>
            <div style={{marginTop: 20, fontSize: 42, lineHeight: 1.85, whiteSpace: 'nowrap'}}>
              <div style={{fontWeight: 700}}>報告摘要：</div>
              <div>
                本季共收到 120 件客訴，比上季
                <span style={{position: 'relative', display: 'inline-block', margin: '0 22px', color: f >= wrongAt ? '#B42318' : C.ink, fontWeight: f >= wrongAt ? 700 : 400}}>
                  減少 15%
                  <Circle p={progress(f, wrongAt, 16)} color={C.red} pad={[16, 10]} stroke={6} />
                </span>
                ，
              </div>
              <div>主要原因是出貨延遲。</div>
            </div>
          </div>
          {f >= wrongAt + 6 && (
            <div style={{position: 'absolute', left: 1270, top: 128, transformOrigin: '0% 50%', ...popIn(f, wrongAt + 6, 0.5)}}>
              <Chip color={C.red} size={34} icon={<WarningTriangle size={40} color="#fff" />}>
                AI 答錯了
              </Chip>
            </div>
          )}
          {f >= checkAt && (
            <div style={{position: 'absolute', left: 0, right: 0, top: 690, display: 'flex', justifyContent: 'center', ...slideUp(f, checkAt, 30)}}>
              <Chip color={C.green} size={38} icon={<Magnifier size={42} />} style={{padding: '14px 36px'}}>
                對照原始資料：其實是「增加 15%」
              </Chip>
            </div>
          )}
        </AbsoluteFill>
      )}

      {f >= slogan - 4 && (
        <AbsoluteFill>
          <div style={{position: 'absolute', left: 0, right: 0, top: 118, display: 'flex', justifyContent: 'center', ...popIn(f, slogan - 4, 0.5)}}>
            <Lock size={150} />
          </div>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 330,
              textAlign: 'center',
              fontSize: 136,
              fontWeight: 700,
              letterSpacing: 10,
              color: C.yellow,
              textShadow: '0 8px 30px rgba(0,0,0,0.45)',
              ...slideUp(f, slogan, 40, 14),
            }}
          >
            貼之前先想一想
          </div>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 520,
              textAlign: 'center',
              fontSize: 118,
              fontWeight: 700,
              letterSpacing: 10,
              textShadow: '0 8px 30px rgba(0,0,0,0.45)',
              ...slideUp(f, slogan2, 40, 14),
            }}
          >
            機密資料<span style={{color: '#4CC38A'}}>不外送</span>
          </div>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 852,
              display: 'flex',
              justifyContent: 'center',
              ...slideUp(f, slogan2 + 40, 16),
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: 14, fontSize: 34, fontWeight: 700, color: C.muted}}>
              <Shield size={34} color={C.green} check={1} />
              <span style={{color: C.white}}>{BRAND.company} 資訊部</span>
              <span style={{color: C.dim}}>｜</span>
              AI 工具問題請教 <span style={{color: '#4CC38A'}}>{BRAND.contact}</span>
            </div>
          </div>
          <div style={{position: 'absolute', left: 0, right: 0, top: 740, display: 'flex', justifyContent: 'center', gap: 18}}>
            {['不貼機密', '先換代號', '用核可工具', '自己檢查'].map((t, i) => (
              <div
                key={t}
                style={{
                  padding: '10px 30px',
                  borderRadius: 999,
                  fontSize: 36,
                  fontWeight: 700,
                  border: `3px solid ${C.yellow}`,
                  color: C.yellow,
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
