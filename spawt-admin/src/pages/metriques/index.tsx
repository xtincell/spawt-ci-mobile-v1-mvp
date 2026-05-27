// Story 6.5 — Tableau de bord KPI basiques + auto-refresh 60s.
// V1 : query directe Supabase. Sprint 2 : vues matérialisées + PostHog.
//
// CR Chunk B :
//   M13 — limit + visibility-aware tick (m3) pour ne pas OOM browser à scale
//   M14 — KPI manquants : places_published + flagged_reviews_total + new_spawters_30d chart
//   Story 6.5 AC #2 — filter is_seed=false partout (Madame Sun ne veut pas les seeds)

import { useCallback, useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { supabaseClient } from "../../utility/supabaseClient";

interface DailyPoint {
  date: string;
  count: number;
}

interface DashboardData {
  spawtersTotal: number;
  spawtersActive: number;
  placesPublished: number;
  flaggedReviewsTotal: number;
  spawtsDaily: DailyPoint[];
  reviewsDaily: DailyPoint[];
  spawtersDaily: DailyPoint[];
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
    supabaseClient.from("spawters").select("id", { count: "exact", head: true }),
    supabaseClient.from("spawters").select("id", { count: "exact", head: true }).eq("is_banned", false),
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

  return {
    spawtersTotal: spawtersTotal ?? 0,
    spawtersActive: spawtersActive ?? 0,
    placesPublished: placesPublished ?? 0,
    flaggedReviewsTotal: flaggedReviewsTotal ?? 0,
    spawtsDaily: groupByDay(spawts.data ?? []),
    reviewsDaily: groupByDay(reviews.data ?? []),
    spawtersDaily: groupByDay(spawters30d.data ?? []),
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

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: "var(--bg-card)", padding: 24, borderRadius: 8, border: "1px solid var(--line)" }}>
      <p style={{ margin: 0, color: "var(--ink-mute)", fontSize: 12, textTransform: "uppercase" }}>{label}</p>
      <p style={{ margin: "8px 0 0 0", fontSize: 36, fontWeight: 700, color: "var(--gold)" }}>{value.toLocaleString("fr-FR")}</p>
    </div>
  );
}
