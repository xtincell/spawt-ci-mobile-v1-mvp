// Sprint 2 — GoldUpsellSheet : le CTA renvoie vers le portail web (achat
// HORS app, Apple 3.1.3 — aucun prix ni bouton d'achat in-app), état « Gold
// actif » (badge doré + gestion), revalidation à l'ouverture.
//
// Le mock react-i18next résout les VRAIES strings de fr.json : les
// assertions « aucun prix affiché » portent sur la copy réelle.

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only.
import TestRenderer from "react-test-renderer";
import { Linking } from "react-native";

const mockStorage = new Map<string, string>();
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((k: string) => Promise.resolve(mockStorage.get(k) ?? null)),
    setItem: jest.fn((k: string, v: string) => {
      mockStorage.set(k, v);
      return Promise.resolve();
    }),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

// Store mocké : le sheet ne lit que `gold` + `refreshGold` via sélecteurs.
import type { GoldEntitlement } from "../../src/lib/data-source";
let mockGold: GoldEntitlement | null = null;
const mockRefreshGold = jest.fn(() => Promise.resolve());
jest.mock("../../src/store/spawter-store", () => ({
  __esModule: true,
  useSpawterStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ gold: mockGold, refreshGold: mockRefreshGold }),
}));

jest.mock("react-i18next", () => {
  const fr = jest.requireActual("../../src/i18n/fr.json") as Record<string, unknown>;
  const resolve = (key: string): string => {
    let cur: unknown = fr;
    for (const part of key.split(".")) {
      cur = cur && typeof cur === "object" ? (cur as Record<string, unknown>)[part] : undefined;
    }
    return typeof cur === "string" ? cur : key;
  };
  return {
    __esModule: true,
    useTranslation: () => ({ t: (key: string) => resolve(key) }),
  };
});

import { GoldUpsellSheet } from "../../src/components/GoldUpsellSheet";
import { ThemeProvider } from "../../src/theme/ThemeProvider";

type TreeNode = {
  type: string;
  props: Record<string, unknown>;
  children: Array<TreeNode | string> | null;
};
type RenderOutput = TreeNode | TreeNode[] | null;

interface Rendered {
  toJSON: () => RenderOutput;
  unmount: () => void;
  root: {
    findAllByProps: (props: Record<string, unknown>) => Array<{
      props: Record<string, unknown>;
    }>;
  };
}

function render(node: React.ReactElement): Rendered {
  let instance: Rendered | null = null;
  TestRenderer.act(() => {
    instance = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>);
  });
  return instance as unknown as Rendered;
}

/** Presse un Pressable par testID via l'arbre d'instances (le JSON sérialisé
 *  ne porte pas onPress — Pressable le transforme en handlers responder). */
function pressByTestID(r: Rendered, testID: string): void {
  const matches = r.root.findAllByProps({ testID });
  const withPress = matches.find((m) => typeof m.props.onPress === "function");
  expect(withPress).toBeDefined();
  TestRenderer.act(() => {
    (withPress!.props.onPress as () => void)();
  });
}

function collectText(out: RenderOutput): string {
  const acc: string[] = [];
  const walk = (n: TreeNode | string | null): void => {
    if (n === null) return;
    if (typeof n === "string") {
      acc.push(n);
      return;
    }
    for (const child of n.children ?? []) walk(child);
  };
  for (const tree of Array.isArray(out) ? out : out ? [out] : []) walk(tree);
  return acc.join(" ");
}

function findByTestID(out: RenderOutput, testID: string): TreeNode | null {
  const walk = (n: TreeNode | string | null): TreeNode | null => {
    if (n === null || typeof n === "string") return null;
    if (n.props?.testID === testID) return n;
    for (const child of n.children ?? []) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  };
  for (const tree of Array.isArray(out) ? out : out ? [out] : []) {
    const found = walk(tree);
    if (found) return found;
  }
  return null;
}

const NOW = Date.parse("2026-07-26T12:00:00.000Z");

function goldActif(): GoldEntitlement {
  return {
    active: true,
    plan: "gold_monthly",
    status: "active",
    expires_at: "2026-08-26T12:00:00.000Z",
    grace_until: null,
    checked_at: new Date(NOW).toISOString(),
  };
}

let openURLSpy: jest.SpyInstance;

beforeEach(() => {
  mockGold = null;
  mockRefreshGold.mockClear();
  jest.spyOn(Date, "now").mockReturnValue(NOW);
  openURLSpy = jest.spyOn(Linking, "openURL").mockImplementation(() => Promise.resolve(true));
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("GoldUpsellSheet — état non-Gold (upsell portail)", () => {
  it("le CTA ouvre la page Gold du portail (spawt.online/gold)", () => {
    const r = render(<GoldUpsellSheet visible onClose={jest.fn()} />);
    expect(findByTestID(r.toJSON(), "gold-upsell-cta")).not.toBeNull();
    pressByTestID(r, "gold-upsell-cta");
    expect(openURLSpy).toHaveBeenCalledWith("https://spawt.online/gold");
    r.unmount();
  });

  it("affiche la copy portail « Passe Gold sur spawt.online »", () => {
    const r = render(<GoldUpsellSheet visible onClose={jest.fn()} />);
    const text = collectText(r.toJSON());
    expect(text).toContain("Passe Gold sur spawt.online");
    expect(text).toContain("tout Abidjan");
    r.unmount();
  });

  it("n'affiche AUCUN prix in-app (Apple 3.1.3)", () => {
    const r = render(<GoldUpsellSheet visible onClose={jest.fn()} />);
    const text = collectText(r.toJSON());
    // Copy paywall historique : « 2 950 F/mois TTC » — bannie de l'app.
    expect(text).not.toMatch(/2\s?950/);
    expect(text).not.toMatch(/29\s?500/);
    expect(text).not.toMatch(/F\s?CFA|FCFA|XOF|TTC/i);
    expect(text).not.toMatch(/F\/mois/i);
    r.unmount();
  });

  it("revalide l'entitlement à l'ouverture (refreshGold)", () => {
    const r = render(<GoldUpsellSheet visible onClose={jest.fn()} />);
    expect(mockRefreshGold).toHaveBeenCalled();
    r.unmount();
  });

  it("ne revalide pas tant que la feuille est fermée", () => {
    const r = render(<GoldUpsellSheet visible={false} onClose={jest.fn()} />);
    expect(mockRefreshGold).not.toHaveBeenCalled();
    r.unmount();
  });
});

describe("GoldUpsellSheet — état Gold actif", () => {
  it("affiche le badge doré + la copy Gold actif, sans CTA d'achat", () => {
    mockGold = goldActif();
    const r = render(<GoldUpsellSheet visible onClose={jest.fn()} />);
    const out = r.toJSON();
    expect(findByTestID(out, "gold-active-badge")).not.toBeNull();
    expect(findByTestID(out, "gold-upsell-cta")).toBeNull();
    const text = collectText(out);
    expect(text).toContain("Tu es Gold");
    expect(text).toContain("GOLD");
    r.unmount();
  });

  it("« Gérer mon abonnement » ouvre le portail /compte", () => {
    mockGold = goldActif();
    const r = render(<GoldUpsellSheet visible onClose={jest.fn()} />);
    expect(findByTestID(r.toJSON(), "gold-manage-cta")).not.toBeNull();
    pressByTestID(r, "gold-manage-cta");
    expect(openURLSpy).toHaveBeenCalledWith("https://spawt.online/compte");
    r.unmount();
  });

  it("entitlement périmé (échéance passée sans grâce) → retombe sur l'upsell", () => {
    mockGold = { ...goldActif(), expires_at: "2026-07-20T12:00:00.000Z" };
    const r = render(<GoldUpsellSheet visible onClose={jest.fn()} />);
    expect(findByTestID(r.toJSON(), "gold-upsell-cta")).not.toBeNull();
    expect(findByTestID(r.toJSON(), "gold-active-badge")).toBeNull();
    r.unmount();
  });
});
