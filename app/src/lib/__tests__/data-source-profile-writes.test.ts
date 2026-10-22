import { EMPTY_PALAIS, SAMPLE_SPAWTER } from "../../data/seed/sample-spawter";

const mockUpsert = jest.fn();
jest.mock("../supabase", () => ({
  supabase: { from: jest.fn(() => ({ upsert: mockUpsert })) },
}));
import { savePalaisToSupabase, saveSpawterToSupabase } from "../data-source.supabase";

const writes = [
  ["Palais", () => savePalaisToSupabase(EMPTY_PALAIS)],
  ["profil", () => saveSpawterToSupabase(SAMPLE_SPAWTER)],
] as const;
describe.each(writes)("écriture %s — refus observable", (_label, write) => {
  beforeEach(() => mockUpsert.mockReset());

  it("ne confirme pas une sauvegarde refusée par la base", async () => {
    const denied = { message: "Écriture refusée", code: "42501" };
    mockUpsert.mockResolvedValue({ error: denied });
    await expect(write()).rejects.toEqual(denied);
  });

  it("transmet aussi une panne réseau au chemin de reprise appelant", async () => {
    const offline = new Error("Connexion interrompue");
    mockUpsert.mockRejectedValue(offline);
    await expect(write()).rejects.toBe(offline);
  });

  it("résout après l’acceptation de la sauvegarde", async () => {
    mockUpsert.mockResolvedValue({ error: null });
    await expect(write()).resolves.toBeUndefined();
  });
});
