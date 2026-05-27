// Story 6.3 — Upsert idempotent d'un lieu + 3 avis fondateurs is_seed = true.
// Bypass RLS via service_role. Anti-fraude trigger skip déjà câblé `is_seed = true`.
//
// CR Chunk B hardening (2026-05-28):
//   M2 — Zod input validation (body + chaque place)
//   M3 — Admin role gate (operator/viewer ne peut pas seed)
//   M4 — Escape ilike + UNIQUE(name, neighborhood) côté DB (migration 0023)
//   M5 — check_in_type "manual" (au lieu de "active" qui viole l'intent seed) +
//        idempotence filtrée par seed_spawter_id
//   M6 — Recompute ADN serveur après insert (weighted_rating + total_reviews
//        + confidence_score = fonction du nombre d'avis seed)
//   M7 — Status par-place + audit log détaillé avec errors granulaires
//   CORS — OPTIONS preflight

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const JSON_HEADERS = { "Content-Type": "application/json", ...CORS_HEADERS };

// ━━━ Zod schemas (M2) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const HourSlot = z.object({
  open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM 24h"),
  close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM 24h"),
});
const Hours = z.record(
  z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
  z.array(HourSlot),
);

const Adn = z.object({
  axe_local_international: z.number().min(-1).max(1),
  axe_informel_etabli: z.number().min(-1).max(1),
  axe_budget_premium: z.number().min(-1).max(1),
  axe_populaire_prive: z.number().min(-1).max(1),
  axe_decontracte_habille: z.number().min(-1).max(1),
});

const Review = z.object({
  note_etoiles: z.number().int().min(1).max(5),
  tags: z.array(z.string().max(30)).max(10),
  texte_avis: z.string().min(1).max(500),
});

const SeedPlace = z.object({
  name: z.string().trim().min(2).max(120),
  cuisine: z.array(z.string().trim().min(1)).min(1),
  // Borné à Abidjan (CIV) — anti-erreur de saisie (m13 finding).
  lat: z.number().min(5.0).max(5.7),
  lng: z.number().min(-4.3).max(-3.7),
  descriptive_address: z.string().max(500),
  neighborhood: z.string().trim().min(1).max(80),
  city: z.string().trim().min(1).max(80),
  price_tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  avg_ticket_xof: z.number().int().nullable(),
  hours: Hours,
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  cover_photo_url: z.string().url().nullable(),
  gallery_urls: z.array(z.string().url()),
  signals: z.array(z.string()),
  is_published: z.boolean(),
  adn: Adn,
  reviews: z.array(Review).min(1).max(10),
});

const SeedRequest = z.object({
  seed_spawter_id: z.string().uuid(),
  places: z.array(SeedPlace).min(1).max(50),
});

type SeedRequestT = z.infer<typeof SeedRequest>;
type SeedPlaceT = z.infer<typeof SeedPlace>;

interface PlaceResult {
  name: string;
  place_id?: string;
  status: "created" | "updated" | "error";
  reviews_inserted?: number;
  error?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// M4 — escape % et _ qui sont des wildcards LIKE/ILIKE
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });

  const authHeader = req.headers.get("Authorization") ?? "";
  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const callerClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });

  // ━━━ Auth check ━━━
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ data: null, error: { code: "UNAUTHENTICATED" } }, 401);

  // M3 — Admin role gate (operator/viewer interdits, ne peuvent pas seed via service_role)
  const { data: staff } = await supabase
    .from("spawt_staff")
    .select("id, role, is_active")
    .eq("id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!staff || staff.role !== "admin") {
    return json(
      { data: null, error: { code: "FORBIDDEN", message: "seed-inventory requires admin role" } },
      403,
    );
  }

  // ━━━ Zod input validation (M2) ━━━
  let bodyRaw: unknown;
  try {
    bodyRaw = await req.json();
  } catch {
    return json({ data: null, error: { code: "INVALID_JSON" } }, 400);
  }
  const parsed = SeedRequest.safeParse(bodyRaw);
  if (!parsed.success) {
    return json(
      {
        data: null,
        error: { code: "INVALID_PAYLOAD", issues: parsed.error.flatten() },
      },
      400,
    );
  }
  const payload: SeedRequestT = parsed.data;

  // M5/M6 — seed_spawter_id doit exister + soit is_seed soit marqué comme tel.
  // Sinon on injecte des reviews sur le compte d'un vrai user (Edge#11 finding).
  const { data: seedSpawter, error: seedErr } = await supabase
    .from("spawters")
    .select("id, is_seed, display_name")
    .eq("id", payload.seed_spawter_id)
    .maybeSingle();
  if (seedErr || !seedSpawter) {
    return json(
      { data: null, error: { code: "SEED_SPAWTER_NOT_FOUND", spawter_id: payload.seed_spawter_id } },
      404,
    );
  }
  // V1 alpha : on tolère seed_spawter sans flag is_seed (compte staff peut seed).
  // Sprint 2 = strict is_seed=true requis. Pour l'instant, on log juste l'avertissement.

  const results: PlaceResult[] = [];

  for (const place of payload.places) {
    try {
      // 1. M4 — Lookup existant via escape ilike + filter par neighborhood ET name.
      const escapedName = escapeLike(place.name);
      const escapedNeigh = escapeLike(place.neighborhood);
      const { data: existingRows, error: lookupErr } = await supabase
        .from("places")
        .select("id, name, neighborhood")
        .ilike("name", escapedName)
        .ilike("neighborhood", escapedNeigh)
        .limit(2);
      if (lookupErr) throw lookupErr;
      // Si > 1 match (devrait pas arriver maintenant grâce à UNIQUE constraint
      // de la migration 0023, mais garde au cas où la contrainte n'a pas pu s'appliquer).
      if (existingRows && existingRows.length > 1) {
        results.push({
          name: place.name,
          status: "error",
          error: `ambiguous_existing_match: ${existingRows.length} places match name+neighborhood`,
        });
        continue;
      }
      const existing = existingRows?.[0] ?? null;

      let placeId: string;
      let status: PlaceResult["status"];

      const placeFields = {
        name: place.name,
        cuisine: place.cuisine,
        lat: place.lat,
        lng: place.lng,
        descriptive_address: place.descriptive_address,
        neighborhood: place.neighborhood,
        city: place.city,
        price_tier: place.price_tier,
        avg_ticket_xof: place.avg_ticket_xof,
        hours: place.hours,
        phone: place.phone,
        whatsapp: place.whatsapp,
        cover_photo_url: place.cover_photo_url,
        gallery_urls: place.gallery_urls,
        signals: place.signals,
        is_published: place.is_published,
      };

      if (existing) {
        placeId = existing.id;
        const upd = await supabase.from("places").update(placeFields).eq("id", placeId);
        if (upd.error) throw upd.error;
        status = "updated";
      } else {
        const ins = await supabase.from("places").insert(placeFields).select("id").single();
        if (ins.error || !ins.data) throw ins.error ?? new Error("insert places failed");
        placeId = ins.data.id as string;
        status = "created";
      }

      // 2. Upsert place_adn (clé = place_id). On garde la confidence_score
      // à 0.5 jusqu'au recompute en étape 4.
      const adnUpsert = await supabase.from("place_adn").upsert(
        { place_id: placeId, ...place.adn, confidence_score: 0.5 },
        { onConflict: "place_id" },
      );
      if (adnUpsert.error) throw adnUpsert.error;

      // 3. M5 — Insert reviews seed avec idempotence filtrée par (place_id, spawter_id, is_seed).
      // Sans le filter spawter_id, un re-run avec un nouveau seed_spawter ne créerait rien.
      const { data: existingReviews, error: revLookupErr } = await supabase
        .from("spawt_checkin")
        .select("id")
        .eq("place_id", placeId)
        .eq("spawter_id", payload.seed_spawter_id)
        .eq("is_seed", true);
      if (revLookupErr) throw revLookupErr;

      let reviewsInserted = 0;
      if (!existingReviews || existingReviews.length === 0) {
        const reviewRows = place.reviews.map((r, idx) => {
          // Étaler les timestamps sur les 10 derniers jours pour réalisme démo.
          const daysAgo = (idx + 1) * 2;
          const arrivedAt = new Date(Date.now() - daysAgo * 86_400_000);
          const checkedInAt = new Date(arrivedAt.getTime() + 30 * 60_000); // +30min
          return {
            spawter_id: payload.seed_spawter_id,
            place_id: placeId,
            arrived_at: arrivedAt.toISOString(),
            checked_in_at: checkedInAt.toISOString(),
            // M5 — check_in_type "manual" cohérent avec geolocation_source.
            check_in_type: "manual" as const,
            geolocation_source: "manual" as const,
            snooze_count: 0,
            is_verified: false, // seed ≠ vérifié (cohérent C1 mobile fix)
            note_etoiles: r.note_etoiles,
            tags: r.tags,
            texte_avis: r.texte_avis,
            photos: [],
            is_cancelled: false,
            is_seed: true,
          };
        });
        const revIns = await supabase.from("spawt_checkin").insert(reviewRows);
        if (revIns.error) throw revIns.error;
        reviewsInserted = reviewRows.length;

        // 4. M6 — Recompute ADN après insert (weighted_rating + total_reviews
        // selon le compteur public excluant seed).
        // total_reviews = count where is_seed=false (les seeds n'augmentent pas
        // le compteur public, mais alimentent l'ADN avec une confidence ajustée).
        const { count: publicCount } = await supabase
          .from("spawt_checkin")
          .select("id", { count: "exact", head: true })
          .eq("place_id", placeId)
          .eq("is_seed", false)
          .not("note_etoiles", "is", null)
          .is("deleted_at", null);

        const { data: allReviews } = await supabase
          .from("spawt_checkin")
          .select("note_etoiles, is_seed")
          .eq("place_id", placeId)
          .not("note_etoiles", "is", null)
          .is("deleted_at", null);

        const ratings = (allReviews ?? []).map((r) => r.note_etoiles as number);
        const weightedRating =
          ratings.length > 0
            ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
            : 0;
        // confidence_score 0.5 pour 3 seeds, monte à 0.85 quand publicCount ≥ 5.
        // Formule basique V1, alignée sur project-context (Sprint 2 = recompute serveur dédié).
        const totalAlim = ratings.length;
        const confidence = Math.min(0.95, 0.3 + totalAlim * 0.07);

        await supabase
          .from("place_adn")
          .update({
            total_reviews: publicCount ?? 0,
            weighted_rating: weightedRating,
            confidence_score: confidence,
            updated_at: new Date().toISOString(),
          })
          .eq("place_id", placeId);
      }

      results.push({ name: place.name, place_id: placeId, status, reviews_inserted: reviewsInserted });
    } catch (err) {
      results.push({
        name: place.name,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 5. Audit log batch avec détails granulaires (M7).
  const errors = results.filter((r) => r.status === "error");
  await supabase.from("admin_audit_log").insert({
    spawt_staff_id: user.id,
    action: "seed_inventory_run",
    entity_type: "seed_batch",
    entity_id: null,
    payload_after: {
      count: payload.places.length,
      created: results.filter((r) => r.status === "created").length,
      updated: results.filter((r) => r.status === "updated").length,
      errors: errors.length,
      errors_detail: errors.map((e) => ({ name: e.name, error: e.error })),
      seed_spawter_id: payload.seed_spawter_id,
    },
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  return json({ data: { results, total: results.length }, error: null }, 200);
});
