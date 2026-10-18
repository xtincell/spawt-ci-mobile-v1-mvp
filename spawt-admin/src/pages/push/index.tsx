import { useLocation } from "react-router";
// Console admin 07/2026 — Campagnes push (Edge `push-send`, tokens 0034).
// Composer (titre, corps, deep link), ciblage (tous / stade / archétype /
// gold), estimation des devices ciblés, envoi authentifié staff, résultat
// {sent, failed, purged} et historique depuis admin_audit_log
// (action push_campaign — l'audit est écrit côté Edge). Limite 3/jour UTC.

import { FormEvent, useCallback, useEffect, useState, useRef } from "react";
import { supabaseClient } from "../../utility/supabaseClient";
import {
  EMPTY_PUSH_FORM,
  MAX_CAMPAIGNS_PER_DAY,
  PUSH_ARCHETYPES,
  PUSH_BODY_MAX,
  PUSH_STADES,
  PUSH_TITLE_MAX,
  buildPushBody,
  pushErrorMessage,
  validatePushForm,
  type PushEstimate,
  type PushFormValues,
  type PushSendResult,
} from "./logic";

interface CampaignHistoryRow {
  id: string; created_at: string; payload: { title?: string }; status: string;
  targets: number; tokens: number; sent: number; failed: number; purged: number;
}

interface Toast {
  kind: "success" | "error";
  message: string;
}

export const PushCampaigns = () => {
  const { state } = useLocation();
  const [form, setForm] = useState<PushFormValues>(() => ({ ...EMPTY_PUSH_FORM, ...(state ?? {}), ...(state?.spawter_id ? { target: "account" } : {}) }));
  const reservation = useRef<{ content: string; id: string } | null>(null);
  const [dailyCount, setDailyCount] = useState<number | null>(null);
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
      .from("push_campaigns")
      .select("id,created_at,payload,status,targets,tokens,sent,failed,purged")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      setHistoryError(error.message);
      return;
    }
    setHistoryError(null);
    setHistory((data ?? []) as CampaignHistoryRow[]);
    const day = new Date(); day.setUTCHours(0,0,0,0);
    const daily = await supabaseClient.from("push_campaigns").select("id", { count: "exact", head: true }).gte("created_at",day.toISOString());
    setDailyCount(daily.error ? null : daily.count);
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
      const { data, error } = await supabaseClient.functions.invoke("push-send", { body: { ...buildPushBody(form,null), dry_run: true } });
      if (error || !data?.dry_run) throw new Error(error?.message ?? "Estimation indisponible");
      setEstimate({ spawters: data.targets, tokens: data.tokens });
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
      const content = buildPushBody(form, null);
      const encoded = JSON.stringify(content);
      if (reservation.current?.content !== encoded) reservation.current = { content: encoded, id: crypto.randomUUID() };
      const body = { ...content, request_id: reservation.current.id };
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
        message: `Traitement terminé : ${payload.sent} acceptées par Expo, ${payload.failed} échecs. La réception sur le téléphone n’est pas confirmée.`,
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

  const usedToday = dailyCount;

  return (
    <div>
      <h1>Campagnes push</h1>
      <p style={{ color: "var(--ink-mute)", fontSize: 12, maxWidth: 720 }}>
        Prépare une information, une actualité ou une promotion pour les appareils ayant autorisé les notifications. Un envoi accepté ne confirme pas son affichage sur le téléphone.
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
      <form onChange={() => { setEstimate(null); setResult(null); }} onSubmit={onSend} style={{ display: "grid", gap: 8, maxWidth: 560, margin: "16px 0", background: "var(--bg-card)", padding: 16, borderRadius: 8, border: "1px solid var(--line)" }}>
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
        <label>Destination dans l’app (ex. /place/identifiant ou /actualites/identifiant)
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
              <option value="gold">Abonnés Gold</option><option value="account">Un compte précis</option>
            </select>
          </label>
          {form.target === "account" ? <label>Identifiant du compte<input value={form.spawter_id ?? ""} onChange={e => setForm({ ...form, spawter_id: e.target.value })} /></label> : null}
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
              ≈ <strong>{estimate.spawters}</strong> spawters ciblés, <strong>{estimate.tokens}</strong> appareils avec notifications.
            </span>
          ) : null}
        </div>
        <div>
          <button type="submit" className="btn-primary" disabled={sending || !estimate || estimate.tokens === 0}>
            {sending ? "Envoi…" : "Envoyer la campagne"}
          </button>
        </div>
        {result ? (
          <p style={{ fontSize: 13, margin: 0 }}>
            Résultat : <strong>{result.sent}</strong> acceptées par Expo, <strong>{result.failed}</strong> échecs,{" "}
            <strong>{result.purged}</strong> tokens morts purgés.
          </p>
        ) : null}
      </form>

      {estimate?.tokens === 0 ? <p role="status">Aucun appareil joignable pour ce ciblage. Consulte l’activité des comptes pour vérifier les permissions et la version installée.</p> : null}
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
              <th>Acceptées par Expo</th><th>État</th>
              <th>Échecs</th>
              <th>Purgés</th>
            </tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.created_at).toLocaleString("fr-FR")}</td>
                <td>{row.payload?.title ?? "—"}</td>
                <td>{row.targets ?? "—"}</td>
                <td>{row.tokens ?? "—"}</td>
                <td>{row.sent ?? "—"}</td><td>{row.status === "sending" ? "Envoi en cours ou à vérifier" : "Traitement terminé"}</td>
                <td>{row.failed ?? "—"}</td>
                <td>{row.purged ?? "—"}</td>
              </tr>
            ))}
            {history.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ color: "var(--ink-mute)" }}>Aucune campagne pour l&apos;instant.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      )}
    </div>
  );
};
