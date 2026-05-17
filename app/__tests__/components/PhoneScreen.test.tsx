// Story 2.3 — AC #8-1 : <PhoneScreen /> émet auth_otp_sent en démo + valide format CIV.

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

import PhoneScreen from "../../app/(onboarding)/phone";

interface TestRendererInstanceLike {
  root: {
    findByProps: (props: Record<string, unknown>) => { props: Record<string, unknown> };
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

describe("<PhoneScreen /> — Story 2.3 (mode démo)", () => {
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
});
