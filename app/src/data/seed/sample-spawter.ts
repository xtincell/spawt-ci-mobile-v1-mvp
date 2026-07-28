// Échantillon de spawter pour les tests / mode démo (avant Supabase).
// Représente un nouveau Touriste fraîchement onboardé à Cocody.

import type { Spawter } from "../../types/spawter";
import type { UserPalais } from "../../types/palais";

export const SAMPLE_SPAWTER: Spawter = {
  id: "spawter_demo_001",
  phone_e164: "+22507000000",
  display_name: "Toi",
  avatar_url: null,
  neighborhood: "Cocody Riviera",
  country_code: "CI",
  origin_country_code: "CI",
  gender: "non_renseigne",
  date_of_birth: null,
  age_range: null,
  stade: "touriste",
  total_spawts: 0,
  unique_spots: 0,
  customer_id: null,
  geoloc_consent_at: null,
  cgv_accepted_at: null,
  // Chantier 13 archétypes (0033) — assignés au finalize onboarding.
  quiz_archetype: null,
  pionnier_seq: null,
  is_internal: false,
  created_at: "2026-05-03T18:00:00Z",
  updated_at: "2026-05-03T18:00:00Z",
};

/** Palais initial vierge — confidence très basse (< 0.3 → "En construction") */
export const EMPTY_PALAIS: UserPalais = {
  spawter_id: "spawter_demo_001",
  axe_racines_horizons: 0,
  axe_taniere_nomade: 0,
  axe_exigeant_enthousiaste: 0,
  axe_foule_secret: 0,
  axe_maquis_table: 0,
  confidence_score: 0,
  dominant_axes: null,
  archetype_id: null,
  stade: "touriste",
  total_spawts: 0,
  updated_at: "2026-05-03T18:00:00Z",
};
