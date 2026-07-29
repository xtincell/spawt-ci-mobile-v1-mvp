// Pastille feed « Promo » / « Événement » (0049/0050) — composant PUR.
// Couvre : rendu par drapeaux, rien sans activité (non-régression des cartes),
// et l'intégration ListeCard (prop optionnelle → pastille présente/absente).

import { type ReactElement } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only.
import TestRenderer from "react-test-renderer";
import { Text } from "react-native";

const mockTranslate = jest.fn((key: string) => key);
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

import { ThemeProvider } from "../../theme/ThemeProvider";
import { PlaceActivityPill } from "../PlaceActivityPill";
import { ListeCard } from "../ListeCard";
import { SEED_PLACES } from "../../data/seed/places";
import type { PlaceWithAdn } from "../../lib/data-source";

interface TestInstanceLike {
  props: Record<string, unknown>;
}
interface TestRendererInstanceLike {
  root: {
    findAllByType: (t: unknown) => TestInstanceLike[];
    findAll: (predicate: (node: TestInstanceLike) => boolean) => TestInstanceLike[];
  };
  toJSON: () => unknown;
  unmount: () => void;
}

function render(node: ReactElement): TestRendererInstanceLike {
  let raw: TestRendererInstanceLike | null = null;
  TestRenderer.act(() => {
    raw = TestRenderer.create(
      <ThemeProvider>{node}</ThemeProvider>,
    ) as unknown as TestRendererInstanceLike;
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

function findByTestID(r: TestRendererInstanceLike, testID: string): TestInstanceLike[] {
  return r.root.findAll((n) => n.props.testID === testID);
}

const seed = SEED_PLACES[0]!;
const PLACE: PlaceWithAdn = {
  ...seed,
  adn: seed.adn,
  rating_display: seed.rating_display,
  total_spawts: seed.total_spawts,
};

describe("PlaceActivityPill — composant pur", () => {
  it("has_promo → pill « Promo » ; has_event → pill « Événement »", () => {
    const r = render(
      <PlaceActivityPill activity={{ has_event: true, has_promo: true }} />,
    );
    const texts = gatherTexts(r);
    expect(texts).toContain("place_activity.pill_promo");
    expect(texts).toContain("place_activity.pill_event");
    // `findAll` peut matcher composite + host pour un même testID — présence
    // vs absence, jamais de compte exact.
    expect(findByTestID(r, "activity-pill-promo").length).toBeGreaterThan(0);
    expect(findByTestID(r, "activity-pill-event").length).toBeGreaterThan(0);
    TestRenderer.act(() => r.unmount());
  });

  it("promo seule → pas de pill événement", () => {
    const r = render(
      <PlaceActivityPill activity={{ has_event: false, has_promo: true }} />,
    );
    expect(findByTestID(r, "activity-pill-promo").length).toBeGreaterThan(0);
    expect(findByTestID(r, "activity-pill-event")).toHaveLength(0);
    TestRenderer.act(() => r.unmount());
  });

  it("aucune activité ou prop absente → ne rend RIEN", () => {
    const rNone = render(
      <PlaceActivityPill activity={{ has_event: false, has_promo: false }} />,
    );
    expect(rNone.toJSON()).toBeNull();
    TestRenderer.act(() => rNone.unmount());

    const rUndef = render(<PlaceActivityPill />);
    expect(rUndef.toJSON()).toBeNull();
    TestRenderer.act(() => rUndef.unmount());
  });
});

describe("ListeCard — intégration pastille (non-régression)", () => {
  it("sans prop activity → carte identique, aucune pastille", () => {
    const r = render(<ListeCard place={PLACE} onPress={() => {}} />);
    expect(findByTestID(r, "place-activity-pill")).toHaveLength(0);
    const texts = gatherTexts(r);
    expect(texts).not.toContain("place_activity.pill_promo");
    expect(texts).not.toContain("place_activity.pill_event");
    TestRenderer.act(() => r.unmount());
  });

  it("avec activity → la pastille apparaît sur la carte", () => {
    const r = render(
      <ListeCard
        place={PLACE}
        onPress={() => {}}
        activity={{ has_event: true, has_promo: false }}
      />,
    );
    expect(findByTestID(r, "place-activity-pill").length).toBeGreaterThan(0);
    expect(gatherTexts(r)).toContain("place_activity.pill_event");
    TestRenderer.act(() => r.unmount());
  });
});
