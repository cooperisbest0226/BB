export type Phrase = {text: string; from: number};
export type Line = {
  key: string;
  file: string;
  sub: string;
  from: number;
  duration: number;
  seconds: number;
  phrases: Phrase[];
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
