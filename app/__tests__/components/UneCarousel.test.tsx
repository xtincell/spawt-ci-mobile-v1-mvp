// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";
import { FlatList, type ViewToken } from "react-native";
import { UneCarousel } from "../../src/components/UneCarousel";
import { SEED_PLACES } from "../../src/data/seed/places";
import type { PlaceWithScore } from "../../src/lib/matching";

jest.mock("../../src/components/UneCard", () => ({ UneCard: () => null }));

const unes: PlaceWithScore[] = SEED_PLACES.slice(0, 2).map((place) => ({
  place, adn: place.adn, raw_score: 0.8, match_score: 90, distance_km: 1,
}));
type VisibilityHandler = (info: { viewableItems: ViewToken[] }) => void;
type ImpressionHandler = (place: PlaceWithScore, index: number) => void;
interface Renderer {
  root: { findByType: (type: unknown) => { props: { onViewableItemsChanged: VisibilityHandler } } };
  update: (node: React.ReactNode) => void;
  unmount: () => void;
}
let renderer: Renderer | null;
const onPress = jest.fn();
function render(onImpression?: ImpressionHandler) {
  TestRenderer.act(() => {
    renderer = TestRenderer.create(<UneCarousel unes={unes} onUnePress={onPress} {...(onImpression ? { onImpression } : {})} />) as unknown as Renderer;
  });
  return renderer!.root.findByType(FlatList).props.onViewableItemsChanged;
}
function visible(callback: VisibilityHandler, index: number) {
  const item = unes[index]!;
  TestRenderer.act(() => {
    callback({ viewableItems: [{ item, index, key: item.place.id, isViewable: true }] });
  });
}
afterEach(() => {
  TestRenderer.act(() => renderer?.unmount());
  renderer = null;
});

it("garde le contrat FlatList au rerender du feed et livre l'impression au handler actuel", () => {
  const first = jest.fn();
  const current = jest.fn();
  const mountedCallback = render(first);
  visible(mountedCallback, 0);
  TestRenderer.act(() => {
    renderer!.update(<UneCarousel unes={unes} onUnePress={onPress} onImpression={current} showMatchScore={false} />);
  });
  // L'implémentation web rejette tout remplacement après montage.
  expect(renderer!.root.findByType(FlatList).props.onViewableItemsChanged).toBe(mountedCallback);
  // FlatList conserve son abonnement initial ; il doit lire le contexte frais.
  visible(mountedCallback, 1);
  visible(mountedCallback, 1);
  expect(first).toHaveBeenCalledTimes(1);
  expect(current).toHaveBeenCalledTimes(1);
  expect(current).toHaveBeenCalledWith(unes[1], 1);
});

it("active puis désactive le suivi sans changer l'abonnement de visibilité", () => {
  const callback = render();
  const report = jest.fn();
  TestRenderer.act(() => {
    renderer!.update(<UneCarousel unes={unes} onUnePress={onPress} onImpression={report} />);
  });
  visible(callback, 0);
  expect(report).toHaveBeenCalledTimes(1);
  TestRenderer.act(() => {
    renderer!.update(<UneCarousel unes={unes} onUnePress={onPress} />);
  });
  visible(callback, 1);
  expect(report).toHaveBeenCalledTimes(1);
  expect(renderer!.root.findByType(FlatList).props.onViewableItemsChanged).toBe(callback);
});

it("autorise une nouvelle impression après rafraîchissement du contenu", () => {
  const report = jest.fn();
  const callback = render(report);
  visible(callback, 0);
  visible(callback, 0);
  expect(report).toHaveBeenCalledTimes(1);
  TestRenderer.act(() => {
    renderer!.update(<UneCarousel unes={[...unes]} onUnePress={onPress} onImpression={report} />);
  });
  visible(callback, 0);
  expect(report).toHaveBeenCalledTimes(2);
});
