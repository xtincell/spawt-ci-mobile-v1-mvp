// Console admin 07/2026 — Comptes B2B (b2b_accounts, 0043 + policies 0049).
// Lier un lieu à un compte Pro/Gold par téléphone (lookup spawters.phone_e164
// → auth_user_id), activer/désactiver. Audit b2b_link / b2b_unlink.

import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabaseClient } from "../../utility/supabaseClient";
import { logAuditActionBestEffort } from "../../lib/audit";
import { usePlaces, placeLabel } from "../../lib/usePlaces";
import { maskPhone } from "../comptes";
import {
  B2B_ROLES,
  EMPTY_B2B_FORM,
  ROLE_LABELS,
  b2bInsertErrorMessage,
  normalizePhoneE164,
  validateB2bLink,
  type B2bAccountRow,
  type B2bFormValues,
} from "./logic";

const B2B_COLUMNS =
  "id, auth_user_id, place_id, role, contact_name, contact_phone, is_active, created_at, places(name, neighborhood)";

interface Toast {
  kind: "success" | "error";
  message: string;
}

interface ResolvedSpawter {
  id: string;
  display_name: string;
}

export const B2bList = () => {
  const { places, error: placesError } = usePlaces();
  const [rows, setRows] = useState<B2bAccountRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<B2bFormValues>(EMPTY_B2B_FORM);
  const [resolved, setResolved] = useState<ResolvedSpawter | null>(null);
  const [lookupDone, setLookupDone] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabaseClient
      .from("b2b_accounts")
      .select(B2B_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(error.message);
      return;
    }
    setLoadError(null);
    setRows((data ?? []) as unknown as B2bAccountRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function showToast(t: Toast) {
    setToast(t);
    setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 4000);
  }

  /** Lookup du compte par téléphone (spawters.id = auth.uid du compte OTP). */
  async function onLookup() {
    setResolved(null);
    setLookupDone(false);
    const phone = normalizePhoneE164(form.phone);
    if (!phone) {
      setFormErrors(["Téléphone invalide (attendu +225XXXXXXXXXX)."]);
      return;
    }
    setFormErrors([]);
    setBusy(true);
    try {
      const { data, error } = await supabaseClient
        .from("spawters")
        .select("id, display_name")
        .eq("phone_e164", phone)
        .maybeSingle();
      if (error) throw new Error(error.message);
      setResolved((data as ResolvedSpawter | null) ?? null);
      setLookupDone(true);
    } catch (err) {
      showToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Erreur inattendue",
      });
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const validated = validateB2bLink(form, resolved?.id ?? null);
    if (!validated.ok) {
      setFormErrors(validated.errors);
      return;
    }
    setFormErrors([]);
    setBusy(true);
    try {
      const { data, error } = await supabaseClient
        .from("b2b_accounts")
        .insert(validated.row)
        .select("id")
        .single();
      const msg = b2bInsertErrorMessage(error);
      if (msg) throw new Error(msg);
      await logAuditActionBestEffort({
        action: "b2b_link",
        entity_type: "b2b_account",
        entity_id: (data as { id: string }).id,
        payload_before: null,
        payload_after: {
          place_id: validated.row.place_id,
          role: validated.row.role,
          auth_user_id: validated.row.auth_user_id,
        },
      });
      showToast({ kind: "success", message: "Compte B2B lié au lieu." });
      setForm(EMPTY_B2B_FORM);
      setResolved(null);
      setLookupDone(false);
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

  /** Désactiver = b2b_unlink, réactiver = b2b_link (audité). */
  async function onToggleActive(row: B2bAccountRow) {
    setBusy(true);
    try {
      const { data, error } = await supabaseClient
        .from("b2b_accounts")
        .update({ is_active: !row.is_active })
        .eq("id", row.id)
        .select("id");
      if (error) throw new Error(error.message);
      if ((data?.length ?? 0) === 0) throw new Error("Réservé aux admins");
      await logAuditActionBestEffort({
        action: row.is_active ? "b2b_unlink" : "b2b_link",
        entity_type: "b2b_account",
        entity_id: row.id,
        payload_before: { is_active: row.is_active },
        payload_after: { is_active: !row.is_active, place_id: row.place_id, role: row.role },
      });
      showToast({
        kind: "success",
        message: row.is_active ? "Compte B2B désactivé." : "Compte B2B réactivé.",
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

  if (loadError) {
    return (
      <div>
        <h1>Comptes B2B</h1>
        <p style={{ color: "var(--danger)" }}>Erreur : {loadError}</p>
        <button type="button" onClick={() => void load()}>Réessayer</button>
      </div>
    );
  }
  if (!rows) return <p>Chargement…</p>;

  return (
    <div>
      <h1>Comptes B2B</h1>
      <p style={{ color: "var(--ink-mute)", fontSize: 12, maxWidth: 720 }}>
        Un lieu = un compte Pro ou Gold, lié par le téléphone du contact (il doit s&apos;être
        connecté à l&apos;app au moins une fois). Les dashboards B2B ne montrent que des agrégats
        (n ≥ 3) — jamais un avis individuel.
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

      {/* ── Lier un compte ── */}
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 8, maxWidth: 560, margin: "16px 0", background: "var(--bg-card)", padding: 16, borderRadius: 8, border: "1px solid var(--line)" }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Lier un compte B2B</h2>
        {formErrors.length > 0 ? (
          <div style={{ background: "var(--bg-warm)", padding: 8, borderRadius: 6 }}>
            {formErrors.map((er) => (
              <div key={er} style={{ color: "var(--danger)", fontSize: 13 }}>• {er}</div>
            ))}
          </div>
        ) : null}
        <label>Téléphone du contact (+225…)
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={form.phone}
              placeholder="+2250700000000"
              onChange={(e) => {
                setForm({ ...form, phone: e.target.value });
                setResolved(null);
                setLookupDone(false);
              }}
              style={{ flex: 1 }}
            />
            <button type="button" disabled={busy} onClick={() => void onLookup()}>
              Chercher
            </button>
          </div>
        </label>
        {lookupDone ? (
          resolved ? (
            <p style={{ fontSize: 13, margin: 0 }}>
              ✓ Compte trouvé : <strong>{resolved.display_name}</strong>
            </p>
          ) : (
            <p style={{ fontSize: 13, margin: 0, color: "var(--danger)" }}>
              Aucun compte pour ce téléphone — le contact doit d&apos;abord se connecter à l&apos;app (OTP).
            </p>
          )
        ) : null}
        <label>Lieu
          <select value={form.place_id} onChange={(e) => setForm({ ...form, place_id: e.target.value })} style={{ width: "100%" }}>
            <option value="">— choisir un lieu —</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>{placeLabel(p)}</option>
            ))}
          </select>
        </label>
        <label>Rôle
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as B2bFormValues["role"] })}>
            {B2B_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </label>
        <label>Nom du contact (optionnel)
          <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} style={{ width: "100%" }} />
        </label>
        <div>
          <button type="submit" className="btn-primary" disabled={busy || !resolved}>
            Lier le compte
          </button>
        </div>
      </form>

      <table>
        <thead>
          <tr>
            <th>Lieu</th>
            <th>Contact</th>
            <th>Téléphone (masqué)</th>
            <th>Rôle</th>
            <th>Statut</th>
            <th>Créé le</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                {row.places
                  ? placeLabel({ name: row.places.name, neighborhood: row.places.neighborhood })
                  : row.place_id.slice(0, 8)}
              </td>
              <td>{row.contact_name ?? "—"}</td>
              <td>{row.contact_phone ? maskPhone(row.contact_phone) : "—"}</td>
              <td>{ROLE_LABELS[row.role] ?? row.role}</td>
              <td>{row.is_active ? "Actif" : "Désactivé"}</td>
              <td>{new Date(row.created_at).toLocaleDateString("fr-FR")}</td>
              <td>
                <button type="button" disabled={busy} onClick={() => void onToggleActive(row)}>
                  {row.is_active ? "Désactiver" : "Réactiver"}
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ color: "var(--ink-mute)" }}>Aucun compte B2B pour l&apos;instant.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
};
