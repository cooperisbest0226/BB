import {Easing, interpolate, spring} from 'remotion';

export const FPS = 30;

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** 0→1 線性進度（start 幀開始，dur 幀完成） */
export const progress = (frame: number, start: number, dur: number) =>
  interpolate(frame, [start, start + dur], [0, 1], clamp);

/** 0→1，帶緩出（進場用） */
export const easeIn = (frame: number, start: number, dur = 12) =>
  interpolate(frame, [start, start + dur], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});

/** 1→0，帶緩入（退場用） */
export const easeOut = (frame: number, start: number, dur = 10) =>
  interpolate(frame, [start, start + dur], [1, 0], {...clamp, easing: Easing.in(Easing.cubic)});

/** 在 [from, to) 區間內可見，前後各有淡入淡出 */
export const visible = (frame: number, from: number, to: number, fadeIn = 10, fadeOut = 10) =>
  Math.min(easeIn(frame, from, fadeIn), easeOut(frame, to - fadeOut, fadeOut));

/** 彈出（0→1，略帶回彈） */
export const pop = (frame: number, start: number) =>
  frame < start ? 0 : spring({frame: frame - start, fps: FPS, config: {damping: 13, stiffness: 170, mass: 0.7}});

/** 平滑插值（多段關鍵幀） */
export const keyframes = (frame: number, input: number[], output: number[]) =>
  interpolate(frame, input, output, {...clamp, easing: Easing.inOut(Easing.cubic)});

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
