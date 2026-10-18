// Console admin — page Tarifs (migration 0079).
//
// La table `plans` est la SEULE source des prix : le checkout CinetPay, la
// validation manuelle des paiements et cette console la lisent. On y saisit
// le prix PAYÉ par le client (TTC, F CFA entiers) ; la base en dérive HT et
// TVA. Tout le staff lit ; seul un admin modifie, par la RPC
// `admin_update_plan` (motif obligatoire, avant/après journalisés).
//
// Ce que l'écran doit rendre difficile : changer un prix sans le voir. D'où
// l'aperçu HT/TVA à la saisie et la confirmation qui montre l'avant/après.

import { useCallback, useEffect, useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import { supabaseClient } from "../../utility/supabaseClient";
import { ReasonModal } from "../../components/ReasonModal";
import { updatePlan } from "../../lib/update-plan";
import { formatXof } from "../paiements/logic";
import {
  changeSummary,
  deriveAmounts,
  describeAudit,
  hasChanges,
  lastChangeByPlan,
  parsePriceInput,
  periodLabel,
  updatePlanErrorMessage,
  type PlanAuditRow,
  type PlanRow,
} from "./logic";

const PLAN_COLUMNS = "id, code, label, period, price_ttc, price_ht, tva_amount, is_active, updated_at";
const AUDIT_COLUMNS =
  "entity_id, created_at, reason, spawt_staff_id, payload_before, payload_after, spawt_staff(display_name)";

interface Draft {
  price: string;
  active: boolean;
}

interface Pending {
  row: PlanRow;
  priceTtc: number;
  isActive: boolean;
}

export const TarifsPage = () => {
  const { data: identity } = useGetIdentity<{ role: "admin" | "moderator" | "operator" }>();
  // Écrire un prix, c'est décider de ce que paient les clients : acte d'admin.
  // La RPC refuse de toute façon ; on n'affiche pas un champ qui ne peut
  // qu'échouer.
  const isAdmin = identity?.role === "admin";

  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [audits, setAudits] = useState<Record<string, PlanAuditRow>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabaseClient
      .from("plans")
      .select(PLAN_COLUMNS)
      .order("code", { ascending: true });
    if (error) {
      setLoadError(error.message);
      return;
    }
    setLoadError(null);
    setPlans((data ?? []) as PlanRow[]);
    setDrafts({});
    // Journal : lisible en entier par un admin, limité à ses propres lignes
    // pour le reste du staff (RLS). Sans lui, la date de mise à jour suffit.
    const { data: auditRows } = await supabaseClient
      .from("admin_audit_log")
      .select(AUDIT_COLUMNS)
      .eq("entity_type", "plan")
      .eq("action", "plan_update")
      .order("created_at", { ascending: false })
      .limit(200);
    setAudits(lastChangeByPlan((auditRows ?? []) as PlanAuditRow[]));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function draftOf(row: PlanRow): Draft {
    return drafts[row.code] ?? { price: String(row.price_ttc), active: row.is_active };
  }

  function setDraft(row: PlanRow, patch: Partial<Draft>) {
    setDrafts((cur) => ({ ...cur, [row.code]: { ...draftOf(row), ...patch } }));
  }

  async function confirmer(reason: string) {
    if (!pending || busy) return;
    setBusy(true);
    try {
      const res = await updatePlan(pending.row.code, pending.priceTtc, pending.isActive, reason);
      if (!res.ok) {
        setMessage({ kind: "error", text: updatePlanErrorMessage(res.error) });
        return;
      }
      setMessage({
        kind: "success",
        text: `${pending.row.label} : ${formatXof(res.plan?.price_ttc ?? pending.priceTtc)} TTC` +
          `${res.plan?.is_active === false ? " (désactivé)" : ""}. Vaut pour les prochains paiements.`,
      });
      setPending(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div>
        <h1>Tarifs</h1>
        <p role="alert" style={{ color: "var(--danger)" }}>Erreur : {loadError}</p>
        <button type="button" onClick={() => void load()}>Réessayer</button>
      </div>
    );
  }
  if (!plans) return <p>Chargement…</p>;

  return (
    <div>
      <h1>Tarifs</h1>
      <p style={{ color: "var(--ink-mute)", maxWidth: "70ch" }}>
        Le prix saisi est le <strong>prix payé par le client</strong>, TTC, en F CFA
        entiers. HT et TVA (18 %) en sont dérivés par la base. Le checkout en ligne
        et la validation manuelle lisent cette table : il n&apos;existe aucun autre
        endroit où un prix est écrit.
      </p>
      <p role="note" style={{ maxWidth: "70ch" }}>
        <strong>Un nouveau prix vaut pour les nouveaux paiements.</strong> Les
        factures déjà émises gardent leur montant, et un paiement déjà lancé est
        facturé au prix figé à son ouverture. Les CGV prévoient une annonce
        30 jours avant une évolution tarifaire : vérifie ce délai avant de
        modifier un prix ici.
      </p>
      {isAdmin ? null : (
        <p style={{ color: "var(--ink-mute)" }}>Lecture seule : seul un admin modifie un tarif.</p>
      )}

      {message ? (
        <p
          role="status"
          style={{
            background: message.kind === "success" ? "var(--accent)" : "var(--danger)",
            color: "white",
            padding: 10,
            borderRadius: 6,
          }}
        >
          {message.text}
        </p>
      ) : null}

      <table style={{ marginTop: 8 }}>
        <thead>
          <tr>
            <th>Plan</th>
            <th>Période</th>
            <th>Prix payé (TTC)</th>
            <th>HT (dérivé)</th>
            <th>TVA 18 % (dérivée)</th>
            <th>Actif</th>
            <th>Dernier changement</th>
            {isAdmin ? <th aria-label="Enregistrer" /> : null}
          </tr>
        </thead>
        <tbody>
          {plans.map((row) => {
            const draft = draftOf(row);
            const parsed = parsePriceInput(draft.price);
            const apercu = parsed.ok ? deriveAmounts(parsed.value) : null;
            const modifie = parsed.ok && hasChanges(row, parsed.value, draft.active);
            const audit = audits[row.id];
            return (
              <tr key={row.id}>
                <td>
                  <div>{row.label}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "monospace" }}>
                    {row.code}
                  </div>
                </td>
                <td>{periodLabel(row.period)}</td>
                <td>
                  {isAdmin ? (
                    <>
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label={`Prix payé — ${row.label}`}
                        value={draft.price}
                        onChange={(e) => setDraft(row, { price: e.target.value })}
                        style={{ width: 110 }}
                      />
                      {parsed.ok ? null : (
                        <div role="alert" style={{ color: "var(--danger)", fontSize: 12 }}>
                          {parsed.error}
                        </div>
                      )}
                    </>
                  ) : (
                    <strong>{formatXof(row.price_ttc)}</strong>
                  )}
                </td>
                <td>{formatXof(apercu ? apercu.price_ht : row.price_ht)}</td>
                <td>{formatXof(apercu ? apercu.tva_amount : row.tva_amount)}</td>
                <td>
                  {isAdmin ? (
                    <input
                      type="checkbox"
                      aria-label={`Actif — ${row.label}`}
                      checked={draft.active}
                      onChange={(e) => setDraft(row, { active: e.target.checked })}
                    />
                  ) : row.is_active ? (
                    "Oui"
                  ) : (
                    "Non"
                  )}
                </td>
                <td style={{ fontSize: 12 }}>
                  {audit
                    ? describeAudit(audit)
                    : `Mis à jour le ${new Date(row.updated_at).toLocaleDateString("fr-FR")}`}
                </td>
                {isAdmin ? (
                  <td>
                    <button
                      type="button"
                      disabled={!modifie || busy}
                      onClick={() =>
                        parsed.ok &&
                        setPending({ row, priceTtc: parsed.value, isActive: draft.active })
                      }
                    >
                      Enregistrer
                    </button>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>

      {pending ? (
        <ReasonModal
          isOpen
          title={`Changer le tarif — ${pending.row.label}`}
          confirmLabel="Enregistrer le tarif"
          onCancel={() => setPending(null)}
          // Le motif est exigé par la RPC : un prix qui change sans raison
          // écrite est un prix que personne ne saura expliquer au client.
          onConfirm={(reason) => void confirmer(reason)}
        >
          <ul>
            {changeSummary(pending.row, pending.priceTtc, pending.isActive).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p style={{ fontSize: 13, color: "var(--ink-mute)" }}>
            Vaut pour les nouveaux paiements ; les factures émises gardent leur montant.
          </p>
        </ReasonModal>
      ) : null}
    </div>
  );
};
