import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { ThemeProvider } from "../../../theme/ThemeProvider";
import { leChaMenuId, menuPreviews, placeDishes } from "../../../lib/place-menu-catalog";
import type { MenuItem } from "../../../lib/outings";
import { PlaceMenuCatalog } from "../PlaceMenuCatalog";
import { OutingActions } from "../../OutingActions";

const mockRows: MenuItem[] = [];
jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({}), useRouter: () => ({}) }));
jest.mock("../../../lib/use-menu-items", () => ({ useMenuItems: () => ({ items: mockRows, failed: false, loading: false }) }));
jest.mock("../../OutingActions", () => ({ OutingActions: () => null }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string, values?: Record<string, string>) =>
  values ? Object.values(values).join(" ") : key }) }));

const live: MenuItem = { id: "published", place_id: leChaMenuId, name: "Tteokbokki", place_name: "Le Cha",
  price_xof: 5900, observed_on: "2026-11-27", photo_url: "https://site.test/plat.jpg", is_published: true,
  description: "La recette du jour.", menu_section: "Plats", source_label: "Carte de la maison" };
let tree: TestRenderer.ReactTestRenderer;
afterEach(() => { mockRows.length = 0; if (tree) act(() => tree.unmount()); });

it("formats the 71 recorded dishes, their families and choices, leaving local references read only", () => {
  const dishes = placeDishes(leChaMenuId, []);
  expect(dishes).toHaveLength(71);
  expect(new Set(dishes.map(d => d.family)).size).toBeGreaterThan(1);
  expect(dishes.some(d => d.choices.length)).toBe(true);
  expect(dishes.every(d => !d.published && d.observed === "2026-11-26")).toBe(true);
  expect(menuPreviews(dishes, leChaMenuId).map(d => d.name)).toEqual(["Tteokbokki", "Okonomiyaki Corn Dog", "Bubble Milk Tea"]);
  expect(placeDishes("another-place", [])).toHaveLength(0);
});

it("selects the published price, opens dish actions with the real ID, and keeps dates in menu information", async () => {
  mockRows.push(live);
  const onOpenMenu = jest.fn();
  await act(async () => { tree = TestRenderer.create(<ThemeProvider><PlaceMenuCatalog placeId={leChaMenuId} onOpenMenu={onOpenMenu} /></ThemeProvider>); });
  const button = (id: string) => tree.root.findAll(node => node.props.testID === id && typeof node.props.onPress === "function")[0]!;
  const copy = () => tree.root.findAllByType(Text).flatMap(node => typeof node.props.children === "string" ? [node.props.children] : []);
  const preview = copy();
  const title = preview.indexOf(live.name);
  const price = preview.indexOf((5900).toLocaleString("fr-FR"));
  expect(price).toBeGreaterThan(title);
  expect(preview.indexOf(live.description!)).toBeGreaterThan(price);
  expect(preview.join(" ")).not.toContain("27/11/2026");
  act(() => button("menu-information").props.onPress());
  expect(copy().join(" ")).toContain("27/11/2026");
  act(() => tree.root.findAll(node => typeof node.props.onPress === "function" && node.findAllByType(Text).some(text => text.props.children === "common.close"))[0]!.props.onPress());
  act(() => button("open-full-menu").props.onPress());
  expect(onOpenMenu).toHaveBeenCalledTimes(1);
  act(() => button("menu-dish-published").props.onPress());
  expect(tree.root.findByType(OutingActions).props.dish).toEqual(live);
});
