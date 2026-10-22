import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sprites from "../../assets/brand/window-opening.sprites.json";
import { advanceWindowClock, windowFrameAt, WINDOW_EXIT_MS, WINDOW_POSE_MS } from "../../src/components/brand/window-opening-motion";

describe("images locales du pack SPAWT fenêtre V2", () => {
  it("conserve les 69 images source, leur durée et le cadrage de 200 × 320 dp", () => {
    expect(sprites.frames).toBe(69);
    expect(sprites.fps).toBe(60);
    expect(WINDOW_POSE_MS).toBe(1150);
    expect(WINDOW_EXIT_MS).toBe(260);
    expect(sprites.frameWidth / sprites.pixelRatio).toBe(200);
    expect(sprites.frameHeight / sprites.pixelRatio).toBe(320);
    const source = fs.readFileSync(path.resolve(__dirname, "../../assets/brand/window-opening.source.mp4"));
    expect(crypto.createHash("sha256").update(source).digest("hex")).toBe(sprites.sourceSha256);
  });
  it("garde chaque texture sous 2048 px et couvre toutes les images, y compris la pose finale", () => {
    expect(sprites.framesPerSheet * 2).toBeGreaterThanOrEqual(sprites.frames);
    for (let i = 0; i < 2; i++) {
      const bytes = fs.readFileSync(path.resolve(__dirname, `../../assets/brand/window-opening.sheet-${i}.png`));
      expect(bytes.readUInt32BE(16)).toBe(sprites.columns * sprites.frameWidth);
      expect(bytes.readUInt32BE(20)).toBe(sprites.rows * sprites.frameHeight);
      expect(Math.max(bytes.readUInt32BE(16), bytes.readUInt32BE(20))).toBeLessThanOrEqual(2048);
      expect(crypto.createHash("sha256").update(bytes).digest("hex")).toBe(sprites.sheetSha256[i]);
    }
  });
  it("ralentit une frame UI tardive pour conserver le clin d’œil, puis garde la pose finale", () => {
    const beforeWink = 44 * 1000 / 60;
    const delayed = advanceWindowClock(beforeWink, 600);
    expect(windowFrameAt(delayed)).toBeLessThanOrEqual(46);
    expect(windowFrameAt(delayed)).toBeGreaterThanOrEqual(45);
    expect(windowFrameAt(5000)).toBe(68);
    expect(windowFrameAt(-1)).toBe(0);
  });
});
