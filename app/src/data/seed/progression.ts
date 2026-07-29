// Fixtures Progression pour le mode démo (fallback sans Supabase).
// La démo doit faire VIVRE l'écran : 7 badges débloqués (3 affichés),
// 3 cartes collector, 120 paws avec un historique lisible, 1 défi collectif
// à 62 %, un streak de 3 semaines.
//
// ⚠️ Le catalogue des 32 badges est un MIROIR STRICT du seed SQL
// (supabase/migrations/0036_create_badges.sql) : codes, catégories,
// condition_type, seuils et sort_order identiques. Idem pour les 13 cartes
// (0037). Tests de cohérence : src/lib/__tests__/progression-data.test.ts.

import type {
  ActiveChallenge,
  BadgeCatalogueEntry,
  BadgeCategory,
  BadgeConditionType,
  CollectibleCard,
  OwnedCard,
  PawsLedgerEntry,
  SpawterBadgeRow,
  SpawterStreak,
} from "../../types/progression";

// ━━━ Catalogue : 32 badges (miroir 0036) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function badge(
  code: string,
  category: BadgeCategory,
  condition_type: BadgeConditionType,
  threshold: number | null,
  sort_order: number,
): BadgeCatalogueEntry {
  return {
    code,
    category,
    title_key: `badge.${code}.title`,
    description_key: `badge.${code}.description`,
    condition_type,
    threshold,
    sort_order,
  };
}

export const SEED_BADGE_CATALOGUE: readonly BadgeCatalogueEntry[] = [
  // ── core ──────────────────────────────────────────────────────────────────
  badge("premier_spawt", "core", "premier_spawt", 1, 1),
  // ── exploration ───────────────────────────────────────────────────────────
  badge("traversee", "exploration", "communes_distinctes", 5, 10),
  badge("cartographe", "exploration", "communes_distinctes", 10, 11),
  badge("maitre_des_communes", "exploration", "communes_distinctes", 13, 12),
  badge("noctambule", "exploration", "spawts_apres_21h", 10, 13),
  badge("chasseur_de_pepites", "exploration", "lieux_peu_avises", 5, 14),
  badge("hors_des_sentiers", "exploration", "lieux_peu_avises", 15, 15),
  badge("pionnier_commune", "exploration", "lieux_nouveaux_30j", 3, 16),
  badge("marathon_maquis", "exploration", "spawts_total", 25, 17),
  badge("semelles_de_feu", "exploration", "spawts_total", 75, 18),
  badge("spawteur_du_weekend", "exploration", "spawts_weekend", 10, 19),
  badge("leve_tot", "exploration", "custom", null, 20),
  // ── expertise ─────────────────────────────────────────────────────────────
  badge("palais_diversifie", "expertise", "types_cuisine", 5, 30),
  badge("ambassadeur_cuisine", "expertise", "types_cuisine", 10, 31),
  badge("calibre", "expertise", "avis_total", 10, 32),
  badge("plume_du_palais", "expertise", "avis_total", 25, 33),
  badge("voix_d_or", "expertise", "avis_total", 50, 34),
  badge("oeil_de_braise", "expertise", "spawts_total", 50, 35),
  badge("photographe_gourmand", "expertise", "photos_publiees", 10, 36),
  badge("objectif_pepite", "expertise", "photos_publiees", 30, 37),
  badge("gardien_du_garba", "expertise", "custom", null, 38),
  badge("fidele_au_poste", "expertise", "custom", null, 39),
  // ── influence ─────────────────────────────────────────────────────────────
  badge("eclaireur", "influence", "avis_sauvegardes", 5, 50),
  badge("aimant", "influence", "coups_de_coeur_recus", 5, 51),
  badge("coeur_de_la_meute", "influence", "coups_de_coeur_recus", 15, 52),
  badge("bouche_a_oreille", "influence", "parrainages", 3, 53),
  badge("faiseur_de_pluie", "influence", "parrainages", 10, 54),
  badge("voix_de_la_colonie", "influence", "parrainages", 25, 55),
  badge("defi_releve", "influence", "defis_completes", 1, 56),
  badge("pilier_de_colonie", "influence", "defis_completes", 5, 57),
  badge("meneur_de_crew", "influence", "custom", null, 58),
  badge("murmure_urbain", "influence", "custom", null, 59),
] as const;

// ━━━ Badges débloqués en démo (7, dont 3 affichés) ━━━━━━━━━━━━━━━━━━━━━━━━━

export const SEED_UNLOCKED_BADGES: readonly SpawterBadgeRow[] = [
  { badge_code: "premier_spawt", unlocked_at: "2026-05-04T12:10:00Z", is_displayed: false },
  { badge_code: "traversee", unlocked_at: "2026-05-28T19:30:00Z", is_displayed: true },
  { badge_code: "noctambule", unlocked_at: "2026-06-14T22:05:00Z", is_displayed: false },
  { badge_code: "chasseur_de_pepites", unlocked_at: "2026-06-21T13:40:00Z", is_displayed: true },
  { badge_code: "palais_diversifie", unlocked_at: "2026-06-30T20:15:00Z", is_displayed: false },
  { badge_code: "calibre", unlocked_at: "2026-07-08T12:50:00Z", is_displayed: false },
  { badge_code: "eclaireur", unlocked_at: "2026-07-18T19:05:00Z", is_displayed: true },
] as const;

// ━━━ Catalogue : 13 cartes archétype (miroir 0037 — codes/raretés du quiz) ━━

function card(
  code: string,
  rarity: CollectibleCard["rarity"],
  title: string,
  verso_text: string,
): CollectibleCard {
  return {
    // UUID stable de fixture — même doctrine que SEED_PLACES (ids stables).
    id: `card-${code}`,
    code,
    kind: "archetype",
    rarity,
    title,
    image_url: `archetypes/${code}.webp`,
    verso_text,
  };
}

export const SEED_CARD_CATALOGUE: readonly CollectibleCard[] = [
  card("omnivore", "legendaire", "Omnivore", "Mange tout. Juge tout. N'appartient à aucune case."),
  card("gardien", "commun", "Gardien du Maquis", "Pourquoi chercher ailleurs quand tu as trouvé le bon ?"),
  card("ancre", "commun", "Ancre Fidèle", "La fidélité est une forme d'expertise."),
  card("bouchedor", "rare", "Bouche d'Or", "Le palais n'a pas de frontières, mais il a des standards."),
  card("braise", "rare", "Feu de Braise", "Manger seul c'est se nourrir. Ensemble, c'est vivre."),
  card("memoire", "rare", "Mémoire Vive", "Le vrai goût ne se réinvente pas. Il se transmet."),
  card("pisteur", "rare", "Pisteur de Rue", "Le nez au vent, les pieds dans la poussière."),
  card("vent", "epique", "Vent d'Ailleurs", "Chaque assiette est un billet d'avion."),
  card("fantome", "epique", "Fantôme Furtif", "Tu ne le trouves pas. C'est lui qui te trouve."),
  card("murmure", "legendaire", "Murmure de Cour", "Les meilleurs spots ne sont pas sur Google."),
  card("oeil", "epique", "Œil de Chat", "Si c'est moyen, ça n'existe pas."),
  card("lame", "legendaire", "Fine Lame", "Le détail sépare le bon du mémorable."),
  card("passeport", "epique", "Passeport Doré", "La grande table n'a pas de nationalité."),
] as const;

/** Cartes possédées en démo : 3 cartes, raretés variées, sources variées. */
export const SEED_OWNED_CARDS: readonly OwnedCard[] = [
  {
    ...SEED_CARD_CATALOGUE.find((c) => c.code === "pisteur")!,
    obtained_at: "2026-05-03T18:05:00Z",
    source: "heritage_quiz",
  },
  {
    ...SEED_CARD_CATALOGUE.find((c) => c.code === "gardien")!,
    obtained_at: "2026-06-21T13:45:00Z",
    source: "spawt",
  },
  {
    ...SEED_CARD_CATALOGUE.find((c) => c.code === "vent")!,
    obtained_at: "2026-07-18T19:10:00Z",
    source: "defi",
  },
] as const;

// ━━━ Paws : ledger démo (somme = 120) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 9 spawts vérifiés (+10) + 6 avis (+5) = 90 + 30 = 120. L'historique est la
// preuve : jamais de solde mutable, la démo respecte le modèle ledger.

function pawsEntry(
  n: number,
  delta: number,
  reason: PawsLedgerEntry["reason"],
  created_at: string,
): PawsLedgerEntry {
  return { id: `paws-demo-${n}`, delta, reason, ref_id: null, created_at };
}

export const SEED_PAWS_LEDGER: readonly PawsLedgerEntry[] = [
  pawsEntry(1, 10, "spawt_verifie", "2026-05-04T12:10:00Z"),
  pawsEntry(2, 5, "avis_publie", "2026-05-04T12:25:00Z"),
  pawsEntry(3, 10, "spawt_verifie", "2026-05-17T19:40:00Z"),
  pawsEntry(4, 10, "spawt_verifie", "2026-05-28T19:30:00Z"),
  pawsEntry(5, 5, "avis_publie", "2026-05-28T19:55:00Z"),
  pawsEntry(6, 10, "spawt_verifie", "2026-06-07T13:00:00Z"),
  pawsEntry(7, 10, "spawt_verifie", "2026-06-14T22:05:00Z"),
  pawsEntry(8, 5, "avis_publie", "2026-06-14T22:20:00Z"),
  pawsEntry(9, 10, "spawt_verifie", "2026-06-21T13:40:00Z"),
  pawsEntry(10, 5, "avis_publie", "2026-06-21T14:05:00Z"),
  pawsEntry(11, 10, "spawt_verifie", "2026-06-30T20:15:00Z"),
  pawsEntry(12, 5, "avis_publie", "2026-06-30T20:35:00Z"),
  pawsEntry(13, 10, "spawt_verifie", "2026-07-08T12:50:00Z"),
  pawsEntry(14, 10, "spawt_verifie", "2026-07-18T19:05:00Z"),
  pawsEntry(15, 5, "avis_publie", "2026-07-18T19:25:00Z"),
] as const;

/** Solde démo — dérivé du ledger (cohérence testée). */
export const SEED_PAWS_BALANCE: number = SEED_PAWS_LEDGER.reduce(
  (sum, e) => sum + e.delta,
  0,
);

// ━━━ Défi collectif actif (62 %) + streak privé ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const SEED_ACTIVE_CHALLENGE: ActiveChallenge = {
  id: "defi-demo-001",
  code: "meute_juillet_spawts",
  title_key: "defi.meute_juillet_spawts.title",
  description_key: "defi.meute_juillet_spawts.description",
  period_start: "2026-07-01",
  period_end: "2026-07-31",
  goal_type: "spawts_total",
  goal_target: 1000,
  reward_paws: 50,
  // 620/1000 = 62 % — la Meute entière, jamais un palmarès individuel.
  current_value: 620,
};

export const SEED_STREAK: SpawterStreak = {
  current_weeks: 3,
  best_weeks: 5,
  last_spawt_week: "2026-07-20",
};
