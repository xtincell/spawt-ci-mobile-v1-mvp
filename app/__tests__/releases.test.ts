// Story 7.1 — AC #2bis + AC #4 : RELEASES.md existe à la racine du repo et
// contient les 2 entrées backfill (build 1 + build 2).

import { existsSync, readFileSync } from "fs";
import { join } from "path";

// app/__tests__ → app → racine du repo.
const RELEASES_PATH = join(__dirname, "..", "..", "RELEASES.md");

describe("RELEASES.md — Story 7.1", () => {
  it("existe à la racine du repo", () => {
    expect(existsSync(RELEASES_PATH)).toBe(true);
  });

  it("contient les 2 entrées backfill + le format canonique", () => {
    const content = readFileSync(RELEASES_PATH, "utf8");
    expect(content).toContain("build-android-2026-05-28");
    expect(content).toContain("build-android-2026-06-01");
    expect(content).toContain("b92fbf1");
    expect(content).toContain("67851ec");
    // Format d'affichage canonique documenté.
    expect(content).toContain("v1.0.0 — build");
  });

  it("reste distinct de CHANGELOG.md (vue testeur)", () => {
    const content = readFileSync(RELEASES_PATH, "utf8");
    expect(content).toContain("vue **testeur**");
  });
});
