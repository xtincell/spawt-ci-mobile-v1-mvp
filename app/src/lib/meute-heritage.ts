// finding P0 — application de l'héritage quiz « La Meute » réclamé server-side.
//
// Au 1er login OTP, `claim_meute_heritage` échoue (la ligne spawters n'existe
// pas encore) ; le rattrapage se fait au finalizeOnboarding APRÈS l'upsert, via
// la RPC 0051. Ce module contient la logique PURE d'application du résultat du
// claim sur le couple spawter/palais — écrase l'archétype calculé localement
// par l'archétype quiz hérité et pose le n° Pionnier. Pur = testable sans store
// ni réseau.

import type { Spawter } from "../types/spawter";
import type { UserPalais } from "../types/palais";
import { isArchetypeKey } from "./archetype-engine";
import { ARCHETYPES } from "../data/archetypes";

/** Résultat de la RPC `claim_meute_heritage` (0051). */
export interface MeuteHeritageClaim {
  claimed: boolean;
  archetype: string | null;
  pionnier_seq: number | null;
}

export interface AppliedHeritage {
  spawter: Spawter;
  /** null si aucun palais courant à mettre à jour. */
  palais: UserPalais | null;
  /** Clé i18n du titre de collection de l'archétype hérité (unlockTitle). */
  titleKey: string;
}

/**
 * Applique un héritage sur un spawter (+ palais miroir). Retourne null si rien à
 * appliquer : claim absent, archétype invalide, ou déjà appliqué — le caller
 * garde alors l'archétype calculé localement.
 *
 * L'adoption dépend de la PRÉSENCE d'un archétype valide, PAS du flag `claimed` :
 * la RPC ne renvoie un archétype non-null que si le téléphone est un Pionnier
 * (`claimed` au 1er login, `already_claimed` ensuite — même archétype hérité,
 * autoritatif). Cela couvre aussi la réinstallation (already_claimed) sans quoi
 * l'archétype calculé localement masquerait l'héritage.
 *
 * Écrase `quiz_archetype` par l'archétype hérité (source de vérité = le quiz),
 * pose `pionnier_seq`, et reflète l'archétype dans `user_palais.archetype_id`.
 */
export function applyMeuteHeritage(
  spawter: Spawter,
  palais: UserPalais | null,
  claim: MeuteHeritageClaim | null,
): AppliedHeritage | null {
  if (!claim || !isArchetypeKey(claim.archetype)) return null;
  const archetype = claim.archetype;
  // No-op silencieux si l'archétype hérité est déjà celui posé ET le pionnier
  // déjà connu (rien de neuf à écrire — évite un set/save inutile).
  const seq = claim.pionnier_seq ?? spawter.pionnier_seq ?? null;
  if (spawter.quiz_archetype === archetype && spawter.pionnier_seq === seq) return null;

  const nextSpawter: Spawter = {
    ...spawter,
    quiz_archetype: archetype,
    pionnier_seq: seq,
  };
  const nextPalais: UserPalais | null = palais
    ? { ...palais, archetype_id: archetype }
    : null;
  return { spawter: nextSpawter, palais: nextPalais, titleKey: ARCHETYPES[archetype].titleKey };
}
