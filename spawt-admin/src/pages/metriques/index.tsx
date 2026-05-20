// Story 6.5 — Tableau de bord 3 KPIs basiques + auto-refresh 60s.
// V1 : query directe Supabase. Sprint 2 : vues matérialisées + PostHog.

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { supabaseClient } from "../../utility/supabaseClient";

interface DailyPoint {
  date: string;
  count: number;
}

interface DashboardData {
  spawtersTotal: number;
  spawtersDaily: DailyPoint[];
  spawtsDaily: DailyPoint[];
  reviewsDaily: DailyPoint[];
}

async function loadDashboard(): Promise<DashboardData> {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString();

  const [{ count: spawtersTotal }, spawts, reviews] = await Promise.all([
    supabaseClient.from("spawters").select("id", { count: "exact", head: true }),
    supabaseClient
      .from("spawt_checkin")
      .select("created_at")
      .gte("created_at", sinceIso)
      .is("deleted_at", null),
    supabaseClient
      .from("spawt_checkin")
      .select("created_at")
      .gte("created_at", sinceIso)
      .not("note_etoiles", "is", null)
      .is("deleted_at", null),
  ]);

  return {
    spawtersTotal: spawtersTotal ?? 0,
    spawtersDaily: [],
    spawtsDaily: groupByDay(spawts.data ?? []),
    reviewsDaily: groupByDay(reviews.data ?? []),
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

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const d = await loadDashboard();
        if (!cancelled) setData(d);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erreur");
      }
    };
    void tick();
    const id = setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (error) return <p>Erreur : {error}</p>;
  if (!data) return <p>Chargement…</p>;

  const totalSpawts30d = data.spawtsDaily.reduce((acc, p) => acc + p.count, 0);
  const totalReviews30d = data.reviewsDaily.reduce((acc, p) => acc + p.count, 0);

  return (
    <div>
      <h1>Métriques (30 derniers jours)</h1>
      <p style={{ color: "var(--ink-mute)", fontSize: 12 }}>
        Auto-refresh 60s · query directe Supabase V1 · vues matérialisées + PostHog Sprint 2.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 24 }}>
        <KpiCard label="Total spawters" value={data.spawtersTotal} />
        <KpiCard label="Spawts (30j)" value={totalSpawts30d} />
        <KpiCard label="Avis (30j)" value={totalReviews30d} />
      </div>

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
