import type { TFunction } from "i18next";
import type { PriceRange } from "../types/place";

/** Espace insécable (U+00A0) — séparateur de milliers fr-FR. */
export const NBSP = " ";

export const PLACE_BUDGET_TIERS = [1, 2, 3] as const;
export type PlaceBudgetTier = typeof PLACE_BUDGET_TIERS[number];
const MID_BUDGET_START = 10_000;
const HIGH_BUDGET_START = 15_000;

/** Un repas par personne, hors boissons. Un plat à la carte ne classe jamais le lieu. */
export function getPlaceBudgetTier(price: PriceRange): PlaceBudgetTier | null {
  const verified = price.avg_ticket_xof;
  const ticket = typeof verified === "number" && Number.isFinite(verified) && verified >= 1
    ? verified : price.menu_estimate_xof;
  if (typeof ticket !== "number" || !Number.isFinite(ticket) || Math.round(ticket) <= 0) return null;
  if (ticket < MID_BUDGET_START) return 1;
  return ticket < HIGH_BUDGET_START ? 2 : 3;
}

export function getBudgetTierLabel(tier: PlaceBudgetTier | null, t: TFunction, monetary = true): string {
  if (tier === null) return t("place.price_unknown");
  if (!monetary) return "₣".repeat(tier);
  const middle = formatXofAmount(MID_BUDGET_START);
  const high = formatXofAmount(HIGH_BUDGET_START);
  if (tier === 1) return t("place.budget_under", { max: middle });
  if (tier === 2) return t("place.budget_between", { min: middle, max: high });
  return t("place.budget_from", { min: high });
}

export function getPlaceBudgetLabel(price: PriceRange, t: TFunction, monetary = true): string {
  const measured = monetary ? getPlaceBudgetTier(price) : null;
  return measured === null ? t("place.budget_contribute") : getBudgetTierLabel(measured, t);
}

/**
 * Formate un montant XOF en string groupée par milliers (« 8 000 »).
 *
 * Retourne `null` si le montant est absent, invalide ou non strictement
 * positif — le caller affiche alors le fallback (symboles ₣ du price tier).
 * Les décimales éventuelles sont arrondies à l'unité (le F CFA ne se
 * subdivise pas à l'affichage).
 */
export function formatXofAmount(
  amount: number | null | undefined,
): string | null {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  const rounded = Math.round(amount);
  if (rounded <= 0) return null;
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}
