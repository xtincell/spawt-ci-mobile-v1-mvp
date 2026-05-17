// Tests de typage compile-time pour analytics.ts.
// Ce fichier n'exporte rien — il valide que `tsc --noEmit` détecte les misuses.
// Les lignes marquées `// @ts-expect-error` doivent rester en erreur ; si l'une
// d'elles compile sans erreur, ça veut dire que le typage est trop permissif.

import { track } from "../../analytics";

// ✅ Doit compiler : event connu avec props valides.
track({
  name: "onboarding_started",
  properties: {},
});

track({
  name: "feed_first_view",
  properties: { places_count: 12 },
});

track({
  name: "place_first_view",
  properties: {
    place_id: "abc-123",
    match_score: 87,
    distance_km: 2.3,
    time_since_onboarding_seconds: 3600,
  },
});

track({
  name: "onboarding_completed",
  properties: {
    country_code: "CI",
    age_range: "25-34",
    gender: "homme",
    time_to_complete_seconds: 180,
    palais_initial_dominant_axes: ["taniere", "maquis"],
  },
});

// ❌ Doit échouer : nom d'event hors taxonomie.
// @ts-expect-error event hors taxonomie events.md
track({ name: "user_logged_in", properties: {} });

// ❌ Doit échouer : propriété manquante sur `feed_first_view`.
// @ts-expect-error props incomplètes
track({ name: "feed_first_view", properties: {} });

// ❌ Doit échouer : propriété au mauvais type.
// @ts-expect-error places_count doit être un number
track({ name: "feed_first_view", properties: { places_count: "12" } });

// ❌ Doit échouer : event sans `properties`.
// @ts-expect-error properties manquante
track({ name: "onboarding_started" });

// ✅ Event générique V1 (Record<string, unknown>) — accepte tout.
track({
  name: "feed_card_clicked",
  properties: { place_id: "x", position: 0, match_score: 85, distance_km: 1.2 },
});
