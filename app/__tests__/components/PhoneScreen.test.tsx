// Story 2.3 + 2.3a — AC #8-1 : <PhoneScreen /> mode démo + Google/Apple buttons rendus.

import { type ReactNode } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";

const mockTranslate = jest.fn((key: string) => key);
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockTrack = jest.fn();
jest.mock("../../src/lib/analytics", () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

const mockSetField = jest.fn();
const mockPhoneInitial = "+225";
jest.mock("../../src/store/onboarding-draft", () => {
  const fn = (selector: (s: { setField: typeof mockSetField; draft: { phone_e164: string } }) => unknown) =>
    selector({ setField: mockSetField, draft: { phone_e164: mockPhoneInitial } });
  return { useOnboardingDraft: fn };
});

let mockSupabaseConfigured = false;
jest.mock("../../src/lib/data-source", () => ({
  get isSupabaseConfigured() {
    return mockSupabaseConfigured;
  },
}));

// Story 2.3a — mock des composants Google/Apple pour éviter les deps natives
// (expo-auth-session / expo-apple-authentication / expo-crypto) en environnement
// Jest. On vérifie seulement leur **présence** dans l'arbre — les tests propres
// vivent côté composants ou en E2E.
jest.mock("../../src/components/auth/GoogleButton", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    GoogleButton: () => (
      <Pressable testID="auth-google-button">
        <Text>google-mock</Text>
      </Pressable>
    ),
  };
});
jest.mock("../../src/components/auth/AppleButton", () => {
  const { Pressable, Text, Platform } = jest.requireActual("react-native");
  return {
    AppleButton: () =>
      Platform.OS === "ios" ? (
        <Pressable testID="auth-apple-button">
          <Text>apple-mock</Text>
        </Pressable>
      ) : null,
  };
});

import PhoneScreen from "../../app/(onboarding)/phone";

interface TestRendererInstanceLike {
  root: {
    findByProps: (props: Record<string, unknown>) => { props: Record<string, unknown> };
    findAllByProps: (props: Record<string, unknown>) => Array<{ props: Record<string, unknown> }>;
  };
}

function render(): TestRendererInstanceLike {
  let raw: TestRendererInstanceLike | null = null;
  TestRenderer.act(() => {
    raw = TestRenderer.create(<PhoneScreen />) as unknown as TestRendererInstanceLike;
  });
  if (!raw) throw new Error("no renderer");
  return raw;
}

describe("<PhoneScreen /> — Story 2.3 + 2.3a (mode démo)", () => {
  beforeEach(() => {
    mockTranslate.mockClear();
    mockPush.mockClear();
    mockTrack.mockClear();
    mockSetField.mockClear();
    mockSupabaseConfigured = false;
  });

  it("CTA Recevoir mon code disabled au montage (input +225 seul = invalide)", () => {
    const instance = render();
    const cta = instance.root.findByProps({ testID: "phone-send" });
    expect(cta.props.disabled).toBe(true);
  });

  it("tap Recevoir mon code en mode démo → setField + track(auth_otp_sent demo) + push otp avec params.demo='1'", async () => {
    const instance = render();
    const input = instance.root.findByProps({ testID: "phone-input" });
    TestRenderer.act(() => {
      (input.props.onChangeText as (v: string) => void)("+22507123456");
    });
    const cta = instance.root.findByProps({ testID: "phone-send" });
    await TestRenderer.act(async () => {
      await (cta.props.onPress as () => Promise<void>)();
    });

    expect(mockSetField).toHaveBeenCalledWith("phone_e164", "+22507123456");
    const sentCalls = mockTrack.mock.calls.filter(
      ([e]) => (e as { name: string }).name === "auth_otp_sent",
    );
    expect(sentCalls).toHaveLength(1);
    expect((sentCalls[0]?.[0] as { properties: { demo?: boolean } }).properties.demo).toBe(true);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(onboarding)/otp",
      params: { phone: "+22507123456", demo: "1" },
    });
  });

  it("format fallback étranger (+33611111111) accepté", () => {
    const instance = render();
    const input = instance.root.findByProps({ testID: "phone-input" });
    TestRenderer.act(() => {
      (input.props.onChangeText as (v: string) => void)("+33611111111");
    });
    const cta = instance.root.findByProps({ testID: "phone-send" });
    expect(cta.props.disabled).toBe(false);
  });

  // Story 2.3a AC #1+#2 — méthodes secondaires Google/Apple rendues sous l'OTP.
  it("Google button rendu sous le primary OTP", () => {
    const instance = render();
    const google = instance.root.findByProps({ testID: "auth-google-button" });
    expect(google).toBeTruthy();
  });

  it("Apple button rendu sur iOS (via mock isAvailable)", () => {
    // P-06 — assertion stricte (>0) au lieu de tautologie `>= 0`. Le mock
    // AppleButton ne rend que sur Platform.OS === "ios" ; jest-expo configure
    // Platform.OS = "ios" par défaut (preset).
    const instance = render();
    const matches = instance.root.findAllByProps({ testID: "auth-apple-button" });
    expect(matches.length).toBeGreaterThan(0);
  });
});
