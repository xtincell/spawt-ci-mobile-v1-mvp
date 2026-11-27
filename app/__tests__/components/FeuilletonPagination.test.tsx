import TestRenderer, { act } from "react-test-renderer";
import { FeuilletonRow } from "../../src/components/FeuilletonRow";
import { ListeCard } from "../../src/components/ListeCard";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
import type { PlaceWithScore } from "../../src/lib/matching";
import { SEED_PLACES } from "../../src/data/seed/places";

jest.mock("../../src/components/ListeCard", () => ({ ListeCard: () => null }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it("exposes the entire ranking in order and keeps the selected venue tappable", () => {
  const seed = SEED_PLACES[0]!;
  const places: PlaceWithScore[] = Array.from({ length: 25 }, (_, i) => ({
    place: { ...seed, id: String(i) }, adn: seed.adn,
    raw_score: 0.5, match_score: 75, distance_km: i,
  }));
  const open = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <ThemeProvider><FeuilletonRow places={places} onPlacePress={open} /></ThemeProvider>
    );
  });
  const cards = () => tree.root.findAllByType(ListeCard);
  const more = () => tree.root.findAll(n => n.props.accessibilityRole === "button" && typeof n.props.onPress === "function");
  expect(cards()).toHaveLength(12);
  act(() => more()[0]!.props.onPress());
  expect(cards()).toHaveLength(24);
  act(() => more()[0]!.props.onPress());
  expect(cards().map(card => card.props.place.id)).toEqual(places.map(p => p.place.id));
  expect(more()).toHaveLength(0);
  act(() => cards()[24]!.props.onPress());
  expect(open).toHaveBeenCalledWith(places[24]);
  act(() => tree.unmount());
});
