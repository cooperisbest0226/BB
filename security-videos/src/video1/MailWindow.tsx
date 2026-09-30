import React from 'react';
import {Circle, Mark} from '../components/Chrome';
import {C, FONT, MONO} from '../theme';
import {FAKE, INBOX, MAIL, TITLE_H, WIN} from './layout';

export type MailState = {
  mode: number; // 0 = 收件匣列表，1 = 信件內容
  newRow: number; // 新信進入列表的進度
  rowHover: number;
  badge: number;
  nameMark: number; // 寄件人名稱標示
  addrCircle: number; // 寄件地址圈選
  s3Fade: number; // 第一看的標示淡出（1 = 顯示）
  hover: number; // 滑鼠停在按鈕上
  status: number; // 狀態列出現
  urlCircle: number;
  marks: {urgent: number; hours: number; now: number; password: number};
  alarm: number; // 語氣字眼轉為紅框
};

const ROWS = [
  {from: '行政部', subject: '本週會議室預約提醒', preview: '請於週三前完成下週會議室登記，逾期將開放其他單位…', time: '08:40'},
  {from: '專案小組', subject: 'Q3 進度追蹤表已更新', preview: '請各組確認負責項目的最新進度，並於週五前回填…', time: '昨天'},
  {from: '福委會', subject: '中秋禮品登記開始', preview: '登記期間至本月底，請同仁把握時間完成選擇…', time: '昨天'},
  {from: '人資部', subject: '教育訓練報名通知', preview: '本季線上課程開放報名，名額有限…', time: '週一'},
];

const Row: React.FC<{
  from: string;
  subject: string;
  preview: string;
  time: string;
  unread?: boolean;
  bg?: string;
  style?: React.CSSProperties;
}> = ({from, subject, preview, time, unread, bg = 'transparent', style}) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      height: INBOX.rowH,
      borderBottom: `2px solid ${C.paperLine}`,
      background: bg,
      ...style,
    }}
  >
    {unread && (
      <div style={{position: 'absolute', left: 22, top: 30, width: 14, height: 14, borderRadius: 7, background: C.link}} />
    )}
    <div
      style={{position: 'absolute', left: 52, top: 16, fontSize: 27, fontWeight: 700, color: C.ink}}
    >
      {from}
    </div>
    <div style={{position: 'absolute', right: 36, top: 18, fontSize: 22, color: unread ? C.link : C.inkSoft, fontWeight: unread ? 700 : 400}}>
      {time}
    </div>
    <div
      style={{
        position: 'absolute',
        left: 52,
        top: 52,
        fontSize: 25,
        fontWeight: unread ? 700 : 400,
        color: unread ? C.ink : '#33425A',
      }}
    >
      {subject}
    </div>
    <div style={{position: 'absolute', left: 52, top: 84, fontSize: 20, color: C.inkSoft}}>{preview}</div>
  </div>
);

const InboxView: React.FC<{s: MailState}> = ({s}) => {
  const push = s.newRow * INBOX.rowH;
  return (
    <div style={{position: 'absolute', inset: 0}}>
      {/* 側欄 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: INBOX.sideW,
          background: C.paperAlt,
          borderRight: `2px solid ${C.paperLine}`,
          padding: '28px 18px',
          boxSizing: 'border-box',
        }}
      >
        {['收件匣', '已寄送', '草稿', '封存', '垃圾郵件'].map((name, i) => (
          <div
            key={name}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 58,
              padding: '0 18px',
              marginBottom: 6,
              borderRadius: 12,
              fontSize: 25,
              fontWeight: i === 0 ? 700 : 400,
              color: i === 0 ? C.ink : C.inkSoft,
              background: i === 0 ? '#E1E9F6' : 'transparent',
            }}
          >
            <span style={{display: 'flex', alignItems: 'center', gap: 14}}>
              <span style={{width: 12, height: 12, borderRadius: 3, background: i === 0 ? C.link : '#B7C2D2'}} />
              {name}
            </span>
            {i === 0 && (
              <span
                style={{
                  minWidth: 34,
                  height: 34,
                  borderRadius: 17,
                  background: C.red,
                  color: '#fff',
                  fontSize: 20,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {s.badge}
              </span>
            )}
          </div>
        ))}
      </div>
      {/* 列表 */}
      <div style={{position: 'absolute', left: INBOX.sideW, right: 0, top: 0, bottom: 0, overflow: 'hidden'}}>
        <div style={{position: 'absolute', left: 36, top: 20, fontSize: 32, fontWeight: 700, color: C.ink}}>收件匣</div>
        <div style={{position: 'absolute', left: 0, right: 0, top: INBOX.headerH, bottom: 0, overflow: 'hidden'}}>
          {ROWS.map((r, i) => (
            <Row key={r.from} {...r} style={{top: i * INBOX.rowH + push}} />
          ))}
          <Row
            from={FAKE.senderName}
            subject={FAKE.subject}
            preview="系統偵測到您的帳號異常，將於 24 小時後停用，請立即完成驗證…"
            time={FAKE.time}
            unread
            bg={`rgba(245,165,36,${0.16 + 0.14 * s.rowHover})`}
            style={{
              top: -INBOX.rowH + push,
              opacity: s.newRow,
              boxShadow: `inset 6px 0 0 ${C.yellow}`,
            }}
          />
        </div>
      </div>
    </div>
  );
};

const MailView: React.FC<{s: MailState}> = ({s}) => {
  const m = s.marks;
  const hot = s.alarm > 0.5;
  const urgentColor = hot ? 'rgba(229,72,77,0.28)' : 'rgba(245,165,36,0.45)';
  const outline = hot ? C.red : undefined;
  const btnBg = s.hover > 0.5 ? '#1F55C4' : C.link;
  return (
    <div style={{position: 'absolute', inset: 0}}>
      {/* 工具列 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 64,
          borderBottom: `2px solid ${C.paperLine}`,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          paddingLeft: MAIL.padX - 8,
        }}
      >
        {['回覆', '全部回覆', '轉寄', '刪除'].map((t) => (
          <div
            key={t}
            style={{
              fontSize: 21,
              color: C.inkSoft,
              padding: '6px 18px',
              borderRadius: 8,
              border: `2px solid ${C.paperLine}`,
            }}
          >
            {t}
          </div>
        ))}
      </div>
      {/* 主旨 */}
      <div
        style={{
          position: 'absolute',
          left: MAIL.padX,
          top: MAIL.subjectY - TITLE_H,
          fontSize: 40,
          fontWeight: 700,
          color: C.ink,
          whiteSpace: 'nowrap',
        }}
      >
        <Mark p={m.urgent} color={urgentColor} outline={m.urgent > 0.9 ? outline : undefined}>
          【緊急】
        </Mark>
        您的帳號將於 24 小時後停用
      </div>
      {/* 寄件人 */}
      <div
        style={{
          position: 'absolute',
          left: MAIL.padX,
          top: MAIL.senderY - TITLE_H,
          width: 64,
          height: 64,
          borderRadius: 32,
          background: C.link,
          color: '#fff',
          fontSize: 30,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        資
      </div>
      <div
        style={{
          position: 'absolute',
          left: MAIL.padX + 84,
          top: MAIL.senderY - TITLE_H - 2,
          fontSize: 28,
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'baseline',
          gap: 14,
        }}
      >
        <span style={{position: 'relative', fontWeight: 700, color: C.ink}}>
          <Mark p={s.nameMark} color={`rgba(245,165,36,${0.45 * s.s3Fade})`}>
            {FAKE.senderName}
          </Mark>
        </span>
        <span style={{position: 'relative', fontFamily: MONO, fontSize: 25, color: C.inkSoft}}>
          &lt;{FAKE.senderAddr}&gt;
          <Circle p={s.addrCircle} color={C.red} pad={[20, 16]} stroke={5} opacity={s.s3Fade} />
        </span>
      </div>
      <div
        style={{position: 'absolute', left: MAIL.padX + 84, top: MAIL.senderY - TITLE_H + 40, fontSize: 22, color: C.inkSoft}}
      >
        收件者：我
      </div>
      <div style={{position: 'absolute', right: 44, top: MAIL.senderY - TITLE_H + 4, fontSize: 22, color: C.inkSoft}}>
        今天 上午 {FAKE.time}
      </div>
      <div
        style={{position: 'absolute', left: MAIL.padX, right: 44, top: MAIL.dividerY - TITLE_H, height: 2, background: C.paperLine}}
      />
      {/* 內文 */}
      {[
        <>親愛的同仁您好：</>,
        <>
          系統偵測到您的帳號異常，將於{' '}
          <Mark p={m.hours} color={urgentColor} outline={m.hours > 0.9 ? outline : undefined}>
            24 小時
          </Mark>
          後停用。
        </>,
        <>
          請
          <Mark p={m.now} color={urgentColor} outline={m.now > 0.9 ? outline : undefined}>
            立即
          </Mark>
          點擊下方按鈕完成驗證。
        </>,
        <>
          驗證時
          <Mark p={m.password} color="rgba(229,72,77,0.28)" outline={m.password > 0.9 ? C.red : undefined}>
            請輸入密碼
          </Mark>
          ，以免帳號遭到停用。
        </>,
      ].map((content, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: MAIL.padX,
            top: MAIL.bodyY[i] - TITLE_H,
            fontSize: 30,
            color: C.ink,
            whiteSpace: 'nowrap',
          }}
        >
          {content}
        </div>
      ))}
      {/* 按鈕 */}
      <div
        style={{
          position: 'absolute',
          left: MAIL.button.x,
          top: MAIL.button.y - TITLE_H,
          width: MAIL.button.w,
          height: MAIL.button.h,
          borderRadius: 12,
          background: btnBg,
          color: '#fff',
          fontSize: 30,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: s.hover > 0.5 ? `0 0 0 5px rgba(47,111,235,0.3)` : 'none',
        }}
      >
        立即驗證帳號
      </div>
      <div style={{position: 'absolute', left: MAIL.padX, top: MAIL.signY - TITLE_H, fontSize: 25, color: C.inkSoft}}>
        {FAKE.senderName} 敬上
      </div>
      {/* 狀態列（滑鼠停在連結上時顯示真正網址） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: MAIL.statusH,
          background: '#E6EBF2',
          borderTop: `2px solid ${C.paperLine}`,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 22,
          fontFamily: MONO,
          fontSize: 23,
          color: '#3A4A60',
          opacity: s.status,
          transform: `translateY(${(1 - s.status) * MAIL.statusH}px)`,
          whiteSpace: 'nowrap',
        }}
      >
        http://
        <span style={{position: 'relative', color: s.urlCircle > 0 ? C.red : undefined, fontWeight: 700}}>
          {FAKE.fakeDomain}
          <Circle p={s.urlCircle} color={C.red} pad={[16, 10]} stroke={5} />
        </span>
        /verify/login.php?id=7f3a9
      </div>
    </div>
  );
};

/** 淺色郵件視窗（世界座標，外層負責鏡頭縮放） */
export const MailWindow: React.FC<{s: MailState; redFrame: number}> = ({s, redFrame}) => (
  <div
    style={{
      position: 'absolute',
      left: WIN.x,
      top: WIN.y,
      width: WIN.w,
      height: WIN.h,
      borderRadius: 22,
      background: C.paper,
      overflow: 'hidden',
      fontFamily: FONT,
      boxShadow: `0 30px 80px rgba(0,0,0,0.5), 0 0 0 ${redFrame > 0 ? 10 : 0}px rgba(229,72,77,${redFrame}), 0 0 60px ${redFrame > 0 ? 16 : 0}px rgba(229,72,77,${0.45 * redFrame})`,
    }}
  >
    {/* 標題列 */}
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: TITLE_H,
        background: '#E4EAF2',
        borderBottom: `2px solid ${C.paperLine}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        color: C.inkSoft,
        fontWeight: 700,
      }}
    >
      <div style={{position: 'absolute', left: 22, display: 'flex', gap: 10}}>
        {['#F0A6A8', '#F5D38E', '#9FD9B8'].map((c) => (
          <div key={c} style={{width: 16, height: 16, borderRadius: 8, background: c}} />
        ))}
      </div>
      郵件
    </div>
    <div style={{position: 'absolute', left: 0, right: 0, top: TITLE_H, bottom: 0}}>
      {s.mode < 1 && (
        <div style={{position: 'absolute', inset: 0, opacity: 1 - s.mode}}>
          <InboxView s={s} />
        </div>
      )}
      {s.mode > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: s.mode,
            transform: `scale(${0.97 + 0.03 * s.mode})`,
            transformOrigin: '50% 30%',
            background: C.paper,
          }}
        >
          <MailView s={s} />
        </div>
      )}
    </div>
  </div>
);
