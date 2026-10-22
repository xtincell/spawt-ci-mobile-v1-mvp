import TestRenderer, { act } from "react-test-renderer";
import { Image } from "react-native";
import { PlaceCover } from "../../src/components/PlaceCover";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
it("uses an explicit illustration if absent or failed, then accepts a new official cover", () => {
  let tree!: TestRenderer.ReactTestRenderer;
  const render = (uri?: string) => (
    <ThemeProvider>
      <PlaceCover uri={uri} />
    </ThemeProvider>
  );
  act(() => {
    tree = TestRenderer.create(render());
  });
  expect(JSON.stringify(tree.toJSON())).toContain("place.photo_illustration");
  act(() => tree.update(render("https://example.test/official.jpg")));
  expect(tree.root.findByType(Image).props.source).toEqual({
    uri: "https://example.test/official.jpg",
  });
  act(() => tree.root.findByType(Image).props.onError());
  expect(JSON.stringify(tree.toJSON())).toContain("place.photo_illustration");
  act(() => tree.update(render("https://example.test/new.jpg")));
  expect(tree.root.findByType(Image).props.source).toEqual({
    uri: "https://example.test/new.jpg",
  });
  expect(JSON.stringify(tree.toJSON())).not.toContain(
    "place.photo_illustration"
  );
  act(() => tree.unmount());
});
