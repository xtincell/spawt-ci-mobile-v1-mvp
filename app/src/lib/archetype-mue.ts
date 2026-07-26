// La mue — changement LATÉRAL d'archétype (PRD final §5.5).
//
// Exigence produit : la mue est un CONSTAT NEUTRE, jamais une célébration ni
// une promotion. Contrairement aux stades (progression verticale, jamais de
// régression), l'archétype bouge latéralement au gré des spawts.
//
// Règle d'inertie (PRD §5.5, implémentation pragmatique tranchée chantier
// 13-archétypes) : l'archétype ne change que si les axes dominants sont
// STABLES — traduit ici en « le candidat calculé doit rester identique sur
// les 5 derniers recalculs CONSÉCUTIFS et différent de l'actuel ». Le
// compteur est persisté côté client (AsyncStorage, via le store spawter) —
// pas de nouvelle table SQL (le chantier 0033 côté DB ne couvre que les
// colonnes d'héritage, l'inertie reste locale).
//
// Ce module : décision PURE (testable unit) + helpers de persistance du
// compteur et du constat en attente (pattern pendingBadge/pendingStadeCelebration
// du spawter-store, mais SANS overlay de célébration — une bulle de Chat sobre).

import AsyncStorage from "@react-native-async-storage/async-storage";

import { isArchetypeKey, type ArchetypeKey } from "./archetype-engine";

/** Nombre de recalculs consécutifs identiques requis avant mue. */
export const MUE_STABILITY_THRESHOLD = 5;

/** Compteur de stabilité du candidat courant. */
export interface MueStreak {
  candidate: ArchetypeKey;
  count: number;
}

/** Constat de mue en attente d'affichage (bulle de Chat neutre). */
export interface PendingMue {
  from: ArchetypeKey | null;
  to: ArchetypeKey;
}

export type ArchetypeTransition =
  /** Rien ne change — le compteur (éventuellement avancé) est retourné. */
  | { type: "none"; streak: MueStreak | null }
  /** Aucun archétype courant (legacy / première assignation) → direct, sans inertie. */
  | { type: "assign"; to: ArchetypeKey }
  /** Mue effective — le caller met à jour store + titres + analytics + Chat. */
  | { type: "mue"; from: ArchetypeKey; to: ArchetypeKey };

/**
 * Décision pure d'inertie. Ne fait AUCUN I/O.
 *
 * - `current` null → assignation directe (cas legacy : spawter d'avant le
 *   chantier, jamais d'archétype calculé).
 * - candidat identique à l'actuel → reset du compteur (la stabilité de
 *   l'actuel n'alimente pas une mue).
 * - candidat différent → +1 si même candidat qu'au recalcul précédent,
 *   sinon repart à 1. Au seuil {@link MUE_STABILITY_THRESHOLD} → mue.
 */
export function evaluateArchetypeTransition(input: {
  current: ArchetypeKey | null;
  candidate: ArchetypeKey;
  streak: MueStreak | null;
}): ArchetypeTransition {
  const { current, candidate, streak } = input;
  if (current === null) {
    return { type: "assign", to: candidate };
  }
  if (candidate === current) {
    // Retour au bercail : toute série en cours est invalidée (les recalculs
    // doivent être CONSÉCUTIFS).
    return { type: "none", streak: null };
  }
  const count = streak?.candidate === candidate ? streak.count + 1 : 1;
  if (count >= MUE_STABILITY_THRESHOLD) {
    return { type: "mue", from: current, to: candidate };
  }
  return { type: "none", streak: { candidate, count } };
}

// ─── Persistance AsyncStorage (compteur + constat en attente) ───────────────
// Clés préfixées `spawt:` comme storage.ts. Purgées par le reset du store.

export const MUE_STREAK_STORAGE_KEY = "spawt:archetype:mue_streak";
export const PENDING_MUE_STORAGE_KEY = "spawt:archetype:pending_mue";

export async function loadMueStreak(): Promise<MueStreak | null> {
  try {
    const raw = await AsyncStorage.getItem(MUE_STREAK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { candidate?: unknown; count?: unknown };
    if (!isArchetypeKey(parsed.candidate) || typeof parsed.count !== "number") {
      return null;
    }
    return { candidate: parsed.candidate, count: parsed.count };
  } catch {
    return null;
  }
}

export async function saveMueStreak(streak: MueStreak | null): Promise<void> {
  try {
    if (streak === null) {
      await AsyncStorage.removeItem(MUE_STREAK_STORAGE_KEY);
    } else {
      await AsyncStorage.setItem(MUE_STREAK_STORAGE_KEY, JSON.stringify(streak));
    }
  } catch (err) {
    if (__DEV__) console.warn("[archetype-mue] saveMueStreak failed", err);
  }
}

export async function loadPendingMue(): Promise<PendingMue | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_MUE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { from?: unknown; to?: unknown };
    if (!isArchetypeKey(parsed.to)) return null;
    return { from: isArchetypeKey(parsed.from) ? parsed.from : null, to: parsed.to };
  } catch {
    return null;
  }
}

export async function savePendingMue(pending: PendingMue | null): Promise<void> {
  try {
    if (pending === null) {
      await AsyncStorage.removeItem(PENDING_MUE_STORAGE_KEY);
    } else {
      await AsyncStorage.setItem(PENDING_MUE_STORAGE_KEY, JSON.stringify(pending));
    }
  } catch (err) {
    if (__DEV__) console.warn("[archetype-mue] savePendingMue failed", err);
  }
}
