// Console admin 07/2026 — logique pure de la page Défis de la Meute (testable
// sans Refine). Tables challenges + challenge_progress (migration 0040).
//
// ⚠️ CONTRAT SPAWT : les défis sont COLLECTIFS — une seule jauge pour toute
// la Meute, jamais de classement individuel (le schéma 0040 le rend
// impossible par construction : challenge_progress n'a pas de spawter_id).
//
// CONVENTION TEXTES (title_key/description_key) : la migration 0040 nomme ces
// colonnes en « _key » (clés i18n côté app). La console admin y stocke le
// texte FRANÇAIS saisi TEL QUEL : l'app affiche la traduction si la valeur
// existe comme clé i18n, sinon le texte brut. Un défi saisi ici s'affiche
// donc directement en français — et un défi « produit » peut toujours pointer
// une vraie clé i18n. Ne pas « corriger » ce comportement.

export const GOAL_TYPES = [
  "spawts_total",
  "communes_couvertes",
  "avis_total",
  "nouveaux_lieux",
] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  spawts_total: "Spawts vérifiés (total)",
  communes_couvertes: "Communes couvertes",
  avis_total: "Avis publiés (total)",
  nouveaux_lieux: "Nouveaux lieux ouverts",
};

export function goalTypeLabel(code: string): string {
  return GOAL_TYPE_LABELS[code as GoalType] ?? code;
}

export const CHALLENGE_STATUSES = ["draft", "active", "done"] as const;
export type ChallengeStatus = (typeof CHALLENGE_STATUSES)[number];

export const STATUS_LABELS: Record<ChallengeStatus, string> = {
  draft: "Brouillon",
  active: "Actif",
  done: "Terminé",
};

/** Cycle de vie one-way : draft → active → done (jamais de retour). */
export function nextStatuses(status: ChallengeStatus): ChallengeStatus[] {
  if (status === "draft") return ["active"];
  if (status === "active") return ["done"];
  return [];
}

export function canTransition(from: ChallengeStatus, to: ChallengeStatus): boolean {
  return nextStatuses(from).includes(to);
}

export interface ChallengeRow {
  id: string;
  code: string;
  title_key: string;
  description_key: string;
  period_start: string;
  period_end: string;
  goal_type: string;
  goal_target: number;
  reward_paws: number;
  status: ChallengeStatus;
  created_at: string;
  challenge_progress?: { current_value: number; updated_at: string } | { current_value: number; updated_at: string }[] | null;
}

/** PostgREST renvoie la relation 1-1 en objet OU en tableau selon le join. */
export function progressOf(row: ChallengeRow): number {
  const p = row.challenge_progress;
  if (!p) return 0;
  if (Array.isArray(p)) return p[0]?.current_value ?? 0;
  return p.current_value ?? 0;
}

/** Jauge collective : pourcentage borné [0, 100]. */
export function progressPercent(current: number, target: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
}

// ── Validation formulaire ───────────────────────────────────────────────────

export interface ChallengeFormValues {
  code: string;
  /** Texte FR affiché (stocké tel quel dans title_key — cf. convention). */
  title: string;
  description: string;
  period_start: string;
  period_end: string;
  goal_type: GoalType;
  goal_target: string;
  reward_paws: string;
}

export const EMPTY_CHALLENGE_FORM: ChallengeFormValues = {
  code: "",
  title: "",
  description: "",
  period_start: "",
  period_end: "",
  goal_type: "spawts_total",
  goal_target: "",
  reward_paws: "0",
};

export interface ChallengeDbRow {
  code: string;
  title_key: string;
  description_key: string;
  period_start: string;
  period_end: string;
  goal_type: GoalType;
  goal_target: number;
  reward_paws: number;
}

export type ChallengeValidation =
  | { ok: true; row: ChallengeDbRow }
  | { ok: false; errors: string[] };

/** Miroir client des CHECKs 0040 (période ordonnée, target > 0, paws >= 0). */
export function validateChallengeForm(v: ChallengeFormValues): ChallengeValidation {
  const errors: string[] = [];
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(v.code.trim())) {
    errors.push("Code invalide (minuscules, chiffres, tirets/underscores — ex. defi_juillet).");
  }
  if (v.title.trim().length === 0) errors.push("Le titre est obligatoire.");
  if (v.description.trim().length === 0) errors.push("La description est obligatoire.");
  if (!v.period_start) errors.push("La date de début est obligatoire.");
  if (!v.period_end) errors.push("La date de fin est obligatoire.");
  if (v.period_start && v.period_end && v.period_end < v.period_start) {
    errors.push("La fin de période ne peut pas précéder le début.");
  }
  const target = Number(v.goal_target);
  if (!Number.isInteger(target) || target <= 0) {
    errors.push("L'objectif doit être un entier > 0.");
  }
  const paws = Number(v.reward_paws);
  if (!Number.isInteger(paws) || paws < 0) {
    errors.push("Les Paws de récompense doivent être un entier >= 0.");
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    row: {
      code: v.code.trim(),
      title_key: v.title.trim(),
      description_key: v.description.trim(),
      period_start: v.period_start,
      period_end: v.period_end,
      goal_type: v.goal_type,
      goal_target: target,
      reward_paws: paws,
    },
  };
}

/** Row DB → valeurs formulaire (édition). */
export function challengeRowToForm(row: ChallengeRow): ChallengeFormValues {
  return {
    code: row.code,
    title: row.title_key,
    description: row.description_key,
    period_start: row.period_start,
    period_end: row.period_end,
    goal_type: (GOAL_TYPES as readonly string[]).includes(row.goal_type)
      ? (row.goal_type as GoalType)
      : "spawts_total",
    goal_target: String(row.goal_target),
    reward_paws: String(row.reward_paws),
  };
}
