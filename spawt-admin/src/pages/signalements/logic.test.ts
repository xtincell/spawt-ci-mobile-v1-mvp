// Câblage MVP — tests logique pure page Signalements.

import { describe, it, expect } from "vitest";
import { reasonLabel, buildResolutionPayload, REASON_LABELS } from "./logic";

describe("reasonLabel", () => {
  it("mappe les 4 motifs canoniques (Faux-Pas PRD)", () => {
    expect(reasonLabel("fake_review")).toBe("Avis suspect ou faux");
    expect(reasonLabel("hater")).toBe("Méchanceté gratuite");
    expect(reasonLabel("gatekeeping")).toBe("Fausses infos volontaires");
    expect(reasonLabel("autre")).toBe("Autre");
  });

  it("retourne le code brut pour un motif inconnu (forward-compat)", () => {
    expect(reasonLabel("nouveau_motif")).toBe("nouveau_motif");
  });

  it("couvre exactement les codes de la contrainte CHECK 0026", () => {
    expect(Object.keys(REASON_LABELS).sort()).toEqual(
      ["autre", "fake_review", "gatekeeping", "hater"],
    );
  });
});

describe("buildResolutionPayload", () => {
  it("construit une résolution complète avec identité staff", () => {
    const p = buildResolutionPayload("removed", "staff-1");
    expect(p.status).toBe("resolved");
    expect(p.resolution_action).toBe("removed");
    expect(p.resolved_by_staff_id).toBe("staff-1");
    expect(typeof p.resolved_at).toBe("string");
  });

  it("laisse le trigger DB auto-populer sans identité (défense en profondeur)", () => {
    const p = buildResolutionPayload("kept", null);
    expect(p.status).toBe("resolved");
    expect(p.resolution_action).toBe("kept");
    expect(p).not.toHaveProperty("resolved_by_staff_id");
    expect(p).not.toHaveProperty("resolved_at");
  });
});
