// Story 6.3 — Upsert idempotent d'un lieu + 3 avis fondateurs is_seed = true.
// Bypass RLS via service_role. Anti-fraude trigger skip déjà câblé `is_seed = true`.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

interface SeedPlaceInput {
  name: string;
  cuisine: string[];
  lat: number;
  lng: number;
  descriptive_address: string;
  neighborhood: string;
  city: string;
  price_tier: 1 | 2 | 3;
  avg_ticket_xof: number | null;
  hours: Record<string, Array<{ open: string; close: string }>>;
  phone: string | null;
  whatsapp: string | null;
  cover_photo_url: string | null;
  gallery_urls: string[];
  signals: string[];
  is_published: boolean;
  adn: {
    axe_local_international: number;
    axe_informel_etabli: number;
    axe_budget_premium: number;
    axe_populaire_prive: number;
    axe_decontracte_habille: number;
  };
  reviews: Array<{
    note_etoiles: 1 | 2 | 3 | 4 | 5;
    tags: string[];
    texte_avis: string;
  }>;
}

interface SeedRequest {
  seed_spawter_id: string;
  places: SeedPlaceInput[];
}

interface PlaceResult {
  name: string;
  place_id?: string;
  status: "created" | "updated" | "error";
  error?: string;
}

serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const authHeader = req.headers.get("Authorization") ?? "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const callerClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) {
    return new Response(
      JSON.stringify({ data: null, error: { code: "UNAUTHENTICATED" } }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const { data: staff } = await supabase
    .from("spawt_staff")
    .select("id, role, is_active")
    .eq("id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!staff) {
    return new Response(
      JSON.stringify({ data: null, error: { code: "FORBIDDEN" } }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const payload = (await req.json()) as SeedRequest;
  const results: PlaceResult[] = [];

  for (const place of payload.places) {
    try {
      // 1. Upsert places (clé naturelle = name + neighborhood, case-insensitive).
      const { data: existing } = await supabase
        .from("places")
        .select("id")
        .ilike("name", place.name)
        .ilike("neighborhood", place.neighborhood)
        .maybeSingle();

      let placeId: string;
      let status: PlaceResult["status"];

      if (existing) {
        placeId = existing.id;
        await supabase
          .from("places")
          .update({
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
          })
          .eq("id", placeId);
        status = "updated";
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from("places")
          .insert({
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
          })
          .select("id")
          .single();
        if (insErr || !inserted) throw insErr ?? new Error("insert failed");
        placeId = inserted.id as string;
        status = "created";
      }

      // 2. Upsert place_adn (clé = place_id).
      await supabase
        .from("place_adn")
        .upsert({
          place_id: placeId,
          ...place.adn,
          // total_reviews + weighted_rating exclus seed (compteur public)
          confidence_score: 0.5,
        }, { onConflict: "place_id" });

      // 3. Insert 3 avis seed (is_seed = true bypass triggers anti-fraude).
      // Idempotence : on n'insère que si aucune review seed n'existe déjà pour ce (spawter_seed, place).
      const { data: existingReviews } = await supabase
        .from("spawt_checkin")
        .select("id")
        .eq("place_id", placeId)
        .eq("is_seed", true);
      if (!existingReviews || existingReviews.length === 0) {
        for (const r of place.reviews) {
          await supabase.from("spawt_checkin").insert({
            spawter_id: payload.seed_spawter_id,
            place_id: placeId,
            arrived_at: new Date().toISOString(),
            checked_in_at: new Date().toISOString(),
            check_in_type: "active",
            is_verified: true,
            note_etoiles: r.note_etoiles,
            tags: r.tags,
            texte_avis: r.texte_avis,
            photos: [],
            is_cancelled: false,
            is_seed: true,
          });
        }
      }

      results.push({ name: place.name, place_id: placeId, status });
    } catch (err) {
      results.push({
        name: place.name,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 4. Audit log batch.
  await supabase.from("admin_audit_log").insert({
    spawt_staff_id: user.id,
    action: "seed_inventory_run",
    entity_type: "seed_batch",
    entity_id: null,
    payload_after: { count: payload.places.length, results_summary: results.map((r) => r.status) },
  });

  return new Response(
    JSON.stringify({ data: { results, total: results.length }, error: null }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
