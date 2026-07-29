// Edge Function `wrapped-stats` — SPAWT Wrapped (post-MVP #11/#15).
// Runtime : Deno (Supabase Edge).
//
// Rétrospective annuelle du spawter : agrège SES spawts vérifiés de l'année
// (spawt_checkin), ses communes, sa cuisine dominante, son lieu fétiche, sa
// note moyenne, son identité (archétype + stade + n° Pionnier) et ses badges
// débloqués. Chaque agrégat est BEST-EFFORT : un échec partiel (table
// indisponible, colonne inattendue) renvoie `null` sur le champ concerné —
// JAMAIS une 500 globale. La 500 est réservée à la misconfiguration Edge.
//
// Contrat :
//   POST /functions/v1/wrapped-stats
//   Headers : Authorization: Bearer <access_token spawter> · apikey: <anon>
//   Body    : {"year"?: 2026}   (défaut : année UTC courante)
//   200 → {"year":2026,"stats":{
//            "total_spawts":12,"unique_places":8,
//            "communes_count":4,"top_commune":"Cocody Riviera",
//            "top_cuisine":"ivoirienne",
//            "top_place":{"id":"…","name":"Chez Ambroise","count":4},
//            "avg_note":4.3,
//            "archetype":"gardien","stade":"explorateur","pionnier_seq":42,
//            "badges_unlocked":["premier_spawt","traversee"],
//            "top_month":{"month":8,"count":5}
//         }}   — tout champ de stats est nullable (best-effort)
//   400 → {"error":"invalid_json"|"invalid_year"}
//   401 → {"error":"invalid_token"} (session expirée → relogin)
//   405 → {"error":"method_not_allowed"}
//   500 → {"error":"edge_misconfigured"}
//
// Secrets attendus côté Supabase Edge env (injectés par la plateforme) :
//   SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
//   ALLOWED_ORIGINS — CSV origins autorisés (CORS fail-closed, pattern otp-send)

// @ts-expect-error — résolu en Deno runtime (URL imports)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// @ts-expect-error — Deno global
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve: (h: (req: Request) => Promise<Response> | Response) => void;
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WrappedStatsPayload {
  year?: unknown;
}

export interface WrappedStatsBody {
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

/** Row `spawt_checkin` jointe à `places` telle que remontée par la query. */
interface CheckinRow {
  place_id: string;
  arrived_at: string;
  is_verified: boolean;
  note_etoiles: number | null;
  places: { name: string; neighborhood: string; cuisine: string[] } | null;
}

/** Sous-ensemble du client supabase-js utilisé ici — injectable en test. */
// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

export interface WrappedDeps {
  createAnonClient?: (url: string, key: string) => SupabaseLike;
  createServiceClient?: (url: string, key: string) => SupabaseLike;
}

// ─── CORS — pattern fail-closed otp-send / payment-checkout (P-09/P-11) ─────

function readAllowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS");
  if (!raw) return [];
  return raw.split(",").map((o: string) => o.trim()).filter((o: string) => o.length > 0);
}

function corsHeaders(req: Request): Record<string, string> {
  const allowed = readAllowedOrigins();
  const origin = req.headers.get("origin");
  // P-09 — origin non-whitelistée jamais reflétée : "null" systématique.
  const reflect = origin && allowed.includes(origin) ? origin : "null";
  return {
    "access-control-allow-origin": reflect,
    "access-control-allow-headers": "authorization, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "vary": "origin",
  };
}

function json(body: unknown, req: Request, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(req) },
  });
}

// ─── Agrégation pure (testable sans réseau) ─────────────────────────────────

/**
 * Calcule les agrégats dérivés des rows spawt_checkin de l'année.
 * Base "spawts" : vérifiés uniquement (is_verified) — mêmes exclusions que le
 * moteur de badges 0036 (les filtres seed/cancelled/deleted sont posés par la
 * query). Base "avis" : rows avec note_etoiles non-null (vérifiées ou non).
 */
export function aggregateCheckins(rows: readonly CheckinRow[]): Pick<
  WrappedStatsBody,
  | "total_spawts"
  | "unique_places"
  | "communes_count"
  | "top_commune"
  | "top_cuisine"
  | "top_place"
  | "avg_note"
  | "top_month"
> {
  const verified = rows.filter((r) => r.is_verified);

  const placeCounts = new Map<string, { name: string; count: number }>();
  const communeCounts = new Map<string, number>();
  const cuisineCounts = new Map<string, number>();
  const monthCounts = new Map<number, number>();

  for (const r of verified) {
    const prev = placeCounts.get(r.place_id);
    const name = r.places?.name ?? "";
    placeCounts.set(r.place_id, { name: prev?.name || name, count: (prev?.count ?? 0) + 1 });

    const commune = r.places?.neighborhood;
    if (commune) communeCounts.set(commune, (communeCounts.get(commune) ?? 0) + 1);

    for (const c of r.places?.cuisine ?? []) {
      if (typeof c === "string" && c.length > 0) {
        cuisineCounts.set(c, (cuisineCounts.get(c) ?? 0) + 1);
      }
    }

    const month = new Date(r.arrived_at).getUTCMonth() + 1; // 1-12
    if (month >= 1 && month <= 12) monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
  }

  const notes = rows
    .map((r) => r.note_etoiles)
    .filter((n): n is number => typeof n === "number" && n >= 1 && n <= 5);
  const avg_note = notes.length > 0
    ? Math.round((notes.reduce((a, b) => a + b, 0) / notes.length) * 10) / 10
    : null;

  const topEntry = <K>(m: Map<K, number>): [K, number] | null => {
    let best: [K, number] | null = null;
    for (const [k, v] of m) if (!best || v > best[1]) best = [k, v];
    return best;
  };

  const topCommune = topEntry(communeCounts);
  const topCuisine = topEntry(cuisineCounts);
  const topMonth = topEntry(monthCounts);

  let topPlace: { id: string; name: string; count: number } | null = null;
  for (const [id, info] of placeCounts) {
    if (!topPlace || info.count > topPlace.count) {
      topPlace = { id, name: info.name, count: info.count };
    }
  }

  return {
    total_spawts: verified.length,
    unique_places: placeCounts.size,
    communes_count: communeCounts.size,
    top_commune: topCommune ? topCommune[0] : null,
    top_cuisine: topCuisine ? topCuisine[0] : null,
    top_place: topPlace,
    avg_note,
    top_month: topMonth ? { month: topMonth[0], count: topMonth[1] } : null,
  };
}

// ─── Handler ────────────────────────────────────────────────────────────────

const EMPTY_STATS: WrappedStatsBody = {
  total_spawts: null,
  unique_places: null,
  communes_count: null,
  top_commune: null,
  top_cuisine: null,
  top_place: null,
  avg_note: null,
  archetype: null,
  stade: null,
  pionnier_seq: null,
  badges_unlocked: null,
  top_month: null,
};

export async function handleRequest(req: Request, deps: WrappedDeps = {}): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "content-type": "application/json", allow: "POST, OPTIONS", ...corsHeaders(req) },
    });
  }

  let payload: WrappedStatsPayload;
  try {
    const raw = await req.text();
    payload = raw.trim().length === 0 ? {} : (JSON.parse(raw) as WrappedStatsPayload);
  } catch {
    return json({ error: "invalid_json" }, req, 400);
  }

  // year : optionnel, défaut année UTC courante. Entier plausible exigé — un
  // 1999 ou un 3000 est un bug client, pas une année de spawts.
  const currentYear = new Date().getUTCFullYear();
  let year = currentYear;
  if (payload.year !== undefined && payload.year !== null) {
    if (
      typeof payload.year !== "number" ||
      !Number.isInteger(payload.year) ||
      payload.year < 2020 ||
      payload.year > currentYear + 1
    ) {
      return json({ error: "invalid_year" }, req, 400);
    }
    year = payload.year;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRole) {
    return json({ error: "edge_misconfigured" }, req, 500);
  }

  // ── Authentification spawter — client ANON + getUser(token), pattern
  // payment-checkout : validation GoTrue du JWT, jamais via service_role. ────
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "invalid_token" }, req, 401);

  const makeAnon = deps.createAnonClient ?? ((u: string, k: string) => createClient(u, k));
  const makeAdmin = deps.createServiceClient ?? ((u: string, k: string) => createClient(u, k));

  const anonClient = makeAnon(supabaseUrl, anonKey);
  const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return json({ error: "invalid_token" }, req, 401);
  }
  const spawterId: string = userData.user.id;

  // Lectures agrégées via service_role : spawt_checkin est RLS own-rows, mais
  // l'Edge lit pour LE spawter authentifié uniquement (filtre spawter_id).
  const admin = makeAdmin(supabaseUrl, serviceRole);

  const yearStart = `${year}-01-01T00:00:00Z`;
  const yearEnd = `${year + 1}-01-01T00:00:00Z`;

  const stats: WrappedStatsBody = { ...EMPTY_STATS };

  // ── 1. Spawts de l'année (join places) — best-effort ──────────────────────
  try {
    const { data, error } = await admin
      .from("spawt_checkin")
      .select("place_id, arrived_at, is_verified, note_etoiles, places(name, neighborhood, cuisine)")
      .eq("spawter_id", spawterId)
      .eq("is_cancelled", false)
      .eq("is_seed", false)
      .is("deleted_at", null)
      .gte("arrived_at", yearStart)
      .lt("arrived_at", yearEnd);
    if (error) throw error;
    const rows: CheckinRow[] = (data ?? []).map((r: Record<string, unknown>) => {
      // La relation `places` peut remonter objet ou array selon le SDK.
      const rawPlace = Array.isArray(r.places) ? r.places[0] : r.places;
      const p = (rawPlace ?? null) as CheckinRow["places"];
      return {
        place_id: String(r.place_id),
        arrived_at: String(r.arrived_at),
        is_verified: r.is_verified === true,
        note_etoiles: typeof r.note_etoiles === "number" ? r.note_etoiles : null,
        places: p && typeof p === "object"
          ? {
            name: typeof p.name === "string" ? p.name : "",
            neighborhood: typeof p.neighborhood === "string" ? p.neighborhood : "",
            cuisine: Array.isArray(p.cuisine) ? p.cuisine : [],
          }
          : null,
      };
    });
    Object.assign(stats, aggregateCheckins(rows));
  } catch (err) {
    console.log(JSON.stringify({
      evt: "wrapped_stats_partial_failure",
      part: "spawt_checkin",
      detail: err instanceof Error ? err.message : String(err),
    }));
  }

  // ── 2. Identité (archétype + n° Pionnier) — best-effort ───────────────────
  try {
    const { data, error } = await admin
      .from("spawters")
      .select("quiz_archetype, pionnier_seq")
      .eq("id", spawterId)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      stats.archetype = typeof data.quiz_archetype === "string" ? data.quiz_archetype : null;
      stats.pionnier_seq = typeof data.pionnier_seq === "number" ? data.pionnier_seq : null;
    }
  } catch (err) {
    console.log(JSON.stringify({
      evt: "wrapped_stats_partial_failure",
      part: "spawters",
      detail: err instanceof Error ? err.message : String(err),
    }));
  }

  // ── 3. Stade courant (spawter_progression) — best-effort ──────────────────
  try {
    const { data, error } = await admin
      .from("spawter_progression")
      .select("stade")
      .eq("spawter_id", spawterId)
      .maybeSingle();
    if (error) throw error;
    stats.stade = data && typeof data.stade === "string" ? data.stade : null;
  } catch (err) {
    console.log(JSON.stringify({
      evt: "wrapped_stats_partial_failure",
      part: "spawter_progression",
      detail: err instanceof Error ? err.message : String(err),
    }));
  }

  // ── 4. Badges débloqués dans l'année (spawter_badges 0036) — best-effort ──
  try {
    const { data, error } = await admin
      .from("spawter_badges")
      .select("badge_code, unlocked_at")
      .eq("spawter_id", spawterId)
      .gte("unlocked_at", yearStart)
      .lt("unlocked_at", yearEnd);
    if (error) throw error;
    stats.badges_unlocked = (data ?? [])
      .map((r: Record<string, unknown>) => r.badge_code)
      .filter((c: unknown): c is string => typeof c === "string");
  } catch (err) {
    console.log(JSON.stringify({
      evt: "wrapped_stats_partial_failure",
      part: "spawter_badges",
      detail: err instanceof Error ? err.message : String(err),
    }));
  }

  console.log(JSON.stringify({
    evt: "wrapped_stats_served",
    spawter_id: spawterId,
    year,
    total_spawts: stats.total_spawts,
  }));
  return json({ year, stats }, req);
}

Deno.serve((req: Request) => handleRequest(req));
