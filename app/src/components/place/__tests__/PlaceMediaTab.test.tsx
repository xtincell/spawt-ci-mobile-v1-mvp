// Refonte fiche lieu (R17 / Q1) — <PlaceMediaTab />.
// Couvre : état vide global (0 photo partout), cap à 3 photos de
// présentation, galerie des spawters (fetcher injecté), état vide de la
// galerie spawters seule, résilience au rejet du fetcher.

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";
import { ActivityIndicator, Image, Text } from "react-native";

const mockTranslate = jest.fn((key: string) => key);
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

import { ThemeProvider } from "../../../theme/ThemeProvider";
import { PlaceMediaTab } from "../PlaceMediaTab";

interface NodeLike {
  props: Record<string, unknown>;
}
interface RendererLike {
  root: { findAllByType: (t: unknown) => NodeLike[] };
  unmount: () => void;
}

async function flush(): Promise<void> {
  await TestRenderer.act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function render(
  galleryUrls: string[],
  fetcher: (placeId: string) => Promise<string[]>,
): RendererLike {
  let r: RendererLike | null = null;
  TestRenderer.act(() => {
    r = TestRenderer.create(
      <ThemeProvider>
        <PlaceMediaTab
          placeId="place-1"
          galleryUrls={galleryUrls}
          fetcher={fetcher}
        />
      </ThemeProvider>,
    ) as unknown as RendererLike;
  });
  if (!r) throw new Error("renderer did not init");
  return r;
}

function texts(r: RendererLike): string[] {
  return r.root
    .findAllByType(Text)
    .flatMap((n) => {
      const children = n.props.children;
      if (typeof children === "string") return [children];
      if (Array.isArray(children)) {
        return children.filter((c): c is string => typeof c === "string");
      }
      return [];
    });
}

describe("<PlaceMediaTab /> — R17 / Q1 onglet Média", () => {
  beforeEach(() => mockTranslate.mockClear());

  it("aucune photo (présentation + spawters) → état vide global", async () => {
    const fetcher = jest.fn(() => Promise.resolve<string[]>([]));
    const r = render([], fetcher);
    await flush();
    expect(texts(r)).toContain("place.media_empty_title");
    expect(texts(r)).toContain("place.media_empty_body");
    expect(r.root.findAllByType(Image)).toHaveLength(0);
  });

  it("cap les photos de présentation à 3 (Q1 — jusqu'à 3 depuis gallery_urls)", async () => {
    const fetcher = jest.fn(() => Promise.resolve<string[]>([]));
    const r = render(
      [
        "https://x/1.jpg",
        "https://x/2.jpg",
        "https://x/3.jpg",
        "https://x/4.jpg",
        "https://x/5.jpg",
      ],
      fetcher,
    );
    await flush();
    // 3 images max côté présentation, pas d'état vide global.
    expect(r.root.findAllByType(Image)).toHaveLength(3);
    expect(texts(r)).not.toContain("place.media_empty_title");
    // Galerie spawters vide → titre + copy d'invitation.
    expect(texts(r)).toContain("place.media_spawters_title");
    expect(texts(r)).toContain("place.media_spawters_empty");
  });

  it("photos spawters présentes → galerie des spawters rendue (sans placeholders)", async () => {
    const fetcher = jest.fn(() =>
      Promise.resolve(["https://x/spawt-1.jpg", "https://x/spawt-2.jpg"]),
    );
    const r = render([], fetcher);
    await flush();
    expect(fetcher).toHaveBeenCalledWith("place-1");
    expect(texts(r)).toContain("place.media_spawters_title");
    expect(texts(r)).not.toContain("place.media_spawters_empty");
    expect(r.root.findAllByType(Image)).toHaveLength(2);
    expect(texts(r)).not.toContain("place.media_empty_title");
  });

  it("pendant le fetch → spinner, pas d'état vide prématuré", () => {
    const fetcher = jest.fn(() => new Promise<string[]>(() => {})); // jamais résolu
    const r = render([], fetcher);
    expect(r.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(texts(r)).not.toContain("place.media_empty_title");
  });

  it("fetcher rejeté → même UX que 0 photo spawter (pas de crash)", async () => {
    const fetcher = jest.fn(() => Promise.reject(new Error("boom")));
    const r = render(["https://x/1.jpg"], fetcher);
    await flush();
    expect(r.root.findAllByType(Image)).toHaveLength(1);
    expect(texts(r)).toContain("place.media_spawters_empty");
  });
});
