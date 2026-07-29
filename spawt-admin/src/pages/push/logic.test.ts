// Console admin 07/2026 — tests logique pure page Campagnes push (Edge
// push-send). Ciblage, estimation (deps mockées), limite 3/jour UTC.

import { describe, it, expect, vi } from "vitest";
import {
  EMPTY_PUSH_FORM,
  MAX_CAMPAIGNS_PER_DAY,
  MAX_SPAWTER_IDS,
  PUSH_ARCHETYPES,
  buildPushBody,
  campaignsToday,
  estimateTargets,
  pushErrorMessage,
  validatePushForm,
} from "./logic";

const BASE = { ...EMPTY_PUSH_FORM, title: "Le Guet est ouvert", body: "Viens spawter ce soir." };

describe("validatePushForm (miroir bornes Edge : 178 / 2048)", () => {
  it("accepte un composer valide", () => {
    expect(validatePushForm(BASE).ok).toBe(true);
    expect(validatePushForm({ ...BASE, deep_link: "/lieu/1234" }).ok).toBe(true);
  });

  it("refuse titre/corps vides ou trop longs", () => {
    expect(validatePushForm({ ...BASE, title: "  " }).ok).toBe(false);
    expect(validatePushForm({ ...BASE, title: "x".repeat(179) }).ok).toBe(false);
    expect(validatePushForm({ ...BASE, body: "x".repeat(2049) }).ok).toBe(false);
  });

  it("refuse un deep link exotique", () => {
    expect(validatePushForm({ ...BASE, deep_link: "javascript:alert(1)" }).ok).toBe(false);
  });
});

describe("buildPushBody (contrat Edge push-send)", () => {
  it("« tous » → spawter_ids explicites, cappés au max serveur", () => {
    const ids = Array.from({ length: MAX_SPAWTER_IDS + 5 }, (_, i) => `id-${i}`);
    const body = buildPushBody({ ...BASE, target: "all" }, ids);
    expect(body.spawter_ids).toHaveLength(MAX_SPAWTER_IDS);
    expect(body.stade).toBeUndefined();
    expect(body.title).toBe("Le Guet est ouvert");
  });

  it("stade / archétype / gold → filtre serveur, sans spawter_ids", () => {
    expect(buildPushBody({ ...BASE, target: "stade", stade: "djidji" }, null)).toMatchObject({ stade: "djidji" });
    expect(buildPushBody({ ...BASE, target: "archetype", archetype: "braise" }, null)).toMatchObject({ archetype: "braise" });
    expect(buildPushBody({ ...BASE, target: "gold" }, null)).toMatchObject({ gold_only: true });
  });

  it("deep link → data.deep_link ; absent sinon", () => {
    expect(buildPushBody({ ...BASE, target: "gold", deep_link: "/carte" }, null).data).toEqual({ deep_link: "/carte" });
    expect(buildPushBody({ ...BASE, target: "gold" }, null).data).toBeUndefined();
  });

  it("les 13 archétypes canoniques du quiz sont proposés", () => {
    expect(PUSH_ARCHETYPES).toHaveLength(13);
    expect(PUSH_ARCHETYPES).toContain("omnivore");
  });
});

describe("campaignsToday (jour UTC, aligné comptage serveur)", () => {
  it("ne compte que les campagnes du jour UTC courant", () => {
    const now = new Date("2026-07-26T08:00:00Z");
    const rows = [
      { created_at: "2026-07-26T00:30:00Z" }, // aujourd'hui UTC
      { created_at: "2026-07-26T07:59:00Z" }, // aujourd'hui UTC
      { created_at: "2026-07-25T23:59:00Z" }, // hier UTC
    ];
    expect(campaignsToday(rows, now)).toBe(2);
    expect(MAX_CAMPAIGNS_PER_DAY).toBe(3);
  });
});

describe("estimateTargets (deps injectées — pattern mock dataProvider)", () => {
  it("déduplique les ids puis compte les tokens", async () => {
    const fetchSpawterIds = vi.fn().mockResolvedValue(["a", "b", "a", "c"]);
    const countTokens = vi.fn().mockResolvedValue(5);
    const est = await estimateTargets({ ...BASE, target: "all" }, { fetchSpawterIds, countTokens });
    expect(est).toEqual({ spawters: 3, tokens: 5 });
    expect(countTokens).toHaveBeenCalledWith(["a", "b", "c"]);
  });

  it("aucune cible → 0/0 sans compter les tokens", async () => {
    const fetchSpawterIds = vi.fn().mockResolvedValue([]);
    const countTokens = vi.fn();
    const est = await estimateTargets({ ...BASE, target: "gold" }, { fetchSpawterIds, countTokens });
    expect(est).toEqual({ spawters: 0, tokens: 0 });
    expect(countTokens).not.toHaveBeenCalled();
  });
});

describe("pushErrorMessage", () => {
  it("mappe les codes Edge vers des messages FR actionnables", () => {
    expect(pushErrorMessage("campaign_limit_reached")).toContain("3 campagnes");
    expect(pushErrorMessage("forbidden")).toBe("Réservé aux admins");
    expect(pushErrorMessage("missing_targets")).toMatch(/cible/i);
    expect(pushErrorMessage(undefined)).toMatch(/inconnue/);
  });
});
