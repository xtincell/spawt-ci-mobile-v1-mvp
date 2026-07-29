// PRD §3.1 Feature 8 + §5.2 — 5 stades de maturité
// La maturité mesure le comportement accumulé — elle ne recule jamais.
// Progression par spots UNIQUES (lieux différents) avec check-in vérifié.

export const STADES = ["touriste", "explorateur", "detective", "djidji", "guide"] as const;

export type Stade = (typeof STADES)[number];

export interface StadeDescriptor {
  id: Stade;
  label: string;
  /** Seuil min de spots uniques (inclus) */
  min: number;
  /** Seuil max (exclu pour Guide qui est ouvert) */
  max: number | null;
  /** Comportement (PRD §5.2) */
  behavior: string;
  /** Voix du Chat (PRD §9.3) */
  chatTone: string;
  /** Poids algorithmique des avis (PRD §3.1 Feature 6) */
  reviewWeight: number;
  /** Coups de Cœur base/mois (PRD §3.1 Feature 12) */
  coupsDeCoeurBase: number;
}

export const STADE_DESCRIPTORS: Record<Stade, StadeDescriptor> = {
  touriste: {
    id: "touriste",
    label: "Touriste",
    min: 0,
    max: 11,
    behavior: "Renifle tout. Palais bouge beaucoup.",
    chatTone: "enjoue_taquin",
    reviewWeight: 1.0,
    coupsDeCoeurBase: 1,
  },
  explorateur: {
    id: "explorateur",
    label: "Explorateur",
    min: 11,
    max: 21,
    behavior: "Territoire qui se dessine. Axes se stabilisent.",
    chatTone: "complice",
    reviewWeight: 1.5,
    coupsDeCoeurBase: 1,
  },
  detective: {
    id: "detective",
    label: "Détective",
    min: 21,
    max: 31,
    behavior: "Sûr de son flair. Respecté dans sa zone.",
    chatTone: "grave_respectueux",
    reviewWeight: 2.0,
    coupsDeCoeurBase: 1,
  },
  djidji: {
    id: "djidji",
    label: "Djidji",
    min: 31,
    max: 51,
    behavior: "Expert reconnu. La colonie écoute.",
    chatTone: "solennel",
    reviewWeight: 2.5,
    coupsDeCoeurBase: 2,
  },
  guide: {
    id: "guide",
    label: "Guide",
    min: 51,
    max: null,
    behavior: "Le chat qui marche devant. Slots limités par ville.",
    chatTone: "rare_sacre",
    reviewWeight: 3.0,
    coupsDeCoeurBase: 3,
  },
};

/**
 * Détermine le stade d'un spawter selon ses spots uniques.
 * Aligné PRD §3.1 Feature 8 et §5.2.
 */
export function getStade(uniqueSpots: number): Stade {
  if (uniqueSpots < 11) return "touriste";
  if (uniqueSpots < 21) return "explorateur";
  if (uniqueSpots < 31) return "detective";
  if (uniqueSpots < 51) return "djidji";
  return "guide";
}

// PRD §5.2 — invariant : la maturité ne recule jamais. Si un SpawtCheckin
// passe `is_verified` de true à false (rejet antifraude serveur), uniqueSpots
// peut chuter et `getStade(uniqueSpots)` redescendre. Cet helper protège le
// stade persisté en prenant systématiquement le max entre l'ancien et le
// nouveau via l'ordre canonique STADES.
export function maxStade(current: Stade, candidate: Stade): Stade {
  const currentIdx = STADES.indexOf(current);
  const candidateIdx = STADES.indexOf(candidate);
  return currentIdx >= candidateIdx ? current : candidate;
}

export function getStadeDescriptor(stade: Stade): StadeDescriptor {
  return STADE_DESCRIPTORS[stade];
}

/** Poids du stade dans le calcul de la note communautaire pondérée (PRD §3.1 Feature 6 + §20.6).
 *  Invariant — ne pas modifier sans review tech lead + Stéphanie + Kidam + Alexandre. */
export const STADE_WEIGHTS = {
  touriste: 1,
  explorateur: 1.5,
  detective: 2,
  djidji: 2.5,
  guide: 3,
} as const satisfies Record<Stade, number>;
