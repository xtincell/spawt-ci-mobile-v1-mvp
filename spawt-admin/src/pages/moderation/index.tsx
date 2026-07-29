// Story 6.4 — File de modération proactive (V1 — signalement spawter FR-017 reporté Sprint 2).
//
// CR Chunk B :
//   C1 — onDelete include deleted_by_staff_id (sinon CHECK constraint reject)
//   M9 — audit logAuditAction throw → try/catch + UI feedback inline
//   m11/m14 — remplace alert() par toast/banner + disable button on click

import { useState } from "react";
import { useNavigate } from "react-router";
import { useTable, useUpdate, useGetIdentity, useInvalidate } from "@refinedev/core";
import { ReasonModal, FAUX_PAS_REVIEW } from "../../components/ReasonModal";
import { logAuditAction, logAuditActionBestEffort, AuditLogError } from "../../lib/audit";
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
  /** FR-032 — avis d'amorçage. Doit se distinguer VISUELLEMENT d'un avis
   *  communauté : un modérateur qui supprime un avis fondateur sans le savoir
   *  fait retomber l'ADN du lieu en « en construction ». */
  is_seed: boolean;
  places?: { id: string; name: string; neighborhood: string };
  spawters?: { id: string; display_name: string; stade: string; is_banned: boolean; warning_count: number };
}

interface Toast {
  kind: "success" | "error";
  message: string;
}

interface StaffIdentity {
  id: string;
  role: "admin" | "moderator" | "operator";
}

export const ModerationList = () => {
  const navigate = useNavigate();
  const { data: identity } = useGetIdentity<StaffIdentity>();
  const [filter, setFilter] = useState<"recent" | "flagged">("recent");
  const [activeAction, setActiveAction] = useState<
    | { kind: "delete"; review: ReviewRow }
    | { kind: "warning"; review: ReviewRow }
    | null
  >(null);
  const [busyReviewId, setBusyReviewId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  // CR m14 — anti-flood : track les reviews déjà "gardées" dans cette session
  // pour disable le bouton et éviter l'audit log spam.
  const [keptReviewIds, setKeptReviewIds] = useState<Set<string>>(new Set());

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

  const { mutateAsync: updateReview } = useUpdate();
  const invalidate = useInvalidate();

  const rows = (tableQuery.data?.data ?? []) as ReviewRow[];
  const canModerate = identity?.role === "admin" || identity?.role === "moderator";

  function showToast(t: Toast) {
    setToast(t);
    setTimeout(() => setToast((current) => (current === t ? null : current)), 4000);
  }

  async function onKeep(review: ReviewRow) {
    if (keptReviewIds.has(review.id)) return;
    setBusyReviewId(review.id);
    try {
      await logAuditAction({
        action: "review_keep",
        entity_type: "spawt_checkin",
        entity_id: review.id,
      });
      setKeptReviewIds((prev) => new Set(prev).add(review.id));
      showToast({ kind: "success", message: "Avis marqué comme vu (audit log enregistré)." });
    } catch (err) {
      const msg = err instanceof AuditLogError ? err.message : "Erreur inattendue";
      showToast({ kind: "error", message: msg });
    } finally {
      setBusyReviewId(null);
    }
  }

  async function onDelete(review: ReviewRow, reason: string) {
    if (!identity) return;
    setBusyReviewId(review.id);
    try {
      // C1 — deleted_by_staff_id obligatoire (CHECK constraint coherence).
      // Le trigger 0023 auto-populate aussi côté DB en défense en profondeur,
      // mais on l'envoie explicitement pour cohérence client.
      await updateReview({
        resource: "spawt_checkin",
        id: review.id,
        values: {
          deleted_at: new Date().toISOString(),
          deleted_by_staff_id: identity.id,
          deleted_reason: reason,
        },
      });
      // M9 — audit doit succeed sinon on a delete sans trace (compliance).
      // Si audit échoue, on log warn server-side (best-effort) car le delete
      // est déjà committé en DB et impossible à rollback automatiquement.
      const ok = await logAuditActionBestEffort({
        action: "review_delete",
        entity_type: "spawt_checkin",
        entity_id: review.id,
        payload_before: { texte_avis: review.texte_avis, note_etoiles: review.note_etoiles, tags: review.tags },
        payload_after: { deleted_at: "now", deleted_by_staff_id: identity.id },
        reason,
      });
      invalidate({ resource: "spawt_checkin", invalidates: ["list"] });
      setActiveAction(null);
      showToast({
        kind: ok ? "success" : "error",
        message: ok
          ? "Avis supprimé + audit log enregistré."
          : "Avis supprimé MAIS audit log a échoué — vérifier admin_audit_log manuellement.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inattendue";
      showToast({ kind: "error", message: `Échec suppression : ${msg}` });
    } finally {
      setBusyReviewId(null);
    }
  }

  async function onWarning(review: ReviewRow, reason: string) {
    setBusyReviewId(review.id);
    try {
      const res = await moderateSpawter(review.spawter_id, "warning", reason);
      if (!res.ok) {
        showToast({ kind: "error", message: `Erreur warning : ${res.error?.code ?? "inconnue"}` });
        return;
      }
      // Best-effort sur l'audit review_warning : si fail, le spawter_warning
      // a déjà été audité par l'Edge Function moderate-spawter (double-audit
      // intentionnel pour traçer les deux entités review + spawter).
      await logAuditActionBestEffort({
        action: "review_warning",
        entity_type: "spawt_checkin",
        entity_id: review.id,
        payload_before: { texte_avis: review.texte_avis, note_etoiles: review.note_etoiles },
        reason,
      });
      invalidate({ resource: "spawt_checkin", invalidates: ["list"] });
      setActiveAction(null);
      showToast({ kind: "success", message: "Warning envoyé au spawter." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inattendue";
      showToast({ kind: "error", message: msg });
    } finally {
      setBusyReviewId(null);
    }
  }

  return (
    <div>
      <h1>Modération</h1>
      <p style={{ background: "var(--bg-warm)", padding: 12, borderRadius: 6 }}>
        ⓘ Modération <strong>proactive</strong> — avis récents et flagged anti-fraude.
        Les signalements envoyés par la Meute (bouton « Signaler » mobile, FR-017 livré)
        ont leur propre file : page <strong>Signalements</strong>.
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
          {rows.map((row) => {
            const isBusy = busyReviewId === row.id;
            const isKept = keptReviewIds.has(row.id);
            return (
              <tr key={row.id}>
                <td>{new Date(row.created_at).toLocaleString("fr-FR")}</td>
                <td>
                  <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/comptes/show/${row.spawter_id}`); }}>{row.spawters?.display_name}</a>
                  {/* FR-032 — la distinction visuelle exigée par le cahier. Le
                      nom du compte de service suffisait à deviner, mais deviner
                      n'est pas distinguer : supprimer un avis fondateur sans
                      le savoir fait retomber l'ADN du lieu. */}
                  {row.is_seed ? <span className="badge-seed" title="Avis d'amorçage — compte de service, exclu du compteur public">✨ fondateur</span> : null}
                </td>
                <td>{row.spawters?.stade}</td>
                <td>{row.places?.name} ({row.places?.neighborhood})</td>
                <td>{row.note_etoiles}/5</td>
                <td>{row.tags?.join(", ")}</td>
                <td style={{ maxWidth: 240 }}>{row.texte_avis}</td>
                <td>{row.flag_reason ?? "—"}</td>
                <td style={{ display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    disabled={!canModerate || isBusy || isKept}
                    onClick={() => onKeep(row)}
                  >
                    {isKept ? "✓ Gardé" : "Garder"}
                  </button>
                  <button
                    type="button"
                    disabled={!canModerate || isBusy}
                    onClick={() => setActiveAction({ kind: "delete", review: row })}
                  >
                    Supprimer
                  </button>
                  <button
                    type="button"
                    disabled={!canModerate || isBusy}
                    onClick={() => setActiveAction({ kind: "warning", review: row })}
                  >
                    Warning
                  </button>
                </td>
              </tr>
            );
          })}
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
