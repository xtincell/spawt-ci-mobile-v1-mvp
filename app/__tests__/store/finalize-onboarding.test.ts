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
let mockSupabaseConfigured = false;
jest.mock("../../src/lib/data-source", () => ({
  saveSpawter: (arg: unknown) => mockSaveSpawter(arg),
  savePalais: (arg: unknown) => mockSavePalais(arg),
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
    neighborhood: "Cocody",
    country_code: "CI",
    origin_country_code: "CI",
    gender: "femme",
    age_range: "25-34",
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
    ...over,
  };
}

describe("finalizeOnboarding — Story 2.6", () => {
  beforeEach(() => {
    mockSaveSpawter.mockClear();
    mockSavePalais.mockClear();
    mockGetUser.mockClear();
    mockSupabaseConfigured = false;
    useSpawterStore.setState({ spawter: null, palais: null, spawts: [], hydrating: false });
    useOnboardingDraft.getState().reset();
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
});
