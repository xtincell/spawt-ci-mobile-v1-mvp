import type { ImageSourcePropType } from "react-native";
import { inMenuId, leChaMenuId, localMenuPhotography, normalizedMenuText, type CatalogDish } from "../../lib/place-menu-catalog";

// Le Chā's cheddar corn dog and IN's editorial photo of its brunch are used for their own menus.
const cornDog = require("../../../assets/editorial/le-cha-officiel-corn-dog.webp");
const inBrunch = require("../../../assets/editorial/menu/in-brunch.jpg");
// These attributed dish photographs accompany the local validation copy only.
const previewPhotos: Record<string, ImageSourcePropType> = localMenuPhotography ? {
  "tteokbokki": require("../../../assets/editorial/menu/tteokbokki.webp"),
  "chicken katsu": require("../../../assets/editorial/menu/chicken-katsu.webp"),
  "okonomiyaki corn dog": require("../../../assets/editorial/menu/okonomiyaki.webp"),
  "mochi glace": require("../../../assets/editorial/menu/mochi.webp"),
  "bubble milk tea": require("../../../assets/editorial/menu/bubble-milk-tea.webp"),
} : {};

export function menuDishPhoto(placeId: string, dish: CatalogDish): ImageSourcePropType | undefined {
  if (dish.published?.photo_url) return { uri: dish.published.photo_url };
  if (placeId === leChaMenuId) {
    const name = normalizedMenuText(dish.name);
    if (name === "cheese corn dog") return cornDog;
    if (previewPhotos[name]) return previewPhotos[name];
  }
  return dish.photoUrl ? { uri: dish.photoUrl } : undefined;
}

export function menuCoverPhoto(placeId: string, dishes: readonly CatalogDish[]): ImageSourcePropType | undefined {
  if (placeId === leChaMenuId) return cornDog;
  if (placeId === inMenuId) return inBrunch;
  const withPhoto = dishes.find(dish => dish.photoUrl);
  return withPhoto ? menuDishPhoto(placeId, withPhoto) : undefined;
}

