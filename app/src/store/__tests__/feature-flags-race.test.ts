const mockRead = jest.fn();
jest.mock("../../lib/data-source", () => ({ listFeatureFlags: (...args: unknown[]) => mockRead(...args) }));
import { useFeatureFlagsStore } from "../feature-flags";

function flags(owner: string | null, enabled = true) {
  return [{ id: "flag", flag_code: "mode-crew", spawter_id: owner, enabled, scope: "prod", expires_at: null }];
}

beforeEach(async () => {
  mockRead.mockReset().mockResolvedValue([]);
  useFeatureFlagsStore.setState({ scope: "prod", flags: {}, localOverrides: {}, lastSyncAt: null });
  await useFeatureFlagsStore.getState().hydrate(null);
});

it("un changement de compte charge B et ignore la réponse tardive de A", async () => {
  let resolveA!: (value: unknown) => void;
  mockRead.mockImplementation((owner) => owner === "A" ? new Promise((resolve) => { resolveA = resolve; }) : Promise.resolve(flags("B", false)));
  const a = useFeatureFlagsStore.getState().hydrate("A");
  await Promise.resolve();
  useFeatureFlagsStore.getState().setLocalOverride("paywall-geo", true);
  const b = useFeatureFlagsStore.getState().hydrate("B");
  await b;
  expect(useFeatureFlagsStore.getState().flags).toEqual({ "mode-crew": false });
  resolveA(flags("A"));
  await a;
  expect(useFeatureFlagsStore.getState().spawterId).toBe("B");
  expect(useFeatureFlagsStore.getState().flags).toEqual({ "mode-crew": false });
});

it("une panne préserve les flags confirmés et libère le chargement pour réessayer", async () => {
  mockRead.mockResolvedValue(flags("A"));
  await useFeatureFlagsStore.getState().hydrate("A");
  const sync = useFeatureFlagsStore.getState().lastSyncAt;
  mockRead.mockRejectedValue(new Error("network"));
  await useFeatureFlagsStore.getState().hydrate("A");
  expect(useFeatureFlagsStore.getState().flags["mode-crew"]).toBe(true);
  expect(useFeatureFlagsStore.getState().loading).toBe(false);
  expect(useFeatureFlagsStore.getState().lastSyncAt).toBe(sync);
  mockRead.mockResolvedValue(flags("A", false));
  await useFeatureFlagsStore.getState().hydrate("A");
  expect(useFeatureFlagsStore.getState().flags["mode-crew"]).toBe(false);
});

it("retirer un override restaure immédiatement la valeur serveur", async () => {
  mockRead.mockResolvedValue(flags(null, false));
  await useFeatureFlagsStore.getState().hydrate("A");
  useFeatureFlagsStore.getState().setLocalOverride("mode-crew", true);
  useFeatureFlagsStore.getState().clearLocalOverride("mode-crew");
  expect(useFeatureFlagsStore.getState().flags["mode-crew"]).toBe(false);
});
