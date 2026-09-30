import {BRAND} from '../brand';

// 郵件視窗在「世界座標」中的位置（鏡頭縮放 1 時即為畫面座標）
export const WIN = {x: 260, y: 110, w: 1400, h: 770};
export const TITLE_H = 52;

// 信件內容（相對於視窗左上角）
export const MAIL = {
  padX: 56,
  subjectY: 132,
  senderY: 206,
  dividerY: 296,
  bodyY: [330, 384, 438, 492],
  button: {x: 56, y: 560, w: 310, h: 74},
  signY: 664,
  statusH: 46,
};

// 收件匣列表
export const INBOX = {sideW: 270, headerH: 78, rowH: 118};

export const FAKE = {
  senderName: `${BRAND.company} 資訊部`,
  senderAddr: 'it-support@cathaypovver.com.tw', // 兩個 v 冒充 w
  fakeDomain: 'cathaypovver.com.tw',
  realDomain: BRAND.domain,
  subject: '【緊急】您的帳號將於 24 小時後停用',
  url: 'http://cathaypovver.com.tw/verify/login.php?id=7f3a9',
  time: '09:12',
};

export type Cam = {fx: number; fy: number; s: number; ax: number; ay: number};
// fx/fy：要對準的世界座標點；s：縮放；ax/ay：該點在畫面上的位置
export const CAM = {
  full: {fx: 960, fy: 495, s: 1, ax: 960, ay: 495},
  sender: {fx: 960, fy: 348, s: 1.3, ax: 960, ay: 330},
  link: {fx: 960, fy: 700, s: 1.3, ax: 960, ay: 656},
  tone: {fx: 960, fy: 493, s: 1.3, ax: 960, ay: 456},
} satisfies Record<string, Cam>;

export const mixCam = (a: Cam, b: Cam, t: number): Cam => ({
  fx: a.fx + (b.fx - a.fx) * t,
  fy: a.fy + (b.fy - a.fy) * t,
  s: a.s + (b.s - a.s) * t,
  ax: a.ax + (b.ax - a.ax) * t,
  ay: a.ay + (b.ay - a.ay) * t,
});
