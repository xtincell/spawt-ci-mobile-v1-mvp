import { estimateMenuMeal } from "../../src/lib/menu-meal-estimate";
import { getPlaceBudgetTier } from "../../src/lib/format-price";
import { leChaMenuId, placeDishes } from "../../src/lib/place-menu-catalog";

const dish = (section: string, price: number | null, description = "", name = section) => ({
  family: "À la carte", section, price, name, description, variants: [],
});

describe("Repère du repas d’après la carte", () => {
  it("classe Le Cha à partir de sa carte salée", () => {
    const estimate = estimateMenuMeal(placeDishes(leChaMenuId, []));
    expect(estimate).toBe(9500);
    expect(getPlaceBudgetTier({ tier: null, menu_estimate_xof: estimate! })).toBe(1);
  });
  it("écarte boissons, sucrés et suppléments", () => {
    expect(estimateMenuMeal([dish("Desserts", 3000), dish("Boissons", 800),
      dish("Côté terre", 2500, "", "Supplément garnitures")])).toBeNull();
  });
  it("ne facture pas deux fois un accompagnement inclus", () => {
    expect(estimateMenuMeal([dish("Burgers", 10000, "Servi avec des frites"), dish("Entrées", 4500)])).toBe(10000);
  });
  it("ne traite pas un plat seul comme un repas documenté", () => {
    expect(estimateMenuMeal([dish("Burgers", 12900)])).toBeNull();
  });
  it("conserve la tranche éditoriale quand un ticket de référence existe", () => {
    expect(getPlaceBudgetTier({tier:null, avg_ticket_xof:15500, menu_estimate_xof:9500})).toBe(3);
  });
});

