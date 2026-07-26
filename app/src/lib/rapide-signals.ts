// Mode Rapide — signal FAIBLE swipe → axes du Palais.
//
// Mécanisme existant réutilisé : `updateAxis` de palais-engine (décroissance
// par unique_spots) — le même moteur que les signaux d'avis (palais-signals).
// Un swipe n'est PAS un avis : les poids sont délibérément SOUS le plancher
// des signaux d'avis (0.02, PRD §20.5). Le geste est ambigu — on passe aussi
// un bon lieu parce qu'on n'a pas faim de ça aujourd'hui. La vraie matière
// pour le ML futur est dans `user_signals` (swipe_like/swipe_pass, migration
// 0046) ; ceci n'est que le nudge V1 côté client.
//
// Mapping axes ADN lieu → axes Palais : le même appariement 1:1 que la
// composante cosine du matching (matching.ts, cosineComponent) :
//   local_international  ↔ racines_horizons
//   informel_etabli      ↔ taniere_nomade
//   budget_premium       ↔ exigeant_enthousiaste
//   populaire_prive      ↔ foule_secret
//   decontracte_habille  ↔ maquis_table
//
// Règles :
//   - Un axe ADN neutre (|valeur| < seuil) ne caractérise pas le lieu →
//     aucun signal sur cet axe. ADN totalement plat → no-op (didUpdate=false).
//   - like : nudge du Palais VERS le profil du lieu (ouverture à ce type).
//   - pass : nudge léger À L'OPPOSÉ (signal négatif, moitié du poids like).
//   - confidence_score : INCHANGÉ — un swipe n'est pas une visite vérifiée,
//     la confiance ne monte qu'avec unique_spots (PRD §5.6).
//
// Pure, sans I/O — le caller (spawter-store.applySwipeSignal) persiste.

import { dominantAxes, updateAxis } from "./palais-engine";
import type { UserPalais } from "../types/palais";
import type { PlaceAdn } from "../types/place";

export type SwipeDirection = "like" | "pass";

/** Poids d'un like — moitié du signal d'avis faible (0.02, PRD §20.5). */
export const SWIPE_LIKE_WEIGHT = 0.01;
/** Poids d'un pass — encore moitié : le rejet d'une carte est plus ambigu. */
export const SWIPE_PASS_WEIGHT = 0.005;
/** Seuil de caractère : en-dessous, l'axe ADN est trop neutre pour signifier. */
export const SWIPE_ADN_THRESHOLD = 0.3;

/** Appariement figé ADN lieu → Palais (ordre canonique matching.ts). */
const ADN_TO_PALAIS = [
  { adn: "axe_local_international", palais: "axe_racines_horizons" },
  { adn: "axe_informel_etabli", palais: "axe_taniere_nomade" },
  { adn: "axe_budget_premium", palais: "axe_exigeant_enthousiaste" },
  { adn: "axe_populaire_prive", palais: "axe_foule_secret" },
  { adn: "axe_decontracte_habille", palais: "axe_maquis_table" },
] as const;

export interface ApplySwipeToPalaisInput {
  current: UserPalais;
  unique_spots: number;
  adn: PlaceAdn;
  direction: SwipeDirection;
}

export interface ApplySwipeToPalaisOutput {
  palais: UserPalais;
  didUpdate: boolean;
}

/**
 * Applique un swipe (like/pass) au Palais courant. Pure — le caller persiste.
 * Retourne `didUpdate: false` si aucun axe ADN n'est assez marqué.
 */
export function applySwipeToPalais(
  input: ApplySwipeToPalaisInput,
): ApplySwipeToPalaisOutput {
  const weight =
    input.direction === "like" ? SWIPE_LIKE_WEIGHT : SWIPE_PASS_WEIGHT;
  const orientation = input.direction === "like" ? 1 : -1;

  const axes = {
    axe_racines_horizons: input.current.axe_racines_horizons,
    axe_taniere_nomade: input.current.axe_taniere_nomade,
    axe_exigeant_enthousiaste: input.current.axe_exigeant_enthousiaste,
    axe_foule_secret: input.current.axe_foule_secret,
    axe_maquis_table: input.current.axe_maquis_table,
  };

  let touched = false;
  for (const pair of ADN_TO_PALAIS) {
    const adnValue = input.adn[pair.adn];
    if (!Number.isFinite(adnValue) || Math.abs(adnValue) < SWIPE_ADN_THRESHOLD) {
      continue;
    }
    touched = true;
    axes[pair.palais] = updateAxis(
      axes[pair.palais],
      Math.sign(adnValue) * orientation * weight,
      input.unique_spots,
    );
  }

  if (!touched) {
    return { palais: input.current, didUpdate: false };
  }

  return {
    palais: {
      ...input.current,
      ...axes,
      dominant_axes: dominantAxes(axes),
      updated_at: new Date().toISOString(),
    },
    didUpdate: true,
  };
}
