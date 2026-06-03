// Story 4.12 — AC #3 + AC #5 : <PlaceGallery /> rend toujours ≥ 3 slots
// (placeholders si gallery_urls insuffisant) et la cover reste distincte.

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";
import { Image, View } from "react-native";

const mockTranslate = jest.fn((key: string) => key);
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

import { ThemeProvider } from "../../theme/ThemeProvider";
import { PlaceGallery } from "../PlaceGallery";

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
        <PlaceGallery urls={urls} />
      </ThemeProvider>,
    ) as unknown as RendererLike;
  });
  if (!r) throw new Error("renderer did not init");
  return r;
}

function placeholders(r: RendererLike): number {
  return r.root
    .findAllByType(View)
    .filter((n) => n.props.testID === "gallery-placeholder").length;
}

function images(r: RendererLike): number {
  return r.root.findAllByType(Image).length;
}

describe("<PlaceGallery /> — Story 4.12 AC #3", () => {
  beforeEach(() => mockTranslate.mockClear());

  it("0 photo → 3 placeholders, 0 image", () => {
    const r = render([]);
    expect(placeholders(r)).toBe(3);
    expect(images(r)).toBe(0);
  });

  it("1 photo → 1 image + 2 placeholders (toujours ≥3 slots)", () => {
    const r = render(["https://x/1.jpg"]);
    expect(images(r)).toBe(1);
    expect(placeholders(r)).toBe(2);
  });

  it("3 photos → 3 images, 0 placeholder", () => {
    const r = render(["https://x/1.jpg", "https://x/2.jpg", "https://x/3.jpg"]);
    expect(images(r)).toBe(3);
    expect(placeholders(r)).toBe(0);
  });

  it("5 photos → 5 images, 0 placeholder", () => {
    const r = render([
      "https://x/1.jpg",
      "https://x/2.jpg",
      "https://x/3.jpg",
      "https://x/4.jpg",
      "https://x/5.jpg",
    ]);
    expect(images(r)).toBe(5);
    expect(placeholders(r)).toBe(0);
  });

  it("ignore les URLs vides (filtrées) puis complète en placeholders", () => {
    const r = render(["https://x/1.jpg", ""]);
    expect(images(r)).toBe(1);
    expect(placeholders(r)).toBe(2);
  });
});
