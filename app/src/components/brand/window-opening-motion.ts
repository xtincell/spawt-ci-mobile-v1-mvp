import sprites from "../../../assets/brand/window-opening.sprites.json";

export const WINDOW_POSE_MS = sprites.poseDurationMs;
export const WINDOW_EXIT_MS = sprites.exitDurationMs;

export function advanceWindowClock(elapsedMs: number, deltaMs: number): number {
  "worklet";
  return elapsedMs + Math.max(0, Math.min(deltaMs, 1000 / 30));
}

export function windowFrameAt(elapsedMs: number): number {
  "worklet";
  return Math.min(sprites.frames - 1, Math.max(0, Math.floor(elapsedMs * sprites.fps / 1000)));
}
