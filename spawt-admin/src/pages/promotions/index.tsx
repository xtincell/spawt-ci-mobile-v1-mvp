// Console admin 07/2026 — Promotions de lieux (table place_promotions, 0050).
// CRUD par lieu + bandeau Contrat SPAWT permanent : une promotion est un
// affichage étiqueté, jamais un levier de note ou de matching. Audit promo_*.

import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabaseClient } from "../../utility/supabaseClient";
import { logAuditActionBestEffort } from "../../lib/audit";
import { usePlaces, placeLabel } from "../../lib/usePlaces";
import { ContratBanner } from "./ContratBanner";
import {
  EMPTY_PROMO_FORM,
  filterPromotions,
  isPromoActive,
  promoRowToForm,
  todayIsoDate,
  validatePromoForm,
  type PlacePromotionRow,
  type PromoFormValues,
  type PromoState,
} from "./logic";

const PROMO_COLUMNS =
  "id, place_id, label, description, starts_at, ends_at, is_published, created_at, updated_at, places(name)";

interface Toast {
  kind: "success" | "error";
  message: string;
}

export const PromotionsList = () => {
  const { places, error: placesError } = usePlaces();
  const [rows, setRows] = useState<PlacePromotionRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [placeFilter, setPlaceFilter] = useState<string>("all");
  const [state, setState] = useState<PromoState>("all");
  const [form, setForm] = useState<PromoFormValues>(EMPTY_PROMO_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabaseClient
      .from("place_promotions")
      .select(PROMO_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(error.message);
      return;
    }
    setLoadError(null);
    setRows((data ?? []) as unknown as PlacePromotionRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function showToast(t: Toast) {
    setToast(t);
    setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 4000);
  }

  function resetForm() {
    setForm(EMPTY_PROMO_FORM);
    setEditingId(null);
    setFormErrors([]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const validated = validatePromoForm(form);
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
          .from("place_promotions")
          .update(validated.row)
          .eq("id", editingId)
          .select("id");
        if (error) throw new Error(error.message);
        if ((data?.length ?? 0) === 0) throw new Error("Réservé aux admins");
        await logAuditActionBestEffort({
          action: "promo_update",
          entity_type: "place_promotion",
          entity_id: editingId,
          payload_before: before,
          payload_after: validated.row,
        });
        showToast({ kind: "success", message: "Promotion mise à jour." });
      } else {
        const { data, error } = await supabaseClient
          .from("place_promotions")
          .insert(validated.row)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        await logAuditActionBestEffort({
          action: "promo_create",
          entity_type: "place_promotion",
          entity_id: (data as { id: string }).id,
          payload_before: null,
          payload_after: validated.row,
        });
        showToast({ kind: "success", message: "Promotion créée." });
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

  async function onTogglePublish(row: PlacePromotionRow) {
    setBusy(true);
    try {
      const { data, error } = await supabaseClient
        .from("place_promotions")
        .update({ is_published: !row.is_published })
        .eq("id", row.id)
        .select("id");
      if (error) throw new Error(error.message);
      if ((data?.length ?? 0) === 0) throw new Error("Réservé aux admins");
      await logAuditActionBestEffort({
        action: "promo_update",
        entity_type: "place_promotion",
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

  async function onDelete(row: PlacePromotionRow) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Supprimer la promotion « ${row.label} » ? (irréversible)`)
    ) {
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabaseClient.from("place_promotions").delete().eq("id", row.id);
      if (error) throw new Error(error.message);
      await logAuditActionBestEffort({
        action: "promo_delete",
        entity_type: "place_promotion",
        entity_id: row.id,
        payload_before: { label: row.label, place_id: row.place_id },
        payload_after: null,
      });
      showToast({ kind: "success", message: "Promotion supprimée." });
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
        <h1>Promotions</h1>
        <p style={{ color: "var(--danger)" }}>Erreur : {loadError}</p>
        <button type="button" onClick={() => void load()}>Réessayer</button>
      </div>
    );
  }
  if (!rows) return <p>Chargement…</p>;

  const today = todayIsoDate();
  const visible = filterPromotions(rows, placeFilter, state, today);

  return (
    <div>
      <h1>Promotions</h1>
      <ContratBanner />
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
        <h2 style={{ margin: 0, fontSize: 16 }}>{editingId ? "Éditer la promotion" : "Nouvelle promotion"}</h2>
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
        <label>Libellé (le badge affiché)
          <input value={form.label} placeholder="-20% sur l'attiéké poisson" onChange={(e) => setForm({ ...form, label: e.target.value })} style={{ width: "100%" }} />
        </label>
        <label>Description
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ width: "100%" }} />
        </label>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label>Du (optionnel)
            <input type="date" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
          </label>
          <label>Au (optionnel)
            <input type="date" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
          </label>
        </div>
        <label>
          <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />{" "}
          Publiée (visible côté app pendant la fenêtre de dates)
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
        <select value={state} onChange={(e) => setState(e.target.value as PromoState)}>
          <option value="all">Toutes</option>
          <option value="active">Actives (publiées, fenêtre en cours)</option>
          <option value="inactive">Inactives (brouillon ou hors fenêtre)</option>
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th>Lieu</th>
            <th>Libellé</th>
            <th>Fenêtre</th>
            <th>État</th>
            <th>Publication</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.id}>
              <td>{row.places?.name ?? row.place_id.slice(0, 8)}</td>
              <td>{row.label}</td>
              <td>
                {row.starts_at || row.ends_at
                  ? `${row.starts_at ?? "…"} → ${row.ends_at ?? "…"}`
                  : "Sans bornes"}
              </td>
              <td>{isPromoActive(row, today) ? "Active" : "Inactive"}</td>
              <td>
                <button type="button" disabled={busy} onClick={() => void onTogglePublish(row)}>
                  {row.is_published ? "Publiée ✓ (dépublier)" : "Brouillon (publier)"}
                </button>
              </td>
              <td style={{ display: "flex", gap: 4 }}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEditingId(row.id);
                    setForm(promoRowToForm(row));
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
              <td colSpan={6} style={{ color: "var(--ink-mute)" }}>Aucune promotion pour ce filtre.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
};
