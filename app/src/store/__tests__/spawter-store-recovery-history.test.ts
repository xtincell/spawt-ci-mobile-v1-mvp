import AsyncStorage from "@react-native-async-storage/async-storage";
import { SAMPLE_SPAWTER, EMPTY_PALAIS } from "../../data/seed/sample-spawter";
const mockAccount = jest.fn();
const mockHistory = jest.fn();
jest.mock("../../lib/account-recovery", () => ({
  readAuthenticatedAccount: (...args: unknown[]) => mockAccount(...args),
  requireAccountSession: () => Promise.resolve(require("../../data/seed/sample-spawter").SAMPLE_SPAWTER.id),
  canResumeMissingPalais: () => false,
}));
jest.mock("../../lib/account-history", () => ({ readAccountHistory: (...args: unknown[]) => mockHistory(...args) }));
jest.mock("../../lib/analytics", () => ({ track: jest.fn() }));
import { useSpawterStore } from "../spawter-store";

const history = {
  spawts: [{ id: "spawt-existing", spawter_id: SAMPLE_SPAWTER.id, place_id: "spot", is_verified: true }],
  collectionTitres: [{ id: "title-existing", spawter_id: SAMPLE_SPAWTER.id, title_key: "stade_touriste", is_displayed: true }],
};

beforeEach(async () => {
  useSpawterStore.getState().reset();
  await useSpawterStore.getState().hydrate();
  await AsyncStorage.clear();
  mockAccount.mockResolvedValue({ kind: "existing", owner: SAMPLE_SPAWTER.id, spawter: SAMPLE_SPAWTER, palais: EMPTY_PALAIS });
  mockHistory.mockResolvedValue(history);
});

it("une reconnexion restaure spawts et titres en mémoire et sur disque", async () => {
  await expect(useSpawterStore.getState().recoverAuthenticatedAccount(SAMPLE_SPAWTER.id)).resolves.toBe("restored");
  expect(useSpawterStore.getState().spawts).toEqual(history.spawts);
  expect(useSpawterStore.getState().collectionTitres).toEqual(history.collectionTitres);
  expect(JSON.parse((await AsyncStorage.getItem("spawt:spawts"))!)).toEqual(history.spawts);
  expect(JSON.parse((await AsyncStorage.getItem("spawt:collection_titres"))!)).toEqual(history.collectionTitres);
});

it("un historique indisponible laisse le cache précédent intact pour réessayer", async () => {
  await AsyncStorage.setItem("spawt:spawter", JSON.stringify(SAMPLE_SPAWTER));
  useSpawterStore.setState({ spawter: SAMPLE_SPAWTER, palais: EMPTY_PALAIS });
  mockHistory.mockRejectedValueOnce(new Error("ACCOUNT_READ_FAILED"));
  await expect(useSpawterStore.getState().recoverAuthenticatedAccount(SAMPLE_SPAWTER.id)).rejects.toThrow("ACCOUNT_READ_FAILED");
  expect(useSpawterStore.getState().spawter).toEqual(SAMPLE_SPAWTER);
  expect(JSON.parse((await AsyncStorage.getItem("spawt:spawter"))!)).toEqual(SAMPLE_SPAWTER);
});
