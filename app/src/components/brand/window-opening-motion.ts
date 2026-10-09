import atlas from "../../../assets/brand/window-opening.atlas.json";

export const WINDOW_POSE_MS = atlas.poseDurationMs;
export const WINDOW_EXIT_MS = atlas.exitDurationMs;

export function windowFrameAt(seconds: number) {
  "worklet";
  return Math.max(0, Math.min(atlas.frames - 1, Math.floor(seconds * atlas.fps)));
}
