import { EMPTY_PALAIS, SAMPLE_SPAWTER } from "../../data/seed/sample-spawter";
const mockSession = jest.fn();
const mockRows = jest.fn();
const mockFilter = jest.fn();
const mockAbort = jest.fn();
jest.mock("../supabase", () => ({ supabase: {
  auth: { getSession: () => mockSession() },
  from: (table: string) => ({ select: () => ({ eq: (column: string, owner: string) => {
    mockFilter(table, column, owner);
    return { abortSignal: (signal: AbortSignal) => { mockAbort(signal); return { maybeSingle: () => mockRows(table, signal) }; } };
  } }) }),
} }));
import { canResumeMissingPalais, readAuthenticatedAccount, validRecoveredAccount } from "../account-recovery";
const owner = SAMPLE_SPAWTER.id;
let profile: unknown;
let palais: unknown;
beforeEach(() => {
  jest.clearAllMocks();
  profile = { ...SAMPLE_SPAWTER, stade: "guide", unique_spots: 61, total_spawts: 100, pionnier_seq: 42 };
  palais = { ...EMPTY_PALAIS, axe_foule_secret: 0.83, confidence_score: 0.91, stade: "guide", total_spawts: 100 };
  mockSession.mockResolvedValue({ data: { session: { user: { id: owner } } }, error: null });
  mockRows.mockImplementation(async (table: string) => ({ data: table === "spawters" ? profile : palais, error: null }));
});
it("lit les deux lignes pour l'identité SDK et conserve exactement le Palais mûri", async () => {
  expect(await readAuthenticatedAccount(owner)).toEqual({ kind: "existing", owner, spawter: profile, palais });
  expect(mockFilter.mock.calls).toEqual([["spawters", "id", owner], ["user_palais", "spawter_id", owner]]);
});
it("seules deux absences confirmées sont un nouveau compte", async () => {
  profile = palais = null;
  await expect(readAuthenticatedAccount()).resolves.toEqual({ kind: "new", owner });
});
it.each(["spawters", "user_palais"])("une ligne %s absente est un compte incomplet", async (table) => {
  if (table === "spawters") profile = null; else palais = null;
  await expect(readAuthenticatedAccount()).resolves.toEqual({ kind: "incomplete", owner, spawter: profile, palais });
});
it.each(["spawters", "user_palais"])("une erreur %s n'est jamais une nouvelle inscription", async (table) => {
  mockRows.mockImplementation(async (name: string) => ({ data: null, error: name === table ? { code: "42501" } : null }));
  await expect(readAuthenticatedAccount()).rejects.toThrow("ACCOUNT_READ_FAILED");
});
it("une exception réseau n'expose pas son corps ni un numéro", async () => {
  mockRows.mockRejectedValue(new Error("transport fixture +2250700000000"));
  await expect(readAuthenticatedAccount()).rejects.toThrow(/^ACCOUNT_READ_FAILED$/);
});
it("ne lance aucune lecture sans session", async () => {
  mockSession.mockResolvedValue({ data: { session: null }, error: null });
  await expect(readAuthenticatedAccount()).rejects.toThrow("ACCOUNT_NO_SESSION");
  expect(mockRows).not.toHaveBeenCalled();
});
it("refuse une identité SDK différente de celle qui vient de se connecter", async () => {
  await expect(readAuthenticatedAccount("autre-compte")).rejects.toThrow("ACCOUNT_SESSION_CHANGED");
  expect(mockRows).not.toHaveBeenCalled();
});
it("refuse aussi le changement de session pendant la lecture", async () => {
  mockSession.mockResolvedValueOnce({ data: { session: { user: { id: owner } } }, error: null })
    .mockResolvedValueOnce({ data: { session: { user: { id: "compte-b" } } }, error: null });
  await expect(readAuthenticatedAccount()).rejects.toThrow("ACCOUNT_SESSION_CHANGED");
});
it("refuse un Palais d'un autre compte même si le transport le renvoie", async () => {
  palais = { ...EMPTY_PALAIS, spawter_id: "compte-b" };
  await expect(readAuthenticatedAccount()).rejects.toThrow("ACCOUNT_INVALID");
});
it.each([NaN, Infinity, 1.01, -1.01, "0.3"])("ne remplace pas un axe invalide (%s) par zéro", async (value) => {
  palais = { ...EMPTY_PALAIS, axe_foule_secret: value };
  await expect(readAuthenticatedAccount()).rejects.toThrow("ACCOUNT_INVALID");
});
it("les bornes -1/1 et les consentements historiques null sont valides", () => {
  expect(validRecoveredAccount(SAMPLE_SPAWTER, { ...EMPTY_PALAIS, axe_foule_secret: -1, axe_maquis_table: 1 }, owner)).toBe(true);
});
it("un premier Palais absent est reprenable ; une progression sans Palais n'est jamais remise à zéro", () => {
  const partial = { kind: "incomplete" as const, owner, spawter: SAMPLE_SPAWTER, palais: null };
  expect(canResumeMissingPalais(partial)).toBe(true);
  expect(canResumeMissingPalais({ ...partial, spawter: { ...SAMPLE_SPAWTER, total_spawts: 1 } })).toBe(false);
  expect(canResumeMissingPalais({ ...partial, spawter: { ...SAMPLE_SPAWTER, stade: "guide" } })).toBe(false);
  expect(canResumeMissingPalais({ ...partial, spawter: { ...SAMPLE_SPAWTER, id: "autre" } })).toBe(false);
});
it("une annulation ne livre aucun compte même si le transport répond", async () => {
  const abort = new AbortController(); abort.abort();
  await expect(readAuthenticatedAccount(owner, abort.signal)).rejects.toThrow("ACCOUNT_READ_FAILED");
});
it("borne la lecture des lignes à quinze secondes", async () => {
  jest.useFakeTimers();
  try {
    mockRows.mockImplementation((_table: string, signal: AbortSignal) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("abort")));
    }));
    const promise = readAuthenticatedAccount();
    const result = expect(promise).rejects.toThrow("ACCOUNT_READ_FAILED");
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(15_000);
    await result;
    expect(mockAbort.mock.calls.every(([signal]) => signal.aborted)).toBe(true);
  } finally { jest.useRealTimers(); }
});
