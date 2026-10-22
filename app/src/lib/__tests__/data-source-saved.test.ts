let mockError: unknown = null;
const mockUpsert = jest.fn(async () => ({ error: mockError }));
const mockEq = jest.fn();
const mockDelete = jest.fn(() => ({ eq: mockEq }));
jest.mock("../supabase", () => ({ supabase: { from: jest.fn(() => ({ upsert: mockUpsert, delete: mockDelete })) } }));
import { insertSavedPlaceToSupabase, deleteSavedPlaceFromSupabase } from "../data-source.supabase";
beforeEach(() => {
  mockError = null;
  jest.clearAllMocks();
  mockEq.mockImplementation((key: string) => key === "spawter_id" ? { eq: mockEq } : Promise.resolve({ error: mockError }));
});
it("un ajout rejeté par le serveur n'est pas acquitté silencieusement", async () => {
  mockError = { code: "42501", message: "refus" };
  await expect(insertSavedPlaceToSupabase("a", "spot")).rejects.toEqual(mockError);
});
it("une suppression rejetée par le serveur n'est pas acquittée silencieusement", async () => {
  mockError = { code: "42501", message: "refus" };
  await expect(deleteSavedPlaceFromSupabase("a", "spot")).rejects.toEqual(mockError);
});
it("les opérations confirmées ciblent la paire compte/lieu", async () => {
  await expect(insertSavedPlaceToSupabase("a", "spot")).resolves.toBeUndefined();
  expect(mockUpsert).toHaveBeenCalledWith({ spawter_id: "a", place_id: "spot" }, { onConflict: "spawter_id,place_id" });
  await expect(deleteSavedPlaceFromSupabase("a", "spot")).resolves.toBeUndefined();
  expect(mockEq.mock.calls).toEqual([["spawter_id", "a"], ["place_id", "spot"]]);
});
