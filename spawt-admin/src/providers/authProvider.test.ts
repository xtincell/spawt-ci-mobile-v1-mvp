import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(), signOut: vi.fn(), getSession: vi.fn(),
  rpc: vi.fn(), maybeSingle: vi.fn(), audit: vi.fn(),
}));
vi.mock("../utility/supabaseClient", () => ({ supabaseClient: {
  auth: { signInWithPassword: mocks.signInWithPassword, signOut: mocks.signOut, getSession: mocks.getSession },
  rpc: mocks.rpc,
} }));
vi.mock("../lib/audit", () => ({ logAuditAction: mocks.audit }));
import { authProvider } from "./authProvider";

const session = { user: { id: "staff-id", email: "staff@example.test" } };
const staff = { id: "staff-id", role: "admin", display_name: "Équipe" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signInWithPassword.mockResolvedValue({ data: { session }, error: null });
  mocks.getSession.mockResolvedValue({ data: { session }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.rpc.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  mocks.maybeSingle.mockResolvedValue({ data: staff, error: null });
  mocks.audit.mockResolvedValue(undefined);
});

describe("authentification équipe", () => {
  it("authentifie un admin via la seule identité staff de sa session", async () => {
    expect(await authProvider.login({ email: "staff@example.test", password: "test-password" })).toMatchObject({ success: true });
    expect(mocks.rpc).toHaveBeenCalledWith("current_staff");
    expect(mocks.audit).toHaveBeenCalledWith({ action: "login", entity_type: "session" });
    expect(await authProvider.getIdentity?.()).toEqual({ ...staff, email: "staff@example.test" });
  });

  it("refuse un compte absent ou désactivé et supprime la session", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await authProvider.login({ email: "staff@example.test", password: "test-password" })).toMatchObject({ success: false, error: { name: "AuthRejection" } });
    expect(mocks.signOut).toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(await authProvider.getPermissions?.()).toBeNull();
  });

  it("bloque l'accès en panne sans effacer une session déjà établie", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: "Failed to fetch" } });
    expect(await authProvider.check()).toMatchObject({ authenticated: false });
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("distingue une panne de vérification d'un refus d'autorisation à la connexion", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: "Failed to fetch" } });
    expect(await authProvider.login({ email: "staff@example.test", password: "test-password" })).toMatchObject({ success: false, error: { name: "StaffLookupError", message: expect.stringContaining("Failed to fetch") } });
  });

  it("redirige une session absente sans lancer de lecture staff", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await authProvider.check()).toEqual({ authenticated: false, redirectTo: "/login" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("ne laisse pas une session utilisable après l'échec du journal de connexion", async () => {
    mocks.audit.mockRejectedValue(new Error("audit unavailable"));
    expect(await authProvider.login({ email: "staff@example.test", password: "test-password" })).toMatchObject({ success: false, error: { name: "AuditError" } });
    expect(mocks.signOut).toHaveBeenCalled();
  });
});
