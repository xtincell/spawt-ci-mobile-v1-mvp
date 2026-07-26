// Console admin 07/2026 — tests logique pure page Défis de la Meute (0040).

import { describe, it, expect } from "vitest";
import {
  EMPTY_CHALLENGE_FORM,
  canTransition,
  challengeRowToForm,
  goalTypeLabel,
  nextStatuses,
  progressOf,
  progressPercent,
  validateChallengeForm,
  type ChallengeRow,
} from "./logic";

describe("cycle de vie draft → active → done (one-way)", () => {
  it("draft ne peut qu'activer, active ne peut que clore, done est final", () => {
    expect(nextStatuses("draft")).toEqual(["active"]);
    expect(nextStatuses("active")).toEqual(["done"]);
    expect(nextStatuses("done")).toEqual([]);
  });

  it("aucun retour en arrière possible", () => {
    expect(canTransition("active", "draft")).toBe(false);
    expect(canTransition("done", "active")).toBe(false);
    expect(canTransition("draft", "done")).toBe(false);
    expect(canTransition("draft", "active")).toBe(true);
  });
});

describe("progressPercent (jauge collective)", () => {
  it("borne [0, 100] et arrondit", () => {
    expect(progressPercent(250, 500)).toBe(50);
    expect(progressPercent(600, 500)).toBe(100);
    expect(progressPercent(0, 500)).toBe(0);
    expect(progressPercent(10, 0)).toBe(0); // target invalide → 0, pas NaN
  });
});

describe("progressOf (formats PostgREST objet vs tableau)", () => {
  const base: Omit<ChallengeRow, "challenge_progress"> = {
    id: "c1",
    code: "defi_test",
    title_key: "Ensemble : 500 spawts",
    description_key: "On ouvre la carte.",
    period_start: "2026-08-01",
    period_end: "2026-08-31",
    goal_type: "spawts_total",
    goal_target: 500,
    reward_paws: 20,
    status: "active",
    created_at: "2026-07-26T00:00:00Z",
  };

  it("lit current_value en objet, en tableau, et 0 si absent", () => {
    expect(progressOf({ ...base, challenge_progress: { current_value: 42, updated_at: "" } })).toBe(42);
    expect(progressOf({ ...base, challenge_progress: [{ current_value: 7, updated_at: "" }] })).toBe(7);
    expect(progressOf({ ...base, challenge_progress: null })).toBe(0);
  });
});

describe("validateChallengeForm", () => {
  const valid = {
    ...EMPTY_CHALLENGE_FORM,
    code: "defi_aout_2026",
    title: "Ensemble : 500 spawts ce mois",
    description: "La Meute ouvre la carte d'Abidjan.",
    period_start: "2026-08-01",
    period_end: "2026-08-31",
    goal_target: "500",
    reward_paws: "20",
  };

  it("accepte un défi valide — le texte FR est stocké TEL QUEL dans title_key (convention)", () => {
    const res = validateChallengeForm(valid);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.row.title_key).toBe("Ensemble : 500 spawts ce mois");
      expect(res.row.description_key).toBe("La Meute ouvre la carte d'Abidjan.");
      expect(res.row.goal_target).toBe(500);
      expect(res.row.reward_paws).toBe(20);
    }
  });

  it("refuse un code non slug", () => {
    const res = validateChallengeForm({ ...valid, code: "Défi Août !" });
    expect(res.ok).toBe(false);
  });

  it("refuse une période inversée (miroir CHECK 0040)", () => {
    const res = validateChallengeForm({ ...valid, period_start: "2026-09-01" });
    expect(res.ok).toBe(false);
  });

  it("refuse objectif <= 0 et paws négatifs ou non entiers", () => {
    expect(validateChallengeForm({ ...valid, goal_target: "0" }).ok).toBe(false);
    expect(validateChallengeForm({ ...valid, goal_target: "12.5" }).ok).toBe(false);
    expect(validateChallengeForm({ ...valid, reward_paws: "-3" }).ok).toBe(false);
  });
});

describe("libellés & re-pivot", () => {
  it("goalTypeLabel mappe les 4 types canoniques, code brut sinon", () => {
    expect(goalTypeLabel("spawts_total")).toContain("Spawts");
    expect(goalTypeLabel("type_futur")).toBe("type_futur");
  });

  it("challengeRowToForm re-pivote la row DB (goal_type inconnu → défaut sûr)", () => {
    const form = challengeRowToForm({
      id: "c1",
      code: "x",
      title_key: "T",
      description_key: "D",
      period_start: "2026-08-01",
      period_end: "2026-08-31",
      goal_type: "goal_inconnu",
      goal_target: 10,
      reward_paws: 0,
      status: "draft",
      created_at: "",
      challenge_progress: null,
    });
    expect(form.goal_type).toBe("spawts_total");
    expect(form.goal_target).toBe("10");
  });
});
