// Câblage MVP — File des signalements d'avis (Feature 17, migration 0026).
// Les signalements créés par le bouton « Signaler » côté mobile arrivent ici.
// Workflow PRD : signalement → file d'attente → décision humaine
// (garder l'avis / supprimer l'avis / avertir l'auteur).
//
// Patterns repris de pages/moderation (C1 deleted_by_staff_id explicite,
// M9 audit best-effort post-mutation, m11/m14 toast + disable on busy).

import { useState } from "react";
import { useTable, useUpdate, useGetIdentity, useInvalidate } from "@refinedev/core";
import { ReasonModal, FAUX_PAS_REVIEW } from "../../components/ReasonModal";
import { logAuditActionBestEffort } from "../../lib/audit";
import { moderateSpawter } from "../../lib/moderate-spawter";
import { reasonLabel, buildResolutionPayload, type ResolutionAction } from "./logic";

interface ReportRow {
  id: string;
  spawt_checkin_id: string;
  reporter_spawter_id: string;
  reason_code: string;
  commentaire: string | null;
  status: "pending" | "resolved";
  resolution_action: ResolutionAction | null;
  created_at: string;
  resolved_at: string | null;
  spawt_checkin?: {
    id: string;
    spawter_id: string;
    place_id: string;
    note_etoiles: number | null;
    texte_avis: string | null;
    deleted_at: string | null;
    /** FR-032 — avis d'amorçage, à distinguer visuellement d'un avis
     *  communauté (cf. page Modération). */
    is_seed?: boolean;
    places?: { name: string; neighborhood: string };
    spawters?: { display_name: string };
  };
  reporter?: { display_name: string };
}

interface Toast {
  kind: "success" | "error";
  message: string;
}

interface StaffIdentity {
  id: string;
  role: "admin" | "moderator" | "operator";
}

const SELECT_WITH_JOINS =
  "*, spawt_checkin!review_reports_spawt_checkin_id_fkey(id, spawter_id, place_id, note_etoiles, texte_avis, deleted_at, is_seed, places(name, neighborhood), spawters(display_name)), reporter:spawters!review_reports_reporter_spawter_id_fkey(display_name)";

export const SignalementsList = () => {
  const { data: identity } = useGetIdentity<StaffIdentity>();
  const [tab, setTab] = useState<"pending" | "resolved">("pending");
  const [activeAction, setActiveAction] = useState<
    | { kind: "remove"; report: ReportRow }
    | { kind: "warn"; report: ReportRow }
    | null
  >(null);
  const [busyReportId, setBusyReportId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const { tableQuery } = useTable<ReportRow>({
    resource: "review_reports",
    pagination: { pageSize: 50 },
    sorters: { initial: [{ field: "created_at", order: "desc" }] },
    filters: {
      permanent: [{ field: "status", operator: "eq", value: tab }],
    },
    meta: { select: SELECT_WITH_JOINS },
  });

  const { mutateAsync: update } = useUpdate();
  const invalidate = useInvalidate();

  const rows = (tableQuery.data?.data ?? []) as ReportRow[];
  const canModerate = identity?.role === "admin" || identity?.role === "moderator";

  function showToast(t: Toast) {
    setToast(t);
    setTimeout(() => setToast((current) => (current === t ? null : current)), 4000);
  }

  function refresh() {
    invalidate({ resource: "review_reports", invalidates: ["list"] });
  }

  async function resolveReport(report: ReportRow, action: ResolutionAction) {
    await update({
      resource: "review_reports",
      id: report.id,
      values: buildResolutionPayload(action, identity?.id ?? null),
    });
    await logAuditActionBestEffort({
      action: `report_${action}`,
      entity_type: "review_reports",
      entity_id: report.id,
      payload_before: { reason_code: report.reason_code, spawt_checkin_id: report.spawt_checkin_id },
      payload_after: { status: "resolved", resolution_action: action },
    });
  }

  /** Garder l'avis — le signalement est classé sans suite. */
  async function onKeep(report: ReportRow) {
    setBusyReportId(report.id);
    try {
      await resolveReport(report, "kept");
      refresh();
      showToast({ kind: "success", message: "Signalement classé — avis conservé." });
    } catch (err) {
      showToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Erreur inattendue",
      });
    } finally {
      setBusyReportId(null);
    }
  }

  /** Supprimer l'avis (soft-delete pattern moderation C1) puis résoudre. */
  async function onRemove(report: ReportRow, reason: string) {
    if (!identity) return;
    setBusyReportId(report.id);
    try {
      await update({
        resource: "spawt_checkin",
        id: report.spawt_checkin_id,
        values: {
          deleted_at: new Date().toISOString(),
          deleted_by_staff_id: identity.id,
          deleted_reason: reason,
        },
      });
      await resolveReport(report, "removed");
      refresh();
      setActiveAction(null);
      showToast({ kind: "success", message: "Avis supprimé + signalement résolu." });
    } catch (err) {
      showToast({
        kind: "error",
        message: `Échec suppression : ${err instanceof Error ? err.message : "inattendue"}`,
      });
    } finally {
      setBusyReportId(null);
    }
  }

  /** Avertir l'AUTEUR de l'avis signalé (Edge Function moderate-spawter). */
  async function onWarn(report: ReportRow, reason: string) {
    const authorId = report.spawt_checkin?.spawter_id;
    if (!authorId) {
      showToast({ kind: "error", message: "Auteur de l'avis introuvable." });
      return;
    }
    setBusyReportId(report.id);
    try {
      const res = await moderateSpawter(authorId, "warning", reason);
      if (!res.ok) {
        showToast({ kind: "error", message: `Erreur warning : ${res.error?.code ?? "inconnue"}` });
        return;
      }
      await resolveReport(report, "warned");
      refresh();
      setActiveAction(null);
      showToast({ kind: "success", message: "Warning envoyé + signalement résolu." });
    } catch (err) {
      showToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Erreur inattendue",
      });
    } finally {
      setBusyReportId(null);
    }
  }

  return (
    <div>
      <h1>Signalements</h1>
      <p style={{ background: "var(--bg-warm)", padding: 12, borderRadius: 6 }}>
        ⓘ File des signalements envoyés par la Meute via le bouton « Signaler »
        de l&apos;app (Feature 17). Trois issues possibles : garder l&apos;avis, le
        supprimer, ou avertir son auteur.
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
        <button type="button" onClick={() => setTab("pending")}>
          En attente
        </button>
        <button type="button" onClick={() => setTab("resolved")}>
          Résolus
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Motif</th>
            <th>Signalé par</th>
            <th>Avis (auteur)</th>
            <th>Lieu</th>
            <th>Note</th>
            <th>Texte de l&apos;avis</th>
            {tab === "pending" ? <th>Actions</th> : <th>Issue</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isBusy = busyReportId === row.id;
            const checkin = row.spawt_checkin;
            const alreadyDeleted = checkin?.deleted_at != null;
            return (
              <tr key={row.id}>
                <td>{new Date(row.created_at).toLocaleString("fr-FR")}</td>
                <td>{reasonLabel(row.reason_code)}</td>
                <td>{row.reporter?.display_name ?? "—"}</td>
                <td>
                  {checkin?.spawters?.display_name ?? "—"}
                  {checkin?.is_seed ? <span className="badge-seed" title="Avis d'amorçage — compte de service, exclu du compteur public">✨ fondateur</span> : null}
                </td>
                <td>
                  {checkin?.places
                    ? `${checkin.places.name} (${checkin.places.neighborhood})`
                    : "—"}
                </td>
                <td>{checkin?.note_etoiles != null ? `${checkin.note_etoiles}/5` : "—"}</td>
                <td style={{ maxWidth: 240 }}>
                  {alreadyDeleted ? <em>(avis déjà supprimé)</em> : checkin?.texte_avis}
                </td>
                {tab === "pending" ? (
                  <td style={{ display: "flex", gap: 4 }}>
                    <button
                      type="button"
                      disabled={!canModerate || isBusy}
                      onClick={() => onKeep(row)}
                    >
                      Garder
                    </button>
                    <button
                      type="button"
                      disabled={!canModerate || isBusy || alreadyDeleted}
                      onClick={() => setActiveAction({ kind: "remove", report: row })}
                    >
                      Supprimer l&apos;avis
                    </button>
                    <button
                      type="button"
                      disabled={!canModerate || isBusy}
                      onClick={() => setActiveAction({ kind: "warn", report: row })}
                    >
                      Avertir l&apos;auteur
                    </button>
                  </td>
                ) : (
                  <td>{row.resolution_action ? reasonResolutionLabel(row.resolution_action) : "—"}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {activeAction?.kind === "remove" ? (
        <ReasonModal
          isOpen
          title="Supprimer l'avis signalé"
          confirmLabel="Supprimer"
          destructive
          fauxPasOptions={FAUX_PAS_REVIEW}
          onCancel={() => setActiveAction(null)}
          onConfirm={(r) => onRemove(activeAction.report, r)}
        />
      ) : null}
      {activeAction?.kind === "warn" ? (
        <ReasonModal
          isOpen
          title="Avertir l'auteur de l'avis"
          confirmLabel="Envoyer warning"
          fauxPasOptions={FAUX_PAS_REVIEW}
          onCancel={() => setActiveAction(null)}
          onConfirm={(r) => onWarn(activeAction.report, r)}
        />
      ) : null}
    </div>
  );
};

function reasonResolutionLabel(action: ResolutionAction): string {
  switch (action) {
    case "kept":
      return "Avis conservé";
    case "removed":
      return "Avis supprimé";
    case "warned":
      return "Auteur averti";
  }
}
