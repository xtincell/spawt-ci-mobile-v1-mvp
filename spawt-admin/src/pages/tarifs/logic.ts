// Page Tarifs (migration 0079) — logique pure, testée.
//
// `plans` est la SEULE source des prix : le checkout CinetPay, la validation
// manuelle des paiements et cette console la lisent. L'équipe saisit le prix
// PAYÉ par le client (TTC, F CFA entiers) ; la base en dérive
// HT = round(TTC / 1,18) et TVA = TTC − HT (TVA fixe à 18 %).
//
// Ce module ne connaît aucun prix. Il prévisualise la dérivation que fera la
// base, lit une saisie, résume un changement avant confirmation et retrouve
// le dernier changement journalisé de chaque plan.

import { formatXof } from "../paiements/logic";

/** Ligne `plans` telle que lue par la page (staff actif : tous les plans). */
export interface PlanRow {
  id: string;
  code: string;
  label: string;
  period: string;
  price_ttc: number;
  price_ht: number;
  tva_amount: number;
  is_active: boolean;
  updated_at: string;
}

/** Ligne `admin_audit_log` d'un changement de tarif (action plan_update). */
export interface PlanAuditRow {
  entity_id: string;
  created_at: string;
  reason: string | null;
  spawt_staff_id: string | null;
  payload_before: Record<string, unknown> | null;
  payload_after: Record<string, unknown> | null;
  // Relation vers un seul membre : PostgREST rend un objet, le typage
  // supabase-js sans schéma généré annonce un tableau. Les deux sont lus.
  spawt_staff?: { display_name: string } | { display_name: string }[] | null;
}

function staffName(row: PlanAuditRow): string | undefined {
  const staff = Array.isArray(row.spawt_staff) ? row.spawt_staff[0] : row.spawt_staff;
  return staff?.display_name;
}

export const PERIOD_LABELS: Record<string, string> = {
  monthly: "Mensuel",
  annual: "Annuel",
  lifetime: "À vie",
};

export function periodLabel(period: string): string {
  return PERIOD_LABELS[period] ?? period;
}

/**
 * Aperçu de la dérivation faite par la base (trigger plans_derive_amounts).
 * round(TTC / 1,18) se calcule en entiers : TTC × 100 / 118. Le quotient ne
 * tombe jamais à mi-chemin de deux entiers (il faudrait un reste de 59, or
 * TTC × 100 et 118 sont pairs), donc l'arrondi coïncide avec PostgreSQL.
 */
export function deriveAmounts(priceTtc: number): { price_ht: number; tva_amount: number } {
  const price_ht = Math.round((priceTtc * 100) / 118);
  return { price_ht, tva_amount: priceTtc - price_ht };
}

export type PriceInput = { ok: true; value: number } | { ok: false; error: string };

/**
 * Lit une saisie de prix payé : « 60 000 », « 60000 », « 60 000 F » ou
 * « 60 000 F CFA ». Refuse décimales, zéro et négatifs. Le plafond est celui
 * de la RPC, qui renvoie son propre message.
 */
export function parsePriceInput(raw: string): PriceInput {
  const compact = raw
    .replace(/[\s\u00A0\u202F]/g, "")
    .replace(/F(CFA)?$/i, "");
  if (compact === "") return { ok: false, error: "Indique le prix payé, en F CFA." };
  if (!/^\d+$/.test(compact)) {
    return { ok: false, error: "Un nombre entier de F CFA, sans virgule ni signe." };
  }
  const value = Number(compact);
  if (!Number.isSafeInteger(value) || value <= 0) {
    return { ok: false, error: "Le prix payé doit dépasser 0 F CFA." };
  }
  return { ok: true, value };
}

/** Le brouillon diffère-t-il de la ligne enregistrée ? */
export function hasChanges(row: PlanRow, priceTtc: number, isActive: boolean): boolean {
  return row.price_ttc !== priceTtc || row.is_active !== isActive;
}

/**
 * Résumé avant/après montré dans la confirmation. Un prix multiplié ou divisé
 * par deux ou plus est signalé : c'est la signature d'un zéro en trop ou en
 * moins, que le plafond de la RPC n'arrête pas.
 */
export function changeSummary(row: PlanRow, priceTtc: number, isActive: boolean): string[] {
  const lines: string[] = [];
  if (row.price_ttc !== priceTtc) {
    const { price_ht, tva_amount } = deriveAmounts(priceTtc);
    lines.push(
      `Prix payé : ${formatXof(row.price_ttc)} → ${formatXof(priceTtc)} ` +
        `(HT ${formatXof(price_ht)} + TVA ${formatXof(tva_amount)})`,
    );
    if (priceTtc >= row.price_ttc * 2 || priceTtc * 2 <= row.price_ttc) {
      lines.push("⚠️ Le prix change d'un facteur 2 ou plus : vérifie le nombre de zéros.");
    }
  }
  if (row.is_active !== isActive) {
    lines.push(
      isActive
        ? "Statut : désactivé → actif (le plan redevient vendable)."
        : "Statut : actif → désactivé (plus de checkout ni de validation manuelle pour ce plan).",
    );
  }
  return lines;
}

/** Dernier changement journalisé par plan (id du plan → ligne d'audit la plus récente). */
export function lastChangeByPlan(rows: ReadonlyArray<PlanAuditRow>): Record<string, PlanAuditRow> {
  const latest: Record<string, PlanAuditRow> = {};
  for (const row of rows) {
    const current = latest[row.entity_id];
    if (!current || row.created_at > current.created_at) latest[row.entity_id] = row;
  }
  return latest;
}

function ttcOf(payload: Record<string, unknown> | null): number | null {
  const value = payload?.price_ttc;
  return typeof value === "number" ? value : null;
}

/**
 * Une ligne d'audit en clair : « 18/10/2026 · Admin · 60 000 F → 55 000 F ·
 * motif ». Une ligne sans auteur vient d'une migration (0079).
 */
export function describeAudit(row: PlanAuditRow): string {
  const parts = [new Date(row.created_at).toLocaleDateString("fr-FR")];
  parts.push(row.spawt_staff_id ? (staffName(row) ?? "Équipe") : "Migration");
  const avant = ttcOf(row.payload_before);
  const apres = ttcOf(row.payload_after);
  if (avant !== null && apres !== null && avant !== apres) {
    parts.push(`${formatXof(avant)} → ${formatXof(apres)}`);
  }
  const actifAvant = row.payload_before?.is_active;
  const actifApres = row.payload_after?.is_active;
  if (typeof actifAvant === "boolean" && typeof actifApres === "boolean" && actifAvant !== actifApres) {
    parts.push(actifApres ? "réactivé" : "désactivé");
  }
  if (row.reason?.trim()) parts.push(`« ${row.reason.trim()} »`);
  return parts.join(" · ");
}

/** Message affiché quand la RPC refuse. */
export function updatePlanErrorMessage(error: { code: string; message?: string } | undefined): string {
  switch (error?.code) {
    case "FORBIDDEN":
      return "Refusé : seul un admin actif peut modifier un tarif.";
    case "23514":
      // check_violation : la RPC dit elle-même ce qui ne va pas (plafond, motif…).
      return `Refusé : ${error.message ?? "saisie invalide"}.`;
    case "P0002":
      return "Ce plan n'existe plus : recharge la page.";
    default:
      return `Erreur : ${error?.message ?? error?.code ?? "inconnue"}`;
  }
}
