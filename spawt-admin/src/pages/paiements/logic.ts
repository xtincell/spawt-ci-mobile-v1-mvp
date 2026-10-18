// Paiements à validation manuelle (migration 0063) — logique pure, testée.
//
// Tout ce qui demande un jugement est ici plutôt que dans le composant : ce
// sont les règles que l'équipe applique en validant de l'argent, et elles
// doivent être vérifiables sans navigateur.

export type PaymentMethod =
  | "wave"
  | "orange_money"
  | "mtn_momo"
  | "moov_money"
  | "especes"
  | "virement"
  | "autre";

export type PaymentPlan = "gold_monthly" | "gold_annual" | "pro" | "b2b_gold";
export type PaymentStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface PaymentRequestRow {
  id: string;
  requester_id: string;
  customer_type: "b2c" | "b2b";
  plan: PaymentPlan;
  method: PaymentMethod;
  amount_declare: number;
  reference: string | null;
  payer_phone: string | null;
  note: string | null;
  status: PaymentStatus;
  decision_reason: string | null;
  decided_at: string | null;
  created_at: string;
  spawters?: { display_name: string; phone_e164?: string } | null;
}

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  wave: "Wave",
  orange_money: "Orange Money",
  mtn_momo: "MTN MoMo",
  moov_money: "Moov Money",
  especes: "Espèces",
  virement: "Virement",
  autre: "Autre",
};

export const PLAN_LABELS: Record<PaymentPlan, string> = {
  gold_monthly: "Spawter Gold — 1 mois",
  gold_annual: "Spawter Gold — 12 mois",
  pro: "Spawt Pro — lieu",
  b2b_gold: "Spawt Gold — lieu",
};

export const STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "En attente",
  approved: "Validé",
  rejected: "Refusé",
  cancelled: "Annulé par le payeur",
};

/**
 * Tarif d'un plan tel que lu dans la table `plans` — la seule source des prix
 * (migration 0079), administrée depuis la page Tarifs. `price_ttc` est le prix
 * payé : c'est lui que `approve_payment_request` facture.
 */
export interface PlanTarif {
  code: PaymentPlan;
  price_ttc: number;
  is_active: boolean;
}

export type TarifsParPlan = Partial<Record<PaymentPlan, PlanTarif>>;

const PAYMENT_PLANS: readonly PaymentPlan[] = ["gold_monthly", "gold_annual", "pro", "b2b_gold"];

/** Indexe les lignes `plans` par code ; ignore les codes qu'aucune demande ne porte. */
export function indexerTarifs(
  rows: ReadonlyArray<{ code: string; price_ttc: number; is_active: boolean }>,
): TarifsParPlan {
  const tarifs: TarifsParPlan = {};
  for (const row of rows) {
    if ((PAYMENT_PLANS as readonly string[]).includes(row.code)) {
      const code = row.code as PaymentPlan;
      tarifs[code] = { code, price_ttc: row.price_ttc, is_active: row.is_active };
    }
  }
  return tarifs;
}

export type AmountVerdict = "exact" | "trop_peu" | "trop" | "inconnu" | "tarif_inconnu";

/**
 * Le montant déclaré correspond-il au tarif ?
 *
 * C'est LE contrôle que l'humain doit faire, et celui qu'on rate quand on
 * valide vite : quelqu'un déclare 500 F pour un abonnement à 2 950 et repart
 * avec un mois de Gold. Le serveur facture toujours le tarif du catalogue, donc
 * un sous-paiement validé n'est pas une perte comptable — c'est un cadeau. Le
 * signaler en rouge évite de le faire par inadvertance.
 *
 * Le tarif attendu est le prix payé COURANT du plan (`plans.price_ttc`) :
 * c'est exactement ce que la validation facturera.
 */
export function verdictMontant(
  row: { plan: PaymentPlan; amount_declare: number },
  tarif: PlanTarif | undefined,
): AmountVerdict {
  if (!Number.isFinite(row.amount_declare) || row.amount_declare <= 0) return "inconnu";
  if (!tarif) return "tarif_inconnu";
  const attendu = tarif.price_ttc;
  if (row.amount_declare === attendu) return "exact";
  return row.amount_declare < attendu ? "trop_peu" : "trop";
}

/** Message court affiché à côté du montant. */
export function libelleVerdict(
  row: { plan: PaymentPlan; amount_declare: number },
  tarif: PlanTarif | undefined,
): string {
  const attendu = tarif?.price_ttc ?? 0;
  switch (verdictMontant(row, tarif)) {
    case "exact":
      return "montant conforme";
    case "trop_peu":
      return `⚠️ ${attendu - row.amount_declare} F de moins que le tarif (${attendu} F)`;
    case "trop":
      return `+${row.amount_declare - attendu} F de plus que le tarif (${attendu} F)`;
    case "tarif_inconnu":
      return "tarif introuvable dans Tarifs";
    default:
      return "montant illisible";
  }
}

/**
 * Peut-on valider sans rien demander de plus ?
 *
 * Un versement sans référence ET sans numéro émetteur est irretrouvable : si
 * le payeur conteste, ou si le rapprochement bancaire ne tombe pas juste, il
 * n'y a rien à chercher. On n'interdit pas la validation (l'espèce en main
 * propre existe), on exige que l'admin le fasse en connaissance de cause.
 *
 * Un plan absent ou désactivé dans Tarifs est signalé d'emblée : la
 * validation serait refusée par le serveur (plan absent du catalogue actif).
 */
export function alertesAvantValidation(
  row: PaymentRequestRow,
  tarif: PlanTarif | undefined,
): string[] {
  const alertes: string[] = [];
  if (!tarif) {
    alertes.push("Plan absent de la page Tarifs : la validation sera refusée.");
  } else if (!tarif.is_active) {
    alertes.push(
      "Plan désactivé dans Tarifs : la validation sera refusée tant qu'il n'est pas réactivé.",
    );
  }
  const v = verdictMontant(row, tarif);
  if (v === "trop_peu") alertes.push(libelleVerdict(row, tarif));
  if (!row.reference?.trim() && !row.payer_phone?.trim() && row.method !== "especes") {
    alertes.push("Aucune référence ni numéro émetteur : le versement sera introuvable.");
  }
  return alertes;
}

/**
 * Formatage XOF, groupage par milliers avec une espace insécable explicite.
 *
 * Pas de `toLocaleString("fr-FR")` : selon la version d'ICU embarquée, il rend
 * tantôt une espace insécable (U+00A0), tantôt une insécable fine (U+202F).
 * Deux caractères invisibles et différents, donc un test qui passe sur une
 * machine et échoue sur l'autre — pour un montant, autant maîtriser l'octet.
 */
export function formatXof(montant: number): string {
  const entier = Math.round(Math.abs(montant)).toString();
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return `${montant < 0 ? "-" : ""}${groupe}\u00A0F`;
}
