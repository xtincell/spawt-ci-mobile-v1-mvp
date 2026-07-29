// Story 2.2 — AC #7-4 : <ConsentScreen /> respecte FR-040 (binaire bloquant).
//
// Pattern de test : react-test-renderer (cohérent avec Story 2.1 ChatBubble).
// Aucune dépendance @testing-library/react-native (non installée).

import { type ReactNode } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";
import { Pressable } from "react-native";

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

const mockDraftSetConsent = jest.fn();
jest.mock("../../src/store/onboarding-draft", () => ({
  useOnboardingDraft: {
    getState: () => ({ setConsent: mockDraftSetConsent }),
  },
}));

const mockSpawterRecordConsent = jest.fn(() => Promise.resolve());
let mockSpawter: unknown = null;
jest.mock("../../src/store/spawter-store", () => ({
  useSpawterStore: {
    getState: () => ({ spawter: mockSpawter, recordConsent: mockSpawterRecordConsent }),
  },
}));

// ChatBubble children consomment useTheme — on stub via mock léger pour éviter
// d'embarquer le ThemeProvider entier.
jest.mock("../../src/components/ChatBubble", () => ({
  ChatBubble: () => null,
}));

import ConsentScreen from "../../app/(onboarding)/consent";

interface TestInstanceLike {
  props: Record<string, unknown>;
}
interface TestRendererInstanceLike {
  root: {
    findByProps: (props: Record<string, unknown>) => TestInstanceLike;
    findAllByProps: (props: Record<string, unknown>) => TestInstanceLike[];
    findAllByType: (t: unknown) => TestInstanceLike[];
  };
}

function render(): TestRendererInstanceLike {
  let raw: TestRendererInstanceLike | null = null;
  TestRenderer.act(() => {
    raw = TestRenderer.create(<ConsentScreen />) as unknown as TestRendererInstanceLike;
  });
  if (!raw) throw new Error("renderer did not initialize");
  return raw;
}

function findPressableByTestID(
  instance: TestRendererInstanceLike,
  testID: string,
): TestInstanceLike {
  // Plusieurs nœuds peuvent porter le même testID (le wrapper React qui le
  // propage + le Pressable host). On veut celui qui possède un handler onPress.
  const all = instance.root.findAllByProps({ testID });
  const withPress = all.find((n) => typeof n.props.onPress === "function");
  return withPress ?? all[0]!;
}

describe("<ConsentScreen /> — Story 2.2 (FR-040 bloquant)", () => {
  beforeEach(() => {
    mockTranslate.mockClear();
    mockPush.mockClear();
    mockTrack.mockClear();
    mockDraftSetConsent.mockClear();
    mockSpawterRecordConsent.mockClear();
    mockSpawter = null;
  });

  it("au montage : émet consent_screen_viewed une seule fois", () => {
    render();
    const viewedCalls = mockTrack.mock.calls.filter(
      ([event]) => (event as { name: string }).name === "consent_screen_viewed",
    );
    expect(viewedCalls).toHaveLength(1);
  });

  it("bouton Continuer est disabled au montage", () => {
    const instance = render();
    const cta = findPressableByTestID(instance, "consent-continue");
    expect(cta.props.accessibilityState).toMatchObject({ disabled: true });
    expect(cta.props.disabled).toBe(true);
  });

  it("tap case CGU/CGV → state cgv true mais bouton reste disabled (gate binaire)", () => {
    const instance = render();
    const cgvBox = findPressableByTestID(instance, "consent-cgv");
    TestRenderer.act(() => {
      (cgvBox.props.onPress as () => void)();
    });
    const cta = findPressableByTestID(instance, "consent-continue");
    expect(cta.props.disabled).toBe(true);
  });

  it("tap les 2 cases → bouton Continuer activé", () => {
    const instance = render();
    TestRenderer.act(() => {
      (findPressableByTestID(instance, "consent-cgv").props.onPress as () => void)();
    });
    TestRenderer.act(() => {
      (findPressableByTestID(instance, "consent-geoloc").props.onPress as () => void)();
    });
    const cta = findPressableByTestID(instance, "consent-continue");
    expect(cta.props.disabled).toBe(false);
  });

  it("tap Continuer après cochage → émet consent_recorded (cgv puis geoloc) puis onboarding_step_completed, dans cet ordre", async () => {
    const instance = render();
    TestRenderer.act(() => {
      (findPressableByTestID(instance, "consent-cgv").props.onPress as () => void)();
    });
    TestRenderer.act(() => {
      (findPressableByTestID(instance, "consent-geoloc").props.onPress as () => void)();
    });
    mockTrack.mockClear();

    await TestRenderer.act(async () => {
      await (findPressableByTestID(instance, "consent-continue").props.onPress as () => Promise<void>)();
    });

    const sequence = mockTrack.mock.calls.map(([e]) => (e as { name: string; properties?: Record<string, unknown> }));
    expect(sequence[0]).toEqual({
      name: "consent_recorded",
      properties: { kind: "cgv", decision: "accepted" },
    });
    expect(sequence[1]).toEqual({
      name: "consent_recorded",
      properties: { kind: "geoloc", decision: "accepted" },
    });
    expect(sequence[2]).toEqual({
      name: "onboarding_step_completed",
      properties: { step: "consent", step_index: 1 },
    });
  });

  it("tap Continuer → setConsent(\"cgv\", iso) + setConsent(\"geoloc\", iso) + router.push(/(onboarding)/phone)", async () => {
    const instance = render();
    TestRenderer.act(() => {
      (findPressableByTestID(instance, "consent-cgv").props.onPress as () => void)();
    });
    TestRenderer.act(() => {
      (findPressableByTestID(instance, "consent-geoloc").props.onPress as () => void)();
    });

    await TestRenderer.act(async () => {
      await (findPressableByTestID(instance, "consent-continue").props.onPress as () => Promise<void>)();
    });

    expect(mockDraftSetConsent).toHaveBeenCalledTimes(2);
    expect(mockDraftSetConsent.mock.calls[0]?.[0]).toBe("cgv");
    expect(mockDraftSetConsent.mock.calls[1]?.[0]).toBe("geoloc");
    expect(mockPush).toHaveBeenCalledWith("/(onboarding)/phone");
  });

  it("si spawter !== null : recordConsent (\"cgv\" puis \"geoloc\") est appelé sur le store", async () => {
    mockSpawter = { id: "x" };
    const instance = render();
    TestRenderer.act(() => {
      (findPressableByTestID(instance, "consent-cgv").props.onPress as () => void)();
    });
    TestRenderer.act(() => {
      (findPressableByTestID(instance, "consent-geoloc").props.onPress as () => void)();
    });

    await TestRenderer.act(async () => {
      await (findPressableByTestID(instance, "consent-continue").props.onPress as () => Promise<void>)();
    });

    expect(mockSpawterRecordConsent).toHaveBeenCalledTimes(2);
    expect(mockSpawterRecordConsent.mock.calls[0]).toEqual(["cgv", true]);
    expect(mockSpawterRecordConsent.mock.calls[1]).toEqual(["geoloc", true]);
  });

  it("rendu OK : au moins un nœud avec onPress dans le tree (sanity)", () => {
    const instance = render();
    const interactive = (instance.root as unknown as {
      findAll: (fn: (n: { props: Record<string, unknown> }) => boolean) => unknown[];
    }).findAll((n) => typeof n.props.onPress === "function");
    expect(interactive.length).toBeGreaterThan(0);
  });
});
