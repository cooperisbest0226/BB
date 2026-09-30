import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {BRAND} from '../brand';
import {CardRow} from '../components/CardRow';
import {Backdrop, Chip, Cursor, Mark, Ripple, TopTag, popIn, slideUp} from '../components/Chrome';
import {Badge, Banknote, Camera, DataFile, GiftCard, Handset, Shield} from '../components/Icons';
import {Person} from '../components/Person';
import {Bubble, Phone} from '../components/Phone';
import {Contact, Slogan} from '../components/Slogan';
import {Subtitles} from '../components/Subtitles';
import {easeIn, easeOut, keyframes, lerp, pop, progress} from '../lib/anim';
import {getScene, phraseAt, sceneEnd, Timeline} from '../lib/timeline';
import {C, FONT} from '../theme';
import timeline from '../data/video3.timeline.json';

export const tl3 = timeline as unknown as Timeline;

const GOLD = '#E0B04A';

/** 「董事長」頭像（金框剪影，照片可以被冒用） */
const BossAvatar: React.FC<{size?: number}> = ({size = 58}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      background: '#22344F',
      border: `${Math.max(3, size / 16)}px solid ${GOLD}`,
      boxSizing: 'border-box',
      overflow: 'hidden',
      position: 'relative',
    }}
  >
    <div style={{position: 'absolute', left: '32%', top: '18%', width: '36%', height: '36%', borderRadius: '50%', background: GOLD}} />
    <div style={{position: 'absolute', left: '16%', top: '60%', width: '68%', height: '60%', borderRadius: '50% 50% 0 0', background: GOLD}} />
  </div>
);

const MemberAvatar: React.FC<{color: string}> = ({color}) => (
  <div style={{width: 58, height: 58, borderRadius: 29, background: color, position: 'relative', overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: 19, top: 10, width: 20, height: 20, borderRadius: 10, background: 'rgba(255,255,255,0.8)'}} />
    <div style={{position: 'absolute', left: 10, top: 34, width: 38, height: 30, borderRadius: '19px 19px 0 0', background: 'rgba(255,255,255,0.8)'}} />
  </div>
);

const PHONE = {w: 520, h: 820, y: 80};
const CHAT_TOP = PHONE.y + 16 + 118; // 聊天區在畫面上的 y

/** S1～S4：被拉進群組 → 董事長要求 → 可疑之處 */
const GroupStage: React.FC<{f: number}> = ({f}) => {
  const s1 = getScene(tl3, 's1_added');
  const s2 = getScene(tl3, 's2_busy');
  const s3 = getScene(tl3, 's3_asks');
  const s4 = getScene(tl3, 's4_fake');
  const end = sceneEnd(s4);
  if (f >= end) return null;

  const opacity = Math.min(easeIn(f, 0, 14), easeOut(f, end - 12, 12));
  const x = keyframes(f, [s4.from, s4.from + 20], [700, 250]);
  const scroll = keyframes(f, [s3.from, s3.from + 14], [0, -120]);
  const bossName = phraseAt(s1, 1, 2);
  const noCall = phraseAt(s2, 1, 2);
  const [aPoints, aMoney, aData, aCommon] = [1, 2, 3, 4].map((i) => phraseAt(s3, 1, i));
  const fakeName = phraseAt(s4, 1, 2);
  const [urgent, secret, suspicious] = [1, 2, 3].map((i) => phraseAt(s4, 2, i));
  const msgs = [
    {at: s2.lines[0].from, text: <>我在開會，不方便講電話</>},
    {at: phraseAt(s2, 1, 3), text: <>你先幫我處理一件事，<Mark p={progress(f, urgent, 12)} color="rgba(245,165,36,0.5)">越快越好</Mark></>},
    {at: aPoints, text: <>幫我買 10 張遊戲點數，<br />拍序號給我</>, red: aPoints},
    {at: aMoney, text: <>先匯 5 萬到這個帳戶，<br />明天報帳</>, red: aMoney},
    {at: aData, text: <>再把客戶名單傳給我，<br /><Mark p={progress(f, secret, 12)} color="rgba(229,72,77,0.3)">先別跟其他人說</Mark></>, red: aData},
  ];
  const chipX = x + PHONE.w + 36;
  const rightChips = f < s4.from;

  return (
    <AbsoluteFill style={{opacity, fontFamily: FONT}}>
      <Phone x={x} y={PHONE.y} w={PHONE.w} h={PHONE.h} title="業務部緊急聯絡" sub="5 位成員">
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, transform: `translateY(${scroll}px)`}}>
          <div style={{display: 'flex', justifyContent: 'center', marginTop: 16, opacity: easeIn(f, 12, 10)}}>
            <div style={{background: '#D9E1EC', color: C.inkSoft, fontSize: 19, borderRadius: 999, padding: '6px 18px'}}>董事長 已將你加入群組</div>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-around', padding: '16px 18px 0', opacity: easeIn(f, 18, 10)}}>
            {[
              {name: '董事長', boss: true},
              {name: '你', color: C.link},
              {name: '業務一', color: '#8B7CF6'},
              {name: '業務二', color: '#30A46C'},
              {name: '業務三', color: '#E08E0B'},
            ].map((m) => (
              <div key={m.name} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4}}>
                <div style={{borderRadius: 34, boxShadow: m.boss && f >= bossName ? `0 0 0 5px ${C.yellow}` : 'none'}}>
                  {m.boss ? <BossAvatar /> : <MemberAvatar color={m.color!} />}
                </div>
                <div style={{fontSize: 18, color: m.boss ? C.ink : C.inkSoft, fontWeight: m.boss ? 700 : 400}}>{m.name}</div>
              </div>
            ))}
          </div>
          <div style={{padding: '20px 18px 0', display: 'flex', flexDirection: 'column', gap: 14}}>
            {msgs.map((m, i) =>
              f >= m.at - 2 ? (
                <div key={i} style={{opacity: easeIn(f, m.at - 2, 8), transform: `translateY(${(1 - easeIn(f, m.at - 2, 8)) * 16}px)`}}>
                  <Bubble
                    name={i === 0 ? '董事長' : undefined}
                    avatar={i === 0 ? <BossAvatar /> : null}
                    highlight={m.red !== undefined && f >= m.red ? C.red : undefined}
                  >
                    {m.text}
                  </Bubble>
                </div>
              ) : null,
            )}
          </div>
        </div>
      </Phone>

      {/* 右側說明（S1～S3） */}
      {rightChips && f >= bossName && f < s2.from + 10 && (
        <div style={{position: 'absolute', left: chipX, top: 286, transformOrigin: '0% 50%', ...popIn(f, bossName + 4, 0.5), opacity: Math.min(pop(f, bossName + 4) * 1.5, easeOut(f, s2.from, 10))}}>
          <Chip color={C.yellow} style={{color: C.bg}} size={32}>
            頭像、名字都是董事長
          </Chip>
        </div>
      )}
      {rightChips && f >= noCall && f < s3.from + 10 && (
        <div style={{position: 'absolute', left: chipX, top: 400, transformOrigin: '0% 50%', ...popIn(f, noCall, 0.5), opacity: Math.min(pop(f, noCall) * 1.5, easeOut(f, s3.from, 10))}}>
          <Chip color={C.red} size={32}>
            不方便講電話？
          </Chip>
        </div>
      )}
      {rightChips &&
        [
          {at: aPoints, label: '買點數', y: CHAT_TOP + 300},
          {at: aMoney, label: '匯款', y: CHAT_TOP + 411},
          {at: aData, label: '傳資料', y: CHAT_TOP + 522},
        ].map((c) =>
          f >= c.at ? (
            <div key={c.label} style={{position: 'absolute', left: chipX, top: c.y, transformOrigin: '0% 50%', ...popIn(f, c.at, 0.5)}}>
              <Chip color={C.red} size={34} icon={<Badge kind="x" size={40} p={1} />}>
                {c.label}
              </Chip>
            </div>
          ) : null,
        )}
      {rightChips && f >= aCommon && (
        <div style={{position: 'absolute', left: chipX, top: 190, fontSize: 40, fontWeight: 700, color: '#FF6B6F', ...slideUp(f, aCommon, 20)}}>
          詐騙最常見的要求
        </div>
      )}

      {/* S4：成員資料 */}
      {f >= s4.from + 8 && (
        <div
          style={{
            position: 'absolute',
            left: 860,
            top: 110,
            width: 840,
            borderRadius: 28,
            background: C.panel,
            border: `3px solid ${C.panelLine}`,
            padding: '30px 40px',
            boxSizing: 'border-box',
            color: C.white,
            boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
            ...slideUp(f, s4.from + 8, 30),
          }}
        >
          <div style={{fontSize: 28, color: C.muted, fontWeight: 700}}>成員資料</div>
          <div style={{display: 'flex', alignItems: 'center', gap: 24, marginTop: 18}}>
            <BossAvatar size={110} />
            <div>
              <div style={{fontSize: 46, fontWeight: 700}}>董事長</div>
              <div style={{fontSize: 26, color: C.muted}}>頭像、名字看起來都沒問題</div>
            </div>
          </div>
          {[
            {k: '帳號', v: '@chair_8812', tag: '陌生帳號', at: s4.lines[0].from + 14},
            {k: '加入時間', v: '今天 09:03', tag: '剛建立', at: s4.lines[0].from + 26},
          ].map((r) => (
            <div key={r.k} style={{display: 'flex', alignItems: 'center', gap: 18, marginTop: 20, fontSize: 32, ...slideUp(f, r.at, 16)}}>
              <span style={{color: C.muted, width: 140}}>{r.k}</span>
              <span style={{fontWeight: 700}}>{r.v}</span>
              <span style={{background: C.red, borderRadius: 999, padding: '4px 16px', fontSize: 26, fontWeight: 700}}>{r.tag}</span>
            </div>
          ))}
        </div>
      )}
      {f >= fakeName && (
        <div style={{position: 'absolute', left: 860, width: 840, top: 575, display: 'flex', justifyContent: 'center', ...popIn(f, fakeName, 0.6)}}>
          <Chip color={C.red} size={36}>照片和名字都能冒用</Chip>
        </div>
      )}
      {f >= urgent && (
        <div style={{position: 'absolute', left: 860, width: 840, top: 690, display: 'flex', justifyContent: 'center', gap: 20}}>
          <div style={{transformOrigin: '50% 50%', ...popIn(f, urgent, 0.5)}}>
            <Chip color={C.yellow} style={{color: C.bg}} size={34}>語氣越急</Chip>
          </div>
          {f >= secret && (
            <div style={{...popIn(f, secret, 0.5)}}>
              <Chip color={C.red} size={34}>越要你保密</Chip>
            </div>
          )}
          {f >= suspicious && (
            <div style={{...popIn(f, suspicious, 0.5)}}>
              <Chip color={C.bgDeep} size={34} style={{border: `3px solid ${C.red}`, color: '#FF6B6F'}}>
                ＝ 越可疑
              </Chip>
            </div>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};

/** S5：用原本知道的電話打給本人 */
const CallScene: React.FC<{f: number}> = ({f}) => {
  const s = getScene(tl3, 's5_call');
  const end = sceneEnd(s);
  if (f < s.from || f >= end) return null;
  const opacity = Math.min(easeIn(f, s.from, 12), easeOut(f, end - 10, 10));
  const dialAt = s.lines[0].from + 6;
  const answer = phraseAt(s, 1, 2) + 10;
  const ring = f >= dialAt && f < answer ? Math.sin((f - dialAt) / 3) * 8 : 0;
  return (
    <AbsoluteFill style={{opacity, fontFamily: FONT, color: C.white}}>
      <div style={{position: 'absolute', left: 230, top: 150, width: 640, borderRadius: 28, background: C.panel, border: `3px solid ${C.panelLine}`, padding: '28px 36px', boxSizing: 'border-box', ...slideUp(f, s.from + 2, 30)}}>
        <div style={{fontSize: 30, color: C.muted, fontWeight: 700, marginBottom: 12}}>公司通訊錄</div>
        {[
          {n: '董事長', d: '董事長室', on: true},
          {n: `資訊部 ${BRAND.contact}`, d: '資訊部'},
          {n: '人資部', d: '管理處'},
          {n: '財務部', d: '管理處'},
        ].map((r) => (
          <div
            key={r.n}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 22px',
              marginTop: 10,
              borderRadius: 16,
              background: r.on ? 'rgba(48,164,108,0.2)' : 'transparent',
              border: `3px solid ${r.on && f >= dialAt ? C.green : 'transparent'}`,
              fontSize: 34,
              fontWeight: r.on ? 700 : 400,
              color: r.on ? C.white : C.muted,
            }}
          >
            <span>{r.n}</span>
            <span style={{fontSize: 24, color: C.muted}}>{r.d}</span>
          </div>
        ))}
      </div>
      {f >= dialAt && (
        <div style={{position: 'absolute', left: 980, top: 250, display: 'flex', alignItems: 'center', gap: 28, ...popIn(f, dialAt, 0.5)}}>
          <div style={{width: 150, height: 150, borderRadius: 75, background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `rotate(${ring}deg)`, boxShadow: `0 0 0 ${f < answer ? 12 + 10 * Math.abs(Math.sin((f - dialAt) / 8)) : 12}px rgba(48,164,108,0.3)`}}>
            <Handset size={80} />
          </div>
          <div style={{fontSize: 40, fontWeight: 700}}>{f < answer ? '撥打給董事長…' : '已接通'}</div>
        </div>
      )}
      {f >= answer && (
        <div style={{position: 'absolute', left: 980, top: 460, ...popIn(f, answer, 0.6), transformOrigin: '0% 0%'}}>
          <div style={{background: C.paper, color: C.ink, borderRadius: '8px 30px 30px 30px', padding: '22px 32px', fontSize: 40, fontWeight: 700, boxShadow: '0 16px 40px rgba(0,0,0,0.35)'}}>
            「我沒有傳訊息給你喔！」
          </div>
        </div>
      )}
      {f >= answer + 24 && (
        <div style={{position: 'absolute', left: 980, top: 630, ...popIn(f, answer + 24, 0.5), transformOrigin: '0% 50%'}}>
          <Chip color={C.red} size={38} icon={<Badge kind="x" size={46} p={easeIn(f, answer + 28, 10)} />}>
            確認是假冒的群組
          </Chip>
        </div>
      )}
    </AbsoluteFill>
  );
};

/** S6：不匯款、不買點數、不給資料 → 截圖交給 Henry */
const ReportScene: React.FC<{f: number}> = ({f}) => {
  const s = getScene(tl3, 's6_report');
  const end = sceneEnd(s);
  if (f < s.from || f >= end) return null;
  const opacity = Math.min(easeIn(f, s.from, 12), easeOut(f, end - 10, 10));
  const reportAt = phraseAt(s, 1, 4);
  const click = s.cues.reportClick;
  const done = s.cues.reportDone;
  const btn = {x: 960, y: 752};
  const ct = keyframes(f, [reportAt + 4, click - 2], [0, 1]);
  const glow = f >= done ? 0.5 + 0.5 * Math.sin(((f - done) / 20) * Math.PI) : 0;
  return (
    <AbsoluteFill style={{opacity, fontFamily: FONT, color: C.white}}>
      <div style={{position: 'absolute', top: 108, left: 0, right: 0, textAlign: 'center', fontSize: 54, fontWeight: 700, ...slideUp(f, s.from + 4, 24)}}>遇到可疑的群組要求</div>
      <CardRow
        frame={f}
        kind="x"
        ats={[1, 2, 3].map((i) => phraseAt(s, 1, i))}
        cards={[
          {icon: <Banknote size={120} />, label: '不匯款', desc: '換帳戶、先墊款都一樣'},
          {icon: <GiftCard size={116} />, label: '不買點數', desc: '點數、禮物卡、序號'},
          {icon: <DataFile size={80} />, label: '不給資料', desc: '客戶名單、報價、個資'},
        ]}
      />
      {f >= reportAt && (
        <div
          style={{
            position: 'absolute',
            left: btn.x - 400,
            top: btn.y - 64,
            width: 800,
            height: 128,
            borderRadius: 64,
            background: C.green,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 22,
            fontSize: 50,
            fontWeight: 700,
            boxShadow: `0 0 0 ${10 + 10 * glow}px rgba(48,164,108,${0.25 + 0.2 * glow}), 0 16px 40px rgba(0,0,0,0.4)`,
            ...slideUp(f, reportAt, 40, 14),
            transform: `${slideUp(f, reportAt, 40, 14).transform} scale(${f >= click && f < click + 5 ? 0.95 : 1})`,
          }}
        >
          {f >= done ? <Badge kind="check" size={74} p={easeIn(f, done, 10)} /> : <Camera size={60} />}
          {f >= done ? `已截圖交給資訊部 ${BRAND.contact}` : `截圖交給資訊部 ${BRAND.contact}`}
        </div>
      )}
      {f >= reportAt + 4 && (
        <>
          <Ripple x={btn.x + 120} y={btn.y + 20} frame={f} at={click} />
          <Cursor x={lerp(1560, btn.x + 120, ct)} y={lerp(980, btn.y + 20, ct)} press={f >= click && f < click + 5 ? 1 : 0} opacity={easeOut(f, done + 20, 10)} />
        </>
      )}
    </AbsoluteFill>
  );
};

/** S7：董事長也會願意等你確認 → 標語 */
const EndingScene: React.FC<{f: number}> = ({f}) => {
  const s = getScene(tl3, 's7_slogan');
  const end = sceneEnd(s);
  if (f < s.from || f >= end) return null;
  const slogan = s.lines[1].from;
  const partA = Math.min(easeIn(f, s.from, 14), easeOut(f, slogan - 16, 12));
  const okAt = phraseAt(s, 1, 2);
  return (
    <AbsoluteFill style={{fontFamily: FONT}}>
      {partA > 0 && (
        <AbsoluteFill style={{opacity: partA}}>
          <div style={{position: 'absolute', left: 330, top: 150}}>
            <Person mood={1} alert={0} sigh={0} width={700} />
          </div>
          {f >= okAt && (
            <div style={{position: 'absolute', left: 1120, top: 330, transformOrigin: '0% 50%', ...popIn(f, okAt, 0.5)}}>
              <Chip color={C.green} size={44} icon={<Handset size={48} />} style={{padding: '16px 40px'}}>
                打電話確認，不失禮
              </Chip>
            </div>
          )}
        </AbsoluteFill>
      )}
      {f >= slogan - 4 && (
        <Slogan
          frame={f}
          iconAt={slogan - 4}
          icon={<Shield size={170} check={easeIn(f, slogan + 4, 14)} />}
          rows={[
            {content: '要錢要資料', at: slogan, size: 150, color: C.yellow},
            {content: <>先打給<span style={{color: '#4CC38A'}}>本人確認</span></>, at: phraseAt(s, 2, 2), size: 118},
          ]}
          pills={[
            {text: '不匯款', color: '#FF6B6F'},
            {text: '不買點數', color: '#FF6B6F'},
            {text: '不給資料', color: '#FF6B6F'},
            {text: '打給本人確認', color: '#4CC38A'},
          ]}
          pillsAt={phraseAt(s, 2, 2) + 16}
          footer={<>可疑群組請截圖交給 <Contact /></>}
          footerAt={phraseAt(s, 2, 2) + 40}
        />
      )}
    </AbsoluteFill>
  );
};

/** 影片三：假冒主管（董事長）群組詐騙 */
export const Video3: React.FC = () => {
  const f = useCurrentFrame();
  const fadeOut = progress(f, tl3.durationInFrames - 20, 20);
  return (
    <AbsoluteFill style={{background: C.bg, fontFamily: FONT}}>
      <Backdrop />
      <GroupStage f={f} />
      <CallScene f={f} />
      <ReportScene f={f} />
      <EndingScene f={f} />
      <TopTag company={BRAND.company} label="資安宣導｜假冒主管群組" />
      <Subtitles tl={tl3} />
      <AbsoluteFill style={{background: C.bgDeep, opacity: fadeOut}} />
    </AbsoluteFill>
  );
};
