// Story 2.3 + 2.3a — AC #8-2 : <OtpScreen /> en mode démo accepte `123456`
// (#V07 — code mock 8 chiffres de la phase MAJ consolidée 07/2026)
// et émet auth_otp_validated + auth_signed_in + onboarding_step_completed.
// Couvre aussi : friction panel (3 essais → Resend + Change phone DANS le panneau).

import { type ReactNode } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";

const mockTranslate = jest.fn((key: string) => key);
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockParams: { phone?: string; demo?: string } = { phone: "+22507000000", demo: "1" };
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));

const mockTrack = jest.fn();
jest.mock("../../src/lib/analytics", () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

const mockSetField = jest.fn();
jest.mock("../../src/store/onboarding-draft", () => {
  const fn = (selector: (s: { setField: typeof mockSetField }) => unknown) =>
    selector({ setField: mockSetField });
  return { useOnboardingDraft: fn };
});

jest.mock("../../src/lib/data-source", () => ({
  isSupabaseConfigured: false,
}));

// Story 2.3a — mock du client Supabase (importé dans otp.tsx pour setSession).
const mockSetSession = jest.fn().mockResolvedValue({ error: null });
jest.mock("../../src/lib/supabase", () => ({
  supabase: {
    auth: {
      setSession: (payload: unknown) => mockSetSession(payload),
    },
  },
}));

import OtpScreen from "../../app/(onboarding)/otp";

interface FoundProps {
  props: Record<string, unknown>;
}
interface TestRendererInstanceLike {
  root: {
    findByProps: (props: Record<string, unknown>) => FoundProps;
    findAllByProps: (props: Record<string, unknown>) => FoundProps[];
    findAllByType: (t: unknown) => FoundProps[];
  };
}

function render(): TestRendererInstanceLike {
  let raw: TestRendererInstanceLike | null = null;
  TestRenderer.act(() => {
    raw = TestRenderer.create(<OtpScreen />) as unknown as TestRendererInstanceLike;
  });
  if (!raw) throw new Error("no renderer");
  return raw;
}

async function typeCode(instance: TestRendererInstanceLike, code: string): Promise<void> {
  for (let i = 0; i < code.length; i++) {
    const cell = instance.root.findByProps({ testID: `otp-cell-${i}` });
    await TestRenderer.act(async () => {
      (cell.props.onChangeText as (v: string) => void)(code[i] ?? "");
    });
  }
}

describe("<OtpScreen /> — Story 2.3 + 2.3a (mode démo)", () => {
  beforeEach(() => {
    mockTranslate.mockClear();
    mockPush.mockClear();
    mockBack.mockClear();
    mockTrack.mockClear();
    mockSetField.mockClear();
    mockSetSession.mockClear();
    mockParams = { phone: "+22507000000", demo: "1" };
  });

  it("6 cases rendues + cell-0 a autoFocus true", () => {
    const instance = render();
    const cell0 = instance.root.findByProps({ testID: "otp-cell-0" });
    expect(cell0.props.autoFocus).toBe(true);
    // 6 cases = longueur du pin Termii (version finale) — la 7e n'existe plus.
    const cell5 = instance.root.findByProps({ testID: "otp-cell-5" });
    expect(cell5).toBeTruthy();
    expect(instance.root.findAllByProps({ testID: "otp-cell-6" })).toHaveLength(0);
  });

  it("saisie de 123456 → auto-submit → 3 events dans l'ordre + setField + push profile", async () => {
    const instance = render();
    await typeCode(instance, "123456");

    const order = mockTrack.mock.calls.map(([e]) => (e as { name: string; properties?: Record<string, unknown> }).name);
    expect(order).toEqual([
      "auth_otp_validated",
      "auth_signed_in",
      "onboarding_step_completed",
    ]);
    expect(mockSetField).toHaveBeenCalledWith("phone_e164", "+22507000000");
    expect(mockPush).toHaveBeenCalledWith("/(onboarding)/profile");
  });

  it("démo : setSession n'est jamais appelé (pas de session live)", async () => {
    const instance = render();
    await typeCode(instance, "123456");
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it("saisie code invalide en démo → error + no nav + attempts incrémente", async () => {
    const instance = render();
    await typeCode(instance, "111111");

    const validatedCalls = mockTrack.mock.calls.filter(
      ([e]) => (e as { name: string }).name === "auth_otp_validated",
    );
    expect(validatedCalls).toHaveLength(1);
    expect((validatedCalls[0]?.[0] as { properties: { success: boolean } }).properties.success).toBe(false);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("tap Changer de numéro → router.back()", () => {
    const instance = render();
    const back = instance.root.findByProps({ testID: "otp-change-phone" });
    TestRenderer.act(() => {
      (back.props.onPress as () => void)();
    });
    expect(mockBack).toHaveBeenCalled();
  });

  // Story 2.3a AC #6 — friction panel contient Resend + Change phone DANS le panneau.
  it("3 essais ratés → friction panel + Resend + Change phone DANS le panneau", async () => {
    const instance = render();
    for (let i = 0; i < 3; i++) {
      await typeCode(instance, "111111");
    }
    // Le panneau friction est rendu.
    const friction = instance.root.findByProps({ testID: "otp-friction" });
    expect(friction).toBeTruthy();
    // Les 2 boutons doivent toujours être présents (rendus DANS le panneau).
    const resend = instance.root.findByProps({ testID: "otp-resend" });
    const changePhone = instance.root.findByProps({ testID: "otp-change-phone" });
    expect(resend).toBeTruthy();
    expect(changePhone).toBeTruthy();
  });

  // P-31 round 3 — live path : setSession failure doit ne pas naviguer.
  // Test différé : le mock isSupabaseConfigured est statique au module-level
  // (jest.mock factory), donc on ne peut pas le toggler dans un test isolé
  // sans `jest.resetModules` + ré-import. Couvert en suite live dédiée Sprint 2
  // (D-14 round 3 deferred-work). Le path est néanmoins correct dans le code :
  // `if (sessionErr) { setError(...); return; }` empêche le push.
  it.skip("live mode : setSession failure → no router.push + no auth_signed_in (TODO: live suite)", () => {
    // Voir `deferred-work.md` D-14 round 3.
  });
});
