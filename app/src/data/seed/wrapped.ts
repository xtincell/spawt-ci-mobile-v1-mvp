// Fixture SPAWT Wrapped pour le mode démo — une année cohérente avec le
// reste du monde démo : 9 spawts vérifiés et 6 avis (miroir du ledger paws
// de seed/progression.ts), archétype Pisteur (carte héritage possédée),
// badges de l'année = les 7 débloqués des fixtures.

import type { WrappedResult } from "../../lib/wrapped";
import { SEED_UNLOCKED_BADGES } from "./progression";

export const SEED_WRAPPED: WrappedResult = {
  year: 2026,
  stats: {
    total_spawts: 9,
    unique_places: 6,
    communes_count: 4,
    top_commune: "Cocody",
    top_cuisine: "ivoirienne",
    top_place: { id: "demo-place-fetiche", name: "Chez Tantie Rosalie", count: 3 },
    avg_note: 4.3,
    archetype: "pisteur",
    stade: "explorateur",
    pionnier_seq: 42,
    badges_unlocked: SEED_UNLOCKED_BADGES.map((b) => b.badge_code),
    top_month: { month: 7, count: 3 },
  },
};
