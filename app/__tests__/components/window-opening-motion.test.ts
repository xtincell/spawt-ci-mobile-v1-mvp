import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import media from "../../assets/brand/window-opening.media.json";
import { WINDOW_EXIT_MS, WINDOW_POSE_MS } from "../../src/components/brand/window-opening-motion";

describe("vidéo locale du pack SPAWT fenêtre V2", () => {
  it("conserve les 69 images source à 60 images/s et une sortie de 260 ms", () => {
    expect(media.frames).toBe(69);
    expect(media.fps).toBe(60);
    expect(WINDOW_POSE_MS).toBe(media.frames * 1000 / media.fps);
    expect(WINDOW_EXIT_MS).toBe(260);
  });
  it("fournit des poses de secours au même cadrage que le lecteur natif", () => {
    for (const pose of ["first", "final"]) {
      const bytes = fs.readFileSync(path.resolve(__dirname, `../../assets/brand/window-opening.${pose}.png`));
      expect(bytes.readUInt32BE(16)).toBe(media.width);
      expect(bytes.readUInt32BE(20)).toBe(media.height);
    }
    expect(media.width / media.pixelRatio).toBe(200);
    expect(media.height / media.pixelRatio).toBe(320);
  });
  it("identifie la vidéo originale fournie et son adaptation locale pour le lecteur", () => {
    for (const [file, sha] of [["source", media.sourceSha256], ["native", media.nativeSha256]]) {
      const bytes = fs.readFileSync(path.resolve(__dirname, `../../assets/brand/window-opening.${file}.mp4`));
      expect(crypto.createHash("sha256").update(bytes).digest("hex")).toBe(sha);
    }
  });
});
