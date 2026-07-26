// Tests Mode Crew — onglet Meute (app/(tabs)/meute.tsx).
// Critère de NON-RÉGRESSION : flag `mode-crew` OFF → l'onglet rend exactement
// comme avant (fil/EmptyState, aucun bloc Crew). Flag ON → le bloc « Ton
// Crew » s'ajoute EN PLUS, sans écraser l'existant.

import { type ReactNode } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only.
import TestRenderer from "react-test-renderer";
import { Text } from "react-native";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("react-native-safe-area-context", () => {
  const ReactMock = jest.requireActual("react") as typeof import("react");
  const RNMock = jest.requireActual("react-native") as typeof import("react-native");
  return {
    SafeAreaView: ({ children }: { children: ReactNode }) =>
      ReactMock.createElement(RNMock.View, null, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const mockTranslate = jest.fn((key: string) => key);
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

// Flags contrôlés par test.
let mockFlags: Record<string, boolean> = {};
jest.mock("../../src/store/feature-flags", () => ({
  useFlag: (code: string) => mockFlags[code] ?? false,
}));

jest.mock("../../src/lib/analytics", () => ({
  track: jest.fn(),
}));

import { ThemeProvider } from "../../src/theme/ThemeProvider";
import MeuteScreen from "../../app/(tabs)/meute";
import { useSpawterStore } from "../../src/store/spawter-store";
import { SAMPLE_SPAWTER } from "../../src/data/seed/sample-spawter";

interface TestInstanceLike {
  props: Record<string, unknown>;
}
interface TestRendererInstanceLike {
  root: {
    findAllByType: (t: unknown) => TestInstanceLike[];
    findAll: (predicate: (node: TestInstanceLike) => boolean) => TestInstanceLike[];
  };
  unmount: () => void;
}

async function renderScreen(): Promise<TestRendererInstanceLike> {
  let raw: TestRendererInstanceLike | null = null;
  await TestRenderer.act(async () => {
    raw = TestRenderer.create(
      <ThemeProvider>
        <MeuteScreen />
      </ThemeProvider>,
    ) as unknown as TestRendererInstanceLike;
    // Flush du load initial (listMeuteActivity démo → []).
    await Promise.resolve();
    await Promise.resolve();
  });
  if (!raw) throw new Error("renderer did not initialize");
  return raw;
}

function gatherTexts(r: TestRendererInstanceLike): string[] {
  return r.root.findAllByType(Text).flatMap((node) => {
    const children = node.props.children;
    if (typeof children === "string") return [children];
    if (Array.isArray(children)) {
      return children.filter((c): c is string => typeof c === "string");
    }
    return [];
  });
}

function findCrewBlocks(r: TestRendererInstanceLike): TestInstanceLike[] {
  return r.root.findAll((n) => n.props.testID === "crew-block");
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFlags = {};
  // Un spawter onboardé — le CrewBlock a besoin de son identité.
  useSpawterStore.setState({ spawter: SAMPLE_SPAWTER, hydrating: false });
});

describe("Onglet Meute — flag mode-crew OFF (non-régression)", () => {
  it("rend l'onglet comme avant : EmptyState, AUCUN bloc Crew", async () => {
    const r = await renderScreen();
    const texts = gatherTexts(r);

    // L'état vide historique (mode démo) est intact.
    expect(texts).toContain("empty_state.meute_title");
    expect(texts).toContain("meute.empty_body");

    // Aucune trace du Crew.
    expect(findCrewBlocks(r)).toHaveLength(0);
    expect(texts).not.toContain("crew.block_title");
    expect(texts).not.toContain("crew.cta_launch");

    r.unmount();
  });
});

describe("Onglet Meute — flag mode-crew ON", () => {
  beforeEach(() => {
    mockFlags = { "mode-crew": true };
  });

  it("ajoute le bloc « Ton Crew » EN PLUS de l'existant (rien d'écrasé)", async () => {
    const r = await renderScreen();
    const texts = gatherTexts(r);

    expect(findCrewBlocks(r).length).toBeGreaterThan(0);
    expect(texts).toContain("crew.block_title");
    expect(texts).toContain("crew.cta_launch");
    expect(texts).toContain("crew.join_label");

    // L'existant reste rendu (EmptyState démo sous le bloc).
    expect(texts).toContain("empty_state.meute_title");

    r.unmount();
  });

  it("sans spawter onboardé, le bloc Crew reste masqué (identité requise)", async () => {
    useSpawterStore.setState({ spawter: null, hydrating: false });
    const r = await renderScreen();
    expect(findCrewBlocks(r)).toHaveLength(0);
    r.unmount();
  });
});
