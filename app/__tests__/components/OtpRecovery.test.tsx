// Transport simulé : aucun code, compte ou SMS réel.
// @ts-ignore — types de react-test-renderer absents du dépôt
import TestRenderer from "react-test-renderer";
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockRouter = { push: mockPush, replace: mockReplace, back: mockBack };
const mockParams = { phone: "+2250700000000" };
const mockT = (key: string) => key;
jest.mock("expo-router", () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: mockT }) }));
jest.mock("../../src/lib/analytics", () => ({ track: jest.fn() }));
jest.mock("../../src/lib/data-source", () => ({ isSupabaseConfigured: true }));
const mockField = jest.fn();
jest.mock("../../src/store/onboarding-draft", () => ({
  useOnboardingDraft: (selector: (state: unknown) => unknown) => selector({ setField: mockField }),
}));
const mockRecover = jest.fn();
jest.mock("../../src/store/spawter-store", () => ({
  useSpawterStore: { getState: () => ({ recoverAuthenticatedAccount: mockRecover }) },
}));
const mockSetSession = jest.fn();
jest.mock("../../src/lib/supabase", () => ({
  supabase: { auth: { setSession: (...args: unknown[]) => mockSetSession(...args) } },
}));
import OtpScreen from "../../app/(onboarding)/otp";

type Tree = { root: { findByProps: (props: Record<string, unknown>) => { props: Record<string, any> } }; unmount: () => void };
let tree: Tree;
const originalFetch = global.fetch;
const mockFetch = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch;
  mockSetSession.mockResolvedValue({ error: null });
  mockFetch.mockResolvedValue({ status: 200, ok: true, json: async () => ({
    access_token: "fixture-access", refresh_token: "fixture-refresh", user_id: "compte-a",
  }) });
  mockRecover.mockResolvedValue("restored");
  TestRenderer.act(() => { tree = TestRenderer.create(<OtpScreen />); });
});
afterEach(() => { TestRenderer.act(() => tree.unmount()); global.fetch = originalFetch; });
async function enterCode() {
  await TestRenderer.act(async () => { tree.root.findByProps({ testID: "otp-cell-0" }).props.onChangeText("123456"); });
}
it("un compte existant rejoint son Palais sans créer un nouveau profil", async () => {
  await enterCode();
  expect(mockRecover).toHaveBeenCalledWith("compte-a", expect.any(AbortSignal));
  expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
  expect(mockPush).not.toHaveBeenCalled();
});
it("seule l'absence confirmée du compte ouvre la création du profil", async () => {
  mockRecover.mockResolvedValue("new");
  await enterCode();
  expect(mockRecover).toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith("/(onboarding)/profile");
  expect(mockReplace).not.toHaveBeenCalled();
});
it("un profil sans premier Palais reprend le formulaire existant", async () => {
  mockRecover.mockResolvedValue("resume");
  await enterCode();
  expect(mockPush).toHaveBeenCalledWith("/(onboarding)/profile");
  expect(mockReplace).not.toHaveBeenCalled();
});
it("une lecture en panne se retente avec la session ouverte, sans consommer un autre OTP", async () => {
  mockRecover.mockRejectedValueOnce(new Error("ACCOUNT_READ_FAILED"));
  await enterCode();
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(tree.root.findByProps({ testID: "otp-resend" }).props.disabled).toBe(true);
  await TestRenderer.act(async () => { await tree.root.findByProps({ testID: "otp-recover" }).props.onPress(); });
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(mockSetSession).toHaveBeenCalledTimes(1);
  expect(mockRecover).toHaveBeenCalledTimes(2);
  expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
});
it("un compte incomplet reste distinct d'une nouvelle inscription", async () => {
  mockRecover.mockRejectedValueOnce(new Error("ACCOUNT_INCOMPLETE"));
  await enterCode();
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(tree.root.findByProps({ testID: "otp-recover" })).toBeTruthy();
});
it("un retour tardif après fermeture de l'écran ne navigue pas", async () => {
  let resolve!: (value: string) => void;
  mockRecover.mockReturnValue(new Promise<string>((r) => { resolve = r; }));
  await enterCode();
  TestRenderer.act(() => tree.unmount());
  await TestRenderer.act(async () => { resolve("restored"); });
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});
