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
import type { PlaceReview, PlaceWithAdn, ProgressionRow } from "./data-source";
import type { CollectionTitreRow } from "../types/collection-titres";
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
      // Refonte fiche lieu (R17/R19, migration 0030). `?? []` : une DB live
      // pas encore migrée renvoie undefined — le lieu doit parser quand même.
      menu_urls: r.menu_urls ?? [],
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

// ─── Story 5.1 — spawter_progression ──────────────

/**
 * Story 5.1 — Upsert `spawter_progression` (overwrite par PK spawter_id).
 * Si le trigger SQL `assert_stade_never_recedes` rejette (baisse de stade), on log
 * et on swallow — le local conserve la vérité côté client via maxStade.
 */
export async function upsertProgressionToSupabase(row: ProgressionRow): Promise<void> {
  const { error } = await supabase
    .from("spawter_progression")
    .upsert(row, { onConflict: "spawter_id" });
  if (error && __DEV__) {
    console.warn("[data-source] upsertProgression rejected", error);
  }
}

// ─── Story 5.2 — collection_titres ──────────────

/**
 * Story 5.2 — Insert append-only d'un titre. L'index unique (spawter_id, title_key)
 * rejette les doublons côté serveur (le client gate aussi via dedup local).
 */
export async function insertTitreToSupabase(row: CollectionTitreRow): Promise<void> {
  const { error } = await supabase.from("collection_titres").insert(row);
  if (error && __DEV__) {
    console.warn("[data-source] insertTitre rejected", error);
  }
}

/**
 * Story 5.2 — Set titre affiché via RPC PL/pgSQL atomique `set_displayed_title`
 * (migration 0022, CR Chunk A finding D1).
 *
 * Remplace l'ancien 2-UPDATE séquentiel qui pouvait laisser le serveur dans
 * l'état "0 titre affiché" sur partial fail (réseau coupé entre les 2 steps).
 * La RPC fait reset + set + sync `spawter_progression.current_title` dans
 * une seule transaction PG.
 */
export async function setDisplayedTitreInSupabase(
  spawter_id: string,
  title_key: string,
): Promise<void> {
  const { error } = await supabase.rpc("set_displayed_title", {
    p_spawter_id: spawter_id,
    p_title_key: title_key,
  });
  if (error && __DEV__) {
    console.warn("[data-source] setDisplayedTitre RPC failed", error);
  }
}

/** Story 5.2 — List titres pour un spawter (RLS auto-filter own only). */
export async function listTitresFromSupabase(
  spawter_id: string,
): Promise<CollectionTitreRow[]> {
  const { data, error } = await supabase
    .from("collection_titres")
    .select("*")
    .eq("spawter_id", spawter_id)
    .order("unlocked_at", { ascending: true });
  if (error) {
    if (__DEV__) console.warn("[data-source] listTitres failed", error);
    return [];
  }
  return (data ?? []) as CollectionTitreRow[];
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
// ─── Story 4.9 — reviews d'un lieu ──────────────

/**
 * Liste les avis d'un lieu (Story 4.9 — AC #1).
 *
 * Critères :
 *   - `place_id = X`
 *   - `note_etoiles IS NOT NULL` (inclut `is_seed = true` pour la démo V1).
 *   - join `spawters!inner` → 1 round-trip réseau pour name + avatar.
 *   - Tri : note desc puis created_at desc (qualité puis fraîcheur).
 *   - Limit configurable (5 par défaut sur la fiche).
 *
 * Le mapping Supabase remonte `spawters` comme objet (relation 1:1 via FK),
 * mais le typage SDK le déclare comme `object | object[]` pour couvrir les
 * deux cas (1:1 vs 1:n). On normalise via `Array.isArray()` pour rester
 * defensive — si la relation devenait array, on prend `[0]`.
 */
export async function listReviewsForPlaceFromSupabase(
  placeId: string,
  limit: number,
): Promise<PlaceReview[]> {
  const { data, error } = await supabase
    .from("spawt_checkin")
    .select(
      "id, spawter_id, note_etoiles, texte_avis, photos, created_at, is_seed, spawters_public!inner(display_name, avatar_url)",
    )
    .eq("place_id", placeId)
    .not("note_etoiles", "is", null)
    .order("note_etoiles", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    if (__DEV__ && error) console.warn("[data-source] listReviewsForPlace failed", error);
    return [];
  }

  const out: PlaceReview[] = [];
  for (const row of data) {
    const r = row as Record<string, unknown>;
    // Le SDK peut remonter la relation jointe en objet OU en array selon la
    // version. On normalise les deux cas plutôt que d'assumer une forme.
    const rel = r.spawters_public as
      | { display_name?: unknown; avatar_url?: unknown }
      | { display_name?: unknown; avatar_url?: unknown }[]
      | null
      | undefined;
    const flat = Array.isArray(rel) ? rel[0] : rel;
    if (!flat || typeof flat.display_name !== "string") {
      if (__DEV__) console.warn("[data-source] review row dropped — missing spawter join", r.id);
      continue;
    }
    const rawPhotos = Array.isArray(r.photos) ? r.photos : [];
    const photos = rawPhotos.filter(
      (p): p is string => typeof p === "string" && p.length > 0,
    );
    out.push({
      id: String(r.id),
      spawter_id: String(r.spawter_id),
      spawter_display_name: flat.display_name,
      spawter_avatar_url:
        typeof flat.avatar_url === "string" && flat.avatar_url.length > 0
          ? flat.avatar_url
          : null,
      note_etoiles: Number(r.note_etoiles ?? 0),
      texte_avis: typeof r.texte_avis === "string" ? r.texte_avis : null,
      photos,
      created_at: String(r.created_at ?? ""),
      is_seed: Boolean(r.is_seed),
    });
  }
  return out;
}

/**
 * Story 4.12 — Compte exact des avis d'un lieu (head request, 0 ligne
 * transférée). Même filtre que `listReviewsForPlaceFromSupabase`.
 */
export async function countReviewsForPlaceFromSupabase(
  placeId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("spawt_checkin")
    .select("id", { count: "exact", head: true })
    .eq("place_id", placeId)
    .not("note_etoiles", "is", null);

  if (error) {
    if (__DEV__) console.warn("[data-source] countReviewsForPlace failed", error);
    return 0;
  }
  return count ?? 0;
}

/**
 * Refonte fiche lieu (R17/Q1) — photos des spawts d'un lieu (« galerie des
 * spawters », onglet Média). Champ `photos TEXT[]` de `spawt_checkin`
 * (migration 0011), flatten côté client.
 *
 * Filtres alignés sur la RLS 0021 (`note_etoiles IS NOT NULL AND deleted_at
 * IS NULL`) + `photos != '{}'` pour ne pas gaspiller la limite de rows sur
 * des avis sans photo. Tri fraîcheur (created_at desc), cap `limit` photos.
 */
export async function listPlacePhotosFromSpawtsFromSupabase(
  placeId: string,
  limit: number,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("spawt_checkin")
    .select("photos")
    .eq("place_id", placeId)
    .not("note_etoiles", "is", null)
    .is("deleted_at", null)
    .not("photos", "eq", "{}")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    if (__DEV__ && error) {
      console.warn("[data-source] listPlacePhotosFromSpawts failed", error);
    }
    return [];
  }

  const out: string[] = [];
  for (const row of data) {
    const raw = (row as { photos?: unknown }).photos;
    if (!Array.isArray(raw)) continue;
    for (const p of raw) {
      if (typeof p === "string" && p.length > 0) {
        out.push(p);
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

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

// ─── Câblage MVP — favoris cross-device (migration 0024) ────────────────────

export async function listSavedPlaceIdsFromSupabase(
  spawter_id: string,
): Promise<string[] | null> {
  const { data, error } = await supabase
    .from("saved_places")
    .select("place_id")
    .eq("spawter_id", spawter_id);
  if (error) {
    if (__DEV__) console.warn("[data-source] listSavedPlaceIds failed", error);
    return null;
  }
  return (data ?? []).map((r) => (r as { place_id: string }).place_id);
}

export async function insertSavedPlaceToSupabase(
  spawter_id: string,
  place_id: string,
): Promise<void> {
  const { error } = await supabase
    .from("saved_places")
    .upsert({ spawter_id, place_id }, { onConflict: "spawter_id,place_id" });
  if (error && __DEV__) console.warn("[data-source] insertSavedPlace failed", error);
}

export async function deleteSavedPlaceFromSupabase(
  spawter_id: string,
  place_id: string,
): Promise<void> {
  const { error } = await supabase
    .from("saved_places")
    .delete()
    .eq("spawter_id", spawter_id)
    .eq("place_id", place_id);
  if (error && __DEV__) console.warn("[data-source] deleteSavedPlace failed", error);
}

// ─── Câblage MVP — signalement d'avis (migration 0026) ──────────────────────

export async function reportReviewToSupabase(input: {
  spawt_checkin_id: string;
  reporter_spawter_id: string;
  reason_code: "fake_review" | "hater" | "gatekeeping" | "autre";
  commentaire?: string;
}): Promise<"ok" | "duplicate" | "error" | "unavailable"> {
  const { error } = await supabase.from("review_reports").insert({
    spawt_checkin_id: input.spawt_checkin_id,
    reporter_spawter_id: input.reporter_spawter_id,
    reason_code: input.reason_code,
    ...(input.commentaire ? { commentaire: input.commentaire } : {}),
  });
  if (!error) return "ok";
  // 23505 = unique_violation (déjà signalé par ce spawter).
  if (error.code === "23505") return "duplicate";
  if (__DEV__) console.warn("[data-source] reportReview failed", error);
  return "error";
}

// ─── Phase 2 F12 — Coup de Cœur (migration 0028) ────────────────────────────

export async function giveCoupDeCoeurToSupabase(
  place_id: string,
): Promise<import("./data-source").CoupDeCoeurResult | null> {
  const { data, error } = await supabase.rpc("give_coup_de_coeur", {
    p_place_id: place_id,
  });
  if (error) {
    if (__DEV__) console.warn("[data-source] giveCoupDeCoeur failed", error);
    return null;
  }
  return data as import("./data-source").CoupDeCoeurResult;
}

export async function countCoupsDeCoeurFromSupabase(
  place_id: string,
): Promise<number | null> {
  const { data, error } = await supabase.rpc("count_coups_de_coeur", {
    p_place_id: place_id,
  });
  if (error) {
    if (__DEV__) console.warn("[data-source] countCoupsDeCoeur failed", error);
    return null;
  }
  return typeof data === "number" ? data : 0;
}

// ─── Phase 2 — suppression de compte (migration 0029) ───────────────────────

export async function requestAccountDeletionFromSupabase(): Promise<boolean> {
  const { data, error } = await supabase.rpc("request_account_deletion");
  if (error) {
    if (__DEV__) console.warn("[data-source] requestAccountDeletion failed", error);
    return false;
  }
  return Boolean((data as { ok?: boolean } | null)?.ok);
}

// ─── Phase 2 — fil d'activité de la Meute ────────────────────────────────────

export async function listMeuteActivityFromSupabase(
  limit: number,
): Promise<import("./data-source").MeuteActivityItem[]> {
  const half = Math.ceil(limit / 2);

  const [reviews, coups] = await Promise.all([
    supabase
      .from("spawt_checkin")
      .select(
        "id, created_at, note_etoiles, texte_avis, place_id, places!inner(name, neighborhood), spawters_public!inner(display_name, avatar_url)",
      )
      .not("note_etoiles", "is", null)
      .is("deleted_at", null)
      .eq("is_seed", false)
      .order("created_at", { ascending: false })
      .limit(half),
    supabase
      .from("coups_de_coeur")
      .select(
        "id, created_at, place_id, places!inner(name, neighborhood), spawters_public:spawters!inner(display_name, avatar_url)",
      )
      .order("created_at", { ascending: false })
      .limit(half),
  ]);

  const items: import("./data-source").MeuteActivityItem[] = [];

  if (reviews.error) {
    if (__DEV__) console.warn("[data-source] meute reviews failed", reviews.error);
  } else {
    for (const r of (reviews.data ?? []) as unknown as Array<Record<string, unknown>>) {
      const place = r.places as { name?: string; neighborhood?: string } | null;
      const sp = r.spawters_public as { display_name?: string; avatar_url?: string | null } | null;
      items.push({
        kind: "review",
        id: String(r.id),
        created_at: String(r.created_at),
        spawter_display_name: sp?.display_name ?? "Spawter",
        spawter_avatar_url: sp?.avatar_url ?? null,
        place_id: String(r.place_id),
        place_name: place?.name ?? "?",
        place_neighborhood: place?.neighborhood ?? "",
        note_etoiles: Number(r.note_etoiles),
        texte_avis: (r.texte_avis as string | null) ?? null,
      });
    }
  }

  if (coups.error) {
    if (__DEV__) console.warn("[data-source] meute coups failed", coups.error);
  } else {
    for (const c of (coups.data ?? []) as unknown as Array<Record<string, unknown>>) {
      const place = c.places as { name?: string; neighborhood?: string } | null;
      const sp = c.spawters_public as { display_name?: string; avatar_url?: string | null } | null;
      items.push({
        kind: "coup",
        id: String(c.id),
        created_at: String(c.created_at),
        spawter_display_name: sp?.display_name ?? "Spawter",
        spawter_avatar_url: sp?.avatar_url ?? null,
        place_id: String(c.place_id),
        place_name: place?.name ?? "?",
        place_neighborhood: place?.neighborhood ?? "",
      });
    }
  }

  return items
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit);
}
