const mockStorage = new Map<string,string>();
jest.mock("react-native", () => ({ Platform: { OS: "android" } }));
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: async (k:string) => mockStorage.get(k) ?? null,
  setItem: async (k:string,v:string) => { mockStorage.set(k,v); },
}));

const mockConsent = jest.fn();
const mockRpc = jest.fn();
let mockOwner = "account-one";
let mockNextId = 0;
jest.mock("../storage", () => ({ getConsent: () => mockConsent() }));
jest.mock("expo-crypto", () => ({ randomUUID: () => "00000000-0000-4000-8000-" + String(++mockNextId).padStart(12,"0") }));
jest.mock("expo-application", () => ({
  getInstallationTimeAsync: async () => new Date("2026-11-25T10:00:00Z"),
  getLastUpdateTimeAsync: async () => new Date("2026-11-25T10:00:00Z"),
}));
jest.mock("../supabase", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: {user:{id:mockOwner},access_token:"demo-session"} } }) },
    rpc: (name: string, params: unknown) => ({
      setHeader: jest.fn(),
      then: (ok: (result: unknown) => void, fail: (error: unknown) => void) =>
        Promise.resolve().then(() => mockRpc(name,params)).then(ok,fail),
    }),
  },
}));

// Re-import the app process while keeping its persisted installation and mocks.
function start() {
  jest.resetModules();
  return require("../pilot-journey") as typeof import("../pilot-journey");
}
function calls(name: string) {
  return mockRpc.mock.calls.filter(([method]) => method === name).map(([,params]) => params);
}
beforeEach(async () => {
  jest.clearAllMocks(); mockStorage.clear();
  mockOwner="account-one"; mockConsent.mockResolvedValue("consented");
  mockRpc.mockImplementation(() => ({data:null,error:null}));
});

it("retains the original open across process restarts; a late claim only offers the place",async () => {
  let app=start();
  mockConsent.mockResolvedValue(null);
  await app.recordColdOpen(); await app.syncPilot(null);
  expect(mockRpc).not.toHaveBeenCalled();
  app=start();
  mockConsent.mockResolvedValue("consented");
  await app.syncPilot(null);
  const opens=calls("pilot_app_open");
  expect(opens).toHaveLength(2);
  expect(opens[0].p_first_open_at).toEqual(opens[0].p_opened_at);
  expect(opens[0].p_installed_at).toBe("2026-11-25T10:00:00.000Z");
  expect(opens[0].p_existing_install).toBe(false);
  expect(opens[1].p_first_open_at).toEqual(opens[0].p_first_open_at);
  expect(opens[1].p_install_key).toEqual(opens[0].p_install_key);
  expect(opens[1].p_event_key).not.toEqual(opens[0].p_event_key);
  await app.savePilotCredential("abcdef012345",null);
  mockRpc.mockImplementation((name) => ({data:name==="pilot_claim"?{place_id:app.brunchPlace,journey_id:"demo"}:null,error:null}));
  await app.syncPilot(mockOwner); await app.syncPilot(mockOwner);
  expect(calls("pilot_claim")).toHaveLength(1);
  expect(calls("pilot_claim")[0].p_credential).toBe("ABCDEF012345");
  expect((await app.getPilotPresentation(mockOwner)).offer?.place).toBe(app.brunchPlace);
  expect(calls("pilot_place_view")).toHaveLength(0);
  expect(calls("pilot_saved_place")).toHaveLength(0);
});

it("persists a view with its original instant and key on replay after loss of acknowledgement",async () => {
  const app=start(); let first=true;
  mockRpc.mockImplementation((name) => {
    if (name==="pilot_place_view" && first) { first=false; return {error:{message:"offline"}}; }
    return {data:null,error:null};
  });
  await expect(app.recordPilotView(mockOwner,app.brunchPlace)).rejects.toEqual({message:"offline"});
  await app.syncPilot(mockOwner); await app.syncPilot(mockOwner);
  expect(calls("pilot_place_view")).toHaveLength(2);
  expect(calls("pilot_place_view")[0]).toEqual(calls("pilot_place_view")[1]);
});

it("keeps an offline handoff with the original account, and rejects expired codes without blocking the app",async () => {
  const app=start();
  await app.savePilotCredential("123456789abc",null);
  mockRpc.mockImplementation(() => ({error:{message:"offline"}}));
  await expect(app.syncPilot(mockOwner)).rejects.toEqual({message:"offline"});
  mockOwner="account-two"; mockRpc.mockImplementation(() => ({data:null,error:null}));
  await app.syncPilot(mockOwner);
  expect(calls("pilot_claim")).toHaveLength(0);
  mockOwner="account-one";
  mockRpc.mockImplementation(name => ({data:null,error:name==="pilot_claim"?{message:"claim_unavailable"}:null}));
  await app.syncPilot(mockOwner); await app.syncPilot(mockOwner);
  expect(calls("pilot_claim")).toHaveLength(1);
  expect((await app.getPilotPresentation(mockOwner)).notice).toBe(true);
  expect((await app.getPilotPresentation("account-two")).notice).toBe(false);
  expect(app.validateCredential("B01")).toBeNull();
});

it("only publishes a favorite state explicitly confirmed for the current account",async () => {
  const app=start(), at=new Date().toISOString();
  await expect(app.mutatePilotSaved(mockOwner,app.brunchPlace,"event",at,true)).rejects.toThrow("pilot_saved_unconfirmed");
  mockRpc.mockImplementation(name => ({data:name==="pilot_saved_place"?{saved:false,applied:false}:null,error:null}));
  await expect(app.mutatePilotSaved(mockOwner,app.brunchPlace,"event",at,true)).resolves.toBe(false);
  mockOwner="account-two";
  await expect(app.mutatePilotSaved("account-one",app.brunchPlace,"event",at,true)).rejects.toThrow("pilot_session_changed");
  expect(calls("pilot_saved_place")).toHaveLength(2);
});
