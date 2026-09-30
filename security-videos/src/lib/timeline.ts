export type Phrase = {text: string; from: number};
export type Line = {
  key: string;
  file: string;
  sub: string;
  from: number;
  duration: number;
  seconds: number;
  phrases: Phrase[];
  subs: {text: string; from: number}[]; // 字幕分段（長句用「|」切開，各段從對應片語開始）
};
export type Scene = {id: string; from: number; duration: number; lines: Line[]; cues: Record<string, number>};
export type Timeline = {
  id: string;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  scenes: Scene[];
};

/** 以場景 id 取得場景；所有幀數都是全片的絕對幀 */
export const getScene = (tl: Timeline, id: string): Scene => {
  const s = tl.scenes.find((x) => x.id === id);
  if (!s) throw new Error(`scene not found: ${id}`);
  return s;
};

export const sceneEnd = (s: Scene) => s.from + s.duration;
/** 第 line 句（1 起算）第 phrase 個片語（1 起算）的開始幀 */
export const phraseAt = (s: Scene, line: number, phrase = 1) => s.lines[line - 1].phrases[phrase - 1].from;
export const lineEnd = (s: Scene, line: number) => s.lines[line - 1].from + s.lines[line - 1].duration;

/** 片語內的相對位置（0～1）換算成幀；用來對準片語中間的某個詞 */
export const phraseFrac = (s: Scene, line: number, phrase: number, frac: number) => {
  const l = s.lines[line - 1];
  const start = l.phrases[phrase - 1].from;
  const end = phrase < l.phrases.length ? l.phrases[phrase].from : l.from + l.duration;
  return Math.round(start + (end - start) * frac);
};
