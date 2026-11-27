import type { CatalogDish } from "./place-menu-catalog";

type MealDish = Pick<CatalogDish, "family" | "section" | "name" | "price" | "variants" | "description">;

function median(values: number[]) {
  if (!values.length) return null;
  values.sort((left, right) => left - right);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle]! : (values[middle - 1]! + values[middle]!) / 2;
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

const mains = /^(plats?( principaux?)?|main courses?|bao burgers?|burgers?|sandwich(e)?s?|volailles?|cote (terre|mer)|pizzas?|grillades?|viandes?|poissons?|pates|plats uniques?)$/;
const starters = /^(entrees?|accompagnements?|garnitures?|pour debuter|finger food|starters?|sides?)$/;
const excluded = /boisson|dessert|sucre|supplement|cocktail|bingsu|shake|bubble tea|crepe sucree|cafe gourmand/;
const complete = /^(formules? (dejeuner|repas|midi)|menus? complets?|repas complets?)$/;

/** Estimation éditoriale d’un repas, à partir de rubriques identifiables. */
export function estimateMenuMeal(dishes: readonly MealDish[]): number | null {
  const mainPrices: number[] = [], sidePrices: number[] = [], completePrices: number[] = [];
  for (const dish of dishes) {
    const family = normalized(dish.family);
    const section = normalized(dish.section);
    if (excluded.test(family + " " + section) || /^(supplement|extra)\b/.test(normalized(dish.name))) continue;
    const price = dish.price != null && dish.price > 0 ? dish.price :
      median(dish.variants.map(option => option.price_xof).filter(value => Number.isFinite(value) && value > 0));
    if (price == null || !Number.isFinite(price)) continue;
    if (complete.test(section) || complete.test(family)) {
      completePrices.push(price);
    } else if (mains.test(section)) {
      if (/accompagnement (inclus|compris|au choix)|servi[e]? avec (des |une portion de )?(frites|riz|alloco)|accompagne[e]? de (frites|riz|alloco)/.test(normalized(dish.description))) {
        completePrices.push(price);
      } else {
        mainPrices.push(price);
      }
    } else if (starters.test(section)) {
      sidePrices.push(price);
    }
  }
  const side = median(sidePrices);
  // A side is counted once, only for mains without one already included.
  if (side !== null) completePrices.push(...mainPrices.map(price => price + side));
  const meal = median(completePrices);
  return meal === null ? null : Math.round(meal);
}

