// Implémentation Supabase — chargée dynamiquement par data-source.ts
// quand EXPO_PUBLIC_SUPABASE_URL + ANON_KEY sont configurés.
//
// Story 3.3a — durcissement Zod parse à la frontière + fallback transparent.
// Une row malformée est droppée silencieusement (warn en __DEV__) au lieu
// de casser tout le feed.

import { supabase } from "./supabase";
import { getActiveCity } from "./city";
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
  // Multi-villes (0041) — seuls les lieux de la ville active remontent.
  let { data: rows, error } = await supabase
    .from("places")
    .select("*, place_adn(*)")
    .eq("is_published", true)
    .eq("city_code", getActiveCity().code);

  // Défense : DB live pas encore migrée 0041 (colonne absente → 42703) —
  // retry sans le filtre ville plutôt qu'un feed vide.
  if (error && error.code === "42703") {
    ({ data: rows, error } = await supabase
      .from("places")
      .select("*, place_adn(*)")
      .eq("is_published", true));
  }

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

/**
 * R22 (build 8) — ADN par défaut quand la row `place_adn` manque (inventaire
 * quasi vide côté data). Plutôt que de dropper le lieu (fiche « introuvable »),
 * on synthétise un ADN neutre : la fiche rend « ADN en construction » +
 * « Pas encore noté » — l'état vide élégant attendu.
 */
function defaultAdnForRow(r: Record<string, unknown>): Record<string, unknown> {
  return {
    place_id: r.id,
    axe_local_international: 0,
    axe_informel_etabli: 0,
    axe_budget_premium: 0,
    axe_populaire_prive: 0,
    axe_decontracte_habille: 0,
    confidence_score: 0,
    total_reviews: 0,
    sample_size: 0,
    adn_revealed: false,
    weighted_rating: 0,
    updated_at: r.updated_at ?? new Date().toISOString(),
  };
}

/** Exposé pour les tests : la dérivation `adn_revealed_at` → `adn_revealed`
 *  n'est vérifiable que sur des lignes brutes, telles que PostgREST les rend. */
export function parseRowsForTest(rows: readonly unknown[]): PlaceWithAdn[] {
  return parseRows(rows);
}

function parseRows(rows: readonly unknown[]): PlaceWithAdn[] {
  const out: PlaceWithAdn[] = [];
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    // La relation `place_adn(*)` peut remonter en objet (FK unique) ou en
    // array selon la version du SDK / le schéma — on normalise les deux, et
    // on tolère l'absence (R22 : ADN neutre plutôt que lieu droppé).
    const rawAdn = r.place_adn;
    const adnCandidate = Array.isArray(rawAdn) ? rawAdn[0] : rawAdn;
    const adnBrut =
      adnCandidate && typeof adnCandidate === "object"
        ? (adnCandidate as Record<string, unknown>)
        : defaultAdnForRow(r);
    // La base stocke une DATE de révélation (`adn_revealed_at`, cliquet de la
    // migration 0059), l'app raisonne sur un booléen. Sans cette dérivation, le
    // `.default(false)` du schéma Zod s'appliquait en silence : le radar ADN
    // n'était révélé sur AUCUNE fiche, quel que soit le nombre d'avis. Un
    // défaut qui rattrape une colonne absente rattrape aussi une colonne mal
    // nommée — c'est ce qui a rendu la panne invisible.
    const adn: Record<string, unknown> = {
      ...adnBrut,
      adn_revealed:
        typeof adnBrut.adn_revealed === "boolean"
          ? adnBrut.adn_revealed
          : adnBrut.adn_revealed_at != null,
    };
    if (adnCandidate == null && __DEV__) {
      console.warn("[data-source] place row without place_adn — default ADN used", r.id);
    }
    const candidate = {
      id: r.id,
      name: r.name,
      cuisine: r.cuisine ?? [],
      location: {
        lat: r.lat,
        lng: r.lng,
        descriptive_address: r.descriptive_address ?? "",
        neighborhood: r.neighborhood ?? "",
        city: r.city ?? "",
      },
      price: {
        tier: r.price_tier,
        avg_ticket_xof: r.avg_ticket_xof ?? null,
      },
      hours: r.hours ?? {},
      phone: r.phone ?? null,
      whatsapp: r.whatsapp ?? null,
      cover_photo_url: r.cover_photo_url ?? null,
      gallery_urls: r.gallery_urls ?? [],
      // Refonte fiche lieu (R17/R19, migration 0030). `?? []` : une DB live
      // pas encore migrée renvoie undefined — le lieu doit parser quand même.
      menu_urls: r.menu_urls ?? [],
      signals: r.signals ?? [],
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

// ─── Chantier 13 archétypes — colonne `quiz_archetype` (migration 0033) ─────

/**
 * UPDATE ciblé de l'archétype courant. Colonne posée par 0033 (contrat du
 * chantier SQL parallèle) — si la migration n'est pas encore appliquée sur le
 * projet live, l'erreur est loggée et avalée (le local reste la vérité).
 */
export async function updateSpawterArchetypeInSupabase(
  spawter_id: string,
  quiz_archetype: string,
): Promise<void> {
  const { error } = await supabase
    .from("spawters")
    .update({ quiz_archetype })
    .eq("id", spawter_id);
  if (error && __DEV__) {
    console.warn("[data-source] updateSpawterArchetype failed", error);
  }
}

/** Lecture archétype + pionnier depuis `spawters` (0033). Null si échec. */
export async function fetchSpawterArchetypeFromSupabase(
  spawter_id: string,
): Promise<{ quiz_archetype: string | null; pionnier_seq: number | null } | null> {
  const { data, error } = await supabase
    .from("spawters")
    .select("quiz_archetype, pionnier_seq")
    .eq("id", spawter_id)
    .maybeSingle();
  if (error || !data) {
    if (__DEV__ && error) console.warn("[data-source] fetchSpawterArchetype failed", error);
    return null;
  }
  const row = data as { quiz_archetype?: unknown; pionnier_seq?: unknown };
  return {
    quiz_archetype: typeof row.quiz_archetype === "string" ? row.quiz_archetype : null,
    pionnier_seq: typeof row.pionnier_seq === "number" ? row.pionnier_seq : null,
  };
}

/**
 * Lecture du statut de compte interne (`spawters.is_internal`, 0060).
 *
 * Requête DÉDIÉE et non un champ de plus dans `fetchSpawterArchetype` : ce
 * dernier n'est appelé qu'au rattrapage d'un archétype manquant, alors que le
 * statut interne doit être revalidé à CHAQUE hydratation — un retrait décidé
 * depuis la console admin doit refermer le menu au prochain lancement.
 *
 * Null (échec réseau, colonne absente sur une base pas encore migrée) = « on ne
 * sait pas » : le caller garde ce qu'il avait, il ne dégrade pas.
 */
export async function fetchSpawterInternalFromSupabase(
  spawter_id: string,
): Promise<boolean | null> {
  const { data, error } = await supabase
    .from("spawters")
    .select("is_internal")
    .eq("id", spawter_id)
    .maybeSingle();
  if (error || !data) {
    if (__DEV__ && error) console.warn("[data-source] fetchSpawterInternal failed", error);
    return null;
  }
  const row = data as { is_internal?: unknown };
  return typeof row.is_internal === "boolean" ? row.is_internal : null;
}

/**
 * Réclame l'héritage quiz « La Meute » pour le spawter courant via la RPC
 * `claim_meute_heritage` (0051 — GRANT authenticated : le téléphone est
 * redérivé de la ligne spawters côté serveur, anti-usurpation). Au 1er login le
 * claim d'otp-verify échoue (la ligne spawters n'existe pas encore) ; ce
 * rattrapage post-upsert récupère l'héritage (finding P0). Best-effort : null si
 * la migration n'est pas appliquée, échec réseau, ou pas d'héritage — le caller
 * garde alors l'archétype calculé localement.
 */
export async function claimMeuteHeritageInSupabase(
  spawter_id: string,
  phone_e164: string,
): Promise<{ claimed: boolean; archetype: string | null; pionnier_seq: number | null } | null> {
  const { data, error } = await supabase.rpc("claim_meute_heritage", {
    p_spawter_id: spawter_id,
    p_phone: phone_e164,
  });
  if (error || !data) {
    if (__DEV__ && error) console.warn("[data-source] claim_meute_heritage failed", error);
    return null;
  }
  const row = data as { claimed?: unknown; archetype?: unknown; pionnier_seq?: unknown };
  return {
    claimed: row.claimed === true,
    archetype: typeof row.archetype === "string" ? row.archetype : null,
    pionnier_seq: typeof row.pionnier_seq === "number" ? row.pionnier_seq : null,
  };
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

// ─── Feature 13 — push serveur : tokens Expo (migration 0034) ────────────────

/**
 * Enregistre le token push du device via la RPC `claim_push_token` (0051,
 * SECURITY DEFINER) : elle réassigne le token à auth.uid() — le token physique
 * appartient au DEVICE courant.
 *
 * Device qui change de compte : si la row de l'ancien proprio traîne (logout non
 * propre), l'upsert client ON CONFLICT échouait sous la RLS UPDATE owner-only
 * (finding P2#10) → l'ancien compte gardait le token, le nouveau ne recevait pas
 * ses pushes. La RPC bypass cette RLS et fait basculer la row proprement.
 */
export async function upsertPushTokenToSupabase(
  token: string,
  platform: "ios" | "android",
): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return; // pas de session — la RPC refuserait l'écriture (42501)
  const { error } = await supabase.rpc("claim_push_token", {
    p_token: token,
    p_platform: platform,
  });
  if (error && __DEV__) console.warn("[data-source] claim_push_token failed", error);
}

/** DELETE par token — RLS owner-only (à faire AVANT auth.signOut). */
export async function deletePushTokenFromSupabase(token: string): Promise<void> {
  const { error } = await supabase.from("push_tokens").delete().eq("token", token);
  if (error && __DEV__) console.warn("[data-source] deletePushToken failed", error);
}

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

// ━━━ Mode Crew (migration 0038) — RPC + INSERT sous RLS ━━━━━━━━━━━━━━━━━━━━

/**
 * Mode Crew — crée une session via le RPC `create_crew_session` (0038).
 * Le RPC enrôle l'hôte comme membre et gère les collisions de code.
 */
export async function createCrewSessionInSupabase(
  host_id: string,
): Promise<import("./crew/crew-types").CrewSessionRef | null> {
  const { data, error } = await supabase.rpc("create_crew_session", {
    p_host: host_id,
  });
  if (error || !data) {
    if (__DEV__) console.warn("[data-source] createCrewSession failed", error);
    return null;
  }
  const d = data as { ok?: boolean; session_id?: string; code?: string; expires_at?: string };
  if (!d.ok || !d.session_id || !d.code || !d.expires_at) return null;
  return { session_id: d.session_id, code: d.code, expires_at: d.expires_at };
}

/**
 * Mode Crew — rejoint par code via `join_crew_session` (SECURITY DEFINER :
 * le candidat n'est pas encore membre, la RLS ne lui montre pas la session).
 */
export async function joinCrewSessionInSupabase(
  code: string,
  spawter_id: string,
): Promise<import("./crew/crew-types").CrewJoinResult> {
  const { data, error } = await supabase.rpc("join_crew_session", {
    p_code: code,
    p_spawter: spawter_id,
  });
  if (error || !data) {
    if (__DEV__) console.warn("[data-source] joinCrewSession failed", error);
    return { ok: false, reason: "error" };
  }
  const d = data as { ok?: boolean; code?: string; session_id?: string; expires_at?: string };
  if (!d.ok) {
    return {
      ok: false,
      reason: d.code === "session_closed" ? "session_closed" : "session_not_found",
    };
  }
  if (!d.session_id || !d.expires_at) return { ok: false, reason: "error" };
  return {
    ok: true,
    ref: {
      session_id: d.session_id,
      code: code.trim().toUpperCase(),
      expires_at: d.expires_at,
    },
  };
}

/**
 * Mode Crew — snapshot complet d'une session (4 requêtes en parallèle,
 * lecture membre-only sous RLS). Les votes sont agrégés côté client en
 * compteurs ANONYMES (`votes` + `has_my_vote`) — jamais de liste de votants.
 * L'ordre des propositions (ordre de fetch = ordre d'insertion physique)
 * sert de départage ultime à crew-resolution — voir contrat CrewSnapshot.
 */
export async function fetchCrewSnapshotFromSupabase(
  session_id: string,
  self_id: string,
): Promise<import("./crew/crew-types").CrewSnapshot | null> {
  const [sessionQ, membersQ, proposalsQ, votesQ] = await Promise.all([
    supabase.from("crew_sessions").select("*").eq("id", session_id).maybeSingle(),
    supabase
      .from("crew_members")
      .select("session_id, spawter_id, joined_at, spawters_public!inner(display_name, avatar_url)")
      .eq("session_id", session_id)
      .order("joined_at", { ascending: true }),
    supabase
      .from("crew_proposals")
      .select("id, session_id, place_id, proposed_by, created_at, places!inner(name, neighborhood)")
      // Ordre déterministe = ordre de proposition : départage « premier proposé »
      // de crew-resolution (règle 3) stable d'un refresh à l'autre (0051, P2#6).
      // id en tiebreak si deux propositions partagent le même created_at.
      .eq("session_id", session_id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("crew_votes")
      .select("proposal_id, spawter_id")
      .eq("session_id", session_id),
  ]);

  if (sessionQ.error || !sessionQ.data) {
    if (__DEV__) console.warn("[data-source] fetchCrewSnapshot session failed", sessionQ.error);
    return null;
  }

  const s = sessionQ.data as Record<string, unknown>;
  const session: import("./crew/crew-types").CrewSession = {
    id: String(s.id),
    code: String(s.code),
    host_id: (s.host_id as string | null) ?? null,
    status: (s.status as import("./crew/crew-types").CrewSessionStatus) ?? "open",
    winning_place_id: (s.winning_place_id as string | null) ?? null,
    expires_at: String(s.expires_at),
    created_at: String(s.created_at),
  };

  const members: import("./crew/crew-types").CrewMember[] = [];
  for (const m of (membersQ.data ?? []) as unknown as Array<Record<string, unknown>>) {
    const pub = m.spawters_public as { display_name?: string; avatar_url?: string | null } | null;
    members.push({
      session_id,
      spawter_id: String(m.spawter_id),
      display_name: pub?.display_name ?? "Spawter",
      avatar_url: pub?.avatar_url ?? null,
      joined_at: String(m.joined_at),
    });
  }

  // Agrégat de votes : compteur par proposition + « ai-je voté ? ».
  const counts = new Map<string, number>();
  const mine = new Set<string>();
  for (const v of (votesQ.data ?? []) as unknown as Array<Record<string, unknown>>) {
    const pid = String(v.proposal_id);
    counts.set(pid, (counts.get(pid) ?? 0) + 1);
    if (String(v.spawter_id) === self_id) mine.add(pid);
  }

  const proposals: import("./crew/crew-types").CrewProposal[] = [];
  for (const p of (proposalsQ.data ?? []) as unknown as Array<Record<string, unknown>>) {
    const place = p.places as { name?: string; neighborhood?: string } | null;
    const pid = String(p.id);
    proposals.push({
      id: pid,
      session_id,
      place_id: String(p.place_id),
      proposed_by: (p.proposed_by as string | null) ?? null,
      place_name: place?.name ?? "?",
      place_neighborhood: place?.neighborhood ?? "",
      votes: counts.get(pid) ?? 0,
      has_my_vote: mine.has(pid),
    });
  }

  return { session, members, proposals };
}

/**
 * Mode Crew — propose un lieu (INSERT sous RLS : membre, en son nom, session
 * ouverte). 23505 = UNIQUE (session, place) → "duplicate".
 */
export async function proposeCrewPlaceToSupabase(
  session_id: string,
  place_id: string,
  proposed_by: string,
): Promise<import("./crew/crew-types").CrewMutationResult> {
  const { error } = await supabase
    .from("crew_proposals")
    .insert({ session_id, place_id, proposed_by });
  if (!error) return "ok";
  if (error.code === "23505") return "duplicate";
  if (__DEV__) console.warn("[data-source] proposeCrewPlace failed", error);
  return "error";
}

/**
 * Mode Crew — vote une proposition (INSERT sous RLS). Le double vote est
 * bloqué par la PK (proposal, spawter) → 23505 = "duplicate".
 */
export async function voteCrewProposalToSupabase(
  session_id: string,
  proposal_id: string,
  spawter_id: string,
): Promise<import("./crew/crew-types").CrewMutationResult> {
  const { error } = await supabase
    .from("crew_votes")
    .insert({ session_id, proposal_id, spawter_id });
  if (!error) return "ok";
  if (error.code === "23505") return "duplicate";
  if (__DEV__) console.warn("[data-source] voteCrewProposal failed", error);
  return "error";
}

/** Mode Crew — quitte la session (DELETE self, policy crew_members_delete_self). */
export async function leaveCrewSessionInSupabase(
  session_id: string,
  spawter_id: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("crew_members")
    .delete()
    .eq("session_id", session_id)
    .eq("spawter_id", spawter_id);
  if (error && __DEV__) console.warn("[data-source] leaveCrewSession failed", error);
  return !error;
}

/**
 * Mode Crew — persiste la résolution (status + winning_place_id).
 *
 * ⚠️ Limite connue : 0038 ne définit AUCUNE policy UPDATE sur crew_sessions
 * (et pas de RPC de clôture) — sous RLS cet UPDATE touche 0 row. On tente
 * quand même (best-effort : le jour où une policy/RPC arrive côté DB, la
 * persistance marche sans changement client) et on retourne false si rien
 * n'a été écrit. La révélation temps réel aux membres passe par le BROADCAST
 * du channel (crew-realtime), qui ne dépend pas de cet UPDATE.
 */
export async function resolveCrewSessionInSupabase(
  session_id: string,
  winning_place_id: string | null,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("crew_sessions")
    .update({ status: "resolved", winning_place_id })
    .eq("id", session_id)
    .select("id");
  if (error) {
    if (__DEV__) console.warn("[data-source] resolveCrewSession failed", error);
    return false;
  }
  const persisted = Array.isArray(data) && data.length > 0;
  if (!persisted && __DEV__) {
    console.info(
      "[data-source] resolveCrewSession : 0 row (pas de policy UPDATE côté 0038) — révélation via broadcast uniquement",
    );
  }
  return persisted;
}

// ─── Sprint 2 monétisation — entitlement Gold (vue active_entitlements) ─────

/**
 * SELECT sur la vue `active_entitlements` (migration 0032, security_invoker :
 * la RLS de subscriptions/customers filtre — un spawter ne lit QUE ses
 * droits). On ne remonte que les plans Gold B2C ; `is_active = true` porte
 * déjà la fenêtre échéance/grâce côté SQL.
 *
 * Retour `null` = indéterminé (erreur) — le store garde le dernier état
 * connu. Une réponse VIDE, elle, est un vrai « pas de droit » (active:false).
 */
export async function fetchGoldEntitlementFromSupabase(): Promise<
  import("./data-source").GoldEntitlement | null
> {
  const checkedAt = new Date().toISOString();

  // Sans session, la vue renverrait [] sous RLS — on économise l'aller-retour
  // et on répond un « pas de droit » franc (session locale, pas de réseau).
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return {
      active: false,
      plan: null,
      status: null,
      expires_at: null,
      grace_until: null,
      checked_at: checkedAt,
    };
  }

  const { data, error } = await supabase
    .from("active_entitlements")
    .select("plan, status, is_active, expires_at, grace_until")
    .in("plan", ["gold_monthly", "gold_annual"])
    .eq("is_active", true);

  if (error) {
    if (__DEV__) console.warn("[data-source] fetchGoldEntitlement failed", error);
    return null; // indéterminé — ne pas dégrader le droit sur une erreur
  }

  const rows = (data ?? []) as Array<{
    plan?: unknown;
    status?: unknown;
    expires_at?: unknown;
    grace_until?: unknown;
  }>;
  const row = rows[0];
  return {
    active: rows.length > 0,
    plan: typeof row?.plan === "string" ? row.plan : null,
    status: typeof row?.status === "string" ? row.status : null,
    expires_at: typeof row?.expires_at === "string" ? row.expires_at : null,
    grace_until: typeof row?.grace_until === "string" ? row.grace_until : null,
    checked_at: checkedAt,
  };
}

// ━━━ Mode Explore (migration 0045) — lecture des collections publiées ━━━━━━━

/**
 * Liste les collections Explore publiées, ordonnées par sort_order.
 * La RLS 0045 ne montre que les publiées aux spawters — le `.eq is_published`
 * est une défense en profondeur (staff actif voit AUSSI les brouillons via sa
 * policy dédiée, on ne veut jamais les rendre dans l'app).
 */
export async function listExploreCollectionsFromSupabase(): Promise<
  import("./data-source").ExploreCollectionSummary[]
> {
  const { data, error } = await supabase
    .from("explore_collections")
    .select("id, slug, title_key, subtitle_key, cover_url, sort_order, city_code")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  if (error || !data) {
    if (__DEV__ && error) console.warn("[data-source] listExploreCollections failed", error);
    return [];
  }

  const out: import("./data-source").ExploreCollectionSummary[] = [];
  for (const row of data) {
    const r = row as Record<string, unknown>;
    if (typeof r.slug !== "string" || typeof r.title_key !== "string") {
      if (__DEV__) console.warn("[data-source] explore collection dropped — row malformée", r.id);
      continue;
    }
    out.push({
      id: String(r.id),
      slug: r.slug,
      title_key: r.title_key,
      subtitle_key: typeof r.subtitle_key === "string" ? r.subtitle_key : null,
      cover_url: typeof r.cover_url === "string" && r.cover_url.length > 0 ? r.cover_url : null,
      sort_order: typeof r.sort_order === "number" ? r.sort_order : 0,
      city_code: typeof r.city_code === "string" ? r.city_code : "abidjan",
    });
  }
  return out;
}

/**
 * Détail d'une collection publiée : items joints aux places (+ place_adn) en
 * UN round-trip (nested select). Chaque place passe par le MÊME pipeline Zod
 * fail-safe que le feed (parseRows) — un lieu malformé ou dépublié droppe
 * l'item, jamais tout le carnet. Tri sort_order côté client (l'ordre
 * éditorial fait la narration).
 */
export async function getExploreCollectionFromSupabase(
  slug: string,
): Promise<import("./data-source").ExploreCollectionDetail | null> {
  const { data, error } = await supabase
    .from("explore_collections")
    .select(
      "id, slug, title_key, subtitle_key, cover_url, sort_order, city_code, " +
        "explore_items(id, editorial_text, sort_order, places(*, place_adn(*)))",
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error || !data) {
    if (__DEV__ && error) console.warn("[data-source] getExploreCollection failed", error);
    return null;
  }

  const r = data as unknown as Record<string, unknown>;
  if (typeof r.slug !== "string" || typeof r.title_key !== "string") return null;

  const rawItems = Array.isArray(r.explore_items) ? r.explore_items : [];
  const items: import("./data-source").ExploreItem[] = [];
  for (const raw of rawItems) {
    const it = raw as Record<string, unknown>;
    // La relation `places` peut remonter objet (FK) ou array selon le SDK —
    // même normalisation défensive que spawters_public dans les reviews.
    const rawPlace = Array.isArray(it.places) ? it.places[0] : it.places;
    if (!rawPlace || typeof rawPlace !== "object") {
      if (__DEV__) console.warn("[data-source] explore item dropped — place manquante", it.id);
      continue;
    }
    const parsed = parseRows([rawPlace]);
    const place = parsed[0];
    if (!place || !place.is_published) continue;
    items.push({
      id: String(it.id),
      place,
      editorial_text: typeof it.editorial_text === "string" ? it.editorial_text : null,
      sort_order: typeof it.sort_order === "number" ? it.sort_order : 0,
    });
  }
  items.sort((a, b) => a.sort_order - b.sort_order);

  return {
    id: String(r.id),
    slug: r.slug,
    title_key: r.title_key,
    subtitle_key: typeof r.subtitle_key === "string" ? r.subtitle_key : null,
    cover_url: typeof r.cover_url === "string" && r.cover_url.length > 0 ? r.cover_url : null,
    sort_order: typeof r.sort_order === "number" ? r.sort_order : 0,
    city_code: typeof r.city_code === "string" ? r.city_code : "abidjan",
    items,
  };
}

// ━━━ Progression complète (migrations 0035-0037 + 0040) ━━━━━━━━━━━━━━━━━━━━
// Lecture badges/cartes/paws/défis + toggle is_displayed + RPC d'évaluation.
// Toutes les erreurs sont avalées avec warn __DEV__ : la progression est une
// surface de confort, jamais un point de crash du parcours principal.

import type {
  ActiveChallenge,
  BadgeCatalogueEntry,
  BadgeSnapshot,
  OwnedCard,
  PawsLedgerEntry,
  SpawterBadgeRow,
  SpawterStreak,
} from "../types/progression";

/**
 * Catalogue actif (`badge_catalogue`, lisible par tous les authentifiés) +
 * état du spawter (`spawter_badges`, RLS own) en 2 requêtes parallèles.
 */
export async function listBadgesFromSupabase(
  spawter_id: string,
): Promise<BadgeSnapshot> {
  const [catQ, ownQ] = await Promise.all([
    supabase
      .from("badge_catalogue")
      .select("code, category, title_key, description_key, condition_type, threshold, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("spawter_badges")
      .select("badge_code, unlocked_at, is_displayed")
      .eq("spawter_id", spawter_id),
  ]);

  const catalogue: BadgeCatalogueEntry[] = [];
  if (catQ.error) {
    if (__DEV__) console.warn("[data-source] badge_catalogue failed", catQ.error);
  } else {
    for (const row of (catQ.data ?? []) as unknown as Array<Record<string, unknown>>) {
      if (typeof row.code !== "string" || typeof row.category !== "string") continue;
      catalogue.push({
        code: row.code,
        category: row.category as BadgeCatalogueEntry["category"],
        title_key: typeof row.title_key === "string" ? row.title_key : `badge.${row.code}.title`,
        description_key:
          typeof row.description_key === "string"
            ? row.description_key
            : `badge.${row.code}.description`,
        condition_type: (row.condition_type ?? "custom") as BadgeCatalogueEntry["condition_type"],
        threshold: typeof row.threshold === "number" ? row.threshold : null,
        sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
      });
    }
  }

  const unlocked: SpawterBadgeRow[] = [];
  if (ownQ.error) {
    if (__DEV__) console.warn("[data-source] spawter_badges failed", ownQ.error);
  } else {
    for (const row of (ownQ.data ?? []) as unknown as Array<Record<string, unknown>>) {
      if (typeof row.badge_code !== "string") continue;
      unlocked.push({
        badge_code: row.badge_code,
        unlocked_at: String(row.unlocked_at ?? ""),
        is_displayed: Boolean(row.is_displayed),
      });
    }
  }

  return { catalogue, unlocked };
}

/**
 * RPC `check_and_award_badges` (SECURITY DEFINER, garde-fou own-account) —
 * retourne les NOUVEAUX codes gagnés (SETOF text). [] sur erreur : la
 * célébration est un bonus, jamais un blocage.
 */
export async function triggerBadgeCheckInSupabase(
  spawter_id: string,
): Promise<string[]> {
  const { data, error } = await supabase.rpc("check_and_award_badges", {
    p_spawter_id: spawter_id,
  });
  if (error) {
    if (__DEV__) console.warn("[data-source] check_and_award_badges failed", error);
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.filter((c): c is string => typeof c === "string" && c.length > 0);
}

/**
 * Toggle is_displayed d'un badge (seule colonne modifiable côté client —
 * trigger 0036). "max" = ERRCODE 23514 du trigger `assert_max_displayed_badges`
 * (déjà 3 affichés) — l'UI affiche un feedback dédié.
 */
export async function setBadgeDisplayedInSupabase(
  spawter_id: string,
  badge_code: string,
  displayed: boolean,
): Promise<"ok" | "max" | "error"> {
  const { error } = await supabase
    .from("spawter_badges")
    .update({ is_displayed: displayed })
    .eq("spawter_id", spawter_id)
    .eq("badge_code", badge_code);
  if (!error) return "ok";
  if (error.code === "23514") return "max";
  if (__DEV__) console.warn("[data-source] setBadgeDisplayed failed", error);
  return "error";
}

/**
 * Cartes possédées : join `spawter_cards` × `collectible_cards` en un
 * round-trip (RLS own sur spawter_cards). La relation peut remonter objet ou
 * array selon le SDK — normalisation défensive, doctrine spawters_public.
 */
export async function listSpawterCardsFromSupabase(
  spawter_id: string,
): Promise<OwnedCard[]> {
  const { data, error } = await supabase
    .from("spawter_cards")
    .select(
      "obtained_at, source, collectible_cards(id, code, kind, rarity, title, image_url, verso_text)",
    )
    .eq("spawter_id", spawter_id)
    .order("obtained_at", { ascending: false });

  if (error || !data) {
    if (__DEV__ && error) console.warn("[data-source] listSpawterCards failed", error);
    return [];
  }

  const out: OwnedCard[] = [];
  for (const row of data as unknown as Array<Record<string, unknown>>) {
    const rel = row.collectible_cards;
    const cardRaw = Array.isArray(rel) ? rel[0] : rel;
    if (!cardRaw || typeof cardRaw !== "object") {
      if (__DEV__) console.warn("[data-source] spawter_card dropped — carte manquante");
      continue;
    }
    const c = cardRaw as Record<string, unknown>;
    if (typeof c.code !== "string" || typeof c.title !== "string") continue;
    out.push({
      id: String(c.id ?? c.code),
      code: c.code,
      kind: (c.kind ?? "archetype") as OwnedCard["kind"],
      rarity: (c.rarity ?? "commun") as OwnedCard["rarity"],
      title: c.title,
      image_url: typeof c.image_url === "string" && c.image_url.length > 0 ? c.image_url : null,
      verso_text: typeof c.verso_text === "string" ? c.verso_text : null,
      obtained_at: String(row.obtained_at ?? ""),
      source: (row.source ?? "admin") as OwnedCard["source"],
    });
  }
  return out;
}

/**
 * Solde paws — vue `paws_balance` (security_invoker : chaque spawter ne lit
 * que le sien). Aucune row = jamais crédité → 0 franc. `null` = indéterminé
 * (erreur) : le caller conserve le dernier solde connu.
 */
export async function getPawsBalanceFromSupabase(
  spawter_id: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("paws_balance")
    .select("balance")
    .eq("spawter_id", spawter_id)
    .maybeSingle();
  if (error) {
    if (__DEV__) console.warn("[data-source] paws_balance failed", error);
    return null;
  }
  const balance = (data as { balance?: unknown } | null)?.balance;
  return typeof balance === "number" ? balance : 0;
}

/** Historique du ledger paws (RLS own, append-only — lecture seule). */
export async function listPawsLedgerFromSupabase(
  spawter_id: string,
  limit: number,
): Promise<PawsLedgerEntry[]> {
  const { data, error } = await supabase
    .from("paws_ledger")
    .select("id, delta, reason, ref_id, created_at")
    .eq("spawter_id", spawter_id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) {
    if (__DEV__ && error) console.warn("[data-source] paws_ledger failed", error);
    return [];
  }
  const out: PawsLedgerEntry[] = [];
  for (const row of data as unknown as Array<Record<string, unknown>>) {
    if (typeof row.delta !== "number") continue;
    out.push({
      id: String(row.id ?? ""),
      delta: row.delta,
      reason: (row.reason ?? "ajustement_admin") as PawsLedgerEntry["reason"],
      ref_id: typeof row.ref_id === "string" ? row.ref_id : null,
      created_at: String(row.created_at ?? ""),
    });
  }
  return out;
}

/**
 * Défis actifs + progression collective (`challenge_progress` : UNE ligne
 * par défi, aucun spawter_id — le Contrat SPAWT est garanti par le schéma).
 */
export async function listActiveChallengesFromSupabase(): Promise<ActiveChallenge[]> {
  const { data, error } = await supabase
    .from("challenges")
    .select(
      "id, code, title_key, description_key, period_start, period_end, goal_type, goal_target, reward_paws, challenge_progress(current_value)",
    )
    .eq("status", "active")
    .order("period_end", { ascending: true });

  if (error || !data) {
    if (__DEV__ && error) console.warn("[data-source] listActiveChallenges failed", error);
    return [];
  }

  const out: ActiveChallenge[] = [];
  for (const row of data as unknown as Array<Record<string, unknown>>) {
    if (typeof row.code !== "string" || typeof row.goal_target !== "number") continue;
    const rel = row.challenge_progress;
    const progressRaw = Array.isArray(rel) ? rel[0] : rel;
    const currentValue =
      progressRaw && typeof progressRaw === "object"
        ? (progressRaw as { current_value?: unknown }).current_value
        : 0;
    out.push({
      id: String(row.id ?? row.code),
      code: row.code,
      title_key: typeof row.title_key === "string" ? row.title_key : `defi.${row.code}.title`,
      description_key:
        typeof row.description_key === "string"
          ? row.description_key
          : `defi.${row.code}.description`,
      period_start: String(row.period_start ?? ""),
      period_end: String(row.period_end ?? ""),
      goal_type: (row.goal_type ?? "spawts_total") as ActiveChallenge["goal_type"],
      goal_target: row.goal_target,
      reward_paws: typeof row.reward_paws === "number" ? row.reward_paws : 0,
      current_value: typeof currentValue === "number" ? currentValue : 0,
    });
  }
  return out;
}

/** Streak hebdo privé (`spawter_streaks`, RLS owner-only). Null si aucune row. */
export async function getMyStreakFromSupabase(
  spawter_id: string,
): Promise<SpawterStreak | null> {
  const { data, error } = await supabase
    .from("spawter_streaks")
    .select("current_weeks, best_weeks, last_spawt_week")
    .eq("spawter_id", spawter_id)
    .maybeSingle();
  if (error || !data) {
    if (__DEV__ && error) console.warn("[data-source] spawter_streaks failed", error);
    return null;
  }
  const row = data as Record<string, unknown>;
  return {
    current_weeks: typeof row.current_weeks === "number" ? row.current_weeks : 0,
    best_weeks: typeof row.best_weeks === "number" ? row.best_weeks : 0,
    last_spawt_week: typeof row.last_spawt_week === "string" ? row.last_spawt_week : null,
  };
}

// ─── Feature 18 — suggestion de lieu par la Meute (migration 0039) ──────────

/**
 * INSERT sous RLS `place_suggestions_insert_own` (spawter_id = auth.uid(),
 * status pending forcé). Le quota 5 pending est appliqué par le trigger
 * `assert_place_suggestions_rate_limit` — son RAISE porte ERRCODE 23514
 * (check_violation), qu'on traduit en "quota_exceeded" lisible côté UI.
 */
export async function submitPlaceSuggestionToSupabase(
  spawter_id: string,
  input: import("./place-suggestions").PlaceSuggestionInput,
): Promise<import("./place-suggestions").SubmitSuggestionResult> {
  const { error } = await supabase.from("place_suggestions").insert({
    spawter_id,
    name: input.name,
    commune: input.commune,
    neighborhood: input.neighborhood,
    description: input.description,
    lat: input.lat,
    lng: input.lng,
    photo_urls: input.photo_urls,
  });
  if (!error) return "ok";
  if (error.code === "23514") return "quota_exceeded";
  if (__DEV__) console.warn("[data-source] submitPlaceSuggestion failed", error);
  return "error";
}

/** Suggestions du spawter (RLS select own), plus récentes d'abord. */
export async function listMySuggestionsFromSupabase(
  spawter_id: string,
): Promise<import("./place-suggestions").PlaceSuggestionRow[]> {
  const { data, error } = await supabase
    .from("place_suggestions")
    .select(
      "id, name, commune, neighborhood, description, lat, lng, photo_urls, status, rejection_reason, created_at",
    )
    .eq("spawter_id", spawter_id)
    .order("created_at", { ascending: false });
  if (error) {
    if (__DEV__) console.warn("[data-source] listMySuggestions failed", error);
    return [];
  }
  return (data ?? []) as import("./place-suggestions").PlaceSuggestionRow[];
}

// ─── SPAWT Wrapped — Edge Function `wrapped-stats` ──────────────────────────

import { parseWrappedResponse, type WrappedResult } from "./wrapped";

/**
 * Invoque l'Edge `wrapped-stats` (POST auth spawter — le SDK attache le
 * token de session). Toute erreur (réseau, 401, payload inattendu) → null :
 * le Wrapped est une surface de plaisir, jamais un point de crash.
 */
export async function getWrappedStatsFromSupabase(
  year?: number,
): Promise<WrappedResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke("wrapped-stats", {
      body: year !== undefined ? { year } : {},
    });
    if (error) {
      if (__DEV__) console.warn("[data-source] wrapped-stats failed", error);
      return null;
    }
    return parseWrappedResponse(data);
  } catch (err) {
    if (__DEV__) console.warn("[data-source] wrapped-stats threw", err);
    return null;
  }
}

// ─── Réservation 1-tap (migration 0042) ─────────────────────────────────────

import type {
  ReservationRequestInput,
  ReservationRow,
} from "./reservations";

/**
 * INSERT sous RLS `reservation_requests_insert_own`. Best-effort : toute
 * erreur → null (warn __DEV__) — la trace ne bloque jamais WhatsApp.
 */
export async function createReservationRequestInSupabase(
  spawter_id: string,
  input: ReservationRequestInput,
): Promise<ReservationRow | null> {
  const { data, error } = await supabase
    .from("reservation_requests")
    .insert({
      spawter_id,
      place_id: input.place_id,
      party_size: input.party_size,
      slot_at: input.slot_at,
      channel: input.channel,
    })
    .select("id, place_id, party_size, slot_at, channel, status, created_at")
    .single();
  if (error || !data) {
    if (__DEV__ && error) {
      console.warn("[data-source] createReservationRequest failed", error);
    }
    return null;
  }
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id ?? ""),
    place_id: String(row.place_id ?? input.place_id),
    place_name: input.place_name,
    party_size: typeof row.party_size === "number" ? row.party_size : input.party_size,
    slot_at: typeof row.slot_at === "string" ? row.slot_at : null,
    channel: (row.channel ?? input.channel) as ReservationRow["channel"],
    status: (row.status ?? "sent") as ReservationRow["status"],
    created_at: String(row.created_at ?? ""),
  };
}

/** Demandes du spawter (join places pour le nom), plus récentes d'abord. */
export async function listMyReservationsFromSupabase(
  spawter_id: string,
): Promise<ReservationRow[]> {
  const { data, error } = await supabase
    .from("reservation_requests")
    .select("id, place_id, party_size, slot_at, channel, status, created_at, places(name)")
    .eq("spawter_id", spawter_id)
    .order("created_at", { ascending: false });
  if (error || !data) {
    if (__DEV__ && error) console.warn("[data-source] listMyReservations failed", error);
    return [];
  }
  const out: ReservationRow[] = [];
  for (const raw of data as unknown as Array<Record<string, unknown>>) {
    if (typeof raw.id !== "string" && typeof raw.id !== "number") continue;
    // La relation `places` peut remonter objet ou array selon le SDK.
    const rel = raw.places;
    const placeRaw = Array.isArray(rel) ? rel[0] : rel;
    const placeName =
      placeRaw && typeof placeRaw === "object" &&
      typeof (placeRaw as { name?: unknown }).name === "string"
        ? ((placeRaw as { name: string }).name)
        : "";
    out.push({
      id: String(raw.id),
      place_id: String(raw.place_id ?? ""),
      place_name: placeName,
      party_size: typeof raw.party_size === "number" ? raw.party_size : 1,
      slot_at: typeof raw.slot_at === "string" ? raw.slot_at : null,
      channel: (raw.channel ?? "whatsapp") as ReservationRow["channel"],
      status: (raw.status ?? "sent") as ReservationRow["status"],
      created_at: String(raw.created_at ?? ""),
    });
  }
  return out;
}

// ─── Événements & promotions de lieux (migrations 0049 + 0050) ──────────────
// SELECT simples : la RLS filtre déjà (0049 : publiés à venir/en cours ;
// 0050 : publiées actives en dates civiles). ⚠️ Contrat SPAWT : lecture pour
// AFFICHAGE ÉTIQUETÉ uniquement — rien ici n'alimente matching ni note.

import type {
  PlaceActivityMap,
  PlaceEvent,
  PlacePromotion,
  UpcomingEvent,
} from "./place-activity";
// Filtres MIROIRS des policies RLS (0049/0050). finding P2#12 : un compte STAFF
// voit sous RLS les brouillons + événements passés / promos hors fenêtre
// (place_events_select_staff, place_promotions_select_staff) — on réapplique la
// fenêtre côté client pour que l'app n'affiche jamais que l'actif « en ce
// moment », comme le fait déjà le Mode Explore.
import { isEventCurrent, isPromoActive, todayCivilDate } from "./place-activity";

/** Row défensive → PlaceEvent. Null si les colonnes vitales manquent. */
function parseEventRow(raw: unknown): PlaceEvent | null {
  const r = raw as Record<string, unknown>;
  if (typeof r.title !== "string" || typeof r.starts_at !== "string") return null;
  return {
    id: String(r.id ?? ""),
    place_id: String(r.place_id ?? ""),
    title: r.title,
    description: typeof r.description === "string" ? r.description : null,
    starts_at: r.starts_at,
    ends_at: typeof r.ends_at === "string" ? r.ends_at : null,
    image_url:
      typeof r.image_url === "string" && r.image_url.length > 0 ? r.image_url : null,
  };
}

/** Événements visibles d'un lieu, tri chronologique (RLS 0049 fait le filtre). */
export async function listPlaceEventsFromSupabase(
  placeId: string,
): Promise<PlaceEvent[]> {
  const { data, error } = await supabase
    .from("place_events")
    .select("id, place_id, title, description, starts_at, ends_at, image_url")
    .eq("place_id", placeId)
    .order("starts_at", { ascending: true });
  if (error || !data) {
    if (__DEV__ && error) console.warn("[data-source] listPlaceEvents failed", error);
    return [];
  }
  const now = new Date();
  const out: PlaceEvent[] = [];
  for (const row of data) {
    const event = parseEventRow(row);
    // finding P2#12 — re-filtre côté client : un compte staff verrait sinon les
    // brouillons/passés remontés par place_events_select_staff (0049).
    if (event && isEventCurrent(event, now)) out.push(event);
  }
  return out;
}

/** Promotions actives d'un lieu (RLS 0050 fait le filtre fenêtre civile). */
export async function listPlacePromotionsFromSupabase(
  placeId: string,
): Promise<PlacePromotion[]> {
  const { data, error } = await supabase
    .from("place_promotions")
    .select("id, place_id, label, description, starts_at, ends_at")
    .eq("place_id", placeId)
    .order("starts_at", { ascending: true, nullsFirst: true });
  if (error || !data) {
    if (__DEV__ && error) {
      console.warn("[data-source] listPlacePromotions failed", error);
    }
    return [];
  }
  const todayCivil = todayCivilDate(new Date());
  const out: PlacePromotion[] = [];
  for (const row of data) {
    const r = row as Record<string, unknown>;
    if (typeof r.label !== "string") continue;
    const promo: PlacePromotion = {
      id: String(r.id ?? ""),
      place_id: String(r.place_id ?? ""),
      label: r.label,
      description: typeof r.description === "string" ? r.description : null,
      starts_at: typeof r.starts_at === "string" ? r.starts_at : null,
      ends_at: typeof r.ends_at === "string" ? r.ends_at : null,
    };
    // finding P2#12 — re-filtre fenêtre civile côté client (RLS staff 0050).
    if (isPromoActive(promo, todayCivil)) out.push(promo);
  }
  return out;
}

/**
 * Événements à venir toutes adresses (rangée « Ça bouge cette semaine ») —
 * jointure place minimale `places!inner(name, neighborhood)` en un
 * round-trip. L'inner join sous la RLS places (publiés only pour la Meute)
 * droppe naturellement les événements d'un lieu dépublié.
 */
export async function listUpcomingEventsFromSupabase(
  limit: number,
): Promise<UpcomingEvent[]> {
  const { data, error } = await supabase
    .from("place_events")
    .select(
      "id, place_id, title, description, starts_at, ends_at, image_url, places!inner(name, neighborhood)",
    )
    .order("starts_at", { ascending: true })
    .limit(limit);
  if (error || !data) {
    if (__DEV__ && error) console.warn("[data-source] listUpcomingEvents failed", error);
    return [];
  }
  const now = new Date();
  const out: UpcomingEvent[] = [];
  for (const row of data) {
    const event = parseEventRow(row);
    if (!event) continue;
    // finding P2#12 — re-filtre côté client (RLS staff 0049 remonte les passés).
    if (!isEventCurrent(event, now)) continue;
    // La relation jointe peut remonter objet ou array selon le SDK — même
    // normalisation défensive que spawters_public dans les reviews.
    const rel = (row as Record<string, unknown>).places;
    const place = (Array.isArray(rel) ? rel[0] : rel) as
      | { name?: unknown; neighborhood?: unknown }
      | null
      | undefined;
    if (!place || typeof place.name !== "string") {
      if (__DEV__) console.warn("[data-source] upcoming event dropped — place join manquant", event.id);
      continue;
    }
    out.push({
      ...event,
      place_name: place.name,
      place_neighborhood:
        typeof place.neighborhood === "string" ? place.neighborhood : "",
    });
  }
  return out;
}

/**
 * Pastilles feed par LOT : 2 SELECT `place_id` only en parallèle (aucune
 * ligne de contenu transférée), jamais un fetch par carte. La RLS ne laisse
 * remonter que l'actif/publié — la map reflète donc « en ce moment ».
 */
export async function listPlaceActivityFromSupabase(
  placeIds: readonly string[],
): Promise<PlaceActivityMap> {
  const ids = [...placeIds];
  // finding P2#12 — on récupère aussi les bornes pour re-filtrer la fenêtre côté
  // client : un compte staff verrait sinon des pastilles pour des événements
  // passés / promos hors fenêtre (RLS staff 0049/0050).
  const [eventsQ, promosQ] = await Promise.all([
    supabase.from("place_events").select("place_id, starts_at, ends_at").in("place_id", ids),
    supabase.from("place_promotions").select("place_id, starts_at, ends_at").in("place_id", ids),
  ]);

  const map: PlaceActivityMap = {};
  const entry = (place_id: string) =>
    (map[place_id] ??= { has_event: false, has_promo: false });

  const now = new Date();
  const todayCivil = todayCivilDate(now);

  if (eventsQ.error) {
    if (__DEV__) console.warn("[data-source] activity events failed", eventsQ.error);
  } else {
    for (const row of eventsQ.data ?? []) {
      const r = row as { place_id?: unknown; starts_at?: unknown; ends_at?: unknown };
      if (typeof r.place_id !== "string" || typeof r.starts_at !== "string") continue;
      const current = isEventCurrent(
        { starts_at: r.starts_at, ends_at: typeof r.ends_at === "string" ? r.ends_at : null },
        now,
      );
      if (current) entry(r.place_id).has_event = true;
    }
  }

  if (promosQ.error) {
    if (__DEV__) console.warn("[data-source] activity promos failed", promosQ.error);
  } else {
    for (const row of promosQ.data ?? []) {
      const r = row as { place_id?: unknown; starts_at?: unknown; ends_at?: unknown };
      if (typeof r.place_id !== "string") continue;
      const active = isPromoActive(
        {
          starts_at: typeof r.starts_at === "string" ? r.starts_at : null,
          ends_at: typeof r.ends_at === "string" ? r.ends_at : null,
        },
        todayCivil,
      );
      if (active) entry(r.place_id).has_promo = true;
    }
  }

  return map;
}
