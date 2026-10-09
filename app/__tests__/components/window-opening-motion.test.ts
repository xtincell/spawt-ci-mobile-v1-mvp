import fs from "node:fs";
import path from "node:path";
import atlas from "../../assets/brand/window-opening.atlas.json";
import { advanceWindowClock, windowFrameAt, WINDOW_EXIT_MS, WINDOW_POSE_MS } from "../../src/components/brand/window-opening-motion";

describe("images du pack SPAWT fenêtre V2", () => {
  it("conserve le repère initial et la pose finale pendant une restauration longue", () => {
    expect(windowFrameAt(-1)).toBe(0);
    expect(windowFrameAt(0)).toBe(0);
    expect(windowFrameAt(1.14)).toBe(atlas.frames - 1);
    expect(windowFrameAt(30)).toBe(atlas.frames - 1);
  });
  it("fournit 60 images/s et termine avec le fondu à 1,40 seconde", () => {
    expect(atlas.fps).toBe(60);
    expect(atlas.frames).toBe(Math.ceil(WINDOW_POSE_MS * atlas.fps / 1000));
    expect(WINDOW_POSE_MS + WINDOW_EXIT_MS).toBe(1400);
  });
  it("livre une texture conforme au cadrage et sous la limite GPU de 4096 px", () => {
    const bytes = fs.readFileSync(path.resolve(__dirname, "../../assets/brand/window-opening.atlas.png"));
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    expect(width).toBe(atlas.columns * atlas.frameWidth);
    expect(height).toBe(atlas.rows * atlas.frameHeight);
    expect(width).toBeLessThanOrEqual(4096);
    expect(height).toBeLessThanOrEqual(4096);
  });
  it("identifie la vidéo fournie à partir de laquelle les images sont extraites", () => {
    const crypto = require("node:crypto") as typeof import("node:crypto");
    const bytes = fs.readFileSync(path.resolve(__dirname, "../../assets/brand/window-opening.source.mp4"));
    expect(crypto.createHash("sha256").update(bytes).digest("hex")).toBe(atlas.sourceSha256);
  });
  it("conserve le clin d'œil même si Android suspend le thread JS pendant son apparition", () => {
    const beforeWink = 750;
    const afterPause = advanceWindowClock(beforeWink, 500);
    expect(windowFrameAt(afterPause / 1000)).toBeGreaterThanOrEqual(46);
    expect(windowFrameAt(afterPause / 1000)).toBeLessThanOrEqual(47);
    expect(advanceWindowClock(afterPause, -10)).toBe(afterPause);
    expect(advanceWindowClock(WINDOW_POSE_MS - 1, 500)).toBe(WINDOW_POSE_MS);
  });
});
