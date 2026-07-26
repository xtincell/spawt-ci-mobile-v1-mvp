// Console admin 07/2026 — logique pure des KPIs AARRR étendus (PRD §16),
// testable sans Refine. La page métriques garde ses requêtes directes ;
// ici : agrégations client (MAU, moyennes 7j, MRR, Gold actifs).

export interface DailyPoint {
  date: string;
  count: number;
}

/** Nombre de spawters distincts dans des rows (MAU via spawt_checkin 30j). */
export function distinctCount(rows: { spawter_id: string }[]): number {
  return new Set(rows.map((r) => r.spawter_id)).size;
}

/** Date civile YYYY-MM-DD d'il y a n-1 jours (fenêtre glissante incluant aujourd'hui). */
export function cutoffDate(n: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - (n - 1));
  return d.toISOString().slice(0, 10);
}

/** Sous-série des n derniers jours (dates YYYY-MM-DD triées). */
export function lastNDays(
  series: DailyPoint[],
  n: number,
  now: Date = new Date(),
): DailyPoint[] {
  const cutoff = cutoffDate(n, now);
  return series.filter((p) => p.date >= cutoff);
}

/** Moyenne quotidienne sur les n derniers jours (jours sans activité = 0). */
export function dailyAverage(
  series: DailyPoint[],
  n: number,
  now: Date = new Date(),
): number {
  if (n <= 0) return 0;
  const total = lastNDays(series, n, now).reduce((acc, p) => acc + p.count, 0);
  return Math.round((total / n) * 10) / 10;
}

// ── Revenus (subscriptions 0032) ────────────────────────────────────────────

export interface SubscriptionLite {
  plan: string;
  status: string;
  price_ht: number;
  customer_type: "b2c" | "b2b";
  expires_at: string | null;
  grace_until: string | null;
}

/** Miroir client de la vue active_entitlements.is_active (0032). */
export function isSubscriptionActive(s: SubscriptionLite, now: Date = new Date()): boolean {
  if (s.status !== "active" && s.status !== "grace") return false;
  if (s.expires_at === null) return true;
  if (new Date(s.expires_at) > now) return true;
  return s.grace_until !== null && new Date(s.grace_until) > now;
}

/** Abonnés Gold B2C actifs (plans gold_monthly / gold_annual). */
export function countGoldActive(subs: SubscriptionLite[], now: Date = new Date()): number {
  return subs.filter(
    (s) => s.customer_type === "b2c" && s.plan.startsWith("gold") && isSubscriptionActive(s, now),
  ).length;
}

/** MRR = somme price_ht des abonnements actifs b2c + b2b (XOF HT, PRD §16). */
export function computeMrr(subs: SubscriptionLite[], now: Date = new Date()): number {
  return subs
    .filter((s) => isSubscriptionActive(s, now))
    .reduce((acc, s) => acc + (Number.isFinite(s.price_ht) ? s.price_ht : 0), 0);
}

/** Agrégats de la vue admin_waitlist_stats (0049) — null si non-admin/indispo. */
export interface WaitlistStats {
  total_leads: number;
  leads_30d: number;
  leads_7d: number;
  leads_parraines: number;
}
