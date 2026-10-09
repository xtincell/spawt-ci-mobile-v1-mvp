import fs from "node:fs";
import path from "node:path";
import atlas from "../../assets/brand/window-opening.atlas.json";
import { windowFrameAt, WINDOW_EXIT_MS, WINDOW_POSE_MS } from "../../src/components/brand/window-opening-motion";

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
});
