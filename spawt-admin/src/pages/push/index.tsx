// Console admin 07/2026 — Campagnes push (Edge `push-send`, tokens 0034).
// Composer (titre, corps, deep link), ciblage (tous / stade / archétype /
// gold), estimation des devices ciblés, envoi authentifié staff, résultat
// {sent, failed, purged} et historique depuis admin_audit_log
// (action push_campaign — l'audit est écrit côté Edge). Limite 3/jour UTC.

import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabaseClient } from "../../utility/supabaseClient";
import {
  EMPTY_PUSH_FORM,
  MAX_CAMPAIGNS_PER_DAY,
  MAX_SPAWTER_IDS,
  PUSH_ARCHETYPES,
  PUSH_BODY_MAX,
  PUSH_STADES,
  PUSH_TITLE_MAX,
  buildPushBody,
  campaignsToday,
  estimateTargets,
  pushErrorMessage,
  validatePushForm,
  type PushEstimate,
  type PushFormValues,
  type PushSendResult,
} from "./logic";

/** Chunk des clauses .in() PostgREST (miroir DB_IN_CHUNK_SIZE de l'Edge). */
const DB_IN_CHUNK_SIZE = 200;

interface CampaignHistoryRow {
  id: string;
  created_at: string;
  payload_after: {
    title?: string;
    targets?: number;
    tokens?: number;
    sent?: number;
    failed?: number;
    purged?: number;
  } | null;
}

interface Toast {
  kind: "success" | "error";
  message: string;
}

/** Résolution des spawter_ids côté client (lecture staff). */
async function fetchSpawterIdsForTarget(v: PushFormValues): Promise<string[]> {
  if (v.target === "gold") {
    const { data, error } = await supabaseClient
      .from("active_entitlements")
      .select("spawter_id")
      .eq("is_active", true);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: { spawter_id: string }) => r.spawter_id).filter(Boolean);
  }
  let query = supabaseClient.from("spawters").select("id").limit(MAX_SPAWTER_IDS);
  if (v.target === "stade") query = query.eq("stade", v.stade);
  if (v.target === "archetype") query = query.eq("quiz_archetype", v.archetype);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { id: string }) => r.id);
}

/** Comptage des tokens ciblés (push_tokens, lecture staff 0034). */
async function countTokensFor(spawterIds: string[]): Promise<number> {
  let total = 0;
  for (let i = 0; i < spawterIds.length; i += DB_IN_CHUNK_SIZE) {
    const chunk = spawterIds.slice(i, i + DB_IN_CHUNK_SIZE);
    const { count, error } = await supabaseClient
      .from("push_tokens")
      .select("id", { count: "exact", head: true })
      .in("spawter_id", chunk);
    if (error) throw new Error(error.message);
    total += count ?? 0;
  }
  return total;
}

export const PushCampaigns = () => {
  const [form, setForm] = useState<PushFormValues>(EMPTY_PUSH_FORM);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [estimate, setEstimate] = useState<PushEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<PushSendResult | null>(null);
  const [history, setHistory] = useState<CampaignHistoryRow[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const loadHistory = useCallback(async () => {
    const { data, error } = await supabaseClient
      .from("admin_audit_log")
      .select("id, created_at, payload_after")
      .eq("action", "push_campaign")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      setHistoryError(error.message);
      return;
    }
    setHistoryError(null);
    setHistory((data ?? []) as CampaignHistoryRow[]);
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  function showToast(t: Toast) {
    setToast(t);
    setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 5000);
  }

  async function onEstimate() {
    const validated = validatePushForm(form);
    if (!validated.ok) {
      setFormErrors(validated.errors);
      return;
    }
    setFormErrors([]);
    setEstimating(true);
    try {
      const est = await estimateTargets(form, {
        fetchSpawterIds: fetchSpawterIdsForTarget,
        countTokens: countTokensFor,
      });
      setEstimate(est);
    } catch (err) {
      showToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Erreur inattendue",
      });
    } finally {
      setEstimating(false);
    }
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    const validated = validatePushForm(form);
    if (!validated.ok) {
      setFormErrors(validated.errors);
      return;
    }
    setFormErrors([]);
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Envoyer la campagne « ${form.title.trim()} » maintenant ?` +
          (estimate ? ` (~${estimate.tokens} devices)` : ""),
      )
    ) {
      return;
    }
    setSending(true);
    setResult(null);
    try {
      // « Tous » = spawter_ids explicites (l'Edge exige une cible).
      const allIds = form.target === "all" ? await fetchSpawterIdsForTarget(form) : null;
      const body = buildPushBody(form, allIds);
      const { data, error } = await supabaseClient.functions.invoke("push-send", { body });
      if (error) {
        // Non-2xx : le body JSON de l'Edge porte le code ({ error: ... }).
        let code: string | undefined;
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            code = ((await ctx.json()) as { error?: string }).error;
          } catch {
            code = undefined;
          }
        }
        throw new Error(pushErrorMessage(code ?? error.message));
      }
      const payload = data as (PushSendResult & { error?: string }) | null;
      if (!payload || payload.error) {
        throw new Error(pushErrorMessage(payload?.error));
      }
      setResult({ sent: payload.sent, failed: payload.failed, purged: payload.purged });
      showToast({
        kind: "success",
        message: `Campagne envoyée : ${payload.sent} ok, ${payload.failed} échecs, ${payload.purged} tokens purgés.`,
      });
      setForm(EMPTY_PUSH_FORM);
      setEstimate(null);
      await loadHistory();
    } catch (err) {
      showToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Erreur inattendue",
      });
    } finally {
      setSending(false);
    }
  }

  const usedToday = history ? campaignsToday(history) : null;

  return (
    <div>
      <h1>Campagnes push</h1>
      <p style={{ color: "var(--ink-mute)", fontSize: 12, maxWidth: 720 }}>
        Notification envoyée aux devices de la Meute via l&apos;API Expo (Edge push-send).
        Limite anti-abus : <strong>{MAX_CAMPAIGNS_PER_DAY} campagnes par jour</strong> (UTC).
        {usedToday !== null ? ` Utilisées aujourd'hui : ${usedToday}/${MAX_CAMPAIGNS_PER_DAY}.` : ""}
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

      {/* ── Composer ── */}
      <form onSubmit={onSend} style={{ display: "grid", gap: 8, maxWidth: 560, margin: "16px 0", background: "var(--bg-card)", padding: 16, borderRadius: 8, border: "1px solid var(--line)" }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Composer</h2>
        {formErrors.length > 0 ? (
          <div style={{ background: "var(--bg-warm)", padding: 8, borderRadius: 6 }}>
            {formErrors.map((er) => (
              <div key={er} style={{ color: "var(--danger)", fontSize: 13 }}>• {er}</div>
            ))}
          </div>
        ) : null}
        <label>Titre ({form.title.length}/{PUSH_TITLE_MAX})
          <input value={form.title} maxLength={PUSH_TITLE_MAX} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ width: "100%" }} />
        </label>
        <label>Corps ({form.body.length}/{PUSH_BODY_MAX})
          <textarea rows={3} value={form.body} maxLength={PUSH_BODY_MAX} onChange={(e) => setForm({ ...form, body: e.target.value })} style={{ width: "100%" }} />
        </label>
        <label>Deep link (optionnel, ex. /lieu/1234 ou spawt://…)
          <input value={form.deep_link} onChange={(e) => setForm({ ...form, deep_link: e.target.value })} style={{ width: "100%" }} />
        </label>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          <label>Ciblage
            <select
              value={form.target}
              onChange={(e) => {
                setForm({ ...form, target: e.target.value as PushFormValues["target"] });
                setEstimate(null);
              }}
            >
              <option value="all">Toute la Meute</option>
              <option value="stade">Par stade</option>
              <option value="archetype">Par archétype</option>
              <option value="gold">Abonnés Gold</option>
            </select>
          </label>
          {form.target === "stade" ? (
            <label>Stade
              <select value={form.stade} onChange={(e) => { setForm({ ...form, stade: e.target.value as PushFormValues["stade"] }); setEstimate(null); }}>
                {PUSH_STADES.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </label>
          ) : null}
          {form.target === "archetype" ? (
            <label>Archétype
              <select value={form.archetype} onChange={(e) => { setForm({ ...form, archetype: e.target.value as PushFormValues["archetype"] }); setEstimate(null); }}>
                {PUSH_ARCHETYPES.map((a) => (<option key={a} value={a}>{a}</option>))}
              </select>
            </label>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" disabled={estimating || sending} onClick={() => void onEstimate()}>
            {estimating ? "Estimation…" : "Estimer le ciblage"}
          </button>
          {estimate ? (
            <span style={{ fontSize: 13 }}>
              ≈ <strong>{estimate.spawters}</strong> spawters ciblés, <strong>{estimate.tokens}</strong> devices avec notifs.
            </span>
          ) : null}
        </div>
        <div>
          <button type="submit" className="btn-primary" disabled={sending}>
            {sending ? "Envoi…" : "Envoyer la campagne"}
          </button>
        </div>
        {result ? (
          <p style={{ fontSize: 13, margin: 0 }}>
            Résultat : <strong>{result.sent}</strong> envoyés, <strong>{result.failed}</strong> échecs,{" "}
            <strong>{result.purged}</strong> tokens morts purgés.
          </p>
        ) : null}
      </form>

      {/* ── Historique (audit push_campaign, écrit côté Edge) ── */}
      <h2>Historique des campagnes</h2>
      {historyError ? (
        <p style={{ color: "var(--danger)" }}>Historique indisponible : {historyError}</p>
      ) : !history ? (
        <p>Chargement…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Titre</th>
              <th>Cibles</th>
              <th>Devices</th>
              <th>Envoyés</th>
              <th>Échecs</th>
              <th>Purgés</th>
            </tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.created_at).toLocaleString("fr-FR")}</td>
                <td>{row.payload_after?.title ?? "—"}</td>
                <td>{row.payload_after?.targets ?? "—"}</td>
                <td>{row.payload_after?.tokens ?? "—"}</td>
                <td>{row.payload_after?.sent ?? "—"}</td>
                <td>{row.payload_after?.failed ?? "—"}</td>
                <td>{row.payload_after?.purged ?? "—"}</td>
              </tr>
            ))}
            {history.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ color: "var(--ink-mute)" }}>Aucune campagne pour l&apos;instant.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      )}
    </div>
  );
};
