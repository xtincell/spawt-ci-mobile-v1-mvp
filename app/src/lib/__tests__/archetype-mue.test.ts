// Chantier 13 archétypes — tests de la règle d'inertie de la mue (PRD §5.5).
// Décision pure (evaluateArchetypeTransition) + persistance AsyncStorage.

const mockStorage = new Map<string, string>();
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((k: string) => Promise.resolve(mockStorage.get(k) ?? null)),
    setItem: jest.fn((k: string, v: string) => {
      mockStorage.set(k, v);
      return Promise.resolve();
    }),
    removeItem: jest.fn((k: string) => {
      mockStorage.delete(k);
      return Promise.resolve();
    }),
  },
}));

import {
  MUE_STABILITY_THRESHOLD,
  MUE_STREAK_STORAGE_KEY,
  PENDING_MUE_STORAGE_KEY,
  evaluateArchetypeTransition,
  loadMueStreak,
  loadPendingMue,
  saveMueStreak,
  savePendingMue,
  type MueStreak,
} from "../archetype-mue";

beforeEach(() => {
  mockStorage.clear();
});

describe("evaluateArchetypeTransition — décision pure", () => {
  it("pas d'archétype courant → assignation directe sans inertie (legacy)", () => {
    const out = evaluateArchetypeTransition({
      current: null,
      candidate: "pisteur",
      streak: null,
    });
    expect(out).toEqual({ type: "assign", to: "pisteur" });
  });

  it("candidat = actuel → reset du compteur (les recalculs doivent être consécutifs)", () => {
    const streak: MueStreak = { candidate: "vent", count: 3 };
    const out = evaluateArchetypeTransition({
      current: "gardien",
      candidate: "gardien",
      streak,
    });
    expect(out).toEqual({ type: "none", streak: null });
  });

  it("nouveau candidat différent → compteur repart à 1", () => {
    const out = evaluateArchetypeTransition({
      current: "gardien",
      candidate: "vent",
      streak: { candidate: "pisteur", count: 4 },
    });
    expect(out).toEqual({ type: "none", streak: { candidate: "vent", count: 1 } });
  });

  it("même candidat consécutif → compteur +1, pas de mue sous le seuil", () => {
    const out = evaluateArchetypeTransition({
      current: "gardien",
      candidate: "vent",
      streak: { candidate: "vent", count: MUE_STABILITY_THRESHOLD - 2 },
    });
    expect(out).toEqual({
      type: "none",
      streak: { candidate: "vent", count: MUE_STABILITY_THRESHOLD - 1 },
    });
  });

  it(`mue au ${MUE_STABILITY_THRESHOLD}e recalcul consécutif identique`, () => {
    const out = evaluateArchetypeTransition({
      current: "gardien",
      candidate: "vent",
      streak: { candidate: "vent", count: MUE_STABILITY_THRESHOLD - 1 },
    });
    expect(out).toEqual({ type: "mue", from: "gardien", to: "vent" });
  });

  it("scénario complet : 5 recalculs consécutifs identiques déclenchent la mue", () => {
    let streak: MueStreak | null = null;
    let mue = null;
    for (let i = 0; i < MUE_STABILITY_THRESHOLD; i++) {
      const out = evaluateArchetypeTransition({
        current: "gardien",
        candidate: "murmure",
        streak,
      });
      if (out.type === "mue") {
        mue = out;
        break;
      }
      streak = out.type === "none" ? out.streak : null;
    }
    expect(mue).toEqual({ type: "mue", from: "gardien", to: "murmure" });
  });

  it("scénario interrompu : un retour à l'actuel au milieu casse la série", () => {
    let streak: MueStreak | null = null;
    // 3 recalculs "murmure"…
    for (let i = 0; i < 3; i++) {
      const out = evaluateArchetypeTransition({ current: "gardien", candidate: "murmure", streak });
      streak = out.type === "none" ? out.streak : null;
    }
    // …puis un recalcul "gardien" (actuel) → reset…
    const back = evaluateArchetypeTransition({ current: "gardien", candidate: "gardien", streak });
    expect(back).toEqual({ type: "none", streak: null });
    // …le candidat suivant repart à 1.
    const next = evaluateArchetypeTransition({ current: "gardien", candidate: "murmure", streak: null });
    expect(next).toEqual({ type: "none", streak: { candidate: "murmure", count: 1 } });
  });
});

describe("archetype-mue — persistance AsyncStorage", () => {
  it("round-trip du compteur + clear via null", async () => {
    await saveMueStreak({ candidate: "lame", count: 2 });
    expect(await loadMueStreak()).toEqual({ candidate: "lame", count: 2 });
    await saveMueStreak(null);
    expect(await loadMueStreak()).toBeNull();
    expect(mockStorage.has(MUE_STREAK_STORAGE_KEY)).toBe(false);
  });

  it("compteur corrompu (clé inconnue) → null, pas de crash", async () => {
    mockStorage.set(MUE_STREAK_STORAGE_KEY, JSON.stringify({ candidate: "licorne", count: 3 }));
    expect(await loadMueStreak()).toBeNull();
    mockStorage.set(MUE_STREAK_STORAGE_KEY, "pas-du-json");
    expect(await loadMueStreak()).toBeNull();
  });

  it("round-trip du constat en attente + validation des clés", async () => {
    await savePendingMue({ from: "gardien", to: "vent" });
    expect(await loadPendingMue()).toEqual({ from: "gardien", to: "vent" });
    await savePendingMue(null);
    expect(await loadPendingMue()).toBeNull();
    // `to` invalide → constat ignoré (jamais d'archétype fantaisiste à l'écran).
    mockStorage.set(PENDING_MUE_STORAGE_KEY, JSON.stringify({ from: "gardien", to: "licorne" }));
    expect(await loadPendingMue()).toBeNull();
  });
});
