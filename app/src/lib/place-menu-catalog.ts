import catalog from "../data/le-cha-menu.json";
import inCatalog from "../data/in-menu.json";
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
  /** Only a row read from public_menu_items can receive a persistent action. */
  published?: MenuItem;
}

export const leChaMenuId = catalog.place_id;
export const inMenuId = inCatalog.place_id;
export const previewPhotoCredit = catalog.preview_photo_credit;
export const localMenuPhotography = __DEV__ || process.env.EXPO_PUBLIC_DEMO_MODE === "true";
const leChaDishes: CatalogDish[] = catalog.sections.flatMap(group => group.items.map(item => ({
  key: item.id, name: item.name, price: item.price_xof,
  photoUrl: localMenuPhotography && "preview_photo_url" in item ? item.preview_photo_url ?? null : null,
  description: item.description ?? "", choices: "choices" in item ? item.choices ?? [] : [],
  variants: [], family: group.menu_label, section: group.menu_section,
  source: catalog.source_label, observed: catalog.observed_on,
})));
const inDishes: CatalogDish[] = inCatalog.sections.flatMap(group => group.items.map(item => ({
  key: item.id, name: item.name, price: item.price, photoUrl: null, description: item.description,
  choices: "choices" in item && Array.isArray(item.choices) ? item.choices : [],
  variants: [], family: group.family, section: group.section, source: inCatalog.source_label, observed: item.observed,
})));

export const normalizedMenuText = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/œ/g, "oe").replace(/Œ/g, "oe").toLowerCase().trim();

function publishedDish(row: MenuItem, local?: CatalogDish): CatalogDish {
  return {
    key: row.id, name: row.name, price: row.price_xof, photoUrl: row.photo_url || local?.photoUrl || null,
    description: row.description?.trim() || local?.description || "",
    choices: row.accompaniments?.length ? row.accompaniments : local?.choices ?? [],
    variants: row.price_options ?? [],
    family: row.menu_label?.trim() || local?.family || "",
    section: row.menu_section?.trim() || local?.section || "",
    source: row.source_label?.trim() || local?.source || "", observed: row.observed_on || local?.observed || "",
    published: row,
  };
}

export function placeDishes(placeId: string, rows: readonly MenuItem[]): CatalogDish[] {
  const local = placeId === leChaMenuId ? leChaDishes : placeId === inMenuId ? inDishes : [];
  const available = rows.filter(row => row.place_id === placeId && row.is_published);
  const byId = new Map(available.map(row => [row.id, row]));
  const byName = new Map(available.map(row => [normalizedMenuText(row.name), row]));
  const matched = new Set<string>();
  const dishes = local.map(dish => {
    const row = byId.get(dish.key) ?? (placeId === leChaMenuId ? byName.get(normalizedMenuText(dish.name)) : undefined);
    if (!row || matched.has(row.id)) return dish;
    matched.add(row.id);
    return publishedDish(row, dish);
  });
  return dishes.concat(available.filter(row => !matched.has(row.id)).sort((a, b) =>
    (a.menu_position ?? Infinity) - (b.menu_position ?? Infinity) || a.name.localeCompare(b.name, "fr")
  ).map(row => publishedDish(row)));
}

export function menuPreviews(dishes: readonly CatalogDish[], placeId: string): CatalogDish[] {
  const names = placeId === leChaMenuId ? ["Tteokbokki", "Okonomiyaki Corn Dog", "Bubble Milk Tea"]
    : placeId === inMenuId ? ["Eggs Benedict", "Burger de veau", "Tomates, mozzarella, basilic"] : [];
  const preferred = names.flatMap(name => dishes.find(dish => normalizedMenuText(dish.name) === normalizedMenuText(name)) ?? []);
  return [...new Set([...preferred, ...dishes.filter(dish => dish.photoUrl), ...dishes])].slice(0, 3);
}

