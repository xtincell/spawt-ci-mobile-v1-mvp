// Console admin 07/2026 — Défis de la Meute (tables challenges +
// challenge_progress, 0040). CRUD + cycle draft → active → done + jauge
// collective. Audit challenge_* (0047). Défis COLLECTIFS uniquement :
// une jauge pour toute la Meute, jamais de détail individuel (Contrat SPAWT).

import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabaseClient } from "../../utility/supabaseClient";
import { logAuditActionBestEffort } from "../../lib/audit";
import {
  CHALLENGE_STATUSES,
  EMPTY_CHALLENGE_FORM,
  GOAL_TYPES,
  GOAL_TYPE_LABELS,
  STATUS_LABELS,
  challengeRowToForm,
  goalTypeLabel,
  nextStatuses,
  progressOf,
  progressPercent,
  validateChallengeForm,
  type ChallengeFormValues,
  type ChallengeRow,
  type ChallengeStatus,
} from "./logic";

const CHALLENGE_COLUMNS =
  "id, code, title_key, description_key, period_start, period_end, goal_type, goal_target, reward_paws, status, created_at, challenge_progress(current_value, updated_at)";

interface Toast {
  kind: "success" | "error";
  message: string;
}

export const DefisList = () => {
  const [rows, setRows] = useState<ChallengeRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | ChallengeStatus>("all");
  const [form, setForm] = useState<ChallengeFormValues>(EMPTY_CHALLENGE_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabaseClient
      .from("challenges")
      .select(CHALLENGE_COLUMNS)
      .order("period_start", { ascending: false });
    if (error) {
      setLoadError(error.message);
      return;
    }
    setLoadError(null);
    setRows((data ?? []) as unknown as ChallengeRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function showToast(t: Toast) {
    setToast(t);
    setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 4000);
  }

  function resetForm() {
    setForm(EMPTY_CHALLENGE_FORM);
    setEditingId(null);
    setFormErrors([]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const validated = validateChallengeForm(form);
    if (!validated.ok) {
      setFormErrors(validated.errors);
      return;
    }
    setFormErrors([]);
    setBusy(true);
    try {
      if (editingId) {
        const before = rows?.find((r) => r.id === editingId) ?? null;
        // Le statut ne se change PAS ici (boutons de transition dédiés).
        const { data, error } = await supabaseClient
          .from("challenges")
          .update(validated.row)
          .eq("id", editingId)
          .select("id");
        if (error) throw new Error(error.message);
        if ((data?.length ?? 0) === 0) throw new Error("Réservé aux admins");
        await logAuditActionBestEffort({
          action: "challenge_update",
          entity_type: "challenge",
          entity_id: editingId,
          payload_before: before,
          payload_after: validated.row,
        });
        showToast({ kind: "success", message: "Défi mis à jour." });
      } else {
        const { data, error } = await supabaseClient
          .from("challenges")
          .insert({ ...validated.row, status: "draft" })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        await logAuditActionBestEffort({
          action: "challenge_create",
          entity_type: "challenge",
          entity_id: (data as { id: string }).id,
          payload_before: null,
          payload_after: { ...validated.row, status: "draft" },
        });
        showToast({ kind: "success", message: "Défi créé (brouillon)." });
      }
      resetForm();
      await load();
    } catch (err) {
      showToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Erreur inattendue",
      });
    } finally {
      setBusy(false);
    }
  }

  /** Transition de statut one-way (draft → active → done), auditée. */
  async function onTransition(row: ChallengeRow, to: ChallengeStatus) {
    if (
      to === "done" &&
      typeof window !== "undefined" &&
      !window.confirm(
        `Clore le défi « ${row.title_key} » ? La distribution des ${row.reward_paws} Paws ` +
          "aux participants part côté serveur au passage en done.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabaseClient
        .from("challenges")
        .update({ status: to })
        .eq("id", row.id)
        .select("id");
      if (error) throw new Error(error.message);
      if ((data?.length ?? 0) === 0) throw new Error("Réservé aux admins");
      await logAuditActionBestEffort({
        action: "challenge_update",
        entity_type: "challenge",
        entity_id: row.id,
        payload_before: { status: row.status },
        payload_after: { status: to },
      });
      showToast({ kind: "success", message: `Défi passé en « ${STATUS_LABELS[to]} ».` });
      await load();
    } catch (err) {
      showToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Erreur inattendue",
      });
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div>
        <h1>Défis de la Meute</h1>
        <p style={{ color: "var(--danger)" }}>Erreur : {loadError}</p>
        <button type="button" onClick={() => void load()}>Réessayer</button>
      </div>
    );
  }
  if (!rows) return <p>Chargement…</p>;

  const visible = statusFilter === "all" ? rows : rows.filter((r) => r.status === statusFilter);

  return (
    <div>
      <h1>Défis de la Meute</h1>
      <p style={{ background: "var(--bg-warm)", padding: 12, borderRadius: 6, maxWidth: 720, fontSize: 13 }}>
        ⓘ Défis <strong>collectifs</strong> : une seule jauge pour toute la Meute, jamais de
        détail par spawter (Contrat SPAWT). Les textes saisis ici sont stockés tels quels et
        affichés en français dans l&apos;app (convention title_key/description_key — si la valeur
        correspond à une clé i18n de l&apos;app, c&apos;est la traduction qui gagne).
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

      {/* ── Formulaire création / édition ── */}
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 8, maxWidth: 560, margin: "16px 0", background: "var(--bg-card)", padding: 16, borderRadius: 8, border: "1px solid var(--line)" }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>{editingId ? "Éditer le défi" : "Nouveau défi (brouillon)"}</h2>
        {formErrors.length > 0 ? (
          <div style={{ background: "var(--bg-warm)", padding: 8, borderRadius: 6 }}>
            {formErrors.map((er) => (
              <div key={er} style={{ color: "var(--danger)", fontSize: 13 }}>• {er}</div>
            ))}
          </div>
        ) : null}
        <label>Code (identifiant unique, ex. defi_aout_2026)
          <input value={form.code} disabled={!!editingId} onChange={(e) => setForm({ ...form, code: e.target.value })} style={{ width: "100%" }} />
        </label>
        <label>Titre (français, affiché dans l&apos;app)
          <input value={form.title} placeholder="Ensemble : 500 spawts ce mois" onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ width: "100%" }} />
        </label>
        <label>Description (français)
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ width: "100%" }} />
        </label>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label>Début de période
            <input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} />
          </label>
          <label>Fin de période
            <input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label>Type d&apos;objectif
            <select value={form.goal_type} onChange={(e) => setForm({ ...form, goal_type: e.target.value as ChallengeFormValues["goal_type"] })}>
              {GOAL_TYPES.map((g) => (
                <option key={g} value={g}>{GOAL_TYPE_LABELS[g]}</option>
              ))}
            </select>
          </label>
          <label>Objectif commun
            <input type="number" min={1} value={form.goal_target} onChange={(e) => setForm({ ...form, goal_target: e.target.value })} style={{ width: 100 }} />
          </label>
          <label>Paws (récompense par participant)
            <input type="number" min={0} value={form.reward_paws} onChange={(e) => setForm({ ...form, reward_paws: e.target.value })} style={{ width: 100 }} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="btn-primary" disabled={busy}>
            {editingId ? "Enregistrer" : "Créer"}
          </button>
          {editingId ? (
            <button type="button" onClick={resetForm}>Annuler l&apos;édition</button>
          ) : null}
        </div>
      </form>

      {/* ── Filtre statut ── */}
      <div style={{ display: "flex", gap: 12, margin: "16px 0" }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="all">Tous statuts</option>
          {CHALLENGE_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Titre</th>
            <th>Période</th>
            <th>Objectif</th>
            <th>Jauge collective</th>
            <th>Paws</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const current = progressOf(row);
            const pct = progressPercent(current, row.goal_target);
            return (
              <tr key={row.id}>
                <td style={{ fontFamily: "monospace", fontSize: 12 }}>{row.code}</td>
                <td>{row.title_key}</td>
                <td>{row.period_start} → {row.period_end}</td>
                <td>{goalTypeLabel(row.goal_type)} : {row.goal_target}</td>
                <td style={{ minWidth: 160 }}>
                  <div
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Progression ${row.code}`}
                    style={{ background: "var(--line)", borderRadius: 4, height: 12, overflow: "hidden" }}
                  >
                    <div style={{ width: `${pct}%`, height: "100%", background: "var(--gold)" }} />
                  </div>
                  <span style={{ fontSize: 12 }}>{current} / {row.goal_target} ({pct}%)</span>
                </td>
                <td>{row.reward_paws}</td>
                <td>{STATUS_LABELS[row.status] ?? row.status}</td>
                <td style={{ display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditingId(row.id);
                      setForm(challengeRowToForm(row));
                      setFormErrors([]);
                    }}
                  >
                    Éditer
                  </button>
                  {nextStatuses(row.status).map((to) => (
                    <button key={to} type="button" disabled={busy} onClick={() => void onTransition(row, to)}>
                      {to === "active" ? "Activer" : "Clore"}
                    </button>
                  ))}
                </td>
              </tr>
            );
          })}
          {visible.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ color: "var(--ink-mute)" }}>Aucun défi pour ce filtre.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
};
