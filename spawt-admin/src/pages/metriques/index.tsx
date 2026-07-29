// Story 6.5 — Tableau de bord KPI basiques + auto-refresh 60s.
// V1 : query directe Supabase. Sprint 2 : vues matérialisées + PostHog.
//
// CR Chunk B :
//   M13 — limit + visibility-aware tick (m3) pour ne pas OOM browser à scale
//   M14 — KPI manquants : places_published + flagged_reviews_total + new_spawters_30d chart
//   Story 6.5 AC #2 — filter is_seed=false partout (Madame Sun ne veut pas les seeds)
//
// Console admin 07/2026 — KPIs AARRR (PRD §16) : MAU (spawters actifs 30j via
// spawt_checkin), spawts/jour & avis/jour (moyenne 7j), abonnés Gold actifs +
// MRR (subscriptions 0032, lecture admin), leads waitlist (vue
// admin_waitlist_stats 0049 — agrégats only, la table meute_waitlist reste
// deny-all). Ces blocs dégradent en « — » si la lecture échoue (rôle
// non-admin, migration absente) sans casser les KPIs historiques.

import { useCallback, useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { supabaseClient } from "../../utility/supabaseClient";
import {
  computeMrr,
  countGoldActive,
  dailyAverage,
  distinctCount,
  type DailyPoint,
  type SubscriptionLite,
  type WaitlistStats,
} from "./logic";

interface DashboardData {
  spawtersTotal: number;
  spawtersActive: number;
  placesPublished: number;
  flaggedReviewsTotal: number;
  spawtsDaily: DailyPoint[];
  reviewsDaily: DailyPoint[];
  spawtersDaily: DailyPoint[];
  /** AARRR — null = lecture impossible (droits/migration), affiché « — ». */
  mau: number | null;
  goldActive: number | null;
  mrr: number | null;
  waitlist: WaitlistStats | null;
  refreshedAt: string;
}

// CR M13 — cap dur des rows fetchées pour protéger le browser.
// V1 alpha 5 spawters → ~50 events/jour → 1500 sur 30j → bien sous la limite.
// Sprint 2 = RPC server-side GROUP BY date pour scale.
const FETCH_LIMIT = 5000;

async function loadDashboard(): Promise<DashboardData> {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString();

  const [
    { count: spawtersTotal },
    { count: spawtersActive },
    { count: placesPublished },
    { count: flaggedReviewsTotal },
    spawts,
    reviews,
    spawters30d,
  ] = await Promise.all([
    // `is_seed = false` : les comptes de service qui portent les avis
    // fondateurs ne sont pas des Spawters. Sans ce filtre, le tableau de bord
    // annonce des inscrits qui n'existent pas — exactement ce que l'en-tête de
    // ce fichier interdit depuis la Story 6.5 (« Madame Sun ne veut pas les
    // seeds »), mais la colonne `spawters.is_seed` n'existait pas encore.
    supabaseClient.from("spawters").select("id", { count: "exact", head: true }).eq("is_seed", false),
    supabaseClient.from("spawters").select("id", { count: "exact", head: true }).eq("is_banned", false).eq("is_seed", false),
    supabaseClient.from("places").select("id", { count: "exact", head: true }).eq("is_published", true),
    supabaseClient
      .from("spawt_checkin")
      .select("id", { count: "exact", head: true })
      .not("flag_reason", "is", null)
      .is("deleted_at", null),
    // CR Story 6.5 AC #2 — filter is_seed=false (les seeds ne sont pas du
    // contenu communauté et ne doivent pas gonfler les KPIs Madame Sun).
    supabaseClient
      .from("spawt_checkin")
      .select("created_at")
      .gte("created_at", sinceIso)
      .eq("is_seed", false)
      .is("deleted_at", null)
      .limit(FETCH_LIMIT),
    supabaseClient
      .from("spawt_checkin")
      .select("created_at")
      .gte("created_at", sinceIso)
      .eq("is_seed", false)
      .not("note_etoiles", "is", null)
      .is("deleted_at", null)
      .limit(FETCH_LIMIT),
    supabaseClient
      .from("spawters")
      .select("created_at")
      .gte("created_at", sinceIso)
      .limit(FETCH_LIMIT),
  ]);

  // ── KPIs AARRR (07/2026) — chaque bloc dégrade en null si erreur ──────────
  const [mauRes, subsRes, waitlistRes] = await Promise.all([
    // MAU : spawters distincts avec >= 1 spawt (seed exclu) sur 30j.
    supabaseClient
      .from("spawt_checkin")
      .select("spawter_id")
      .gte("created_at", sinceIso)
      .eq("is_seed", false)
      .is("deleted_at", null)
      .limit(FETCH_LIMIT),
    // Revenus : abonnements potentiellement actifs (le calcul fin — fenêtre
    // de grâce — est fait client-side, miroir de active_entitlements).
    supabaseClient
      .from("subscriptions")
      .select("plan, status, price_ht, customer_type, expires_at, grace_until")
      .in("status", ["active", "grace"])
      .limit(FETCH_LIMIT),
    // Leads waitlist : vue agrégée 0049 (0 ligne si rôle non-admin).
    supabaseClient
      .from("admin_waitlist_stats")
      .select("total_leads, leads_30d, leads_7d, leads_parraines")
      .maybeSingle(),
  ]);

  const subs = subsRes.error ? null : ((subsRes.data ?? []) as SubscriptionLite[]);

  return {
    spawtersTotal: spawtersTotal ?? 0,
    spawtersActive: spawtersActive ?? 0,
    placesPublished: placesPublished ?? 0,
    flaggedReviewsTotal: flaggedReviewsTotal ?? 0,
    spawtsDaily: groupByDay(spawts.data ?? []),
    reviewsDaily: groupByDay(reviews.data ?? []),
    spawtersDaily: groupByDay(spawters30d.data ?? []),
    mau: mauRes.error ? null : distinctCount((mauRes.data ?? []) as { spawter_id: string }[]),
    goldActive: subs ? countGoldActive(subs) : null,
    mrr: subs ? computeMrr(subs) : null,
    waitlist: waitlistRes.error ? null : ((waitlistRes.data as WaitlistStats | null) ?? null),
    refreshedAt: new Date().toISOString(),
  };
}

function groupByDay(rows: { created_at: string }[]): DailyPoint[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const day = r.created_at.slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

export const MetriquesDashboard = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const d = await loadDashboard();
      setData(d);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (!cancelled) void refresh();
    };
    void refresh();
    // CR m3 — visibility-aware interval. Quand l'onglet est en arrière-plan,
    // pas de refresh (économise quota Supabase + batterie).
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        tick();
      }
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refresh]);

  if (error) return <p>Erreur : {error}</p>;
  if (!data) return <p>Chargement…</p>;

  const totalSpawts30d = data.spawtsDaily.reduce((acc, p) => acc + p.count, 0);
  const totalReviews30d = data.reviewsDaily.reduce((acc, p) => acc + p.count, 0);
  const totalNewSpawters30d = data.spawtersDaily.reduce((acc, p) => acc + p.count, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1>Métriques (30 derniers jours)</h1>
        <button type="button" onClick={() => void refresh()} disabled={refreshing}>
          {refreshing ? "Actualisation…" : "Actualiser"}
        </button>
      </div>
      <p style={{ color: "var(--ink-mute)", fontSize: 12 }}>
        Auto-refresh 60s (onglet visible) · query directe Supabase V1 · vues matérialisées + PostHog Sprint 2.
        Dernier refresh : {new Date(data.refreshedAt).toLocaleTimeString("fr-FR")}.
      </p>
      <p style={{ color: "var(--ink-mute)", fontSize: 11, fontStyle: "italic" }}>
        Compteurs publics : seeds exclus (is_seed = false).
      </p>

      {/* CR M14 — 6 KPI cards spec Story 6.5 AC #1 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 24 }}>
        <KpiCard label="Spawters total" value={data.spawtersTotal} />
        <KpiCard label="Spawters actifs" value={data.spawtersActive} />
        <KpiCard label="Lieux publiés" value={data.placesPublished} />
        <KpiCard label="Nouveaux spawters (30j)" value={totalNewSpawters30d} />
        <KpiCard label="Spawts (30j)" value={totalSpawts30d} />
        <KpiCard label="Avis (30j)" value={totalReviews30d} />
      </div>
      <div style={{ marginTop: 16 }}>
        <KpiCard label="Avis flagged (anti-fraude)" value={data.flaggedReviewsTotal} />
      </div>

      {/* ── KPIs AARRR (PRD §16) ── */}
      <h2 style={{ marginTop: 32 }}>KPIs AARRR (PRD §16)</h2>
      <p style={{ color: "var(--ink-mute)", fontSize: 11 }}>
        Revenus et waitlist : lecture réservée au rôle admin — « — » sinon.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 12 }}>
        <KpiCard label="MAU (spawters actifs 30j)" value={data.mau ?? "—"} />
        <KpiCard label="Spawts / jour (moy. 7j)" value={dailyAverage(data.spawtsDaily, 7)} />
        <KpiCard label="Avis / jour (moy. 7j)" value={dailyAverage(data.reviewsDaily, 7)} />
        <KpiCard label="Abonnés Gold actifs" value={data.goldActive ?? "—"} />
        <KpiCard
          label="MRR (F CFA HT, abts actifs)"
          value={data.mrr !== null ? `${data.mrr.toLocaleString("fr-FR")} F` : "—"}
        />
        <KpiCard
          label="Leads waitlist (total · 7j)"
          value={
            data.waitlist
              ? `${data.waitlist.total_leads.toLocaleString("fr-FR")} · ${data.waitlist.leads_7d.toLocaleString("fr-FR")}`
              : "—"
          }
        />
      </div>

      <h2 style={{ marginTop: 32 }}>Nouveaux spawters par jour</h2>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data.spawtersDaily}>
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#9B7DC2" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>

      <h2 style={{ marginTop: 32 }}>Spawts par jour</h2>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data.spawtsDaily}>
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#C8A44E" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>

      <h2 style={{ marginTop: 32 }}>Avis par jour</h2>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data.reviewsDaily}>
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#2D6B4F" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

function KpiCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ background: "var(--bg-card)", padding: 24, borderRadius: 8, border: "1px solid var(--line)" }}>
      <p style={{ margin: 0, color: "var(--ink-mute)", fontSize: 12, textTransform: "uppercase" }}>{label}</p>
      <p style={{ margin: "8px 0 0 0", fontSize: 36, fontWeight: 700, color: "var(--gold)" }}>
        {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
      </p>
    </div>
  );
}
