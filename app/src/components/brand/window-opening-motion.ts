// Chronologie du pack V2 : carte fixe, surgissement, rebond, clin d’œil.
export const WINDOW_POSE_MS = 1140;
export const WINDOW_EXIT_MS = 260;

export function phase(t: number, start: number, end: number) {
  "worklet";
  return Math.max(0, Math.min(1, (t - start) / (end - start)));
}
export function smooth(x: number) {
  "worklet";
  return x * x * x * (x * (x * 6 - 15) + 10);
}
export function ease(t: number, start: number, end: number) {
  "worklet";
  return smooth(phase(t, start, end));
}
export function windowPose(t: number) {
  "worklet";
  if (t < .14) return { y: 415, angle: -10, sx: .9, sy: .9 };
  if (t < .46) {
    const u = 1 - (1 - phase(t, .14, .46)) ** 3;
    return { y: 415 - 471 * u, angle: -10 + 13 * u, sx: .9 + .14 * u, sy: 1.08 - .065 * u };
  }
  if (t < .65) {
    const u = ease(t, .46, .65);
    return { y: -56 + 27 * u, angle: 3 - 6.5 * u, sx: 1.04 - .015 * u, sy: 1.015 - .015 * u };
  }
  const tilt = ease(t, .64, .73) * (1 - ease(t, .94, 1.09));
  return { y: -29 - 2 * tilt, angle: -3.5 - 3 * tilt, sx: 1.025, sy: 1 };
}
export function windowWink(t: number) {
  "worklet";
  return ease(t, .69, .765) * (1 - ease(t, .835, .94));
}
export function poseMatrix(t: number): [number, number, number, number, number, number] {
  "worklet";
  const p = windowPose(t);
  const rad = p.angle * Math.PI / 180;
  const a = Math.cos(rad) * p.sx, b = Math.sin(rad) * p.sx;
  const c = -Math.sin(rad) * p.sy, d = Math.cos(rad) * p.sy;
  return [a, b, c, d, 309 - a * 309 - c * 275, p.y + 275 - b * 309 - d * 275];
}
