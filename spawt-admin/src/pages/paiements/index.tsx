// Console admin — file des paiements déclarés (migration 0063).
//
// CinetPay est devenu un moyen parmi d'autres : à Abidjan, l'essentiel passe
// par Wave, Orange Money, MTN MoMo. Le payeur déclare son versement depuis le
// portail, l'équipe le retrouve sur son relevé, et valide ici. La validation
// ouvre l'abonnement, émet la facture et journalise — en une transaction
// serveur (`approve_payment_request`), pas en trois clics successifs.
//
// Ce que l'écran doit rendre difficile : valider sans regarder. D'où le bandeau
// d'alerte sur les demandes à risque (sous-paiement, versement sans référence)
// et la confirmation explicite quand il y en a une.

import { useState } from "react";
import { useTable, useInvalidate, useGetIdentity } from "@refinedev/core";
import { supabaseClient } from "../../utility/supabaseClient";
import { ReasonModal } from "../../components/ReasonModal";
import {
  METHOD_LABELS,
  PLAN_LABELS,
  STATUS_LABELS,
  alertesAvantValidation,
  expectedTtc,
  formatXof,
  libelleVerdict,
  verdictMontant,
  type PaymentRequestRow,
} from "./logic";

const SELECT_WITH_JOINS = "*, spawters(display_name, phone_e164)";

interface Toast {
  kind: "success" | "error";
  message: string;
}

export const PaiementsList = () => {
  const [tab, setTab] = useState<"pending" | "traitees">("pending");
  const [rejecting, setRejecting] = useState<PaymentRequestRow | null>(null);
  const [confirming, setConfirming] = useState<PaymentRequestRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const invalidate = useInvalidate();
  const { data: identity } = useGetIdentity<{ role: "admin" | "moderator" | "operator" }>();
  // Valider un paiement ouvre un droit facturé : c'est un acte d'admin, pas de
  // modération. La RPC refuse de toute façon — autant ne pas afficher un bouton
  // qui ne peut qu'échouer.
  const isAdmin = identity?.role === "admin";

  const { tableQuery } = useTable<PaymentRequestRow>({
    resource: "payment_requests",
    pagination: { pageSize: 50 },
    sorters: { initial: [{ field: "created_at", order: "desc" }] },
    filters: {
      permanent:
        tab === "pending"
          ? [{ field: "status", operator: "eq", value: "pending" }]
          : [{ field: "status", operator: "ne", value: "pending" }],
    },
    meta: { select: SELECT_WITH_JOINS },
  });

  const rows = (tableQuery.data?.data ?? []) as PaymentRequestRow[];

  function showToast(t: Toast) {
    setToast(t);
    setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 5000);
  }

  async function valider(row: PaymentRequestRow, motif?: string) {
    if (busyId) return;
    setBusyId(row.id);
    try {
      const { data, error } = await supabaseClient.rpc("approve_payment_request", {
        p_request_id: row.id,
        p_reason: motif ?? null,
      });
      if (error) {
        showToast({
          kind: "error",
          message:
            error.code === "42501"
              ? "Refusé : seul un admin actif peut valider un paiement."
              : `Erreur : ${error.message}`,
        });
        return;
      }
      const res = (data ?? {}) as { idempotent?: boolean; expires_at?: string };
      showToast({
        kind: "success",
        message: res.idempotent
          ? "Déjà validée — rien n'a été créé une seconde fois."
          : `Abonnement ouvert jusqu'au ${res.expires_at?.slice(0, 10) ?? "?"}. Facture émise.`,
      });
      invalidate({ resource: "payment_requests", invalidates: ["list"] });
    } finally {
      setBusyId(null);
      setConfirming(null);
    }
  }

  function onValiderClick(row: PaymentRequestRow) {
    const alertes = alertesAvantValidation(row);
    if (alertes.length > 0) setConfirming(row);
    else void valider(row);
  }

  async function refuser(motif: string) {
    if (!rejecting || busyId) return;
    setBusyId(rejecting.id);
    try {
      const { error } = await supabaseClient.rpc("reject_payment_request", {
        p_request_id: rejecting.id,
        p_reason: motif,
      });
      if (error) {
        showToast({ kind: "error", message: `Erreur : ${error.message}` });
        return;
      }
      showToast({ kind: "success", message: "Demande refusée, le motif est enregistré." });
      invalidate({ resource: "payment_requests", invalidates: ["list"] });
      setRejecting(null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1>Paiements déclarés</h1>
      <p style={{ color: "var(--ink-mute)", maxWidth: "62ch" }}>
        Versements Wave / Orange Money / MoMo / espèces déclarés par les payeurs.
        Vérifie le montant et la référence sur le relevé de l'opérateur avant de
        valider : la validation ouvre l'abonnement et émet la facture
        immédiatement.
      </p>

      {toast ? (
        <p
          role="status"
          style={{
            background: toast.kind === "success" ? "var(--accent)" : "var(--danger)",
            color: "white",
            padding: 10,
            borderRadius: 6,
          }}
        >
          {toast.message}
        </p>
      ) : null}

      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <button type="button" disabled={tab === "pending"} onClick={() => setTab("pending")}>
          En attente
        </button>
        <button type="button" disabled={tab === "traitees"} onClick={() => setTab("traitees")}>
          Traitées
        </button>
      </div>

      {tableQuery.isLoading ? <p>Chargement…</p> : null}
      {!tableQuery.isLoading && rows.length === 0 ? (
        <p>
          {tab === "pending"
            ? "Aucune demande en attente."
            : "Aucune demande traitée pour l'instant."}
        </p>
      ) : null}

      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((row) => {
          const alertes = alertesAvantValidation(row);
          const verdict = verdictMontant(row);
          return (
            <article
              key={row.id}
              style={{
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: 14,
                borderLeft:
                  alertes.length > 0 ? "4px solid var(--danger)" : "1px solid var(--line)",
              }}
            >
              <header style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>{row.spawters?.display_name ?? "Compte inconnu"}</strong>
                <span style={{ color: "var(--ink-mute)" }}>
                  {new Date(row.created_at).toLocaleString("fr-FR")}
                </span>
              </header>

              <p style={{ margin: "8px 0" }}>
                {PLAN_LABELS[row.plan]} · {METHOD_LABELS[row.method]} ·{" "}
                <strong>{formatXof(row.amount_declare)}</strong>{" "}
                <span
                  style={{
                    color: verdict === "trop_peu" ? "var(--danger)" : "var(--ink-mute)",
                  }}
                >
                  ({libelleVerdict(row)})
                </span>
              </p>
              <p style={{ margin: "4px 0", color: "var(--ink-mute)" }}>
                Tarif : {formatXof(expectedTtc(row.plan))} TTC · Référence :{" "}
                {row.reference?.trim() || "—"} · Émetteur : {row.payer_phone ?? "—"}
              </p>
              {row.note ? <p style={{ fontStyle: "italic" }}>« {row.note} »</p> : null}

              {alertes.length > 0 && row.status === "pending" ? (
                <ul style={{ color: "var(--danger)", margin: "8px 0", paddingLeft: 18 }}>
                  {alertes.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              ) : null}

              {row.status !== "pending" ? (
                <p>
                  <strong>{STATUS_LABELS[row.status]}</strong>
                  {row.decided_at ? ` le ${new Date(row.decided_at).toLocaleDateString("fr-FR")}` : ""}
                  {row.decision_reason ? ` — « ${row.decision_reason} »` : ""}
                </p>
              ) : (
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    disabled={!isAdmin || busyId === row.id}
                    onClick={() => onValiderClick(row)}
                  >
                    Valider le paiement
                  </button>
                  <button
                    type="button"
                    className="btn-destructive"
                    disabled={!isAdmin || busyId === row.id}
                    onClick={() => setRejecting(row)}
                  >
                    Refuser
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {confirming ? (
        <ReasonModal
          isOpen
          title="Valider malgré les alertes ?"
          confirmLabel="Valider quand même"
          destructive
          onCancel={() => setConfirming(null)}
          // Le motif est exigé ici volontairement : passer outre une alerte de
          // sous-paiement est une décision commerciale, elle doit rester dans
          // le journal d'audit avec sa raison.
          onConfirm={(motif) => void valider(confirming, motif)}
        />
      ) : null}

      {rejecting ? (
        <ReasonModal
          isOpen
          title="Refuser cette demande"
          confirmLabel="Refuser"
          destructive
          onCancel={() => setRejecting(null)}
          onConfirm={(motif) => void refuser(motif)}
        />
      ) : null}
    </div>
  );
};
