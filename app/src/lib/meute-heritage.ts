// Héritage La Meute : décodage à la frontière et Palais initial partagé.
// Le preview 0069 précède le profil ; l'écriture définitive suit son upsert.
// applyMeuteHeritage conserve le rattrapage archétype/rang pour les anciens
// retours et ne réinitialise jamais les axes d'un Palais déjà vivant.

import type { Spawter, MeuteHeritage, OnboardingDraft } from "../types/spawter";
import type { UserPalais } from "../types/palais";
import { computeArchetypeFromPalais, isArchetypeKey, type QuizAxes } from "./archetype-engine";
import { computeConfidence } from "./palais-engine";
import { ARCHETYPES } from "../data/archetypes";

/** Résultat de la RPC `claim_meute_heritage` (0051). */
export type MeuteHeritageClaim = MeuteHeritage;

/** Une donnée incomplète ne devient jamais un faux Palais neutre. */
export function parseQuizAxes(value: unknown): QuizAxes | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  for (const key of ["R", "T", "E", "F", "M"] as const) {
    const n = row[key];
    if (typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 2) return null;
  }
  return { R: row.R as number, T: row.T as number, E: row.E as number, F: row.F as number, M: row.M as number };
}

/** Décodeur commun OTP/RPC. `claimed` décrit une écriture serveur, pas la
 * présence d'un héritage (preview avant profil ou already_claimed). */
export function parseMeuteHeritage(value: unknown): MeuteHeritage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!isArchetypeKey(row.archetype)) return null;
  return {
    claimed: row.claimed === true,
    archetype: row.archetype,
    pionnier_seq: typeof row.pionnier_seq === "number" && Number.isSafeInteger(row.pionnier_seq) && row.pionnier_seq > 0
      ? row.pionnier_seq : null,
    axes: parseQuizAxes(row.axes),
    ...(typeof row.code === "string" ? { code: row.code } : {}),
  };
}

export function hasMeuteCalibration(draft: OnboardingDraft): boolean {
  return draft.use_meute_axes !== false && isArchetypeKey(draft.meute_heritage?.archetype)
    && parseQuizAxes(draft.meute_heritage?.axes) !== null;
}

/** Calcul partagé par la carte, l'analytics et la première persistance.
 * Inverse exact de palaisToQuizAxes : division par deux, mêmes polarités.
 * La confiance garde l'approximation existante sur cinq axes ; six réponses
 * ne sont pas six lieux observés ni une validation scientifique. */
export function initialMeutePalais(draft: OnboardingDraft) {
  const quiz = hasMeuteCalibration(draft) ? parseQuizAxes(draft.meute_heritage?.axes) : null;
  const ans = draft.calibration_answers;
  const axes = quiz ? {
    axe_racines_horizons: quiz.R / 2,
    axe_taniere_nomade: quiz.T / 2,
    axe_exigeant_enthousiaste: quiz.E / 2,
    axe_foule_secret: quiz.F / 2,
    axe_maquis_table: quiz.M / 2,
  } : {
    axe_racines_horizons: ans.racines_horizons ?? 0,
    axe_taniere_nomade: ans.taniere_nomade ?? 0,
    axe_exigeant_enthousiaste: ans.exigeant_enthousiaste ?? 0,
    axe_foule_secret: ans.foule_secret ?? 0,
    axe_maquis_table: ans.maquis_table ?? 0,
  };
  const computed = computeArchetypeFromPalais(axes);
  const heritage = parseMeuteHeritage(draft.meute_heritage);
  const inherited = heritage && (quiz || (draft.use_meute_axes !== false && heritage.claimed));
  return {
    axes,
    archetype: inherited && isArchetypeKey(heritage.archetype) ? heritage.archetype : computed.key,
    runnerUp: inherited ? null : computed.runnerUp,
    inherited: !!inherited,
    pionnierSeq: heritage?.pionnier_seq ?? null,
    confidence: computeConfidence(quiz ? 5 : Object.values(ans).filter((v) => v !== null).length),
  };
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
