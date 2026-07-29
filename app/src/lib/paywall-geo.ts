// Phase 2 — Paywall géographique (PRD Feature 14).
// Gratuit = rayon 3 km autour de la position du spawter ; au-delà, les cartes
// sont verrouillées (nom masqué + bandeau premium). NUDGE, pas mur : la fiche
// reste accessible par deep link (PRD §3.1 F14 "pas un mur infranchissable").
//
// DÉSACTIVÉ par défaut (flag `paywall-geo`, seed scopes false) : l'étude de
// marché (§Risque A) alerte sur la "frustration punitive" d'un paywall sans
// moyen de payer. À activer quand l'abonnement Gold (CinetPay) est branché.

import { haversineKm } from "./matching";

export const FREE_RADIUS_KM = 3;
export const GOLD_PRICE_LABEL_TTC = "2 950 F/mois TTC";

/** Un lieu est verrouillé si le paywall est actif, le spawter non-Gold,
 *  et le lieu au-delà du rayon gratuit. Position fallback (permission refusée)
 *  = pas de verrouillage (on ne punit pas l'absence de GPS). */
export function isPlaceLocked(options: {
  paywallEnabled: boolean;
  isGold: boolean;
  positionSource: "gps" | "fallback";
  spawterLat: number;
  spawterLng: number;
  placeLat: number;
  placeLng: number;
}): boolean {
  if (!options.paywallEnabled || options.isGold) return false;
  if (options.positionSource === "fallback") return false;
  return (
    haversineKm(
      options.spawterLat,
      options.spawterLng,
      options.placeLat,
      options.placeLng,
    ) > FREE_RADIUS_KM
  );
}

/** Masque le nom d'un lieu verrouillé : première lettre + points médians. */
export function maskPlaceName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "•••";
  return `${trimmed[0]}${"•".repeat(Math.min(Math.max(trimmed.length - 1, 3), 12))}`;
}
