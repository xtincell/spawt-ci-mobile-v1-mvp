// Moteur d'agrégation Progression — helpers PURS, sans I/O.
// Fusionne pour l'UI : stade (réutilise stade-progress tel quel), badges
// (catalogue 0036 + état + % de progression client quand calculable), cartes
// (0037, groupées par rareté), paws (0035), streak privé et défis collectifs
// (0040). Tests : __tests__/progression-engine.test.ts.
//
// Doctrine des conditions : elles vivent EN SQL (check_and_award_badges).
// Le client ne RE-calcule que les métriques dérivables des données du store
// (spawts locaux) pour afficher un « % vers le prochain badge » honnête —
// quand une métrique n'est pas dérivable localement (communes, parrainages…),
// le badge s'affiche SANS pourcentage, jamais avec un chiffre inventé.

import type { SpawtCheckin } from "../types/spawt";
import type { Spawter } from "../types/spawter";
import type {
  ActiveChallenge,
  BadgeCategory,
  BadgeConditionType,
  BadgeSnapshot,
  BadgeWithState,
  CardRarity,
  OwnedCard,
  PawsLedgerEntry,
  SpawterStreak,
} from "../types/progression";
import { getNextStadeProgress, type StadeProgress } from "./stade-progress";

// ━━━ Métriques calculables côté client ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Sous-ensemble des conditions dérivables des spawts du store local. */
export type ClientBadgeMetrics = Partial<Record<BadgeConditionType, number>>;

/**
 * Calcule les métriques de badges dérivables des spawts LOCAUX.
 * Mêmes exclusions que le SQL 0036 : spawts vérifiés hors seed/annulés ;
 * avis = note attachée hors seed/annulés. Heures en UTC (Abidjan = GMT+0,
 * même convention que `check_and_award_badges`).
 */
export function computeClientBadgeMetrics(
  spawts: readonly SpawtCheckin[],
): ClientBadgeMetrics {
  const verified = spawts.filter(
    (s) => s.is_verified && !s.is_seed && !s.is_cancelled,
  );
  const avis = spawts.filter(
    (s) => s.note_etoiles !== null && !s.is_seed && !s.is_cancelled,
  );

  let apres21h = 0;
  let weekend = 0;
  for (const s of verified) {
    const d = new Date(s.arrived_at);
    if (Number.isNaN(d.getTime())) continue;
    if (d.getUTCHours() >= 21) apres21h += 1;
    const dow = d.getUTCDay(); // 0 = dimanche, 6 = samedi
    if (dow === 0 || dow === 6) weekend += 1;
  }

  let photos = 0;
  for (const s of avis) photos += (s.photos ?? []).length;

  return {
    spawts_total: verified.length,
    premier_spawt: verified.length,
    spawts_apres_21h: apres21h,
    spawts_weekend: weekend,
    avis_total: avis.length,
    photos_publiees: photos,
  };
}

// ━━━ Badges : fusion catalogue × état × métriques ━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Ordre d'affichage des catégories (grille de l'écran Progression). */
export const BADGE_CATEGORY_ORDER: readonly BadgeCategory[] = [
  "core",
  "exploration",
  "expertise",
  "influence",
] as const;

/**
 * Fusionne le snapshot data-layer en badges prêts pour l'UI, triés par
 * sort_order. `progress_percent` n'est renseigné que si la métrique est
 * calculable client-side (sinon null — pas de % inventé).
 */
export function buildBadgeStates(
  snapshot: BadgeSnapshot,
  metrics: ClientBadgeMetrics = {},
): BadgeWithState[] {
  const unlockedByCode = new Map(snapshot.unlocked.map((u) => [u.badge_code, u]));
  return snapshot.catalogue
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((entry) => {
      const own = unlockedByCode.get(entry.code);
      const metric = metrics[entry.condition_type];
      const threshold = entry.threshold ?? 1;
      const current = typeof metric === "number" ? metric : null;
      let percent: number | null = null;
      if (own) {
        percent = 1;
      } else if (current !== null && threshold > 0) {
        percent = Math.max(0, Math.min(1, current / threshold));
      }
      return {
        ...entry,
        unlocked: Boolean(own),
        unlocked_at: own?.unlocked_at ?? null,
        is_displayed: own?.is_displayed ?? false,
        progress_current: current,
        progress_percent: percent,
      };
    });
}

/** Groupe par catégorie, dans l'ordre canonique (catégories vides omises). */
export function groupBadgesByCategory(
  badges: readonly BadgeWithState[],
): { category: BadgeCategory; badges: BadgeWithState[] }[] {
  const out: { category: BadgeCategory; badges: BadgeWithState[] }[] = [];
  for (const category of BADGE_CATEGORY_ORDER) {
    const list = badges.filter((b) => b.category === category);
    if (list.length > 0) out.push({ category, badges: list });
  }
  return out;
}

/** Badges affichés sur le profil (max 3 — invariant DB, défendu ici aussi). */
export function displayedBadges(
  badges: readonly BadgeWithState[],
): BadgeWithState[] {
  return badges.filter((b) => b.unlocked && b.is_displayed).slice(0, 3);
}

/**
 * Prochains badges atteignables : verrouillés, hors `custom` (attribution
 * spéciale, aucun % possible), triés % décroissant — ceux SANS % calculable
 * passent après ceux avec %, à seuil croissant (le plus accessible d'abord).
 */
export function nextBadges(
  badges: readonly BadgeWithState[],
  limit = 3,
): BadgeWithState[] {
  const locked = badges.filter((b) => !b.unlocked && b.condition_type !== "custom");
  const withPercent = locked
    .filter((b) => b.progress_percent !== null)
    .sort((a, b) => (b.progress_percent ?? 0) - (a.progress_percent ?? 0));
  const without = locked
    .filter((b) => b.progress_percent === null)
    .sort((a, b) => (a.threshold ?? 1) - (b.threshold ?? 1));
  return [...withPercent, ...without].slice(0, limit);
}

// ━━━ Cartes : groupement par rareté ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Ordre d'affichage des raretés (la légende ouvre le bal). */
export const CARD_RARITY_ORDER: readonly CardRarity[] = [
  "legendaire",
  "epique",
  "rare",
  "commun",
] as const;

export function groupCardsByRarity(
  cards: readonly OwnedCard[],
): { rarity: CardRarity; cards: OwnedCard[] }[] {
  const out: { rarity: CardRarity; cards: OwnedCard[] }[] = [];
  for (const rarity of CARD_RARITY_ORDER) {
    const list = cards
      .filter((c) => c.rarity === rarity)
      .slice()
      .sort((a, b) => b.obtained_at.localeCompare(a.obtained_at));
    if (list.length > 0) out.push({ rarity, cards: list });
  }
  return out;
}

// ━━━ Défis : progression collective ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** % [0,1] d'un défi collectif — agrégat Meute entière, jamais individuel. */
export function challengePercent(challenge: ActiveChallenge): number {
  if (challenge.goal_target <= 0) return 0;
  return Math.max(0, Math.min(1, challenge.current_value / challenge.goal_target));
}

// ━━━ Agrégateur unique pour l'UI ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ProgressionSummary {
  /** Stade + % vers le prochain seuil (réutilise stade-progress tel quel). */
  stade: StadeProgress;
  /** Tous les badges (catalogue trié), fusionnés avec l'état du spawter. */
  badges: BadgeWithState[];
  /** Badges affichés sur le profil (max 3). */
  displayed: BadgeWithState[];
  /** Prochains badges atteignables (avec % quand calculable). */
  next: BadgeWithState[];
  unlockedCount: number;
  /** Cartes possédées, groupées par rareté (légendaire d'abord). */
  cardsByRarity: { rarity: CardRarity; cards: OwnedCard[] }[];
  cardsCount: number;
  /** Solde paws (somme du ledger) — null si indéterminé (réseau). */
  pawsBalance: number | null;
  pawsLedger: PawsLedgerEntry[];
  /** Streak hebdo PRIVÉ — null si inconnu. */
  streak: SpawterStreak | null;
  /** Défis collectifs actifs (progression = Meute entière). */
  challenges: ActiveChallenge[];
}

export interface ProgressionInputs {
  spawter: Pick<Spawter, "stade" | "unique_spots">;
  spawts: readonly SpawtCheckin[];
  badges: BadgeSnapshot;
  cards: readonly OwnedCard[];
  pawsBalance: number | null;
  pawsLedger: readonly PawsLedgerEntry[];
  streak: SpawterStreak | null;
  challenges: readonly ActiveChallenge[];
}

/** Point d'entrée unique : agrège tout ce que l'écran Progression affiche. */
export function buildProgressionSummary(inputs: ProgressionInputs): ProgressionSummary {
  const metrics = computeClientBadgeMetrics(inputs.spawts);
  const badges = buildBadgeStates(inputs.badges, metrics);
  return {
    stade: getNextStadeProgress(inputs.spawter.stade, inputs.spawter.unique_spots),
    badges,
    displayed: displayedBadges(badges),
    next: nextBadges(badges),
    unlockedCount: badges.filter((b) => b.unlocked).length,
    cardsByRarity: groupCardsByRarity(inputs.cards),
    cardsCount: inputs.cards.length,
    pawsBalance: inputs.pawsBalance,
    pawsLedger: inputs.pawsLedger.slice(),
    streak: inputs.streak,
    challenges: inputs.challenges.slice(),
  };
}
