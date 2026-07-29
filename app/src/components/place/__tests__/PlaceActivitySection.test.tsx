// Section « En ce moment » (0049/0050) — fiche lieu.
// Couvre : rendu avec données (étiquette PROMO présente, titre d'événement),
// rendu SANS données → null (aucun espace réservé), flag OFF → null ET aucun
// fetch (non-régression), impressions analytics de SECTION (1× par mount).

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only.
import TestRenderer from "react-test-renderer";
import { Text } from "react-native";

const mockTranslate = jest.fn((key: string) => key);
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

// Flags contrôlés par test (doctrine MeuteCrewFlag.test).
let mockFlags: Record<string, boolean> = {};
jest.mock("../../../store/feature-flags", () => ({
  useFlag: (code: string) => mockFlags[code] ?? false,
}));

const mockTrack = jest.fn();
jest.mock("../../../lib/analytics", () => ({
  track: (event: unknown) => mockTrack(event),
}));

import { ThemeProvider } from "../../../theme/ThemeProvider";
import { PlaceActivitySection } from "../PlaceActivitySection";
import type { PlaceEvent, PlacePromotion } from "../../../lib/place-activity";

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

const PROMO: PlacePromotion = {
  id: "promo-1",
  place_id: "place-1",
  label: "Deux jus pour le prix d'un",
  description: "En semaine seulement.",
  starts_at: "2026-07-20",
  ends_at: "2026-07-30",
};

const EVENT: PlaceEvent = {
  id: "event-1",
  place_id: "place-1",
  title: "Soirée braise & vinyles",
  description: "Le grill dehors, les 33 tours dedans.",
  starts_at: "2026-07-29T19:30:00Z",
  ends_at: null,
  image_url: null,
};

async function renderSection(opts: {
  events: PlaceEvent[];
  promos: PlacePromotion[];
  eventsFetcher?: jest.Mock;
  promosFetcher?: jest.Mock;
}): Promise<{
  r: TestRendererInstanceLike;
  eventsFetcher: jest.Mock;
  promosFetcher: jest.Mock;
}> {
  const eventsFetcher =
    opts.eventsFetcher ?? jest.fn(() => Promise.resolve(opts.events));
  const promosFetcher =
    opts.promosFetcher ?? jest.fn(() => Promise.resolve(opts.promos));
  let raw: TestRendererInstanceLike | null = null;
  await TestRenderer.act(async () => {
    raw = TestRenderer.create(
      <ThemeProvider>
        <PlaceActivitySection
          placeId="place-1"
          eventsFetcher={eventsFetcher}
          promosFetcher={promosFetcher}
        />
      </ThemeProvider>,
    ) as unknown as TestRendererInstanceLike;
    await Promise.resolve();
    await Promise.resolve();
  });
  if (!raw) throw new Error("renderer did not initialize");
  return { r: raw, eventsFetcher, promosFetcher };
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

beforeEach(() => {
  jest.clearAllMocks();
  mockFlags = { "evenements-promos": true };
});

describe("PlaceActivitySection — flag ON, avec données", () => {
  it("rend le titre de section, le bandeau promo ÉTIQUETÉ et la carte événement", async () => {
    const { r } = await renderSection({ events: [EVENT], promos: [PROMO] });
    const texts = gatherTexts(r);

    expect(texts).toContain("place_activity.section_title");
    // L'étiquette « PROMO » est bien présente (Contrat SPAWT : affichage étiqueté).
    expect(texts).toContain("place_activity.promo_tag");
    expect(texts).toContain("Deux jus pour le prix d'un");
    expect(texts).toContain("Soirée braise & vinyles");
    // La fenêtre de dates de la promo est affichée.
    expect(texts).toContain("place_activity.promo_dates_range");

    // `findAll` peut matcher composite + host pour un même testID — présence
    // suffit, l'unicité est portée par les textes ci-dessus.
    expect(findByTestID(r, "place-promo-banner").length).toBeGreaterThan(0);
    expect(findByTestID(r, "place-event-card").length).toBeGreaterThan(0);
    TestRenderer.act(() => r.unmount());
  });

  it("émet les impressions de SECTION une seule fois (pas par item)", async () => {
    const { r } = await renderSection({
      events: [EVENT, { ...EVENT, id: "event-2", title: "Autre soirée" }],
      promos: [PROMO],
    });

    const names = mockTrack.mock.calls.map(
      (c) => (c[0] as { name: string }).name,
    );
    expect(names.filter((n) => n === "place_event_viewed")).toHaveLength(1);
    expect(names.filter((n) => n === "place_promo_viewed")).toHaveLength(1);

    // Le payload porte le compteur de section, pas un id d'item.
    const eventCall = mockTrack.mock.calls.find(
      (c) => (c[0] as { name: string }).name === "place_event_viewed",
    )![0] as { properties: Record<string, unknown> };
    expect(eventCall.properties).toEqual({ place_id: "place-1", events_count: 2 });
    TestRenderer.act(() => r.unmount());
  });
});

describe("PlaceActivitySection — flag ON, sans données", () => {
  it("ne rend RIEN (aucun espace réservé, pas de titre orphelin)", async () => {
    const { r } = await renderSection({ events: [], promos: [] });
    expect(gatherTexts(r)).toEqual([]);
    expect(findByTestID(r, "place-activity-section")).toHaveLength(0);
    // Aucune impression analytics sur section vide.
    expect(mockTrack).not.toHaveBeenCalled();
    TestRenderer.act(() => r.unmount());
  });
});

describe("PlaceActivitySection — flag OFF (non-régression)", () => {
  beforeEach(() => {
    mockFlags = {};
  });

  it("ne rend rien ET ne fetch rien, même avec des données disponibles", async () => {
    const { r, eventsFetcher, promosFetcher } = await renderSection({
      events: [EVENT],
      promos: [PROMO],
    });
    expect(gatherTexts(r)).toEqual([]);
    expect(eventsFetcher).not.toHaveBeenCalled();
    expect(promosFetcher).not.toHaveBeenCalled();
    expect(mockTrack).not.toHaveBeenCalled();
    TestRenderer.act(() => r.unmount());
  });
});
