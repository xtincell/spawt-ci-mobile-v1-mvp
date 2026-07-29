// MAJ consolidée 07/2026 — tests logique pure page Fonctionnalités.

import { describe, it, expect } from "vitest";
import {
  FLAG_LABELS,
  RLS_DENIED_MESSAGE,
  SCOPES,
  applyToggle,
  confirmInsert,
  flagLabel,
  groupGlobalFlags,
  planToggle,
  rollbackToggle,
  toggleErrorMessage,
  type FeatureFlagRow,
} from "./logic";

function row(partial: Partial<FeatureFlagRow> & Pick<FeatureFlagRow, "id" | "flag_code" | "scope">): FeatureFlagRow {
  return { enabled: false, spawter_id: null, expires_at: null, ...partial };
}

describe("flagLabel", () => {
  it("mappe les 4 codes produit connus (seeds guet/produit/paywall)", () => {
    expect(flagLabel("place-avg-price")).toBe("Prix moyen en F CFA (fiche lieu)");
    expect(flagLabel("onboarding-origin-country")).toBe("Question “Pays d'origine” (inscription)");
    expect(flagLabel("guet-geofence")).toBe("Le Guet (spawt automatique)");
    expect(flagLabel("paywall-geo")).toBe("Paywall géographique (Gold)");
  });

  it("retourne le code brut pour un code inconnu (forward-compat)", () => {
    expect(flagLabel("flag-mystere")).toBe("flag-mystere");
  });

  it("couvre exactement les 4 codes connus", () => {
    expect(Object.keys(FLAG_LABELS).sort()).toEqual([
      "guet-geofence",
      "onboarding-origin-country",
      "paywall-geo",
      "place-avg-price",
    ]);
  });
});

describe("groupGlobalFlags", () => {
  it("groupe les rows par flag_code avec une cellule par scope", () => {
    const rows = [
      row({ id: "a", flag_code: "guet-geofence", scope: "internal", enabled: true }),
      row({ id: "b", flag_code: "guet-geofence", scope: "prod", enabled: false }),
    ];
    const groups = groupGlobalFlags(rows, ["guet-geofence"]);
    expect(groups).toHaveLength(1);
    expect(groups[0].flagCode).toBe("guet-geofence");
    expect(groups[0].label).toBe("Le Guet (spawt automatique)");
    expect(groups[0].known).toBe(true);
    expect(groups[0].cells.internal).toEqual({ id: "a", enabled: true, expires_at: null });
    expect(groups[0].cells.prod).toEqual({ id: "b", enabled: false, expires_at: null });
    expect(groups[0].cells.alpha).toBeNull();
    expect(groups[0].cells.beta).toBeNull();
  });

  it("affiche les codes connus même sans aucune row (toggle = INSERT)", () => {
    const groups = groupGlobalFlags([]);
    expect(groups.map((g) => g.flagCode)).toEqual(Object.keys(FLAG_LABELS));
    for (const g of groups) {
      expect(Object.values(g.cells).every((c) => c === null)).toBe(true);
    }
  });

  it("exclut les overrides par spawter (spawter_id non NULL)", () => {
    const rows = [
      row({ id: "glob", flag_code: "paywall-geo", scope: "prod", enabled: false }),
      row({ id: "ovr", flag_code: "paywall-geo", scope: "prod", enabled: true, spawter_id: "spawter-1" }),
    ];
    const groups = groupGlobalFlags(rows, ["paywall-geo"]);
    expect(groups[0].cells.prod).toEqual({ id: "glob", enabled: false, expires_at: null });
  });

  it("ajoute les codes inconnus après les connus, triés alpha, en code brut", () => {
    const rows = [
      row({ id: "z", flag_code: "zeta-flag", scope: "prod" }),
      row({ id: "a", flag_code: "alpha-flag", scope: "prod" }),
    ];
    const groups = groupGlobalFlags(rows, ["guet-geofence"]);
    expect(groups.map((g) => g.flagCode)).toEqual(["guet-geofence", "alpha-flag", "zeta-flag"]);
    expect(groups[1].known).toBe(false);
    expect(groups[1].label).toBe("alpha-flag");
  });

  it("ignore un scope hors canon (défensif)", () => {
    const rows = [row({ id: "x", flag_code: "guet-geofence", scope: "canary", enabled: true })];
    const groups = groupGlobalFlags(rows, ["guet-geofence"]);
    expect(Object.values(groups[0].cells).every((c) => c === null)).toBe(true);
  });

  it("préserve expires_at dans la cellule", () => {
    const rows = [
      row({ id: "e", flag_code: "paywall-geo", scope: "beta", enabled: true, expires_at: "2026-12-31T00:00:00Z" }),
    ];
    const groups = groupGlobalFlags(rows, ["paywall-geo"]);
    expect(groups[0].cells.beta?.expires_at).toBe("2026-12-31T00:00:00Z");
  });
});

describe("planToggle", () => {
  const rows = [
    row({ id: "r1", flag_code: "guet-geofence", scope: "prod", enabled: true }),
    row({ id: "ovr", flag_code: "guet-geofence", scope: "beta", enabled: true, spawter_id: "s1" }),
  ];

  it("UPDATE ciblé par id avec enabled inversé quand la row globale existe", () => {
    expect(planToggle(rows, "guet-geofence", "prod")).toEqual({
      kind: "update",
      id: "r1",
      enabled: false,
    });
  });

  it("INSERT (enabled=true, spawter global) quand la row scope manque", () => {
    expect(planToggle(rows, "guet-geofence", "alpha")).toEqual({
      kind: "insert",
      flag_code: "guet-geofence",
      scope: "alpha",
      enabled: true,
    });
  });

  it("ne cible jamais un override spawter (upsert strictement global)", () => {
    // La seule row beta est un override spawter → plan = INSERT global.
    expect(planToggle(rows, "guet-geofence", "beta").kind).toBe("insert");
  });
});

describe("applyToggle / rollbackToggle / confirmInsert (feedback optimiste)", () => {
  const base = [row({ id: "r1", flag_code: "paywall-geo", scope: "prod", enabled: false })];

  it("applique un UPDATE optimiste sans muter l'état d'origine", () => {
    const next = applyToggle(base, { kind: "update", id: "r1", enabled: true }, "unused");
    expect(next[0].enabled).toBe(true);
    expect(base[0].enabled).toBe(false); // immutabilité
  });

  it("rollback d'un UPDATE = enabled re-inversé (rollback ciblé, pas snapshot)", () => {
    const plan = { kind: "update", id: "r1", enabled: true } as const;
    const optimistic = applyToggle(base, plan, "unused");
    const restored = rollbackToggle(optimistic, plan, "unused");
    expect(restored).toEqual(base);
  });

  it("applique un INSERT optimiste (row temporaire globale)", () => {
    const plan = { kind: "insert", flag_code: "paywall-geo", scope: "alpha", enabled: true } as const;
    const next = applyToggle(base, plan, "temp:paywall-geo:alpha");
    expect(next).toHaveLength(2);
    expect(next[1]).toEqual({
      id: "temp:paywall-geo:alpha",
      flag_code: "paywall-geo",
      scope: "alpha",
      enabled: true,
      spawter_id: null,
      expires_at: null,
    });
  });

  it("rollback d'un INSERT = row temporaire retirée", () => {
    const plan = { kind: "insert", flag_code: "paywall-geo", scope: "alpha", enabled: true } as const;
    const optimistic = applyToggle(base, plan, "temp:x");
    expect(rollbackToggle(optimistic, plan, "temp:x")).toEqual(base);
  });

  it("confirmInsert remplace la row temporaire par la row serveur (id réel)", () => {
    const plan = { kind: "insert", flag_code: "paywall-geo", scope: "alpha", enabled: true } as const;
    const optimistic = applyToggle(base, plan, "temp:x");
    const server = row({ id: "uuid-serveur", flag_code: "paywall-geo", scope: "alpha", enabled: true });
    const confirmed = confirmInsert(optimistic, "temp:x", server);
    expect(confirmed.find((r) => r.id === "temp:x")).toBeUndefined();
    expect(confirmed.find((r) => r.id === "uuid-serveur")).toEqual(server);
  });
});

describe("toggleErrorMessage", () => {
  it("succès (pas d'erreur, ≥1 ligne affectée) → null", () => {
    expect(toggleErrorMessage(null, 1)).toBeNull();
  });

  it("code 42501 (violation RLS à l'INSERT) → « Réservé aux admins »", () => {
    expect(toggleErrorMessage({ code: "42501", message: "new row violates row-level security policy" }, 0))
      .toBe(RLS_DENIED_MESSAGE);
    expect(RLS_DENIED_MESSAGE).toBe("Réservé aux admins");
  });

  it("détection RLS par message (code absent)", () => {
    expect(toggleErrorMessage({ message: "permission denied for table feature_flags" }, 0))
      .toBe(RLS_DENIED_MESSAGE);
  });

  it("UPDATE silencieusement filtré par la policy USING (0 ligne, pas d'erreur) → « Réservé aux admins »", () => {
    expect(toggleErrorMessage(null, 0)).toBe(RLS_DENIED_MESSAGE);
  });

  it("23505 (UNIQUE flag_code/spawter/scope) → message conflit row expirée", () => {
    expect(toggleErrorMessage({ code: "23505", message: "duplicate key value" }, 0))
      .toMatch(/Conflit.*expirée/);
  });

  it("autre erreur → message brut remonté tel quel (jamais masqué)", () => {
    expect(toggleErrorMessage({ code: "08006", message: "connection failure" }, 0))
      .toBe("connection failure");
  });
});

describe("SCOPES", () => {
  it("expose les 4 scopes canon dans l'ordre de rollout (CHECK migration 0004)", () => {
    expect(SCOPES).toEqual(["internal", "alpha", "beta", "prod"]);
  });
});
