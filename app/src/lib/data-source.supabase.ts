// Implémentation Supabase — chargée dynamiquement par data-source.ts
// quand EXPO_PUBLIC_SUPABASE_URL + ANON_KEY sont configurés.
//
// Story 3.3a — durcissement Zod parse à la frontière + fallback transparent.
// Une row malformée est droppée silencieusement (warn en __DEV__) au lieu
// de casser tout le feed.

import { supabase } from "./supabase";
import type { Spawter } from "../types/spawter";
import type { UserPalais } from "../types/palais";
import type { SpawtCheckin } from "../types/spawt";
import type { FeatureFlag } from "../types/feature-flag";
import type { PlaceWithAdn } from "./data-source";
import { PlaceWithAdnSchema } from "../types/place.schema";

/**
 * Liste les lieux publiés via le SDK Supabase + Zod parse fail-safe.
 *
 * Pivot DB → TS :
 *   - colonnes plates (`lat`, `lng`, `descriptive_address`, `neighborhood`, `city`) → `location: {…}`
 *   - colonnes plates (`price_tier`, `avg_ticket_xof`) → `price: {…}`
 *   - relation `place_adn` (Supabase nested) → `adn: {…}`
 *
 * Si une row échoue le parse → dropée + warn __DEV__, la liste continue.
 */
export async function listPlacesFromSupabase(): Promise<PlaceWithAdn[]> {
  const { data: rows, error } = await supabase
    .from("places")
    .select("*, place_adn(*)")
    .eq("is_published", true);

  if (error) {
    if (__DEV__) console.warn("[data-source] listPlaces failed", error);
    return [];
  }

  return parseRows(rows ?? []);
}

export async function getPlaceFromSupabase(id: string): Promise<PlaceWithAdn | null> {
  const { data, error } = await supabase
    .from("places")
    .select("*, place_adn(*)")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  const parsed = parseRows([data]);
  return parsed[0] ?? null;
}

function parseRows(rows: readonly unknown[]): PlaceWithAdn[] {
  const out: PlaceWithAdn[] = [];
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const adn = r.place_adn as Record<string, unknown> | undefined;
    if (!adn) {
      if (__DEV__) console.warn("[data-source] place row dropped — missing place_adn", r.id);
      continue;
    }
    const candidate = {
      id: r.id,
      name: r.name,
      cuisine: r.cuisine,
      location: {
        lat: r.lat,
        lng: r.lng,
        descriptive_address: r.descriptive_address,
        neighborhood: r.neighborhood,
        city: r.city,
      },
      price: {
        tier: r.price_tier,
        avg_ticket_xof: r.avg_ticket_xof ?? null,
      },
      hours: r.hours,
      phone: r.phone ?? null,
      whatsapp: r.whatsapp ?? null,
      cover_photo_url: r.cover_photo_url ?? null,
      gallery_urls: r.gallery_urls,
      signals: r.signals,
      is_published: r.is_published,
      created_at: r.created_at,
      updated_at: r.updated_at,
      adn,
      rating_display: (adn.weighted_rating as number | undefined) ?? 0,
      total_spawts: (r.total_spawts as number | undefined) ?? 0,
    };
    const parsed = PlaceWithAdnSchema.safeParse(candidate);
    if (parsed.success) {
      out.push(parsed.data as unknown as PlaceWithAdn);
    } else if (__DEV__) {
      console.warn(
        "[data-source] place row dropped — Zod parse failed",
        parsed.error.flatten(),
      );
    }
  }
  return out;
}

// Story 4.4 — Set in-memory pour anti-replay du `antifraud_flag_raised` event.
// Pas de persistance V1 : re-émission au boot acceptable (analytics queue est
// idempotente côté server). Vise à éviter le bruit dans une même session.
const seenFlaggedRowIds = new Set<string>();

export async function listSpawtsFromSupabase(spawter_id: string): Promise<SpawtCheckin[]> {
  const { data, error } = await supabase
    .from("spawt_checkin")
    .select("*")
    .eq("spawter_id", spawter_id)
    .order("created_at", { ascending: false });

  if (error) return [];
  const rows = (data ?? []) as SpawtCheckin[];

  // Story 4.4 — émission `antifraud_flag_raised` pour chaque row flagged jamais vue.
  // Import dynamique pour ne pas créer un cycle avec analytics.ts.
  void (async () => {
    try {
      const { track } = await import("./analytics");
      for (const row of rows) {
        if (row.flag_reason && !seenFlaggedRowIds.has(row.id)) {
          seenFlaggedRowIds.add(row.id);
          track({
            name: "antifraud_flag_raised",
            properties: {
              place_id: row.place_id,
              flag: row.flag_reason,
            },
          });
        }
      }
    } catch (err) {
      if (__DEV__) console.warn("[data-source] antifraud emit failed", err);
    }
  })();

  return rows;
}

/** Test-only — reset le set anti-replay. */
export function _resetSeenFlaggedForTest(): void {
  seenFlaggedRowIds.clear();
}

export async function saveSpawterToSupabase(spawter: Spawter): Promise<void> {
  await supabase.from("spawters").upsert(spawter);
}

export async function savePalaisToSupabase(palais: UserPalais): Promise<void> {
  await supabase.from("user_palais").upsert(palais);
}

/**
 * Story 4.3 — Upsert idempotent `spawt_checkin` (collision PK = update).
 * Retourne true si l'écriture a réussi, false sinon (caller offline-queue
 * enqueue alors la mutation).
 */
export async function upsertSpawtToSupabase(row: SpawtCheckin): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("spawt_checkin")
      .upsert(row, { onConflict: "id" });
    if (error) {
      if (__DEV__) console.warn("[spawt_checkin] upsert failed", error);
      return false;
    }
    return true;
  } catch (err) {
    if (__DEV__) console.warn("[spawt_checkin] upsert threw", err);
    return false;
  }
}

/**
 * Story 4.3 — Update partial `spawt_checkin` par id (patch story 4.2 confirm,
 * passive, snooze + story 4.5 review attached).
 */
export async function updateSpawtInSupabase(
  row_id: string,
  patch: Partial<SpawtCheckin>,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("spawt_checkin")
      .update(patch)
      .eq("id", row_id);
    if (error) {
      if (__DEV__) console.warn("[spawt_checkin] update failed", error);
      return false;
    }
    return true;
  } catch (err) {
    if (__DEV__) console.warn("[spawt_checkin] update threw", err);
    return false;
  }
}

/**
 * Liste les feature flags pour un spawter (Story 1.8).
 * RLS filtre serveur-side : globaux + overrides du spawter authentifié, et
 * exclut les flags expirés (`expires_at > now()`). Pas de filtre client —
 * évite les bugs de clock skew device.
 */
export async function listFeatureFlagsFromSupabase(
  spawter_id: string | null,
): Promise<FeatureFlag[]> {
  void spawter_id; // filtre RLS-side via auth.uid().
  const { data, error } = await supabase.from("feature_flags").select("*");
  if (error) {
    if (__DEV__) console.warn("[feature_flags] list failed", error);
    return [];
  }
  return (data ?? []) as FeatureFlag[];
}

/**
 * Insert un batch de signaux analytics dans la table append-only `user_signals`
 * (Story 1.7 — refactor Decisions D2+D3). Fire-and-forget — pas de await côté
 * caller métier. La column DB `spawter_id` a `DEFAULT auth.uid()` ; la RLS
 * valide aussi en `WITH CHECK`. Sans session auth (pre-OTP), l'insert échoue
 * côté RLS — le wrapper analytics persiste alors le batch dans AsyncStorage
 * et retentera au prochain `SIGNED_IN` (Story 2.3).
 *
 * @returns `true` si l'insert a réussi, `false` sinon. Le wrapper analytics
 * utilise ce signal pour décider de persister ou non.
 */
export async function insertUserSignals(
  payloads: readonly {
    signal_type: string;
    event_name: string;
    place_id: string | null;
    metadata: object;
  }[],
): Promise<boolean> {
  if (payloads.length === 0) return true;
  const { error } = await supabase.from("user_signals").insert(payloads as object[]);
  if (error) {
    if (__DEV__) console.warn("[user_signals] batch insert failed", error);
    return false;
  }
  return true;
}
