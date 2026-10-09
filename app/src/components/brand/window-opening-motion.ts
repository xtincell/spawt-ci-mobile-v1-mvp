import atlas from "../../../assets/brand/window-opening.atlas.json";

export const WINDOW_POSE_MS = atlas.poseDurationMs;
export const WINDOW_EXIT_MS = atlas.exitDurationMs;

export function windowFrameAt(seconds: number) {
  return Math.max(0, Math.min(atlas.frames - 1, Math.floor(seconds * atlas.fps)));
}

/** Une pause du thread JS ne doit pas sauter le clin d'œil du pack. */
export function advanceWindowClock(elapsedMs: number, deltaMs: number) {
  return Math.min(WINDOW_POSE_MS, elapsedMs + Math.max(0, Math.min(deltaMs, 2000 / atlas.fps)));
}
