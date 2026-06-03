// Story 4.9 — AC #2 + AC #7 : composant <PlaceReviews />.
// Couvre les états loading / empty / loaded / seed badge + AbortController-like
// cancellation post-unmount (le flag cancelled bloque setState).

import { type ReactNode } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";
import { ActivityIndicator, Text } from "react-native";

const mockTranslate = jest.fn((key: string, opts?: Record<string, unknown>) => {
  if (opts && typeof opts.count !== "undefined") return `${key}:${String(opts.count)}`;
  return key;
});
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

import { ThemeProvider } from "../../theme/ThemeProvider";
import { PlaceReviews } from "../PlaceReviews";
import type { PlaceReview } from "../../lib/data-source";

interface TestInstanceLike {
  props: Record<string, unknown>;
}
interface TestRendererInstanceLike {
  root: {
    findAllByType: (t: unknown) => TestInstanceLike[];
  };
  unmount: () => void;
}

function gatherTexts(instance: TestRendererInstanceLike): string[] {
  return instance.root
    .findAllByType(Text)
    .flatMap((node) => {
      const children = node.props.children;
      if (typeof children === "string") return [children];
      if (Array.isArray(children)) return children.filter((c): c is string => typeof c === "string");
      return [];
    });
}

async function flush(): Promise<void> {
  await TestRenderer.act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderWith(
  fetcher: (placeId: string, limit: number) => Promise<PlaceReview[]>,
  opts?: { counter?: (placeId: string) => Promise<number>; onSeeAll?: () => void },
): TestRendererInstanceLike {
  // Toujours passer des valeurs définies (exactOptionalPropertyTypes interdit
  // d'assigner `undefined` à une prop optionnelle).
  const counter = opts?.counter ?? (() => Promise.resolve(0));
  const onSeeAll = opts?.onSeeAll ?? (() => {});
  let raw: TestRendererInstanceLike | null = null;
  TestRenderer.act(() => {
    raw = TestRenderer.create(
      <ThemeProvider>
        <PlaceReviews
          placeId="place-1"
          fetcher={fetcher}
          counter={counter}
          onSeeAll={onSeeAll}
        />
      </ThemeProvider>,
    ) as unknown as TestRendererInstanceLike;
  });
  if (!raw) throw new Error("renderer did not initialize");
  return raw;
}

describe("<PlaceReviews /> — Story 4.9", () => {
  beforeEach(() => {
    mockTranslate.mockClear();
  });

  it("affiche loading + ActivityIndicator au mount", () => {
    const fetcher = jest.fn(() => new Promise<PlaceReview[]>(() => {})); // jamais résolu
    const instance = renderWith(fetcher);
    expect(instance.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    const texts = gatherTexts(instance);
    expect(texts).toContain("place.reviews_loading");
  });

  it("affiche reviews_empty quand le fetcher retourne []", async () => {
    const fetcher = jest.fn(() => Promise.resolve<PlaceReview[]>([]));
    const instance = renderWith(fetcher);
    await flush();
    const texts = gatherTexts(instance);
    expect(texts).toContain("place.reviews_empty");
    expect(instance.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  });

  it("rend les reviews loaded avec display_name + texte tronqué", async () => {
    const review: PlaceReview = {
      id: "r1",
      spawter_id: "s1",
      spawter_display_name: "Stéphanie",
      spawter_avatar_url: null,
      note_etoiles: 5,
      texte_avis:
        "Ambiance super accueillante, le plat du jour est toujours bon, bonus pour la déco soignée, le service très pro avec un sourire constant, et un rapport qualité-prix exceptionnel à signaler",
      photos: [],
      created_at: "2025-12-01T10:00:00Z",
      is_seed: false,
    };
    const fetcher = jest.fn(() => Promise.resolve([review]));
    const instance = renderWith(fetcher);
    await flush();
    const texts = gatherTexts(instance);
    expect(texts).toContain("Stéphanie");
    // Texte tronqué à 140 + suffixe ellipsis.
    const truncated = texts.find((tx) => tx.endsWith("…"));
    expect(truncated).toBeDefined();
    expect(truncated!.length).toBeLessThanOrEqual(141);
    // Pas de badge fondateur quand is_seed = false.
    expect(texts).not.toContain("place.founder_review_badge");
  });

  it("affiche le badge `founder_review_badge` si is_seed", async () => {
    const seed: PlaceReview = {
      id: "r2",
      spawter_id: "s2",
      spawter_display_name: "Kidam",
      spawter_avatar_url: null,
      note_etoiles: 4,
      texte_avis: "court",
      photos: [],
      created_at: "2025-11-01T08:00:00Z",
      is_seed: true,
    };
    const fetcher = jest.fn(() => Promise.resolve([seed]));
    const instance = renderWith(fetcher);
    await flush();
    const texts = gatherTexts(instance);
    expect(texts).toContain("place.founder_review_badge");
  });

  it("appelle le fetcher avec placeId et limit défaut 5", async () => {
    const fetcher = jest.fn(() => Promise.resolve<PlaceReview[]>([]));
    renderWith(fetcher);
    await flush();
    expect(fetcher).toHaveBeenCalledWith("place-1", 5);
  });

  function fiveReviews(): PlaceReview[] {
    return Array.from({ length: 5 }, (_, i) => ({
      id: `r${i}`,
      spawter_id: `s${i}`,
      spawter_display_name: `Spawter ${i}`,
      spawter_avatar_url: null,
      note_etoiles: 5,
      texte_avis: null,
      photos: [],
      created_at: "2025-12-01T10:00:00Z",
      is_seed: false,
    }));
  }

  it("rend le CTA `reviews_see_all` avec le VRAI total quand count > affichés", async () => {
    const fetcher = jest.fn(() => Promise.resolve(fiveReviews()));
    const counter = jest.fn(() => Promise.resolve(8));
    const instance = renderWith(fetcher, { counter });
    await flush();
    const texts = gatherTexts(instance);
    // Story 4.12 — le label porte le total (8), pas le nombre affiché (5).
    expect(texts).toContain("place.reviews_see_all:8");
  });

  it("ne rend PAS le CTA quand le total n'excède pas les avis affichés", async () => {
    const fetcher = jest.fn(() => Promise.resolve(fiveReviews()));
    const counter = jest.fn(() => Promise.resolve(5));
    const instance = renderWith(fetcher, { counter });
    await flush();
    const texts = gatherTexts(instance);
    expect(texts).not.toContain("place.reviews_see_all:5");
  });

  it("déclenche onSeeAll au tap du CTA", async () => {
    const fetcher = jest.fn(() => Promise.resolve(fiveReviews()));
    const counter = jest.fn(() => Promise.resolve(8));
    const onSeeAll = jest.fn();
    const instance = renderWith(fetcher, { counter, onSeeAll });
    await flush();
    const pressable = (instance.root as unknown as {
      findAll: (p: (n: TestInstanceLike) => boolean) => TestInstanceLike[];
    }).findAll(
      (n) =>
        typeof n.props.onPress === "function" &&
        n.props.accessibilityLabel === "place.reviews_see_all:8",
    );
    expect(pressable).toHaveLength(1);
    TestRenderer.act(() => {
      (pressable[0]!.props.onPress as () => void)();
    });
    expect(onSeeAll).toHaveBeenCalledTimes(1);
  });

  it("ne setState pas après unmount (race protection)", async () => {
    let resolve!: (v: PlaceReview[]) => void;
    const fetcher = jest.fn(
      () =>
        new Promise<PlaceReview[]>((r) => {
          resolve = r;
        }),
    );
    const instance = renderWith(fetcher);
    TestRenderer.act(() => {
      instance.unmount();
    });
    // Résolution post-unmount — ne doit pas crasher.
    await TestRenderer.act(async () => {
      resolve([]);
      await Promise.resolve();
    });
    // Pas d'assertion d'erreur — si setState après unmount, React warn.
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("affiche reviews_empty si le fetcher rejette (état error tombe sur empty UX)", async () => {
    const fetcher = jest.fn(() => Promise.reject(new Error("boom")));
    const instance = renderWith(fetcher);
    await flush();
    const texts = gatherTexts(instance);
    expect(texts).toContain("place.reviews_empty");
  });
});
