// Story 2.2 — AC #7-2 : spawter-store.recordConsent supporte "cgv" | "geoloc"
// et mute le bon field. No-op silencieux si spawter === null.

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
jest.mock("../../src/lib/data-source", () => ({
  saveSpawter: (arg: unknown) => mockSaveSpawter(arg),
  savePalais: (arg: unknown) => mockSavePalais(arg),
  isSupabaseConfigured: false,
}));

// spawter-store importe statiquement `lib/supabase` qui initialise un client
// avec EXPO_PUBLIC_* — absent en test → on stub.
jest.mock("../../src/lib/supabase", () => ({
  supabase: { auth: { getUser: jest.fn() } },
}));

import { useSpawterStore } from "../../src/store/spawter-store";
import { SAMPLE_SPAWTER } from "../../src/data/seed/sample-spawter";

describe("spawter-store.recordConsent — Story 2.2", () => {
  beforeEach(() => {
    useSpawterStore.setState({
      hydrating: false,
      spawter: null,
      palais: null,
      spawts: [],
    });
    mockSaveSpawter.mockClear();
  });

  it("recordConsent(\"cgv\", true) met à jour spawter.cgv_accepted_at", async () => {
    useSpawterStore.setState({ spawter: { ...SAMPLE_SPAWTER } });
    await useSpawterStore.getState().recordConsent("cgv", true);
    const updated = useSpawterStore.getState().spawter;
    expect(updated?.cgv_accepted_at).not.toBeNull();
    expect(updated?.geoloc_consent_at).toBeNull();
  });

  it("recordConsent(\"geoloc\", true) met à jour spawter.geoloc_consent_at indépendamment", async () => {
    useSpawterStore.setState({ spawter: { ...SAMPLE_SPAWTER } });
    await useSpawterStore.getState().recordConsent("geoloc", true);
    const updated = useSpawterStore.getState().spawter;
    expect(updated?.geoloc_consent_at).not.toBeNull();
    expect(updated?.cgv_accepted_at).toBeNull();
  });

  it("recordConsent ne crash pas si spawter === null (local-only, retourne true)", async () => {
    // P-26 round 3 — la signature retourne désormais boolean : `true` quand
    // le consent est effectivement écrit (ici local-only via setConsentLocal,
    // car pas encore de spawter persisté en DB).
    useSpawterStore.setState({ spawter: null });
    await expect(useSpawterStore.getState().recordConsent("cgv", true)).resolves.toBe(true);
    expect(useSpawterStore.getState().spawter).toBeNull();
  });

  it("recordConsent retourne false si déjà set (set-once invariant)", async () => {
    // P-26 round 3 — set-once : la 2e tentative est un no-op silencieux, le
    // caller analytics peut différencier les writes réels via la valeur retournée.
    useSpawterStore.setState({
      spawter: { ...SAMPLE_SPAWTER, cgv_accepted_at: "2026-05-01T00:00:00Z" },
    });
    await expect(useSpawterStore.getState().recordConsent("cgv", true)).resolves.toBe(false);
  });
});
