// Événements & promotions — fixtures démo VIVANTES (miroir 0049 + 0050).
//
// Doctrine SEED_EXPLORE_COLLECTIONS : le mode démo embarque ses données, avec
// les mêmes colonnes que les tables DB (is_published inclus — la parité RLS
// est appliquée par l'adaptateur data-source via les helpers place-activity).
// Les dates sont RELATIVES au chargement du module : la preview montre
// toujours 1 événement à venir et 1 promo active sur Bushman Café, quel que
// soit le jour où on la lance. Les fixtures négatives (événement passé,
// brouillons) nourrissent les tests de filtrage — jamais visibles côté app.
//
// ⚠️ Contrat SPAWT : ces données ne servent QU'À l'affichage étiqueté.
// Rien ici n'alimente matching.ts ni weighted-rating.ts.

import type { PlaceEvent, PlacePromotion } from "../../lib/place-activity";
import { todayCivilDate } from "../../lib/place-activity";

export interface SeedPlaceEvent extends PlaceEvent {
  is_published: boolean;
}

export interface SeedPlacePromotion extends PlacePromotion {
  is_published: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.now();

/** ISO à J+`days`, heure locale `hour:minute` — un événement a une heure. */
function isoAtDays(days: number, hour: number, minute = 0): string {
  const d = new Date(NOW + days * DAY_MS);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Date civile locale à J+`days` — granularité des promotions (0050). */
function civilAtDays(days: number): string {
  return todayCivilDate(new Date(NOW + days * DAY_MS));
}

// Bushman Café — le lieu du seed qui « vit » dans la preview.
const BUSHMAN_ID = "00000000-0000-0000-0000-000000000002";

export const SEED_PLACE_EVENTS: SeedPlaceEvent[] = [
  {
    // L'événement à venir de la démo — visible fiche lieu + feed.
    id: "00000000-0000-0000-0002-000000000001",
    place_id: BUSHMAN_ID,
    title: "Soirée braise & vinyles",
    description:
      "Le grill dehors, les 33 tours dedans. Viens tôt, la terrasse part vite.",
    starts_at: isoAtDays(3, 19, 30),
    ends_at: isoAtDays(3, 23, 0),
    image_url: null,
    is_published: true,
  },
  {
    // Événement PASSÉ publié — la parité RLS (à venir/en cours) le filtre.
    id: "00000000-0000-0000-0002-000000000002",
    place_id: BUSHMAN_ID,
    title: "Brunch des pionniers",
    description: null,
    starts_at: isoAtDays(-7, 11, 0),
    ends_at: isoAtDays(-7, 15, 0),
    image_url: null,
    is_published: true, // publié — c'est la fenêtre temporelle qui le filtre
  },
  {
    // Brouillon staff — jamais visible côté app (parité draft/publish 0049).
    id: "00000000-0000-0000-0002-000000000003",
    place_id: BUSHMAN_ID,
    title: "Dégustation surprise (brouillon)",
    description: null,
    starts_at: isoAtDays(5, 18, 0),
    ends_at: null,
    image_url: null,
    is_published: false,
  },
];

export const SEED_PLACE_PROMOTIONS: SeedPlacePromotion[] = [
  {
    // La promo active de la démo — bandeau étiqueté « PROMO » sur la fiche.
    id: "00000000-0000-0000-0003-000000000001",
    place_id: BUSHMAN_ID,
    label: "Deux jus pressés pour le prix d'un",
    description: "Tous les jours en semaine, jusqu'à épuisement des fruits.",
    starts_at: civilAtDays(-1),
    ends_at: civilAtDays(6),
    is_published: true,
  },
  {
    // Brouillon staff — jamais visible côté app (parité draft/publish 0050).
    id: "00000000-0000-0000-0003-000000000002",
    place_id: BUSHMAN_ID,
    label: "Menu découverte (brouillon)",
    description: null,
    starts_at: null,
    ends_at: null,
    is_published: false,
  },
];
