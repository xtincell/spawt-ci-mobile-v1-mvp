// Console admin 07/2026 — File des suggestions de lieux (place_suggestions,
// 0039). La Meute propose, l'humain décide : approuver ouvre le formulaire de
// création de lieu pré-rempli (l'approbation se finalise à la création —
// created_place_id + status approved, audit suggestion_approve dans
// PlaceForm) ; rejeter demande un motif (audit suggestion_reject ici).

import { useState } from "react";
import { useNavigate } from "react-router";
import { useTable, useUpdate, useInvalidate } from "@refinedev/core";
import { ReasonModal } from "../../components/ReasonModal";
import { logAuditActionBestEffort } from "../../lib/audit";
import { ABIDJAN_NEIGHBORHOODS } from "../../components/PlaceForm";
import {
  STATUS_LABELS,
  buildRejectionPayload,
  suggestionToPrefill,
  type SuggestionApprovalState,
  type SuggestionRow,
} from "./logic";

const SELECT_WITH_JOINS = "*, spawters(display_name)";

interface Toast {
  kind: "success" | "error";
  message: string;
}

export const SuggestionsList = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"pending" | "traitees">("pending");
  const [rejecting, setRejecting] = useState<SuggestionRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const { tableQuery } = useTable<SuggestionRow>({
    resource: "place_suggestions",
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

  const { mutateAsync: update } = useUpdate();
  const invalidate = useInvalidate();

  const rows = (tableQuery.data?.data ?? []) as SuggestionRow[];

  function showToast(t: Toast) {
    setToast(t);
    setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 4000);
  }

  /** Approuver = ouvrir la création de lieu pré-remplie ; la suggestion sera
   *  liée (approved + created_place_id) à la création effective. */
  function onApprove(row: SuggestionRow) {
    const state: SuggestionApprovalState = {
      suggestionId: row.id,
      prefill: suggestionToPrefill(row, ABIDJAN_NEIGHBORHOODS),
    };
    navigate("/lieux/create", { state });
  }

  async function onReject(row: SuggestionRow, reason: string) {
    setBusyId(row.id);
    try {
      await update({
        resource: "place_suggestions",
        id: row.id,
        values: buildRejectionPayload(reason),
      });
      await logAuditActionBestEffort({
        action: "suggestion_reject",
        entity_type: "place_suggestion",
        entity_id: row.id,
        payload_before: { status: row.status, name: row.name },
        payload_after: { status: "rejected" },
        reason,
      });
      setRejecting(null);
      invalidate({ resource: "place_suggestions", invalidates: ["list"] });
      showToast({ kind: "success", message: "Suggestion refusée (motif enregistré)." });
    } catch (err) {
      showToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Erreur inattendue",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1>Suggestions de lieux</h1>
      <p style={{ background: "var(--bg-warm)", padding: 12, borderRadius: 6, maxWidth: 720, fontSize: 13 }}>
        ⓘ Les spots proposés par la Meute depuis l&apos;app. Approuver ouvre la création de
        lieu pré-remplie ; la suggestion passe en « approuvée » quand la fiche est créée.
      </p>
      {toast ? (
        <div
          role="status"
          style={{
            margin: "12px 0",
            padding: 10,
            borderRadius: 6,
            background: toast.kind === "success" ? "#1c3a1c" : "#3a1c1c",
            color: "#fff",
          }}
        >
          {toast.message}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 12, margin: "16px 0" }}>
        <button type="button" onClick={() => setTab("pending")}>En attente</button>
        <button type="button" onClick={() => setTab("traitees")}>Traitées</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Proposé par</th>
            <th>Nom du spot</th>
            <th>Commune / quartier</th>
            <th>GPS</th>
            <th>Photos</th>
            <th>Description</th>
            {tab === "pending" ? <th>Actions</th> : <th>Issue</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isBusy = busyId === row.id;
            return (
              <tr key={row.id}>
                <td>{new Date(row.created_at).toLocaleDateString("fr-FR")}</td>
                <td>{row.spawters?.display_name ?? "—"}</td>
                <td>{row.name}</td>
                <td>{[row.commune, row.neighborhood].filter(Boolean).join(" / ") || "—"}</td>
                <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                  {typeof row.lat === "number" && typeof row.lng === "number"
                    ? `${row.lat.toFixed(5)}, ${row.lng.toFixed(5)}`
                    : "—"}
                </td>
                <td>
                  {(row.photo_urls ?? []).length > 0
                    ? row.photo_urls.map((url, i) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer" style={{ marginRight: 6 }}>
                          photo {i + 1}
                        </a>
                      ))
                    : "—"}
                </td>
                <td style={{ maxWidth: 240 }}>{row.description ?? "—"}</td>
                {tab === "pending" ? (
                  <td style={{ display: "flex", gap: 4 }}>
                    <button type="button" className="btn-primary" disabled={isBusy} onClick={() => onApprove(row)}>
                      Approuver
                    </button>
                    <button type="button" disabled={isBusy} onClick={() => setRejecting(row)}>
                      Refuser
                    </button>
                  </td>
                ) : (
                  <td>
                    {STATUS_LABELS[row.status]}
                    {row.status === "rejected" && row.rejection_reason ? (
                      <span style={{ display: "block", fontSize: 12, color: "var(--ink-mute)" }}>
                        {row.rejection_reason}
                      </span>
                    ) : null}
                  </td>
                )}
              </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ color: "var(--ink-mute)" }}>
                {tab === "pending" ? "Aucune suggestion en attente." : "Aucune suggestion traitée."}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {rejecting ? (
        <ReasonModal
          isOpen
          title={`Refuser la suggestion « ${rejecting.name} »`}
          confirmLabel="Refuser"
          onCancel={() => setRejecting(null)}
          onConfirm={(reason) => onReject(rejecting, reason)}
        />
      ) : null}
    </div>
  );
};
