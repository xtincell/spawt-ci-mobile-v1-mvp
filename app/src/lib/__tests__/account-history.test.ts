const mockSpawts = jest.fn();
const mockTitres = jest.fn();
const mockSession = jest.fn();
jest.mock("../data-source", () => ({
  listSpawtsForSpawter: (...args: unknown[]) => mockSpawts(...args),
  listTitresForSpawter: (...args: unknown[]) => mockTitres(...args),
}));
jest.mock("../account-recovery", () => ({ requireAccountSession: (...args: unknown[]) => mockSession(...args) }));
import { readAccountHistory } from "../account-history";

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.mockResolvedValue("A");
  mockSpawts.mockResolvedValue([{ id: "spawt", spawter_id: "A" }]);
  mockTitres.mockResolvedValue([{ id: "title", spawter_id: "A" }]);
});

it("récupère l'historique et les titres du compte connecté", async () => {
  await expect(readAccountHistory("A")).resolves.toEqual({
    spawts: [{ id: "spawt", spawter_id: "A" }],
    collectionTitres: [{ id: "title", spawter_id: "A" }],
  });
  expect(mockSession).toHaveBeenCalledTimes(2);
});

it.each(["spawts", "titres"])("une panne %s interrompt la restauration au lieu de publier un zéro", async (source) => {
  (source === "spawts" ? mockSpawts : mockTitres).mockRejectedValueOnce(new Error("transport private"));
  await expect(readAccountHistory("A")).rejects.toThrow(/^ACCOUNT_READ_FAILED$/);
});

it("refuse l'historique d'un autre compte", async () => {
  mockTitres.mockResolvedValue([{ id: "title", spawter_id: "B" }]);
  await expect(readAccountHistory("A")).rejects.toThrow("ACCOUNT_INVALID");
});

it("une déconnexion pendant la lecture invalide le résultat", async () => {
  mockSession.mockResolvedValueOnce("A").mockRejectedValueOnce(new Error("ACCOUNT_SESSION_CHANGED"));
  await expect(readAccountHistory("A")).rejects.toThrow("ACCOUNT_SESSION_CHANGED");
});

it("annuler la récupération empêche sa publication", async () => {
  const abort = new AbortController(); abort.abort();
  await expect(readAccountHistory("A", abort.signal)).rejects.toThrow("ACCOUNT_READ_FAILED");
});
