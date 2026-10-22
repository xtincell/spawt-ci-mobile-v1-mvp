const mockInsert = jest.fn();
const mockFrom = jest.fn((_table: string) => ({ insert: mockInsert }));
const mockGetSession = jest.fn();
jest.mock("../supabase", () => ({
  supabase: { from: (table: string) => mockFrom(table), auth: { getSession: () => mockGetSession() } },
}));
import { insertUserSignals } from "../data-source.supabase";

const payload = {
  signal_type: "view", event_name: "consent_screen_viewed",
  place_id: null, metadata: { captured_at: "2026-10-08T00:00:00.000Z" },
};
const owner = "00000000-0000-4000-8000-000000000001";

describe("signaux — différer sans session, conserver le contrat de reprise", () => {
  beforeEach(() => {
    mockFrom.mockClear(); mockInsert.mockReset(); mockGetSession.mockReset();
    mockInsert.mockResolvedValue({ error: null });
  });

  it("ne fait aucun appel pour un lot vide", async () => {
    await expect(insertUserSignals([])).resolves.toBe(true);
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("conserve le lot pour reprise sans envoyer de signal anonyme", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(insertUserSignals([payload])).resolves.toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("diffère aussi lorsque la lecture de session est refusée", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: { message: "Session indisponible" } });
    await expect(insertUserSignals([payload])).resolves.toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("n’envoie pas une session sans identité de compte", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: {} } }, error: null });
    await expect(insertUserSignals([payload])).resolves.toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("fixe le compte lu sur les lignes avant l’insertion", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: owner } } }, error: null });
    await expect(insertUserSignals([payload])).resolves.toBe(true);
    expect(mockFrom).toHaveBeenCalledWith("user_signals");
    expect(mockInsert).toHaveBeenCalledWith([{ ...payload, spawter_id: owner }]);
  });

  it("laisse un refus de la base au chemin de reprise existant", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: owner } } }, error: null });
    mockInsert.mockResolvedValue({ error: { message: "Insertion refusée", code: "42501" } });
    await expect(insertUserSignals([payload])).resolves.toBe(false);
  });

  it("transmet une session illisible au garde de persistance appelant", async () => {
    const offline = new Error("Session illisible");
    mockGetSession.mockRejectedValue(offline);
    await expect(insertUserSignals([payload])).rejects.toBe(offline);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
