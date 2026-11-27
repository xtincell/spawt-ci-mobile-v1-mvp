import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { listMenuItems, type MenuItem } from "../outings";
import { listPlaces, type PlaceWithAdn } from "../data-source";
import { readMenuInventory } from "../menu-inventory";
import { getPlaceBudgetTier } from "../format-price";
import { inMenuId, leChaMenuId } from "../place-menu-catalog";
import { invalidatePublishedContent } from "../content-sync";
import { usePlaces } from "../use-places";
import { useMenuItems } from "../use-menu-items";
import { EMPTY_FILTERS, searchPlaces } from "../search";

jest.mock("../outings", () => ({ listMenuItems: jest.fn() }));
jest.mock("../data-source", () => ({ listPlaces: jest.fn() }));

const menus = jest.mocked(listMenuItems);
const inventory = jest.mocked(listPlaces);

it("shows places and documented menus immediately, then shares and refreshes published prices for both lists and filters", async () => {
  const places = [leChaMenuId, inMenuId, "new", "bar"].map(id => ({
    id, name: id, price: { tier: null }, location: { lat: 5, lng: -4, neighborhood: "", city: "Abidjan" },
    cuisine: [], signals: [], adn: { weighted_rating: 0 }, is_published: true,
  } as unknown as PlaceWithAdn));
  inventory.mockResolvedValue(places);
  let finish!: (rows: MenuItem[]) => void;
  menus.mockImplementationOnce(() => new Promise<MenuItem[]>(resolve => { finish = resolve; }));
  const row = (id: string, price: number, section: string, place_id = "new"): MenuItem => ({
    id, name: id, place_id, place_name: place_id, menu_section: section, price_xof: price,
    is_published: true, photo_url: null, observed_on: "2026-11-27",
  });
  let state!: ReturnType<typeof usePlaces>;
  function Screen() { state = usePlaces(); useMenuItems(); return null; }
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(<Screen />); });
  expect(state.loading).toBe(false);
  expect(state.places).toHaveLength(4);
  expect(state.places[0]!.price.menu_estimate_xof).toBeGreaterThan(0);
  expect(state.places[1]!.price.menu_estimate_xof).toBeGreaterThan(0);
  expect(state.places[2]!.price.menu_estimate_xof).toBeUndefined();
  expect(menus).toHaveBeenCalledTimes(1);
  await act(async () => { finish([row("repas", 12000, "Menu complet"), row("eau", 500, "Boissons", "bar")]); });
  expect(getPlaceBudgetTier(state.places[2]!.price)).toBe(2);
  expect(getPlaceBudgetTier(state.places[3]!.price)).toBeNull();
  expect(searchPlaces(state.places, "", { ...EMPTY_FILTERS, budgetTiers: [2] },
    {spawter_lat: null, spawter_lng: null}).map(p => p.id)).toContain("new");
  expect(places[2]!.price.menu_estimate_xof).toBeUndefined();
  menus.mockResolvedValueOnce([]);
  await act(async () => { invalidatePublishedContent(); });
  expect(menus).toHaveBeenCalledTimes(2);
  expect(getPlaceBudgetTier(state.places[2]!.price)).toBeNull();
  act(() => tree.unmount());
});

it("retries a failed menu read while joining callers for the same revision", async () => {
  menus.mockRejectedValueOnce(new Error("hors ligne")).mockResolvedValueOnce([]);
  const first = readMenuInventory(999);
  expect(readMenuInventory(999)).toBe(first);
  await expect(first).rejects.toThrow("hors ligne");
  await expect(readMenuInventory(999)).resolves.toEqual([]);
});

