// Console admin 07/2026 — Événements de lieux (table place_events, 0049).
// CRUD par lieu : liste filtrable (lieu / à venir / passés), création avec
// datetime, bascule de publication. Chaque mutation est auditée (event_*).
// Query directe Supabase, même voie que fonctionnalites/index.tsx.

import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabaseClient } from "../../utility/supabaseClient";
import { logAuditActionBestEffort } from "../../lib/audit";
import { usePlaces, placeLabel } from "../../lib/usePlaces";
import {
  EMPTY_EVENT_FORM,
  eventRowToForm,
  filterEvents,
  isUpcoming,
  validateEventForm,
  type EventFormValues,
  type EventTense,
  type PlaceEventRow,
} from "./logic";

const EVENT_COLUMNS =
  "id, place_id, title, description, starts_at, ends_at, image_url, is_published, created_at, updated_at, places(name)";

interface Toast {
  kind: "success" | "error";
  message: string;
}

export const EvenementsList = () => {
  const { places, error: placesError } = usePlaces();
  const [rows, setRows] = useState<PlaceEventRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [placeFilter, setPlaceFilter] = useState<string>("all");
  const [tense, setTense] = useState<EventTense>("upcoming");
  const [form, setForm] = useState<EventFormValues>(EMPTY_EVENT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabaseClient
      .from("place_events")
      .select(EVENT_COLUMNS)
      .order("starts_at", { ascending: false });
    if (error) {
      setLoadError(error.message);
      return;
    }
    setLoadError(null);
    setRows((data ?? []) as unknown as PlaceEventRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function showToast(t: Toast) {
    setToast(t);
    setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 4000);
  }

  function resetForm() {
    setForm(EMPTY_EVENT_FORM);
    setEditingId(null);
    setFormErrors([]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const validated = validateEventForm(form);
    if (!validated.ok) {
      setFormErrors(validated.errors);
      return;
    }
    setFormErrors([]);
    setBusy(true);
    try {
      if (editingId) {
        const before = rows?.find((r) => r.id === editingId) ?? null;
        const { data, error } = await supabaseClient
          .from("place_events")
          .update(validated.row)
          .eq("id", editingId)
          .select("id");
        if (error) throw new Error(error.message);
        if ((data?.length ?? 0) === 0) throw new Error("Réservé aux admins");
        await logAuditActionBestEffort({
          action: "event_update",
          entity_type: "place_event",
          entity_id: editingId,
          payload_before: before,
          payload_after: validated.row,
        });
        showToast({ kind: "success", message: "Événement mis à jour." });
      } else {
        const { data, error } = await supabaseClient
          .from("place_events")
          .insert(validated.row)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        await logAuditActionBestEffort({
          action: "event_create",
          entity_type: "place_event",
          entity_id: (data as { id: string }).id,
          payload_before: null,
          payload_after: validated.row,
        });
        showToast({ kind: "success", message: "Événement créé." });
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

  /** Bascule publication — auditée en event_update (payload ciblé). */
  async function onTogglePublish(row: PlaceEventRow) {
    setBusy(true);
    try {
      const { data, error } = await supabaseClient
        .from("place_events")
        .update({ is_published: !row.is_published })
        .eq("id", row.id)
        .select("id");
      if (error) throw new Error(error.message);
      if ((data?.length ?? 0) === 0) throw new Error("Réservé aux admins");
      await logAuditActionBestEffort({
        action: "event_update",
        entity_type: "place_event",
        entity_id: row.id,
        payload_before: { is_published: row.is_published },
        payload_after: { is_published: !row.is_published },
      });
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

  async function onDelete(row: PlaceEventRow) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Supprimer l'événement « ${row.title} » ? (irréversible)`)
    ) {
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabaseClient.from("place_events").delete().eq("id", row.id);
      if (error) throw new Error(error.message);
      await logAuditActionBestEffort({
        action: "event_delete",
        entity_type: "place_event",
        entity_id: row.id,
        payload_before: { title: row.title, place_id: row.place_id, starts_at: row.starts_at },
        payload_after: null,
      });
      showToast({ kind: "success", message: "Événement supprimé." });
      if (editingId === row.id) resetForm();
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
        <h1>Événements</h1>
        <p style={{ color: "var(--danger)" }}>Erreur : {loadError}</p>
        <button type="button" onClick={() => void load()}>Réessayer</button>
      </div>
    );
  }
  if (!rows) return <p>Chargement…</p>;

  const visible = filterEvents(rows, placeFilter, tense);

  return (
    <div>
      <h1>Événements</h1>
      <p style={{ color: "var(--ink-mute)", fontSize: 12, maxWidth: 720 }}>
        Événements ponctuels des lieux (soirée, live, dégustation…). Côté app, la Meute ne voit
        que les événements <strong>publiés</strong> encore d&apos;actualité.
      </p>
      {placesError ? (
        <p style={{ color: "var(--danger)", fontSize: 12 }}>Lieux indisponibles : {placesError}</p>
      ) : null}
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
        <h2 style={{ margin: 0, fontSize: 16 }}>{editingId ? "Éditer l'événement" : "Nouvel événement"}</h2>
        {formErrors.length > 0 ? (
          <div style={{ background: "var(--bg-warm)", padding: 8, borderRadius: 6 }}>
            {formErrors.map((er) => (
              <div key={er} style={{ color: "var(--danger)", fontSize: 13 }}>• {er}</div>
            ))}
          </div>
        ) : null}
        <label>Lieu
          <select value={form.place_id} onChange={(e) => setForm({ ...form, place_id: e.target.value })} style={{ width: "100%" }}>
            <option value="">— choisir un lieu —</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>{placeLabel(p)}</option>
            ))}
          </select>
        </label>
        <label>Titre
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ width: "100%" }} />
        </label>
        <label>Description
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ width: "100%" }} />
        </label>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label>Début
            <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
          </label>
          <label>Fin (optionnelle)
            <input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
          </label>
        </div>
        <label>Image (URL)
          <input value={form.image_url} placeholder="https://…" onChange={(e) => setForm({ ...form, image_url: e.target.value })} style={{ width: "100%" }} />
        </label>
        <label>
          <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />{" "}
          Publié (visible côté app)
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="btn-primary" disabled={busy}>
            {editingId ? "Enregistrer" : "Créer"}
          </button>
          {editingId ? (
            <button type="button" onClick={resetForm}>Annuler l&apos;édition</button>
          ) : null}
        </div>
      </form>

      {/* ── Filtres ── */}
      <div style={{ display: "flex", gap: 12, margin: "16px 0", flexWrap: "wrap" }}>
        <select value={placeFilter} onChange={(e) => setPlaceFilter(e.target.value)}>
          <option value="all">Tous les lieux</option>
          {places.map((p) => (
            <option key={p.id} value={p.id}>{placeLabel(p)}</option>
          ))}
        </select>
        <select value={tense} onChange={(e) => setTense(e.target.value as EventTense)}>
          <option value="upcoming">À venir / en cours</option>
          <option value="past">Passés</option>
          <option value="all">Tous</option>
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th>Lieu</th>
            <th>Titre</th>
            <th>Début</th>
            <th>Fin</th>
            <th>Statut</th>
            <th>Publication</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.id}>
              <td>{row.places?.name ?? row.place_id.slice(0, 8)}</td>
              <td>{row.title}</td>
              <td>{new Date(row.starts_at).toLocaleString("fr-FR")}</td>
              <td>{row.ends_at ? new Date(row.ends_at).toLocaleString("fr-FR") : "—"}</td>
              <td>{isUpcoming(row) ? "À venir / en cours" : "Passé"}</td>
              <td>
                <button type="button" disabled={busy} onClick={() => void onTogglePublish(row)}>
                  {row.is_published ? "Publié ✓ (dépublier)" : "Brouillon (publier)"}
                </button>
              </td>
              <td style={{ display: "flex", gap: 4 }}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEditingId(row.id);
                    setForm(eventRowToForm(row));
                    setFormErrors([]);
                  }}
                >
                  Éditer
                </button>
                <button type="button" disabled={busy} onClick={() => void onDelete(row)}>
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
          {visible.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ color: "var(--ink-mute)" }}>Aucun événement pour ce filtre.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
};
