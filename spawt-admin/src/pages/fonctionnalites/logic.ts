// MAJ consolidée 07/2026 — logique pure de la page Fonctionnalités (testable
// sans Refine, pattern signalements/logic.ts).
//
// Table feature_flags (migrations 0004 + 0027) : flags runtime par scope,
// spawter_id NULL = global. RLS (DECISION D4) : SELECT staff actif ;
// INSERT/UPDATE réservés au staff admin. Piège RLS : un UPDATE refusé par la
// policy USING ne lève PAS d'erreur SQL — il modifie simplement 0 ligne. On
// détecte donc le refus via le count de lignes retournées par `.select()`.

export const SCOPES = ["internal", "alpha", "beta", "prod"] as const;
export type FlagScope = (typeof SCOPES)[number];

/** Row feature_flags telle que SELECTée par la page (sous-ensemble colonnes). */
export interface FeatureFlagRow {
  id: string;
  flag_code: string;
  scope: string;
  enabled: boolean;
  spawter_id: string | null;
  expires_at: string | null;
}

/** Libellés humains des codes connus — code inconnu = code brut affiché tel quel. */
export const FLAG_LABELS: Record<string, string> = {
  "place-avg-price": "Prix moyen en F CFA (fiche lieu)",
  "onboarding-origin-country": "Question “Pays d'origine” (inscription)",
  "guet-geofence": "Le Guet (spawt automatique)",
  "paywall-geo": "Paywall géographique (Gold)",
};

export function flagLabel(code: string): string {
  return FLAG_LABELS[code] ?? code;
}

/** Message exact spec MAJ consolidée — affiché quand l'RLS refuse l'écriture. */
export const RLS_DENIED_MESSAGE = "Réservé aux admins";

export interface FlagCell {
  id: string;
  enabled: boolean;
  expires_at: string | null;
}

/** Une ligne du tableau : un flag_code + une cellule par scope (null = row absente). */
export interface FlagGroup {
  flagCode: string;
  label: string;
  known: boolean;
  cells: Record<FlagScope, FlagCell | null>;
}

function emptyCells(): Record<FlagScope, FlagCell | null> {
  return { internal: null, alpha: null, beta: null, prod: null };
}

/**
 * rows globales → groupes affichables. Union des codes connus (ordre de la
 * map, toujours affichés même sans row — le toggle INSERTera) et des codes
 * inconnus présents en base (triés alpha, affichés en code brut).
 * Défensif : ignore les overrides par spawter et les scopes hors canon.
 */
export function groupGlobalFlags(
  rows: FeatureFlagRow[],
  knownCodes: string[] = Object.keys(FLAG_LABELS),
): FlagGroup[] {
  const byCode = new Map<string, Record<FlagScope, FlagCell | null>>();
  for (const code of knownCodes) byCode.set(code, emptyCells());

  const unknownCodes: string[] = [];
  for (const row of rows) {
    if (row.spawter_id !== null) continue; // override spawter — hors périmètre page
    if (!(SCOPES as readonly string[]).includes(row.scope)) continue;
    let cells = byCode.get(row.flag_code);
    if (!cells) {
      cells = emptyCells();
      byCode.set(row.flag_code, cells);
      unknownCodes.push(row.flag_code);
    }
    cells[row.scope as FlagScope] = {
      id: row.id,
      enabled: row.enabled,
      expires_at: row.expires_at,
    };
  }

  const orderedCodes = [...knownCodes, ...unknownCodes.sort((a, b) => a.localeCompare(b))];
  return orderedCodes.map((code) => ({
    flagCode: code,
    label: flagLabel(code),
    known: code in FLAG_LABELS,
    cells: byCode.get(code) ?? emptyCells(),
  }));
}

/** Plan de bascule — upsert par (flag_code, scope, spawter_id NULL) :
 *  UPDATE ciblé par id si la row existe, sinon INSERT (activée d'office :
 *  créer une row désactivée n'aurait aucun effet produit). */
export type TogglePlan =
  | { kind: "update"; id: string; enabled: boolean }
  | { kind: "insert"; flag_code: string; scope: FlagScope; enabled: boolean };

export function planToggle(
  rows: FeatureFlagRow[],
  flagCode: string,
  scope: FlagScope,
): TogglePlan {
  const row = rows.find(
    (r) => r.spawter_id === null && r.flag_code === flagCode && r.scope === scope,
  );
  return row
    ? { kind: "update", id: row.id, enabled: !row.enabled }
    : { kind: "insert", flag_code: flagCode, scope, enabled: true };
}

/** Application optimiste du plan sur l'état local (immutable, React-safe). */
export function applyToggle(
  rows: FeatureFlagRow[],
  plan: TogglePlan,
  tempId: string,
): FeatureFlagRow[] {
  if (plan.kind === "update") {
    return rows.map((r) => (r.id === plan.id ? { ...r, enabled: plan.enabled } : r));
  }
  return [
    ...rows,
    {
      id: tempId,
      flag_code: plan.flag_code,
      scope: plan.scope,
      enabled: plan.enabled,
      spawter_id: null,
      expires_at: null,
    },
  ];
}

/** Rollback ciblé du plan (et non snapshot global : deux toggles concurrents
 *  sur des cellules différentes ne s'écrasent pas mutuellement). */
export function rollbackToggle(
  rows: FeatureFlagRow[],
  plan: TogglePlan,
  tempId: string,
): FeatureFlagRow[] {
  if (plan.kind === "update") {
    return rows.map((r) => (r.id === plan.id ? { ...r, enabled: !plan.enabled } : r));
  }
  return rows.filter((r) => r.id !== tempId);
}

/** Après INSERT réussi : remplace la row optimiste temporaire par la row serveur. */
export function confirmInsert(
  rows: FeatureFlagRow[],
  tempId: string,
  serverRow: FeatureFlagRow,
): FeatureFlagRow[] {
  return rows.map((r) => (r.id === tempId ? serverRow : r));
}

export interface SupabaseErrorLike {
  code?: string | null;
  message?: string | null;
}

/**
 * Erreur Supabase + count de lignes affectées → message UI (null = succès).
 * - 42501 / « row-level security » / « permission denied » → refus RLS
 *   (staff non-admin) → RLS_DENIED_MESSAGE.
 * - UPDATE sans erreur mais 0 ligne → la policy USING a filtré la row : même
 *   refus RLS, silencieux côté SQL.
 * - 23505 → conflit UNIQUE (flag_code, spawter_id, scope) : une row existe
 *   mais est invisible (expirée — le SELECT staff filtre expires_at).
 */
export function toggleErrorMessage(
  error: SupabaseErrorLike | null,
  affectedCount: number,
): string | null {
  if (error) {
    const msg = error.message ?? "";
    if (error.code === "42501" || /row-level security|permission denied/i.test(msg)) {
      return RLS_DENIED_MESSAGE;
    }
    if (error.code === "23505") {
      return "Conflit : une row existe déjà pour ce flag/scope (probablement expirée — vérifier expires_at en base)";
    }
    return msg || "Erreur inconnue";
  }
  if (affectedCount === 0) return RLS_DENIED_MESSAGE;
  return null;
}
