// Refonte fiche lieu (R17 + R19) — <PlaceMenuTab />.
// Couvre : état vide « Le menu arrive bientôt » quand menu_urls est vide,
// grille d'images sinon, filtrage des URLs vides.

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";
import { Image, Text } from "react-native";

const mockTranslate = jest.fn((key: string) => key);
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

import { ThemeProvider } from "../../../theme/ThemeProvider";
import { PlaceMenuTab } from "../PlaceMenuTab";

interface NodeLike {
  props: Record<string, unknown>;
}
interface RendererLike {
  root: { findAllByType: (t: unknown) => NodeLike[] };
}

function render(urls: string[]): RendererLike {
  let r: RendererLike | null = null;
  TestRenderer.act(() => {
    r = TestRenderer.create(
      <ThemeProvider>
        <PlaceMenuTab urls={urls} />
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

describe("<PlaceMenuTab /> — R17 onglet Menu", () => {
  beforeEach(() => mockTranslate.mockClear());

  it("0 URL → état vide « Le menu arrive bientôt », aucune image", () => {
    const r = render([]);
    expect(texts(r)).toContain("place.menu_empty_title");
    expect(texts(r)).toContain("place.menu_empty_body");
    expect(r.root.findAllByType(Image)).toHaveLength(0);
  });

  it("2 URLs → 2 images en grille, pas d'état vide", () => {
    const r = render(["https://x/menu-1.jpg", "https://x/menu-2.jpg"]);
    expect(r.root.findAllByType(Image)).toHaveLength(2);
    expect(texts(r)).not.toContain("place.menu_empty_title");
  });

  it("filtre les URLs vides avant rendu", () => {
    const r = render(["", "https://x/menu-1.jpg"]);
    expect(r.root.findAllByType(Image)).toHaveLength(1);
    expect(texts(r)).not.toContain("place.menu_empty_title");
  });

  it("uniquement des URLs vides → état vide", () => {
    const r = render(["", ""]);
    expect(texts(r)).toContain("place.menu_empty_title");
    expect(r.root.findAllByType(Image)).toHaveLength(0);
  });
});
