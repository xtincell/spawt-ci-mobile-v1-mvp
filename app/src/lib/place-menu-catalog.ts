import catalog from "../data/le-cha-menu.json";
import type { MenuItem } from "./outings";

export interface CatalogDish {
  key: string;
  name: string;
  price: number | null;
  photoUrl: string | null;
  description: string;
  choices: string[];
  variants: { label: string; price_xof: number }[];
  family: string;
  section: string;
  source: string;
  observed: string;
  published?: MenuItem;
}

export const leChaMenuId = catalog.place_id;
export const previewPhotoCredit = catalog.preview_photo_credit;
const localDishes: CatalogDish[] = catalog.sections.flatMap(group => group.items.map(item => ({
  key: item.id, name: item.name, price: item.price_xof,
  // These five photographs are cleared for the local design preview only.
  photoUrl: __DEV__ && "preview_photo_url" in item ? item.preview_photo_url ?? null : null,
  description: item.description ?? "", choices: "choices" in item ? item.choices ?? [] : [],
  variants: [], family: group.menu_label, section: group.menu_section,
  source: catalog.source_label, observed: catalog.observed_on,
})));
const normalize = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const localByName = new Map(localDishes.map(dish => [normalize(dish.name), dish]));

export function placeDishes(placeId: string, rows: readonly MenuItem[]): CatalogDish[] {
  const leCha = placeId === leChaMenuId;
  if (!rows.length) return leCha ? localDishes : [];
  return [...rows].sort((a, b) => (a.menu_position ?? Infinity) - (b.menu_position ?? Infinity)
    || a.name.localeCompare(b.name, "fr")).map(row => {
    const local = leCha ? localByName.get(normalize(row.name)) : undefined;
    return {
      key: row.id, name: row.name, price: row.price_xof, photoUrl: row.photo_url || local?.photoUrl || null,
      description: row.description?.trim() || local?.description || "",
      choices: row.accompaniments?.length ? row.accompaniments : local?.choices ?? [],
      variants: row.price_options ?? [],
      family: row.menu_label?.trim() || local?.family || "", section: row.menu_section?.trim() || local?.section || "",
      source: row.source_label?.trim() || local?.source || "", observed: row.observed_on || "",
      published: row,
    };
  });
}

export function menuPreviews(dishes: readonly CatalogDish[], placeId: string): CatalogDish[] {
  const preferred = placeId === leChaMenuId
    ? ["Tteokbokki", "Okonomiyaki Corn Dog", "Bubble Milk Tea"]
      .flatMap(name => dishes.find(d => normalize(d.name) === normalize(name)) ?? [])
    : [];
  return [...new Set([...preferred, ...dishes.filter(dish => dish.photoUrl), ...dishes])].slice(0, 3);
}
