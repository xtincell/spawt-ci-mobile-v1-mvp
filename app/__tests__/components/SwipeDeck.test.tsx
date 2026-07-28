// Tests Mode Rapide — <SwipeDeck /> (composant présentationnel).
// Couvre : rendu carte du dessus, boutons fallback ✕/♥ (même décision que le
// geste), avancement d'index, fin de deck (EmptyState + onDeckEnded 1×),
// deck vide initial (état distinct, pas de onDeckEnded), tap → fiche lieu.
//
// reanimated + gesture-handler mockés manuellement (standard projet — cf.
// GuetIndicator.test.tsx : pas de @testing-library, react-test-renderer).

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only.
import TestRenderer from "react-test-renderer";

jest.mock("react-native-reanimated", () => {
  const View = require("react-native").View;
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: number) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    interpolate: () => 0,
    Extrapolation: { CLAMP: "clamp" },
    runOnJS: (fn: unknown) => fn,
    View,
  };
});

jest.mock("react-native-gesture-handler", () => {
  const ReactMock = jest.requireActual("react") as typeof import("react");
  const makeChainable = () => {
    const gesture: Record<string, unknown> = {};
    for (const method of ["activeOffsetX", "failOffsetY", "onUpdate", "onEnd"]) {
      gesture[method] = () => gesture;
    }
    return gesture;
  };
  return {
    __esModule: true,
    GestureDetector: ({ children }: { children: React.ReactNode }) =>
      ReactMock.createElement(ReactMock.Fragment, null, children),
    Gesture: { Pan: makeChainable },
  };
});

const mockTranslate = jest.fn((key: string, opts?: Record<string, unknown>) =>
  opts && typeof opts.name === "string" ? `${key}:${opts.name}` : key,
);
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

import { SwipeDeck } from "../../src/components/place/SwipeDeck";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
import type { PlaceWithScore } from "../../src/lib/matching";
import type { PlaceAdn } from "../../src/types/place";

const NOW_ISO = "2026-07-26T12:00:00Z";

function makeItem(id: string, name: string): PlaceWithScore {
  const adn: PlaceAdn = {
    place_id: id,
    axe_local_international: 0,
    axe_informel_etabli: 0,
    axe_budget_premium: 0,
    axe_populaire_prive: 0,
    axe_decontracte_habille: 0,
    confidence_score: 0.8,
    total_reviews: 12,
    sample_size: 12,
    weighted_rating: 4.2,
    updated_at: NOW_ISO,
  };
  return {
    place: {
      id,
      name,
      cuisine: ["ivoirienne"],
      location: {
        lat: 5.358,
        lng: -3.97,
        descriptive_address: "Test",
        neighborhood: "Cocody",
        city: "Abidjan",
      },
      price: { tier: 2 },
      hours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
      phone: null,
      whatsapp: null,
      cover_photo_url: null,
      gallery_urls: [],
      menu_urls: [],
      signals: [],
      is_published: true,
      created_at: NOW_ISO,
      updated_at: NOW_ISO,
    },
    adn,
    raw_score: 0.8,
    match_score: 89,
    distance_km: 1.2,
  };
}

interface NodeLike {
  type: unknown;
  props: Record<string, unknown>;
  children?: unknown;
}

/** Ne garde que les éléments HOST (type string) — findAll matche aussi les
 *  composites (Pressable) qui portent les mêmes props, ce qui doublerait. */
function isHost(n: NodeLike): boolean {
  return typeof n.type === "string";
}
interface RendererLike {
  root: {
    findAll: (predicate: (n: NodeLike) => boolean) => NodeLike[];
  };
  toJSON: () => unknown;
}

function render(ui: React.ReactElement): RendererLike {
  let r: RendererLike | null = null;
  TestRenderer.act(() => {
    r = TestRenderer.create(
      <ThemeProvider>{ui}</ThemeProvider>,
    ) as unknown as RendererLike;
  });
  if (!r) throw new Error("renderer did not init");
  return r;
}

function pressByLabel(r: RendererLike, label: string): void {
  const nodes = r.root.findAll(
    (n) => n.props.accessibilityLabel === label && typeof n.props.onPress === "function",
  );
  expect(nodes.length).toBeGreaterThan(0);
  TestRenderer.act(() => {
    (nodes[0]!.props.onPress as () => void)();
  });
}

function treeText(r: RendererLike): string {
  return JSON.stringify(r.toJSON());
}

describe("<SwipeDeck /> — Mode Rapide", () => {
  const onLike = jest.fn();
  const onPass = jest.fn();
  const onOpenPlace = jest.fn();
  const onDeckEnded = jest.fn();
  const onBackToFeed = jest.fn();

  const props = { onLike, onPass, onOpenPlace, onDeckEnded, onBackToFeed };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rend la carte du dessus (1er du deck) + boutons fallback ✕/♥", () => {
    const deck = [makeItem("p1", "Chez Fixture Un"), makeItem("p2", "Chez Fixture Deux")];
    const r = render(<SwipeDeck deck={deck} {...props} />);
    expect(treeText(r)).toContain("Chez Fixture Un");
    expect(
      r.root.findAll(
        (n) => isHost(n) && n.props.accessibilityLabel === "rapide.keep_aria",
      ),
    ).toHaveLength(1);
    expect(
      r.root.findAll(
        (n) => isHost(n) && n.props.accessibilityLabel === "rapide.pass_aria",
      ),
    ).toHaveLength(1);
  });

  it("bouton ♥ → onLike(item, position) et la carte suivante monte", () => {
    const deck = [makeItem("p1", "Chez Fixture Un"), makeItem("p2", "Chez Fixture Deux")];
    const r = render(<SwipeDeck deck={deck} {...props} />);
    pressByLabel(r, "rapide.keep_aria");
    expect(onLike).toHaveBeenCalledTimes(1);
    expect(onLike.mock.calls[0]![0].place.id).toBe("p1");
    expect(onLike.mock.calls[0]![1]).toBe(0);
    expect(onPass).not.toHaveBeenCalled();
    expect(treeText(r)).toContain("Chez Fixture Deux");
  });

  it("bouton ✕ → onPass(item, position), jamais onLike", () => {
    const deck = [makeItem("p1", "Chez Fixture Un")];
    const r = render(<SwipeDeck deck={deck} {...props} />);
    pressByLabel(r, "rapide.pass_aria");
    expect(onPass).toHaveBeenCalledTimes(1);
    expect(onPass.mock.calls[0]![0].place.id).toBe("p1");
    expect(onLike).not.toHaveBeenCalled();
  });

  it("tap sur la carte → onOpenPlace(item courant)", () => {
    const deck = [makeItem("p1", "Chez Fixture Un")];
    const r = render(<SwipeDeck deck={deck} {...props} />);
    pressByLabel(r, "rapide.card_open_aria:Chez Fixture Un");
    expect(onOpenPlace).toHaveBeenCalledTimes(1);
    expect(onOpenPlace.mock.calls[0]![0].place.id).toBe("p1");
  });

  it("fin de deck → état vide voix du Chat + onDeckEnded 1× + CTA retour feed", () => {
    const deck = [makeItem("p1", "Chez Fixture Un"), makeItem("p2", "Chez Fixture Deux")];
    const r = render(<SwipeDeck deck={deck} {...props} />);
    pressByLabel(r, "rapide.keep_aria");
    pressByLabel(r, "rapide.pass_aria");
    expect(treeText(r)).toContain("rapide.deck_end_title");
    expect(onDeckEnded).toHaveBeenCalledTimes(1);
    pressByLabel(r, "rapide.deck_end_cta");
    expect(onBackToFeed).toHaveBeenCalledTimes(1);
  });

  it("deck vide initial → état « rien à proposer » distinct, PAS de onDeckEnded", () => {
    const r = render(<SwipeDeck deck={[]} {...props} />);
    expect(treeText(r)).toContain("rapide.empty_title");
    expect(treeText(r)).not.toContain("rapide.deck_end_title");
    expect(onDeckEnded).not.toHaveBeenCalled();
    pressByLabel(r, "rapide.empty_cta");
    expect(onBackToFeed).toHaveBeenCalledTimes(1);
  });
});
