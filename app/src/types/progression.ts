// Progression complète — badges 30+, cartes collector, paws, défis collectifs
// (features post-MVP #10, #5, #13, #14). Types alignés sur les migrations
// 0035 (paws_ledger), 0036 (badges), 0037 (collectibles), 0040 (défis+streaks).
//
// ⚠️ Contrat SPAWT (PRD §19/§20.1) : la progression est PERSONNELLE et les
// défis sont COLLECTIFS — aucune structure ici ne permet de comparer deux
// spawters (pas de liste par spawter, pas de rang, jamais).

// ━━━ Badges (0036) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type BadgeCategory = "core" | "exploration" | "expertise" | "influence";

/** Conditions typées du catalogue — miroir du CHECK `badge_catalogue.condition_type`. */
export type BadgeConditionType =
  | "communes_distinctes"
  | "spawts_apres_21h"
  | "lieux_peu_avises"
  | "types_cuisine"
  | "avis_sauvegardes"
  | "spawts_total"
  | "avis_total"
  | "premier_spawt"
  | "coups_de_coeur_recus"
  | "spawts_weekend"
  | "lieux_nouveaux_30j"
  | "photos_publiees"
  | "parrainages"
  | "defis_completes"
  | "custom";

/** Row du catalogue `badge_catalogue` (les conditions vivent EN SQL — l'app affiche). */
export interface BadgeCatalogueEntry {
  code: string;
  category: BadgeCategory;
  /** Clé i18n `badge.<code>.title`. */
  title_key: string;
  /** Clé i18n `badge.<code>.description`. */
  description_key: string;
  condition_type: BadgeConditionType;
  /** NULL pour les conditions `custom` (attribution par le staff, côté serveur). */
  threshold: number | null;
  sort_order: number;
}

/** Row `spawter_badges` du spawter courant (RLS own). */
export interface SpawterBadgeRow {
  badge_code: string;
  unlocked_at: string;
  /** Max 3 affichés — trigger SQL `assert_max_displayed_badges`. */
  is_displayed: boolean;
}

/** Snapshot data-layer : catalogue complet + état du spawter. */
export interface BadgeSnapshot {
  catalogue: BadgeCatalogueEntry[];
  unlocked: SpawterBadgeRow[];
}

/** Badge fusionné pour l'UI (catalogue + état + progression client). */
export interface BadgeWithState extends BadgeCatalogueEntry {
  unlocked: boolean;
  unlocked_at: string | null;
  is_displayed: boolean;
  /** Valeur client de la métrique quand calculable depuis le store, sinon null. */
  progress_current: number | null;
  /** [0,1] vers le seuil quand calculable côté client (1 si débloqué), sinon null. */
  progress_percent: number | null;
}

// ━━━ Cartes collector (0037) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type CardRarity = "commun" | "rare" | "epique" | "legendaire";
export type CardKind = "archetype" | "plat" | "lieu" | "evenement";
export type CardSource = "spawt" | "badge" | "defi" | "heritage_quiz" | "admin";

/** Row `collectible_cards` (catalogue). `title` est une donnée produit DB
 *  (parité quiz « La Meute »), pas une clé i18n — même doctrine que le code
 *  SPWT des archétypes. */
export interface CollectibleCard {
  id: string;
  code: string;
  kind: CardKind;
  rarity: CardRarity;
  title: string;
  /** Chemin relatif bucket (ex: `archetypes/omnivore.webp`) — l'app mappe
   *  vers ses assets embarqués quand kind=archetype. */
  image_url: string | null;
  verso_text: string | null;
}

/** Carte possédée (join `spawter_cards` × `collectible_cards`). */
export interface OwnedCard extends CollectibleCard {
  obtained_at: string;
  source: CardSource;
}

// ━━━ Paws (0035) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Raisons du ledger — miroir du CHECK `paws_ledger.reason`. */
export type PawsReason =
  | "spawt_verifie"
  | "avis_publie"
  | "badge_obtenu"
  | "defi_collectif"
  | "ajustement_admin";

/** Ligne du ledger append-only (le solde = somme, jamais une colonne mutable). */
export interface PawsLedgerEntry {
  id: string;
  delta: number;
  reason: PawsReason;
  ref_id: string | null;
  created_at: string;
}

// ━━━ Défis collectifs + streak privé (0040) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type ChallengeGoalType =
  | "spawts_total"
  | "communes_couvertes"
  | "avis_total"
  | "nouveaux_lieux";

/** Défi actif + progression AGRÉGÉE de la Meute entière.
 *  `current_value` vient de `challenge_progress` : UNE ligne par défi, aucune
 *  colonne spawter_id — impossible de comparer des spawters, par construction. */
export interface ActiveChallenge {
  id: string;
  code: string;
  /** Clé i18n `defi.<code>.title`. */
  title_key: string;
  /** Clé i18n `defi.<code>.description`. */
  description_key: string;
  period_start: string;
  period_end: string;
  goal_type: ChallengeGoalType;
  goal_target: number;
  /** Récompense COLLECTIVE : chaque participant la reçoit à l'objectif atteint. */
  reward_paws: number;
  current_value: number;
}

/** Streak hebdo PRIVÉ (RLS owner-only) — un rendez-vous avec soi-même,
 *  jamais agrégé, jamais comparé. */
export interface SpawterStreak {
  current_weeks: number;
  best_weeks: number;
  /** Lundi ISO de la dernière semaine avec >= 1 spawt vérifié. */
  last_spawt_week: string | null;
}
