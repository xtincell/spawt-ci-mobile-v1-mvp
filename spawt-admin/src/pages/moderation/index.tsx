// Story 6.4 — File de modération proactive (V1 — signalement spawter FR-017 reporté Sprint 2).

import { useState } from "react";
import { useNavigate } from "react-router";
import { useTable, useUpdate, useGetIdentity, useInvalidate } from "@refinedev/core";
import { ReasonModal, FAUX_PAS_REVIEW } from "../../components/ReasonModal";
import { logAuditAction } from "../../lib/audit";
import { moderateSpawter } from "../../lib/moderate-spawter";

interface ReviewRow {
  id: string;
  spawter_id: string;
  place_id: string;
  note_etoiles: number;
  tags: string[];
  texte_avis: string | null;
  flag_reason: string | null;
  created_at: string;
  deleted_at: string | null;
  places?: { id: string; name: string; neighborhood: string };
  spawters?: { id: string; display_name: string; stade: string; is_banned: boolean; warning_count: number };
}

export const ModerationList = () => {
  const navigate = useNavigate();
  const { data: identity } = useGetIdentity<{ role: "admin" | "moderator" | "operator" }>();
  const [filter, setFilter] = useState<"recent" | "flagged">("recent");
  const [activeAction, setActiveAction] = useState<
    | { kind: "delete"; review: ReviewRow }
    | { kind: "warning"; review: ReviewRow }
    | null
  >(null);

  const { tableQuery } = useTable<ReviewRow>({
    resource: "spawt_checkin",
    pagination: { pageSize: 50 },
    sorters: { initial: [{ field: "created_at", order: "desc" }] },
    filters: {
      permanent: [
        { field: "note_etoiles", operator: "nnull", value: null },
        { field: "deleted_at", operator: "null", value: null },
        ...(filter === "flagged" ? [{ field: "flag_reason", operator: "nnull" as const, value: null }] : []),
      ],
    },
    meta: {
      select:
        "*, places!inner(id, name, neighborhood), spawters!inner(id, display_name, stade, is_banned, warning_count)",
    },
  });

  const { mutate: updateReview } = useUpdate();
  const invalidate = useInvalidate();

  const rows = (tableQuery.data?.data ?? []) as ReviewRow[];
  const canModerate = identity?.role === "admin" || identity?.role === "moderator";

  async function onKeep(review: ReviewRow) {
    await logAuditAction({
      action: "review_keep",
      entity_type: "spawt_checkin",
      entity_id: review.id,
    });
    alert("Avis marqué comme vu (audit log enregistré).");
  }

  async function onDelete(review: ReviewRow, reason: string) {
    updateReview(
      {
        resource: "spawt_checkin",
        id: review.id,
        values: {
          deleted_at: new Date().toISOString(),
          deleted_reason: reason,
        },
      },
      {
        onSuccess: async () => {
          await logAuditAction({
            action: "review_delete",
            entity_type: "spawt_checkin",
            entity_id: review.id,
            payload_before: { texte_avis: review.texte_avis, note_etoiles: review.note_etoiles },
            payload_after: { deleted_at: "now" },
            reason,
          });
          invalidate({ resource: "spawt_checkin", invalidates: ["list"] });
        },
      },
    );
    setActiveAction(null);
  }

  async function onWarning(review: ReviewRow, reason: string) {
    const res = await moderateSpawter(review.spawter_id, "warning", reason);
    if (!res.ok) {
      alert(`Erreur : ${res.error?.code ?? "inconnue"}`);
      return;
    }
    await logAuditAction({
      action: "review_warning",
      entity_type: "spawt_checkin",
      entity_id: review.id,
      reason,
    });
    invalidate({ resource: "spawt_checkin", invalidates: ["list"] });
    setActiveAction(null);
  }

  return (
    <div>
      <h1>Modération</h1>
      <p style={{ background: "var(--bg-warm)", padding: 12, borderRadius: 6 }}>
        ⓘ Modération <strong>proactive</strong> V1 — le bouton « Signaler » côté mobile (FR-017)
        arrive Sprint 2. Cette file affiche les avis récents et les avis flagged anti-fraude.
      </p>
      <div style={{ display: "flex", gap: 12, margin: "16px 0" }}>
        <button type="button" onClick={() => setFilter("recent")}>Avis récents</button>
        <button type="button" onClick={() => setFilter("flagged")}>Flagged anti-fraude</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Spawter</th>
            <th>Stade</th>
            <th>Lieu</th>
            <th>Note</th>
            <th>Tags</th>
            <th>Texte</th>
            <th>Flag</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{new Date(row.created_at).toLocaleString("fr-FR")}</td>
              <td><a href="#" onClick={(e) => { e.preventDefault(); navigate(`/comptes/show/${row.spawter_id}`); }}>{row.spawters?.display_name}</a></td>
              <td>{row.spawters?.stade}</td>
              <td>{row.places?.name} ({row.places?.neighborhood})</td>
              <td>{row.note_etoiles}/5</td>
              <td>{row.tags?.join(", ")}</td>
              <td style={{ maxWidth: 240 }}>{row.texte_avis}</td>
              <td>{row.flag_reason ?? "—"}</td>
              <td style={{ display: "flex", gap: 4 }}>
                <button type="button" disabled={!canModerate} onClick={() => onKeep(row)}>Garder</button>
                <button type="button" disabled={!canModerate} onClick={() => setActiveAction({ kind: "delete", review: row })}>Supprimer</button>
                <button type="button" disabled={!canModerate} onClick={() => setActiveAction({ kind: "warning", review: row })}>Warning</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {activeAction?.kind === "delete" ? (
        <ReasonModal
          isOpen
          title="Supprimer cet avis"
          confirmLabel="Supprimer"
          destructive
          fauxPasOptions={FAUX_PAS_REVIEW}
          onCancel={() => setActiveAction(null)}
          onConfirm={(r) => onDelete(activeAction.review, r)}
        />
      ) : null}
      {activeAction?.kind === "warning" ? (
        <ReasonModal
          isOpen
          title="Avertir le spawter"
          confirmLabel="Envoyer warning"
          fauxPasOptions={FAUX_PAS_REVIEW}
          onCancel={() => setActiveAction(null)}
          onConfirm={(r) => onWarning(activeAction.review, r)}
        />
      ) : null}
    </div>
  );
};
