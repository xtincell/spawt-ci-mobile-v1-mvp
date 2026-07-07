// Refonte fiche lieu (R21) — prix moyen affiché en valeur F CFA plutôt que
// l'échelle symbolique ₣₣₣.
//
// Source de donnée UNIQUE : la colonne existante `places.avg_ticket_xof`
// (migration 0010). La méthode de calcul du panier moyen n'est PAS tranchée
// (décision produit/data ouverte) — aucun calcul côté client, on affiche la
// valeur telle quelle si renseignée, sinon le caller retombe sur l'échelle ₣.
//
// Format fr-FR : groupement des milliers par espace insécable (U+00A0),
// ex. 8000 → « 8 000 ». Implémentation locale déterministe — pas de dépendance
// à Intl.NumberFormat (support Hermes variable selon build/plateforme).

/** Espace insécable (U+00A0) — séparateur de milliers fr-FR. */
export const NBSP = " ";

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
