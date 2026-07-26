// SPAWT Wrapped (post-MVP #11/#15) — types partagés + garde saisonnière.
// Les agrégats sont calculés côté serveur (Edge `wrapped-stats`, best-effort
// champ par champ) ; le mode démo sert une fixture vivante (seed/wrapped.ts).
// L'aiguillage vit dans data-source.ts (règle d'or de l'adaptateur).

/** Miroir client de `WrappedStatsBody` (Edge wrapped-stats) — tout nullable. */
export interface WrappedStats {
  total_spawts: number | null;
  unique_places: number | null;
  communes_count: number | null;
  top_commune: string | null;
  top_cuisine: string | null;
  top_place: { id: string; name: string; count: number } | null;
  avg_note: number | null;
  archetype: string | null;
  stade: string | null;
  pionnier_seq: number | null;
  badges_unlocked: string[] | null;
  top_month: { month: number; count: number } | null;
}

export interface WrappedResult {
  year: number;
  stats: WrappedStats;
}

/**
 * Garde saisonnière de la bannière feed : le Wrapped se vit en fin d'année —
 * du 1er décembre au 15 janvier inclus. Hors fenêtre, la bannière disparaît
 * (l'écran reste accessible par deep link si le flag `wrapped` est actif).
 */
export function isWrappedSeason(now: Date = new Date()): boolean {
  const month = now.getUTCMonth(); // 0 = janvier, 11 = décembre
  if (month === 11) return true;
  if (month === 0) return now.getUTCDate() <= 15;
  return false;
}

/**
 * Année à raconter : en janvier (queue de saison), c'est l'année qui vient
 * de se terminer ; sinon l'année en cours.
 */
export function wrappedYearFor(now: Date = new Date()): number {
  const year = now.getUTCFullYear();
  return now.getUTCMonth() === 0 ? year - 1 : year;
}

/** Parse défensif de la réponse Edge (frontière réseau → TS). */
export function parseWrappedResponse(raw: unknown): WrappedResult | null {
  if (raw === null || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.year !== "number") return null;
  const s = r.stats;
  if (s === null || typeof s !== "object") return null;
  const st = s as Record<string, unknown>;
  const num = (v: unknown): number | null => (typeof v === "number" ? v : null);
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.length > 0 ? v : null;
  const topPlaceRaw = st.top_place as Record<string, unknown> | null | undefined;
  const topMonthRaw = st.top_month as Record<string, unknown> | null | undefined;
  return {
    year: r.year,
    stats: {
      total_spawts: num(st.total_spawts),
      unique_places: num(st.unique_places),
      communes_count: num(st.communes_count),
      top_commune: str(st.top_commune),
      top_cuisine: str(st.top_cuisine),
      top_place:
        topPlaceRaw && typeof topPlaceRaw === "object" &&
        typeof topPlaceRaw.name === "string" && typeof topPlaceRaw.count === "number"
          ? {
              id: String(topPlaceRaw.id ?? ""),
              name: topPlaceRaw.name,
              count: topPlaceRaw.count,
            }
          : null,
      avg_note: num(st.avg_note),
      archetype: str(st.archetype),
      stade: str(st.stade),
      pionnier_seq: num(st.pionnier_seq),
      badges_unlocked: Array.isArray(st.badges_unlocked)
        ? st.badges_unlocked.filter((c): c is string => typeof c === "string")
        : null,
      top_month:
        topMonthRaw && typeof topMonthRaw === "object" &&
        typeof topMonthRaw.month === "number" && typeof topMonthRaw.count === "number"
          ? { month: topMonthRaw.month, count: topMonthRaw.count }
          : null,
    },
  };
}
