const mockSession = jest.fn();
jest.mock("../supabase", () => ({ supabase: { auth: { getSession: () => mockSession() } } }));
import { canPublishCachedAccount } from "../cached-session";
import { withReadTimeout, DataReadError } from "../data-read-error";

it("le cache A n'est visible que sous une session SDK A", async () => {
  mockSession.mockResolvedValue({ data: { session: { user: { id: "A" } } }, error: null });
  await expect(canPublishCachedAccount("A")).resolves.toBe(true);
  await expect(canPublishCachedAccount("B")).resolves.toBe(false);
});

it("l'absence confirmée de session masque le cache", async () => {
  mockSession.mockResolvedValue({ data: { session: null }, error: null });
  await expect(canPublishCachedAccount("A")).resolves.toBe(false);
});

it("une panne reste indéterminée, jamais une déconnexion confirmée", async () => {
  mockSession.mockResolvedValue({ data: { session: null }, error: { name: "AuthRetryableFetchError" } });
  await expect(canPublishCachedAccount("A")).rejects.toThrow("ACCOUNT_SESSION_UNAVAILABLE");
});

it("une lecture bloquée libère le chargement et annule le transport après 15 s", async () => {
  jest.useFakeTimers();
  try {
    let signal!: AbortSignal;
    const read = withReadTimeout("places", (s) => { signal = s; return new Promise(() => {}); });
    const result = expect(read).rejects.toEqual(new DataReadError("places"));
    await jest.advanceTimersByTimeAsync(15_000);
    await result;
    expect(signal.aborted).toBe(true);
  } finally { jest.useRealTimers(); }
});
