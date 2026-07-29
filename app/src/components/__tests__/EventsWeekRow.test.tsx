// Rangée feed « Ça bouge cette semaine » (0049) — flag `evenements-promos`.
// Couvre : flag OFF → null ET aucun fetch (non-régression), flag ON → titre +
// cartes des événements sous 7 jours (les lointains sont filtrés), vide → null.

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
jest.mock("../../store/feature-flags", () => ({
  useFlag: (code: string) => mockFlags[code] ?? false,
}));

import { ThemeProvider } from "../../theme/ThemeProvider";
import { EventsWeekRow } from "../EventsWeekRow";
import type { UpcomingEvent } from "../../lib/place-activity";

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

const DAY_MS = 24 * 60 * 60 * 1000;

function upcoming(id: string, title: string, daysAhead: number): UpcomingEvent {
  return {
    id,
    place_id: `place-${id}`,
    title,
    description: null,
    starts_at: new Date(Date.now() + daysAhead * DAY_MS).toISOString(),
    ends_at: null,
    image_url: null,
    place_name: "Bushman Café",
    place_neighborhood: "Cocody Riviera",
  };
}

async function renderRow(opts: {
  events: UpcomingEvent[];
  onPlacePress?: jest.Mock;
}): Promise<{ r: TestRendererInstanceLike; fetcher: jest.Mock }> {
  const fetcher = jest.fn(() => Promise.resolve(opts.events));
  const onPlacePress = opts.onPlacePress ?? jest.fn();
  let raw: TestRendererInstanceLike | null = null;
  await TestRenderer.act(async () => {
    raw = TestRenderer.create(
      <ThemeProvider>
        <EventsWeekRow onPlacePress={onPlacePress} fetcher={fetcher} />
      </ThemeProvider>,
    ) as unknown as TestRendererInstanceLike;
    await Promise.resolve();
    await Promise.resolve();
  });
  if (!raw) throw new Error("renderer did not initialize");
  return { r: raw, fetcher };
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

beforeEach(() => {
  jest.clearAllMocks();
  mockFlags = { "evenements-promos": true };
});

describe("EventsWeekRow — flag ON", () => {
  it("rend le titre et une carte par événement sous 7 jours", async () => {
    const { r } = await renderRow({
      events: [upcoming("1", "Soirée braise & vinyles", 3)],
    });
    const texts = gatherTexts(r);
    expect(texts).toContain("place_activity.week_title");
    expect(texts).toContain("Soirée braise & vinyles");
    // `findAll` peut matcher composite + host pour un même testID — on
    // vérifie la présence, le compte exact vient des titres ci-dessus.
    expect(
      r.root.findAll((n) => n.props.testID === "events-week-card").length,
    ).toBeGreaterThan(0);
    TestRenderer.act(() => r.unmount());
  });

  it("filtre les événements au-delà de 7 jours", async () => {
    const { r } = await renderRow({
      events: [
        upcoming("1", "Cette semaine", 2),
        upcoming("2", "Dans un mois", 30),
      ],
    });
    const texts = gatherTexts(r);
    expect(texts).toContain("Cette semaine");
    expect(texts).not.toContain("Dans un mois");
    TestRenderer.act(() => r.unmount());
  });

  it("tap sur une carte → remonte le place_id au parent", async () => {
    const onPlacePress = jest.fn();
    const { r } = await renderRow({
      events: [upcoming("1", "Soirée braise", 3)],
      onPlacePress,
    });
    const card = r.root.findAll((n) => n.props.testID === "events-week-card")[0]!;
    TestRenderer.act(() => {
      (card.props.onPress as () => void)();
    });
    expect(onPlacePress).toHaveBeenCalledWith("place-1");
    TestRenderer.act(() => r.unmount());
  });

  it("aucun événement cette semaine → ne rend rien", async () => {
    const { r } = await renderRow({ events: [upcoming("1", "Trop loin", 20)] });
    expect(r.toJSON()).toBeNull();
    TestRenderer.act(() => r.unmount());
  });
});

describe("EventsWeekRow — flag OFF (non-régression)", () => {
  beforeEach(() => {
    mockFlags = {};
  });

  it("ne rend rien ET ne fetch rien", async () => {
    const { r, fetcher } = await renderRow({
      events: [upcoming("1", "Soirée braise", 3)],
    });
    expect(r.toJSON()).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
    TestRenderer.act(() => r.unmount());
  });
});
