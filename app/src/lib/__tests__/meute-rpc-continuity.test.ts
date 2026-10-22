const mockRpc = jest.fn();
jest.mock("../supabase", () => ({ supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));
import { claimMeuteHeritageInSupabase } from "../data-source.supabase";
beforeEach(() => mockRpc.mockReset());
it("l'adaptateur conserve les cinq axes et le code du preview", async () => {
  const payload = { claimed: false, archetype: "murmure", pionnier_seq: 42, code: "spawter_pending", axes: { R: -1, T: 0, E: 1, F: 2, M: -2 } };
  mockRpc.mockResolvedValue({ data: payload, error: null });
  await expect(claimMeuteHeritageInSupabase("owner", "+22507000000")).resolves.toEqual(payload);
  expect(mockRpc).toHaveBeenCalledWith("claim_meute_heritage", { p_spawter_id: "owner", p_phone: "+22507000000" });
});
it("un refus reste une absence d'héritage, jamais un faux vecteur zéro", async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: "42501" } });
  await expect(claimMeuteHeritageInSupabase("owner", "+22507000000")).resolves.toBeNull();
});
