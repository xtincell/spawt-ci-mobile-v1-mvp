import { createSupabaseSessionRecovery, type SessionAuth } from "../../../shared/supabase-session";

const base = "https://backend.example.test";
const oldSession = { access_token: "old-fixture-token", user: { id: "account-a" } };
const newSession = { access_token: "new-fixture-token", user: { id: "account-a" } };
const jwtFailure = () => new Response(JSON.stringify({ code: "PGRST301", message: "invalid JWT" }), { status: 401 });
const request = { headers: { Authorization: `Bearer ${oldSession.access_token}`, apikey: "public-fixture-key" } };
let current: typeof oldSession | null;
let auth: SessionAuth;
let renew: jest.Mock;
let transport: jest.Mock;
let recovery: ReturnType<typeof createSupabaseSessionRecovery>;

beforeEach(() => {
  current = oldSession;
  renew = jest.fn(async () => {
    current = newSession;
    return { data: { session: current }, error: null };
  });
  auth = { getSession: async () => ({ data: { session: current }, error: null }), refreshSession: renew };
  transport = jest.fn(async (_input, init) => new Headers(init?.headers).get("Authorization") === `Bearer ${oldSession.access_token}`
    ? jwtFailure() : new Response("[]", { status: 200 }));
  recovery = createSupabaseSessionRecovery(base, () => auth, transport);
});

it("reprend la lecture avec le renouvellement SDK et conserve la requête initiale", async () => {
  const url = `${base}/rest/v1/spawters?id=eq.account-a`;
  expect((await recovery.fetch(url, request)).status).toBe(200);
  expect(renew).toHaveBeenCalledTimes(1);
  expect(transport).toHaveBeenCalledTimes(2);
  expect(transport.mock.calls[1][0]).toBe(url);
  expect(new Headers(transport.mock.calls[1][1].headers).get("apikey")).toBe("public-fixture-key");
  expect(request.headers.Authorization).toBe(`Bearer ${oldSession.access_token}`);
});

it("ne renouvelle qu'une fois pour deux lectures rejetées simultanément", async () => {
  let complete!: () => void;
  renew.mockImplementation(() => new Promise((resolve) => { complete = () => {
    current = newSession; resolve({ data: { session: current }, error: null });
  }; }));
  const first = recovery.fetch(`${base}/rest/v1/spawters`, request);
  const second = recovery.fetch(`${base}/rest/v1/user_palais`, request);
  for (let i = 0; i < 12 && !complete; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  expect(renew).toHaveBeenCalledTimes(1);
  complete();
  expect((await Promise.all([first, second])).map((reply) => reply.status)).toEqual([200, 200]);
});

it("réutilise la session déjà renouvelée par le SDK pendant la réponse", async () => {
  transport.mockImplementationOnce(async () => { current = newSession; return jwtFailure(); });
  expect((await recovery.fetch(`${base}/rest/v1/spawters`, request)).status).toBe(200);
  expect(renew).not.toHaveBeenCalled();
});

it.each([null, { ...newSession, user: { id: "account-b" } }])("ne rejoue pas après déconnexion/changement de compte (%s)", async (next) => {
  transport.mockImplementationOnce(async () => { current = next; return jwtFailure(); });
  expect((await recovery.fetch(`${base}/rest/v1/spawters`, request)).status).toBe(401);
  expect(renew).not.toHaveBeenCalled(); expect(transport).toHaveBeenCalledTimes(1);
});

it("refuse une identité différente renvoyée par le renouvellement", async () => {
  renew.mockImplementation(async () => { current = { ...newSession, user: { id: "account-b" } }; return { data: { session: current }, error: null }; });
  expect((await recovery.fetch(`${base}/rest/v1/spawters`, request)).status).toBe(401);
  expect(transport).toHaveBeenCalledTimes(1);
});

it.each([[403, "42501"], [401, "42501"], [401, "Unauthorized"], [500, "PGRST301"]])("ne transforme pas le refus %s/%s en renouvellement", async (status, code) => {
  transport.mockResolvedValue(new Response(JSON.stringify({ code }), { status }));
  const response = await recovery.fetch(`${base}/rest/v1/spawters`, request);
  expect(response.status).toBe(status); expect(await response.json()).toEqual({ code });
  expect(renew).not.toHaveBeenCalled(); expect(transport).toHaveBeenCalledTimes(1);
});

it.each(["/auth/v1/user", "/storage/v1/object/private/file", "/functions/v1/otp-send"]) ("laisse le transport %s au SDK existant", async (path) => {
  await recovery.fetch(`${base}${path}`, request);
  expect(renew).not.toHaveBeenCalled(); expect(transport).toHaveBeenCalledTimes(1);
});

it("n'envoie aucun jeton renouvelé à une autre origine", async () => {
  await recovery.fetch("https://other.example.test/rest/v1/spawters", request);
  expect(renew).not.toHaveBeenCalled(); expect(transport).toHaveBeenCalledTimes(1);
});

it("ne renouvelle ni un appel anonyme ni un jeton fourni hors session SDK", async () => {
  current = null;
  await recovery.fetch(`${base}/rest/v1/spawters`, request);
  current = newSession;
  await recovery.fetch(`${base}/rest/v1/spawters`, request);
  expect(renew).not.toHaveBeenCalled(); expect(transport).toHaveBeenCalledTimes(2);
});

it("conserve le corps de l'écriture rejetée avant SQL et borne son rejeu à un", async () => {
  const body = JSON.stringify({ spawter_id: "account-a", place_id: "place-a" });
  transport.mockImplementation(async () => jwtFailure());
  expect((await recovery.fetch(`${base}/rest/v1/saved_places`, { ...request, method: "POST", body })).status).toBe(401);
  expect(renew).toHaveBeenCalledTimes(1); expect(transport).toHaveBeenCalledTimes(2);
  expect(transport.mock.calls[1][1]).toMatchObject({ method: "POST", body });
});

it("conserve l'erreur initiale si le refresh est refusé", async () => {
  renew.mockResolvedValue({ data: { session: null }, error: { status: 400 } });
  const response = await recovery.fetch(`${base}/rest/v1/spawters`, request);
  expect(response.status).toBe(401); expect((await response.json()).code).toBe("PGRST301");
  expect(transport).toHaveBeenCalledTimes(1);
});

it("ne rejoue pas une requête annulée pendant le renouvellement", async () => {
  const abort = new AbortController();
  renew.mockImplementation(async () => { current = newSession; abort.abort(); return { data: { session: current }, error: null }; });
  expect((await recovery.fetch(`${base}/rest/v1/spawters`, { ...request, signal: abort.signal })).status).toBe(401);
  expect(transport).toHaveBeenCalledTimes(1);
});

it("reprend getUser après libération de son verrou, sans intercepter sa requête Auth", async () => {
  let locked = false;
  const verify = jest.fn(async () => {
    locked = true;
    const response = current?.access_token === oldSession.access_token
      ? { data: { user: null }, error: { code: "bad_jwt", status: 403 } }
      : { data: { user: { id: "account-a", email: "fixture@example.invalid" } }, error: null };
    locked = false; return response;
  });
  renew.mockImplementation(async () => {
    expect(locked).toBe(false); current = newSession; return { data: { session: current }, error: null };
  });
  expect((await recovery.getUser(verify)).data.user?.id).toBe("account-a");
  expect(renew).toHaveBeenCalledTimes(1); expect(verify).toHaveBeenCalledTimes(2);
});

it("ne renouvelle pas getUser pour une panne de transport ou un refus de droits", async () => {
  const failed = { data: { user: null }, error: { code: "not_authorized", status: 403 } };
  expect(await recovery.getUser(async () => failed)).toBe(failed);
  await expect(recovery.getUser(async () => { throw new TypeError("Failed to fetch"); })).rejects.toThrow("Failed to fetch");
  expect(renew).not.toHaveBeenCalled();
});
