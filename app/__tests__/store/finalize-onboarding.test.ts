// Story 2.6 — AC #8-1 : finalizeOnboarding réécrit (auth.uid, consent persistés, reset draft).

jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
      setItem: jest.fn((k: string, v: string) => {
        store.set(k, v);
        return Promise.resolve();
      }),
      removeItem: jest.fn((k: string) => {
        store.delete(k);
        return Promise.resolve();
      }),
      multiRemove: jest.fn((keys: string[]) => {
        for (const k of keys) store.delete(k);
        return Promise.resolve();
      }),
    },
  };
});

const mockSaveSpawter = jest.fn((..._args: unknown[]) => Promise.resolve(true));
const mockSavePalais = jest.fn((..._args: unknown[]) => Promise.resolve(true));
const mockClaim = jest.fn(async (..._args: unknown[]): Promise<unknown> => null);
const mockUpdateArchetype = jest.fn(async (..._args: unknown[]) => undefined);
jest.mock("../../src/lib/analytics", () => ({ track: jest.fn() }));
let mockSupabaseConfigured = false;
jest.mock("../../src/lib/data-source", () => ({
  saveSpawter: (arg: unknown) => mockSaveSpawter(arg),
  savePalais: (arg: unknown) => mockSavePalais(arg),
  claimMeuteHeritage: (...args: unknown[]) => mockClaim(...args),
  updateSpawterArchetype: (...args: unknown[]) => mockUpdateArchetype(...args),
  insertTitre: jest.fn(async () => undefined),
  get isSupabaseConfigured() {
    return mockSupabaseConfigured;
  },
}));

const mockGetUser = jest.fn();
jest.mock("../../src/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
  },
}));

import { useSpawterStore } from "../../src/store/spawter-store";
import { useOnboardingDraft } from "../../src/store/onboarding-draft";
import { SAMPLE_SPAWTER } from "../../src/data/seed/sample-spawter";
import type { OnboardingDraft } from "../../src/types/spawter";

function freshDraft(over: Partial<OnboardingDraft> = {}): OnboardingDraft {
  return {
    phone_e164: "+22507000000",
    display_name: "Yann",
    email: null,
    neighborhood: "Cocody",
    country_code: "CI",
    origin_country_code: "CI",
    gender: "femme",
    // Story 4.8 — `age_range` du draft supprimé, remplacé par `date_of_birth`.
    // 1995-06-15 → today=2026-05-21 → âge 30 (anniv pas encore passé) → "25-34".
    date_of_birth: "1995-06-15",
    consent: {
      cgv_accepted_at: "2026-05-17T19:00:00.000Z",
      geoloc_consent_at: "2026-05-17T19:00:01.000Z",
    },
    calibration_answers: {
      racines_horizons: -0.4,
      taniere_nomade: 0.4,
      exigeant_enthousiaste: 0,
      foule_secret: 0.4,
      maquis_table: -0.4,
    },
    started_at: Date.now() - 120_000,
    // Chantier 13 archétypes — pas d'héritage quiz par défaut dans les tests.
    meute_heritage: null,
    ...over,
  };
}

describe("finalizeOnboarding — Story 2.6", () => {
  beforeEach(() => {
    mockSaveSpawter.mockClear();
    mockSavePalais.mockClear();
    mockGetUser.mockClear();
    mockClaim.mockReset().mockResolvedValue(null);
    mockUpdateArchetype.mockClear();
    mockSupabaseConfigured = false;
    useSpawterStore.setState({ spawter: null, palais: null, spawts: [], hydrating: false });
    useOnboardingDraft.getState().reset();
  });

  it("un preview est confirmé après le profil puis le Palais, sans dépendance FK inversée", async () => {
    let release!: (v: boolean) => void;
    mockSaveSpawter.mockImplementationOnce(() => new Promise<boolean>((resolve) => { release = resolve; }));
    const inherited = {
      ...freshDraft(),
      meute_heritage: { claimed: false, archetype: "murmure", pionnier_seq: 42, axes: { R: -1, T: 0, E: 1, F: 2, M: -2 } },
    };
    await useSpawterStore.getState().finalizeOnboarding(inherited);
    expect(mockSavePalais).not.toHaveBeenCalled();
    expect(mockClaim).not.toHaveBeenCalled();
    release(true);
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(mockSavePalais).toHaveBeenCalled();
    expect(mockClaim).toHaveBeenCalledWith(SAMPLE_SPAWTER.id, inherited.phone_e164);
    expect(mockSaveSpawter.mock.invocationCallOrder[0]).toBeLessThan(mockSavePalais.mock.invocationCallOrder[0]!);
    expect(mockSavePalais.mock.invocationCallOrder[0]).toBeLessThan(mockClaim.mock.invocationCallOrder[0]!);
  });

  it("la confirmation serveur d'un preview ne remplace pas une recalibration volontaire", async () => {
    mockClaim.mockResolvedValue({ claimed: true, archetype: "murmure", pionnier_seq: 42 });
    const draft = { ...freshDraft(), use_meute_axes: false,
      meute_heritage: { claimed: false, archetype: "murmure", pionnier_seq: 42, axes: { R: -1, T: 0, E: 1, F: 2, M: -2 } } };
    await useSpawterStore.getState().finalizeOnboarding(draft);
    for (let i = 0; i < 8; i++) await Promise.resolve();
    const current = useSpawterStore.getState().spawter?.quiz_archetype;
    expect(current).not.toBe("murmure");
    expect(mockUpdateArchetype).toHaveBeenCalledWith(SAMPLE_SPAWTER.id, current);
    expect(useSpawterStore.getState().palais?.axe_foule_secret).toBe(0.4);
  });

  it("le Palais conserve les cinq axes du quiz, y compris F, avant le claim définitif", async () => {
    const inherited = {
      ...freshDraft(),
      meute_heritage: {
        claimed: false, code: "spawter_pending", archetype: "murmure",
        pionnier_seq: 42, axes: { R: -1, T: 0, E: 1, F: 2, M: -2 },
      },
    };
    await useSpawterStore.getState().finalizeOnboarding(inherited);
    const { spawter, palais } = useSpawterStore.getState();
    expect(spawter?.quiz_archetype).toBe("murmure");
    expect(spawter?.pionnier_seq).toBe(42);
    expect(palais).toMatchObject({
      axe_racines_horizons: -0.5, axe_taniere_nomade: 0,
      axe_exigeant_enthousiaste: 0.5, axe_foule_secret: 1,
      axe_maquis_table: -1, archetype_id: "murmure",
      dominant_axes: ["foule_secret", "maquis_table"],
    });
    expect(mockSavePalais).toHaveBeenCalledWith(expect.objectContaining({ axe_foule_secret: 1 }));
  });

  it("le choix explicite de recalibrer garde le rang sans imposer l'ancien archétype", async () => {
    const recalibrated = {
      ...freshDraft(), use_meute_axes: false,
      meute_heritage: {
        claimed: true, archetype: "murmure", pionnier_seq: 42,
        axes: { R: -1, T: 0, E: 1, F: 2, M: -2 },
      },
    };
    await useSpawterStore.getState().finalizeOnboarding(recalibrated);
    expect(useSpawterStore.getState().palais?.axe_foule_secret).toBe(0.4);
    expect(useSpawterStore.getState().spawter?.quiz_archetype).not.toBe("murmure");
    expect(useSpawterStore.getState().spawter?.pionnier_seq).toBe(42);
  });

  it("mode démo (isSupabaseConfigured false) : utilise SAMPLE_SPAWTER.id sans appeler getUser", async () => {
    await useSpawterStore.getState().finalizeOnboarding(freshDraft());
    const spawter = useSpawterStore.getState().spawter;
    expect(spawter?.id).toBe(SAMPLE_SPAWTER.id);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("mode live : utilise auth.getUser().id pour spawter.id", async () => {
    mockSupabaseConfigured = true;
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-uuid-xyz" } },
      error: null,
    });
    await useSpawterStore.getState().finalizeOnboarding(freshDraft());
    const spawter = useSpawterStore.getState().spawter;
    expect(spawter?.id).toBe("auth-uuid-xyz");
  });

  it("mode live + getUser null → throw FINALIZE_NO_AUTH_USER", async () => {
    mockSupabaseConfigured = true;
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(useSpawterStore.getState().finalizeOnboarding(freshDraft())).rejects.toThrow(
      "FINALIZE_NO_AUTH_USER",
    );
  });

  it("draft.consent.* sont persistés sur le row spawter", async () => {
    await useSpawterStore.getState().finalizeOnboarding(freshDraft());
    const s = useSpawterStore.getState().spawter;
    expect(s?.cgv_accepted_at).toBe("2026-05-17T19:00:00.000Z");
    expect(s?.geoloc_consent_at).toBe("2026-05-17T19:00:01.000Z");
  });

  it("reset draft à la fin → started_at et phone_e164 réinitialisés", async () => {
    await useSpawterStore.getState().finalizeOnboarding(freshDraft());
    const draft = useOnboardingDraft.getState().draft;
    expect(draft.phone_e164).toBe("");
    expect(draft.started_at).toBeNull();
    expect(draft.consent.cgv_accepted_at).toBeNull();
  });

  // DN-5 round 3 — neutral résolu (value=0) compte comme une vraie réponse
  // dans la confidence. Seul le skip explicite (sentinel null) est exclu.
  it("DN-5 — value=0 (neutral résolu) compte dans answeredCount confidence", async () => {
    // 5 réponses, dont une avec value=0 (cartes posa + néga équilibrées).
    const fullyAnswered = freshDraft();
    await useSpawterStore.getState().finalizeOnboarding(fullyAnswered);
    const palaisFull = useSpawterStore.getState().palais;

    // Reset puis run avec 1 skip explicite.
    useSpawterStore.setState({ spawter: null, palais: null, spawts: [], hydrating: false });
    const oneSkipped = freshDraft({
      calibration_answers: {
        racines_horizons: -0.4,
        taniere_nomade: 0.4,
        exigeant_enthousiaste: null, // skip
        foule_secret: 0.4,
        maquis_table: -0.4,
      },
    });
    await useSpawterStore.getState().finalizeOnboarding(oneSkipped);
    const palaisSkip = useSpawterStore.getState().palais;

    // 5 réponses (dont 1 neutral résolu) > 4 réponses (1 skip) côté confidence.
    expect(palaisFull?.confidence_score).toBeGreaterThan(palaisSkip?.confidence_score ?? 0);
  });

  // ─── Story 4.8 — date_of_birth → age_range dérivé au finalize ────────
  it("Story 4.8 — draft.date_of_birth=1995-06-15 → spawter.age_range='25-34' + persist date_of_birth", async () => {
    await useSpawterStore.getState().finalizeOnboarding(freshDraft());
    const s = useSpawterStore.getState().spawter;
    expect(s?.date_of_birth).toBe("1995-06-15");
    // 30 ans (today 2026-05-21, anniv 15 juin → -1) → bucket 25-34.
    expect(s?.age_range).toBe("25-34");
  });

  it("Story 4.8 — draft.date_of_birth=null → spawter.age_range=null", async () => {
    await useSpawterStore.getState().finalizeOnboarding(
      freshDraft({ date_of_birth: null }),
    );
    const s = useSpawterStore.getState().spawter;
    expect(s?.date_of_birth).toBeNull();
    expect(s?.age_range).toBeNull();
  });

  it("Story 4.8 — date_of_birth pour 55+ ans → spawter.age_range='55+'", async () => {
    await useSpawterStore.getState().finalizeOnboarding(
      freshDraft({ date_of_birth: "1960-01-01" }),
    );
    const s = useSpawterStore.getState().spawter;
    expect(s?.age_range).toBe("55+");
  });
});
