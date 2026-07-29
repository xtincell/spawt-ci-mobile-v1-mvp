// Console admin 07/2026 — logique pure de la page Campagnes push (testable
// sans Refine). Contrat Edge `push-send` (supabase/functions/push-send) :
//   POST { spawter_ids? | stade? | archetype? | gold_only?, title, body, data? }
//   → { sent, failed, purged } ; au moins UNE cible requise ; auth staff par
//   access_token (le client supabase.functions.invoke l'attache) ; limite
//   3 campagnes staff / jour UTC (comptées via admin_audit_log push_campaign).
//
// « Tous » n'existe pas côté Edge : on le traduit en spawter_ids explicites
// (lecture staff de spawters, cap 10 000 aligné sur la validation serveur).

export type PushTargetKind = "all" | "stade" | "archetype" | "gold";

export const PUSH_STADES = [
  "touriste",
  "explorateur",
  "detective",
  "djidji",
  "guide",
] as const;

/** Clés canoniques des 13 archétypes (quiz La Meute — 0033). */
export const PUSH_ARCHETYPES = [
  "omnivore",
  "gardien",
  "ancre",
  "bouchedor",
  "braise",
  "memoire",
  "pisteur",
  "vent",
  "fantome",
  "murmure",
  "oeil",
  "lame",
  "passeport",
] as const;

/** Miroir des bornes de validation de l'Edge (title 1..178, body 1..2048). */
export const PUSH_TITLE_MAX = 178;
export const PUSH_BODY_MAX = 2048;
/** Miroir MAX_STAFF_CAMPAIGNS_PER_DAY de l'Edge. */
export const MAX_CAMPAIGNS_PER_DAY = 3;
/** Miroir du cap serveur sur spawter_ids. */
export const MAX_SPAWTER_IDS = 10_000;

export interface PushFormValues {
  title: string;
  body: string;
  deep_link: string;
  target: PushTargetKind;
  stade: (typeof PUSH_STADES)[number];
  archetype: (typeof PUSH_ARCHETYPES)[number];
}

export const EMPTY_PUSH_FORM: PushFormValues = {
  title: "",
  body: "",
  deep_link: "",
  target: "all",
  stade: "touriste",
  archetype: "omnivore",
};

export type PushValidation = { ok: true } | { ok: false; errors: string[] };

export function validatePushForm(v: PushFormValues): PushValidation {
  const errors: string[] = [];
  if (v.title.trim().length === 0) errors.push("Le titre est obligatoire.");
  if (v.title.length > PUSH_TITLE_MAX) errors.push(`Titre trop long (max ${PUSH_TITLE_MAX}).`);
  if (v.body.trim().length === 0) errors.push("Le corps est obligatoire.");
  if (v.body.length > PUSH_BODY_MAX) errors.push(`Corps trop long (max ${PUSH_BODY_MAX}).`);
  if (v.deep_link && !/^(\/|https?:\/\/|spawt:\/\/)/.test(v.deep_link.trim())) {
    errors.push("Deep link invalide (chemin /… ou URL).");
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export interface PushSendBody {
  spawter_ids?: string[];
  stade?: string;
  archetype?: string;
  gold_only?: boolean;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Formulaire → body Edge. `allSpawterIds` n'est requis (et utilisé) que pour
 * le ciblage « tous » — l'Edge exige au moins une cible explicite.
 */
export function buildPushBody(
  v: PushFormValues,
  allSpawterIds: string[] | null,
): PushSendBody {
  const base: PushSendBody = {
    title: v.title.trim(),
    body: v.body.trim(),
    ...(v.deep_link.trim() ? { data: { deep_link: v.deep_link.trim() } } : {}),
  };
  switch (v.target) {
    case "all":
      return { ...base, spawter_ids: (allSpawterIds ?? []).slice(0, MAX_SPAWTER_IDS) };
    case "stade":
      return { ...base, stade: v.stade };
    case "archetype":
      return { ...base, archetype: v.archetype };
    case "gold":
      return { ...base, gold_only: true };
  }
}

/** Campagnes du jour UTC (aligné sur le comptage serveur — dayStart UTC). */
export function campaignsToday(
  rows: { created_at: string }[],
  now: Date = new Date(),
): number {
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  return rows.filter((r) => new Date(r.created_at).getTime() >= dayStart.getTime()).length;
}

// ── Estimation du ciblage (DI pour les tests) ───────────────────────────────

export interface EstimateDeps {
  /** Résout les spawter_ids du ciblage (lecture staff : spawters / entitlements). */
  fetchSpawterIds: (v: PushFormValues) => Promise<string[]>;
  /** Compte les tokens push des ids donnés (lecture staff de push_tokens). */
  countTokens: (spawterIds: string[]) => Promise<number>;
}

export interface PushEstimate {
  spawters: number;
  tokens: number;
}

/** Estimation « N spawters ciblés, M devices » avant envoi. */
export async function estimateTargets(
  v: PushFormValues,
  deps: EstimateDeps,
): Promise<PushEstimate> {
  const ids = [...new Set(await deps.fetchSpawterIds(v))];
  if (ids.length === 0) return { spawters: 0, tokens: 0 };
  const tokens = await deps.countTokens(ids);
  return { spawters: ids.length, tokens };
}

/** Résultat d'envoi de l'Edge. */
export interface PushSendResult {
  sent: number;
  failed: number;
  purged: number;
}

/** Codes d'erreur Edge → message FR actionnable. */
export function pushErrorMessage(code: string | null | undefined): string {
  switch (code) {
    case "campaign_limit_reached":
      return `Limite atteinte : ${MAX_CAMPAIGNS_PER_DAY} campagnes staff par jour (UTC). Réessaie demain.`;
    case "missing_targets":
      return "Aucune cible résolue — choisis un ciblage non vide.";
    case "forbidden":
      return "Réservé aux admins";
    case "unauthenticated":
      return "Session expirée — reconnecte-toi.";
    case "invalid_payload":
      return "Payload refusé par le serveur (titre/corps invalides).";
    default:
      return code ? `Erreur serveur : ${code}` : "Erreur serveur inconnue.";
  }
}
