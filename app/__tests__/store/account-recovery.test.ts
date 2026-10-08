import AsyncStorage from "@react-native-async-storage/async-storage";
import { SAMPLE_SPAWTER, EMPTY_PALAIS } from "../../src/data/seed/sample-spawter";
import type { AccountRecovery } from "../../src/lib/account-recovery";
const mockRead = jest.fn();
const mockSession = jest.fn();
jest.mock("../../src/lib/account-recovery", () => ({
  readAuthenticatedAccount: (...args: unknown[]) => mockRead(...args),
  requireAccountSession: (...args: unknown[]) => mockSession(...args),
  canResumeMissingPalais: jest.requireActual("../../src/lib/account-recovery").canResumeMissingPalais,
}));
const mockWrite = jest.fn();
const mockPalaisWrite = jest.fn();
jest.mock("../../src/lib/data-source", () => ({
  ...jest.requireActual("../../src/lib/data-source"),
  isSupabaseConfigured: false,
  saveSpawter: (...args: unknown[]) => mockWrite(...args),
  savePalais: (...args: unknown[]) => mockPalaisWrite(...args),
  fetchSpawterInternal: async () => null,
  fetchGoldEntitlement: async () => null,
  listSavedPlaceIds: async () => [],
}));
jest.mock("../../src/lib/analytics", () => ({ track: jest.fn() }));
import { useSpawterStore } from "../../src/store/spawter-store";
import { useOnboardingDraft } from "../../src/store/onboarding-draft";
const owner = SAMPLE_SPAWTER.id;
const account: AccountRecovery = { kind: "existing", owner,
  spawter: { ...SAMPLE_SPAWTER, stade: "guide", unique_spots: 61, total_spawts: 100, pionnier_seq: 42,
    cgv_accepted_at: "2026-06-01T09:00:00Z", geoloc_consent_at: null, quiz_archetype: "murmure" },
  palais: { ...EMPTY_PALAIS, axe_foule_secret: 0.83, confidence_score: 0.91, stade: "guide", total_spawts: 100, archetype_id: "murmure" },
};
const tick = async () => { for (let i = 0; i < 3; i++) await new Promise<void>((r) => setTimeout(r, 0)); };
beforeEach(async () => {
  useSpawterStore.getState().reset(); await tick(); await AsyncStorage.clear();
  jest.clearAllMocks();
  mockRead.mockResolvedValue(account); mockSession.mockResolvedValue(owner);
  useOnboardingDraft.getState().reset();
});
it("reprend les axes mûris, le stade et le rang sans aucun upsert", async () => {
  await expect(useSpawterStore.getState().recoverAuthenticatedAccount(owner)).resolves.toBe("restored");
  await tick();
  expect(useSpawterStore.getState().spawter).toEqual(account.spawter);
  expect(useSpawterStore.getState().palais).toEqual(account.palais);
  expect(mockWrite).not.toHaveBeenCalled(); expect(mockPalaisWrite).not.toHaveBeenCalled();
  await useSpawterStore.getState().hydrate();
  expect(useSpawterStore.getState().palais?.axe_foule_secret).toBe(0.83);
});
it("conserve les consentements d'origine et efface le brouillon pré-auth", async () => {
  useOnboardingDraft.getState().setField("display_name", "Nouveau brouillon");
  await useSpawterStore.getState().recoverAuthenticatedAccount(owner); await tick();
  expect(await AsyncStorage.getItem("spawt:consent:cgv")).toBe(account.spawter.cgv_accepted_at);
  expect(await AsyncStorage.getItem("spawt:consent:geoloc")).toBeFalsy();
  expect(useOnboardingDraft.getState().draft.display_name).toBe("");
});
it("ne purgera pas un brouillon lorsque le compte est nouveau", async () => {
  mockRead.mockResolvedValue({ kind: "new", owner });
  useOnboardingDraft.getState().setField("display_name", "Mon premier Palais");
  await expect(useSpawterStore.getState().recoverAuthenticatedAccount()).resolves.toBe("new");
  expect(useOnboardingDraft.getState().draft.display_name).toBe("Mon premier Palais");
  expect(await AsyncStorage.getItem("spawt:spawter")).toBeNull();
});
it.each(["ACCOUNT_READ_FAILED", "ACCOUNT_INCOMPLETE"])("%s ne crée aucune donnée ni zéro de remplacement", async (reason) => {
  if (reason === "ACCOUNT_INCOMPLETE") mockRead.mockResolvedValue({ kind: "incomplete", owner, spawter: account.spawter, palais: null });
  else mockRead.mockRejectedValue(new Error(reason));
  await expect(useSpawterStore.getState().recoverAuthenticatedAccount()).rejects.toThrow(reason);
  expect(useSpawterStore.getState().spawter).toBeNull();
  expect(mockWrite).not.toHaveBeenCalled(); expect(mockPalaisWrite).not.toHaveBeenCalled();
});
it("un profil sans premier Palais reprend le formulaire prérempli, sans aucun upsert", async () => {
  mockRead.mockResolvedValue({ kind: "incomplete", owner, spawter: SAMPLE_SPAWTER, palais: null });
  useOnboardingDraft.getState().setField("phone_e164", "+2250700000000");
  await expect(useSpawterStore.getState().recoverAuthenticatedAccount(owner)).resolves.toBe("resume");
  expect(useOnboardingDraft.getState().draft.display_name).toBe(SAMPLE_SPAWTER.display_name);
  expect(useOnboardingDraft.getState().draft.phone_e164).toBe("+2250700000000");
  expect(useSpawterStore.getState().spawter).toBeNull();
  expect(mockWrite).not.toHaveBeenCalled(); expect(mockPalaisWrite).not.toHaveBeenCalled();
});
it("une réponse après déconnexion ne ressuscite pas le compte", async () => {
  let resolve!: (value: AccountRecovery) => void;
  mockRead.mockReturnValue(new Promise<AccountRecovery>((r) => { resolve = r; }));
  const pending = useSpawterStore.getState().recoverAuthenticatedAccount(owner);
  useSpawterStore.getState().reset(); resolve(account);
  await expect(pending).rejects.toThrow("ACCOUNT_SESSION_CHANGED");
  await useSpawterStore.getState().hydrate();
  expect(useSpawterStore.getState().spawter).toBeNull();
});
it("une panne disque avant la publication du profil reste réessayable", async () => {
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error("quota"));
  await expect(useSpawterStore.getState().recoverAuthenticatedAccount(owner)).rejects.toThrow("quota");
  expect(useSpawterStore.getState().spawter).toBeNull();
  expect(await AsyncStorage.getItem("spawt:spawter")).toBeNull();
  await expect(useSpawterStore.getState().recoverAuthenticatedAccount(owner)).resolves.toBe("restored");
});
it("un changement de session pendant la publication purge la copie tardive", async () => {
  mockSession.mockResolvedValueOnce(owner).mockResolvedValueOnce(owner).mockRejectedValueOnce(new Error("ACCOUNT_SESSION_CHANGED"));
  await expect(useSpawterStore.getState().recoverAuthenticatedAccount(owner)).rejects.toThrow("ACCOUNT_SESSION_CHANGED");
  await useSpawterStore.getState().hydrate();
  expect(useSpawterStore.getState().spawter).toBeNull();
  expect(await AsyncStorage.getItem("spawt:spawter")).toBeNull();
});
it("l'hydratation ne mélange pas un profil A avec un Palais B après une coupure", async () => {
  await AsyncStorage.setItem("spawt:spawter", JSON.stringify(SAMPLE_SPAWTER));
  await AsyncStorage.setItem("spawt:palais", JSON.stringify({ ...EMPTY_PALAIS, spawter_id: "compte-b" }));
  await useSpawterStore.getState().hydrate();
  expect(useSpawterStore.getState().palais).toBeNull();
});
