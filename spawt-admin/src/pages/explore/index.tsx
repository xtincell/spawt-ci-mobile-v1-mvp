// Console admin 07/2026 — Curation du Mode Explore (explore_collections +
// explore_items, 0045). Créer une collection (slug/titre/sous-titre/cover),
// y ordonner des lieux avec un mot éditorial, publier/dépublier.
// Audit explore_* (0047 + 0049) : create/update/delete + publish/unpublish.

import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabaseClient } from "../../utility/supabaseClient";
import { logAuditActionBestEffort } from "../../lib/audit";
import { usePlaces, placeLabel } from "../../lib/usePlaces";
import {
  EDITORIAL_MAX,
  EMPTY_COLLECTION_FORM,
  changedSortOrders,
  collectionRowToForm,
  moveItem,
  nextSortOrder,
  validateCollectionForm,
  validateEditorialText,
  type CollectionFormValues,
  type ExploreCollectionRow,
  type ExploreItemRow,
} from "./logic";

const COLLECTION_COLUMNS =
  "id, slug, title_key, subtitle_key, cover_url, sort_order, is_published, city_code, created_at, updated_at";
const ITEM_COLUMNS =
  "id, collection_id, place_id, editorial_text, sort_order, places(name, neighborhood)";

interface Toast {
  kind: "success" | "error";
  message: string;
}

export const ExploreCuration = () => {
  const { places, error: placesError } = usePlaces();
  const [collections, setCollections] = useState<ExploreCollectionRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<ExploreItemRow[]>([]);
  const [form, setForm] = useState<CollectionFormValues>(EMPTY_COLLECTION_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [newItemPlaceId, setNewItemPlaceId] = useState("");
  const [newItemText, setNewItemText] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const loadCollections = useCallback(async () => {
    const { data, error } = await supabaseClient
      .from("explore_collections")
      .select(COLLECTION_COLUMNS)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error) {
      setLoadError(error.message);
      return;
    }
    setLoadError(null);
    setCollections((data ?? []) as ExploreCollectionRow[]);
  }, []);

  const loadItems = useCallback(async (collectionId: string) => {
    const { data, error } = await supabaseClient
      .from("explore_items")
      .select(ITEM_COLUMNS)
      .eq("collection_id", collectionId)
      .order("sort_order", { ascending: true });
    if (error) {
      setToast({ kind: "error", message: `Lecture des lieux du carnet impossible : ${error.message}` });
      return;
    }
    setItems((data ?? []) as unknown as ExploreItemRow[]);
  }, []);

  useEffect(() => {
    void loadCollections();
  }, [loadCollections]);

  useEffect(() => {
    if (selectedId) void loadItems(selectedId);
    else setItems([]);
  }, [selectedId, loadItems]);

  function showToast(t: Toast) {
    setToast(t);
    setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 4000);
  }

  function resetForm() {
    setForm(EMPTY_COLLECTION_FORM);
    setEditingId(null);
    setFormErrors([]);
  }

  // ── Collections ──────────────────────────────────────────────────────────

  async function onSubmitCollection(e: FormEvent) {
    e.preventDefault();
    const validated = validateCollectionForm(form);
    if (!validated.ok) {
      setFormErrors(validated.errors);
      return;
    }
    setFormErrors([]);
    setBusy(true);
    try {
      if (editingId) {
        const before = collections?.find((c) => c.id === editingId) ?? null;
        const { data, error } = await supabaseClient
          .from("explore_collections")
          .update(validated.row)
          .eq("id", editingId)
          .select("id");
        if (error) throw new Error(error.message);
        if ((data?.length ?? 0) === 0) throw new Error("Réservé aux admins");
        await logAuditActionBestEffort({
          action: "explore_update",
          entity_type: "explore_collection",
          entity_id: editingId,
          payload_before: before,
          payload_after: validated.row,
        });
        showToast({ kind: "success", message: "Carnet mis à jour." });
      } else {
        const { data, error } = await supabaseClient
          .from("explore_collections")
          .insert(validated.row)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        await logAuditActionBestEffort({
          action: "explore_create",
          entity_type: "explore_collection",
          entity_id: (data as { id: string }).id,
          payload_before: null,
          payload_after: validated.row,
        });
        showToast({ kind: "success", message: "Carnet créé (brouillon)." });
      }
      resetForm();
      await loadCollections();
    } catch (err) {
      showToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Erreur inattendue",
      });
    } finally {
      setBusy(false);
    }
  }

  /** Publication — audit dédié explore_publish / explore_unpublish (0047). */
  async function onTogglePublish(row: ExploreCollectionRow) {
    setBusy(true);
    try {
      const { data, error } = await supabaseClient
        .from("explore_collections")
        .update({ is_published: !row.is_published })
        .eq("id", row.id)
        .select("id");
      if (error) throw new Error(error.message);
      if ((data?.length ?? 0) === 0) throw new Error("Réservé aux admins");
      await logAuditActionBestEffort({
        action: row.is_published ? "explore_unpublish" : "explore_publish",
        entity_type: "explore_collection",
        entity_id: row.id,
        payload_before: { is_published: row.is_published },
        payload_after: { is_published: !row.is_published },
      });
      showToast({
        kind: "success",
        message: row.is_published ? "Carnet dépublié." : "Carnet publié — visible dans l'app.",
      });
      await loadCollections();
    } catch (err) {
      showToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Erreur inattendue",
      });
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteCollection(row: ExploreCollectionRow) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Supprimer le carnet « ${row.title_key} » et tous ses lieux ? (irréversible)`)
    ) {
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabaseClient
        .from("explore_collections")
        .delete()
        .eq("id", row.id);
      if (error) throw new Error(error.message);
      await logAuditActionBestEffort({
        action: "explore_delete",
        entity_type: "explore_collection",
        entity_id: row.id,
        payload_before: { slug: row.slug, title_key: row.title_key },
        payload_after: null,
      });
      showToast({ kind: "success", message: "Carnet supprimé." });
      if (selectedId === row.id) setSelectedId(null);
      if (editingId === row.id) resetForm();
      await loadCollections();
    } catch (err) {
      showToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Erreur inattendue",
      });
    } finally {
      setBusy(false);
    }
  }

  // ── Items ────────────────────────────────────────────────────────────────

  async function onAddItem(e: FormEvent) {
    e.preventDefault();
    if (!selectedId || !newItemPlaceId) return;
    const textError = validateEditorialText(newItemText.trim());
    if (textError) {
      showToast({ kind: "error", message: textError });
      return;
    }
    setBusy(true);
    try {
      const row = {
        collection_id: selectedId,
        place_id: newItemPlaceId,
        editorial_text: newItemText.trim() || null,
        sort_order: nextSortOrder(items),
      };
      const { data, error } = await supabaseClient
        .from("explore_items")
        .insert(row)
        .select("id")
        .single();
      if (error) {
        throw new Error(
          error.code === "23505" ? "Ce lieu est déjà dans le carnet." : error.message,
        );
      }
      await logAuditActionBestEffort({
        action: "explore_create",
        entity_type: "explore_item",
        entity_id: (data as { id: string }).id,
        payload_before: null,
        payload_after: row,
      });
      setNewItemPlaceId("");
      setNewItemText("");
      await loadItems(selectedId);
    } catch (err) {
      showToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Erreur inattendue",
      });
    } finally {
      setBusy(false);
    }
  }

  async function onUpdateItemText(item: ExploreItemRow, text: string) {
    const textError = validateEditorialText(text.trim());
    if (textError) {
      showToast({ kind: "error", message: textError });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabaseClient
        .from("explore_items")
        .update({ editorial_text: text.trim() || null })
        .eq("id", item.id);
      if (error) throw new Error(error.message);
      await logAuditActionBestEffort({
        action: "explore_update",
        entity_type: "explore_item",
        entity_id: item.id,
        payload_before: { editorial_text: item.editorial_text },
        payload_after: { editorial_text: text.trim() || null },
      });
      if (selectedId) await loadItems(selectedId);
    } catch (err) {
      showToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Erreur inattendue",
      });
    } finally {
      setBusy(false);
    }
  }

  async function onMoveItem(item: ExploreItemRow, direction: "up" | "down") {
    const reordered = moveItem(items, item.id, direction);
    if (!reordered || !selectedId) return;
    const updates = changedSortOrders(items, reordered);
    setBusy(true);
    try {
      for (const u of updates) {
        const { error } = await supabaseClient
          .from("explore_items")
          .update({ sort_order: u.sort_order })
          .eq("id", u.id);
        if (error) throw new Error(error.message);
      }
      await logAuditActionBestEffort({
        action: "explore_update",
        entity_type: "explore_collection",
        entity_id: selectedId,
        payload_before: null,
        payload_after: { reordered: updates },
      });
      await loadItems(selectedId);
    } catch (err) {
      showToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Erreur inattendue",
      });
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveItem(item: ExploreItemRow) {
    setBusy(true);
    try {
      const { error } = await supabaseClient.from("explore_items").delete().eq("id", item.id);
      if (error) throw new Error(error.message);
      await logAuditActionBestEffort({
        action: "explore_delete",
        entity_type: "explore_item",
        entity_id: item.id,
        payload_before: { collection_id: item.collection_id, place_id: item.place_id },
        payload_after: null,
      });
      if (selectedId) await loadItems(selectedId);
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
        <h1>Curation Explore</h1>
        <p style={{ color: "var(--danger)" }}>Erreur : {loadError}</p>
        <button type="button" onClick={() => void loadCollections()}>Réessayer</button>
      </div>
    );
  }
  if (!collections) return <p>Chargement…</p>;

  const selected = collections.find((c) => c.id === selectedId) ?? null;

  return (
    <div>
      <h1>Curation Explore</h1>
      <p style={{ color: "var(--ink-mute)", fontSize: 12, maxWidth: 720 }}>
        Les carnets du Mode Explore (« Les maquis qui ont le feu »…) : une sélection ordonnée de
        lieux avec le mot du Chat sur chacun. Brouillon tant que non publié.
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

      {/* ── Formulaire carnet ── */}
      <form onSubmit={onSubmitCollection} style={{ display: "grid", gap: 8, maxWidth: 560, margin: "16px 0", background: "var(--bg-card)", padding: 16, borderRadius: 8, border: "1px solid var(--line)" }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>{editingId ? "Éditer le carnet" : "Nouveau carnet"}</h2>
        {formErrors.length > 0 ? (
          <div style={{ background: "var(--bg-warm)", padding: 8, borderRadius: 6 }}>
            {formErrors.map((er) => (
              <div key={er} style={{ color: "var(--danger)", fontSize: 13 }}>• {er}</div>
            ))}
          </div>
        ) : null}
        <label>Slug (identifiant unique)
          <input value={form.slug} disabled={!!editingId} placeholder="maquis-qui-ont-le-feu" onChange={(e) => setForm({ ...form, slug: e.target.value })} style={{ width: "100%" }} />
        </label>
        <label>Titre
          <input value={form.title} placeholder="Les maquis qui ont le feu" onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ width: "100%" }} />
        </label>
        <label>Sous-titre (optionnel)
          <input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} style={{ width: "100%" }} />
        </label>
        <label>Cover (URL, optionnelle)
          <input value={form.cover_url} placeholder="https://…" onChange={(e) => setForm({ ...form, cover_url: e.target.value })} style={{ width: "100%" }} />
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

      <table>
        <thead>
          <tr>
            <th>Slug</th>
            <th>Titre</th>
            <th>Ville</th>
            <th>Publication</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {collections.map((row) => (
            <tr key={row.id} style={selectedId === row.id ? { outline: "1px solid var(--gold)" } : undefined}>
              <td style={{ fontFamily: "monospace", fontSize: 12 }}>{row.slug}</td>
              <td>{row.title_key}</td>
              <td>{row.city_code}</td>
              <td>
                <button type="button" disabled={busy} onClick={() => void onTogglePublish(row)}>
                  {row.is_published ? "Publié ✓ (dépublier)" : "Brouillon (publier)"}
                </button>
              </td>
              <td style={{ display: "flex", gap: 4 }}>
                <button type="button" disabled={busy} onClick={() => setSelectedId(row.id)}>
                  Lieux du carnet
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEditingId(row.id);
                    setForm(collectionRowToForm(row));
                    setFormErrors([]);
                  }}
                >
                  Éditer
                </button>
                <button type="button" disabled={busy} onClick={() => void onDeleteCollection(row)}>
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
          {collections.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ color: "var(--ink-mute)" }}>Aucun carnet pour l&apos;instant.</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {/* ── Items du carnet sélectionné ── */}
      {selected ? (
        <div style={{ marginTop: 24 }}>
          <h2>Lieux du carnet « {selected.title_key} »</h2>
          <form onSubmit={onAddItem} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end", margin: "12px 0" }}>
            <label>Lieu
              <select value={newItemPlaceId} onChange={(e) => setNewItemPlaceId(e.target.value)}>
                <option value="">— choisir —</option>
                {places.map((p) => (
                  <option key={p.id} value={p.id}>{placeLabel(p)}</option>
                ))}
              </select>
            </label>
            <label>Mot du Chat ({newItemText.length}/{EDITORIAL_MAX})
              <input
                value={newItemText}
                maxLength={EDITORIAL_MAX}
                placeholder="Le poisson braisé qui met tout le monde d'accord."
                onChange={(e) => setNewItemText(e.target.value)}
                style={{ width: 320 }}
              />
            </label>
            <button type="submit" className="btn-primary" disabled={busy || !newItemPlaceId}>
              Ajouter
            </button>
          </form>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Lieu</th>
                <th>Mot éditorial</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id}>
                  <td>{i + 1}</td>
                  <td>
                    {item.places
                      ? placeLabel({ name: item.places.name, neighborhood: item.places.neighborhood })
                      : item.place_id.slice(0, 8)}
                  </td>
                  <td style={{ maxWidth: 320 }}>
                    <ItemTextEditor
                      initial={item.editorial_text ?? ""}
                      disabled={busy}
                      onSave={(text) => void onUpdateItemText(item, text)}
                    />
                  </td>
                  <td style={{ display: "flex", gap: 4 }}>
                    <button type="button" disabled={busy || i === 0} onClick={() => void onMoveItem(item, "up")}>↑</button>
                    <button type="button" disabled={busy || i === items.length - 1} onClick={() => void onMoveItem(item, "down")}>↓</button>
                    <button type="button" disabled={busy} onClick={() => void onRemoveItem(item)}>Retirer</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ color: "var(--ink-mute)" }}>Carnet vide — ajoute des lieux.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
};

/** Édition inline du mot éditorial (enregistre au blur si changé). */
function ItemTextEditor({
  initial,
  disabled,
  onSave,
}: {
  initial: string;
  disabled: boolean;
  onSave: (text: string) => void;
}) {
  const [text, setText] = useState(initial);
  useEffect(() => {
    setText(initial);
  }, [initial]);
  return (
    <input
      value={text}
      maxLength={EDITORIAL_MAX}
      disabled={disabled}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text !== initial) onSave(text);
      }}
      style={{ width: "100%" }}
    />
  );
}
