import { useEffect, useState } from "react";
import { useContentRevision } from "./content-sync";
import { readMenuInventory } from "./menu-inventory";
import { estimateMenuMeal } from "./menu-meal-estimate";
import { inMenuId, leChaMenuId, placeDishes } from "./place-menu-catalog";
import type { MenuItem } from "./outings";
import type { Place } from "../types/place";

type BudgetEstimates = ReadonlyMap<string, number>;

/** Use the same normalized dishes as the place detail, including its documented local menus. */
export function menuBudgetEstimates(rows: readonly MenuItem[]): BudgetEstimates {
  const byPlace = new Map<string, MenuItem[]>([[leChaMenuId, []], [inMenuId, []]]);
  for (const row of rows) {
    let group = byPlace.get(row.place_id);
    if (!group) byPlace.set(row.place_id, group = []);
    group.push(row);
  }
  const estimates = new Map<string, number>();
  for (const [id, items] of byPlace) {
    const amount = estimateMenuMeal(placeDishes(id, items));
    if (amount !== null) estimates.set(id, amount);
  }
  return estimates;
}

const local = menuBudgetEstimates([]);
const computed = new WeakMap<readonly MenuItem[], BudgetEstimates>();

export function useMenuBudgets(enabled: boolean): BudgetEstimates {
  const revision = useContentRevision();
  const [budgets, setBudgets] = useState(local);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void readMenuInventory(revision).then(rows => {
      if (!active) return;
      let estimates = computed.get(rows);
      if (!estimates) {
        estimates = menuBudgetEstimates(rows);
        computed.set(rows, estimates);
      }
      setBudgets(estimates);
    }).catch(() => { /* Keep readable prices and places during an offline refresh. */ });
    return () => { active = false; };
  }, [enabled, revision]);
  return budgets;
}

export function withMenuBudget<T extends Pick<Place, "id" | "price">>(place: T, estimates: BudgetEstimates): T {
  const estimate = estimates.get(place.id);
  if (!estimate || place.price.menu_estimate_xof === estimate) return place;
  return { ...place, price: { ...place.price, menu_estimate_xof: estimate } };
}

