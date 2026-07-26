// Multi-villes (NFR-PORT-01, PRD §18.1) — « design portable, zéro énergie
// d'exécution ». Source applicative unique de la ville active.
//
// ── CONTRAT ────────────────────────────────────────────────────────────────
// - `getActiveCity()` est SYNCHRONE et retourne toujours une `CityConfig`
//   valide. V1 : toujours Abidjan (`ACTIVE_CITY_CODE = "abidjan"`).
// - Mode Supabase : la config est relue depuis la table `cities` (migration
//   0041 — code/name/country/default_lat/default_lng/communes/is_active).
//   Le refresh est lazy + fire-and-forget : le premier `getActiveCity()`
//   déclenche `refreshActiveCity()` en arrière-plan ; tant que la lecture
//   n'a pas abouti (ou si elle échoue : réseau, table absente, row
//   malformée, is_active=false), la constante locale `ABIDJAN_FALLBACK`
//   fait foi. Aucun crash possible, aucun await imposé aux consumers.
// - Mode démo (sans Supabase) : constante locale, point final.
// - Le jour de Dakar : flip `cities.is_active` en DB + une entrée de
//   sélection qui pilote `ACTIVE_CITY_CODE` (seul point à rendre dynamique).
//   Zéro refactoring ailleurs : tous les consumers passent par
//   `getActiveCity()`.
//
// ── CONSUMERS ──────────────────────────────────────────────────────────────
// - `nearby-places.ts` / `search.ts` : `default_lat`/`default_lng` comme
//   fallback quand la géoloc du spawter manque.
// - `data-source.supabase.ts` : filtre `city_code = getActiveCity().code`
//   sur les requêtes lieux.
// - Onboarding (Select commune) : `communes` porte les codes canoniques ;
//   les étiquettes restent i18n (`onboarding.commune.<code>`).

import { isSupabaseConfigured } from "./data-source";

export interface CityCommune {
  /** Code stable (aligné sur les clés i18n `onboarding.commune.<code>`). */
  code: string;
  /** Libellé lisible par défaut (le Select privilégie i18n s'il a la clé). */
  name: string;
}

export interface CityConfig {
  code: string;
  name: string;
  country: string;
  default_lat: number;
  default_lng: number;
  communes: readonly CityCommune[];
  is_active: boolean;
}

/**
 * Miroir exact du seed `cities` de la migration 0041 (row `abidjan`).
 * Si le seed évolue en DB, le refresh Supabase prend le dessus — cette
 * constante n'est que le filet de sécurité hors-ligne / mode démo.
 */
export const ABIDJAN_FALLBACK: CityConfig = {
  code: "abidjan",
  name: "Abidjan",
  country: "CI",
  default_lat: 5.3364,
  default_lng: -4.0267,
  communes: [
    { code: "abobo", name: "Abobo" },
    { code: "adjame", name: "Adjamé" },
    { code: "anyama", name: "Anyama" },
    { code: "attecoube", name: "Attécoubé" },
    { code: "bingerville", name: "Bingerville" },
    { code: "cocody", name: "Cocody" },
    { code: "koumassi", name: "Koumassi" },
    { code: "marcory", name: "Marcory" },
    { code: "plateau", name: "Plateau" },
    { code: "port_bouet", name: "Port-Bouët" },
    { code: "songon", name: "Songon" },
    { code: "treichville", name: "Treichville" },
    { code: "yopougon", name: "Yopougon" },
    { code: "autre", name: "Autre / hors Abidjan" },
  ],
  is_active: true,
};

/** V1 : sélection fixe. Le jour de Dakar, ce code devient un choix spawter. */
const ACTIVE_CITY_CODE = "abidjan";

let activeCity: CityConfig = ABIDJAN_FALLBACK;
let refreshStarted = false;

/**
 * Ville active courante — synchrone, jamais null (contrat en tête de
 * fichier). Premier appel en mode Supabase : déclenche le refresh DB en
 * arrière-plan (fire-and-forget).
 */
export function getActiveCity(): CityConfig {
  if (!refreshStarted && isSupabaseConfigured) {
    refreshStarted = true;
    void refreshActiveCity().catch(() => {});
  }
  return activeCity;
}

/**
 * Relit la config de la ville active depuis la table `cities` (mode
 * Supabase uniquement). Toute anomalie (erreur, row absente/malformée,
 * is_active=false) laisse la config courante inchangée — fail-safe.
 * Retourne la config effective après tentative.
 */
export async function refreshActiveCity(): Promise<CityConfig> {
  if (!isSupabaseConfigured) return activeCity;
  try {
    // require() lazy (pattern monitoring.ts) plutôt qu'import() dynamique :
    // jest ne supporte pas import() runtime, et les consumers purs
    // (nearby-places, search) ne doivent jamais charger le client Supabase.
    const { supabase } = require("./supabase") as typeof import("./supabase");
    const { data, error } = await supabase
      .from("cities")
      .select("code,name,country,default_lat,default_lng,communes,is_active")
      .eq("code", ACTIVE_CITY_CODE)
      .single();
    if (error || !data) return activeCity;
    const parsed = parseCityRow(data);
    if (parsed && parsed.is_active) activeCity = parsed;
  } catch (err) {
    if (__DEV__) console.info("[city] refreshActiveCity fallback", err);
  }
  return activeCity;
}

/** Reset pour les tests (module state). */
export function __resetActiveCityForTests(): void {
  activeCity = ABIDJAN_FALLBACK;
  refreshStarted = false;
}

/**
 * Parse défensif d'une row `cities` (frontière DB → TS, même doctrine que
 * data-source.supabase). Row invalide → null. Coordonnées manquantes
 * (colonnes nullables) → celles du fallback local.
 */
function parseCityRow(row: unknown): CityConfig | null {
  if (row === null || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.code !== "string" || r.code.length === 0) return null;
  if (typeof r.name !== "string" || r.name.length === 0) return null;

  const lat = typeof r.default_lat === "number" && Number.isFinite(r.default_lat)
    ? r.default_lat
    : ABIDJAN_FALLBACK.default_lat;
  const lng = typeof r.default_lng === "number" && Number.isFinite(r.default_lng)
    ? r.default_lng
    : ABIDJAN_FALLBACK.default_lng;

  const communes: CityCommune[] = [];
  if (Array.isArray(r.communes)) {
    for (const c of r.communes) {
      if (
        c !== null &&
        typeof c === "object" &&
        typeof (c as Record<string, unknown>).code === "string" &&
        typeof (c as Record<string, unknown>).name === "string"
      ) {
        communes.push({
          code: (c as Record<string, unknown>).code as string,
          name: (c as Record<string, unknown>).name as string,
        });
      }
    }
  }

  return {
    code: r.code,
    name: r.name,
    country: typeof r.country === "string" ? r.country : ABIDJAN_FALLBACK.country,
    default_lat: lat,
    default_lng: lng,
    // Liste vide/malformée → communes du fallback (le Select ne doit jamais
    // se retrouver sans options).
    communes: communes.length > 0 ? communes : ABIDJAN_FALLBACK.communes,
    is_active: r.is_active === true,
  };
}
