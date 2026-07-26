// Mode Crew — résolution DÉTERMINISTE du vote (pure, totale, testable).
//
// Règles, dans l'ordre :
//   1. Majorité simple : la proposition avec le plus de voix gagne.
//   2. Égalité → départage par le score de matching de l'HÔTE
//      (computeRawScore de matching.ts). Choix documenté : l'hôte a créé la
//      session, c'est son Palais qui départage — la décision reste humaine
//      (celle du crew) sauf quand le crew n'a pas su trancher, auquel cas
//      l'algorithme penche du côté de celui qui a lancé l'appel.
//   3. Nouvelle égalité (scores identiques ou Palais hôte indisponible) →
//      le PREMIER PROPOSÉ gagne (index le plus bas dans l'ordre du snapshot,
//      cf. contrat CrewSnapshot.proposals — l'ordre de proposition est
//      préservé par le fetch et par le moteur démo).
//
// Pure : aucun I/O, aucun throw, aucune mutation des entrées. Le déclencheur
// (bouton hôte « Tranche » ou expiration TTL) vit dans le store.

import {
  computeRawScore,
  type MatchingContext,
  type PlaceWithSignals,
} from "../matching";

/** Vue minimale d'une proposition pour la résolution (découplée de l'UI). */
export interface CrewProposalTally {
  proposal_id: string;
  place_id: string;
  votes: number;
}

/**
 * Contexte de départage de l'hôte. `candidates` mappe place_id → signaux de
 * matching ; un candidat absent de la map score 0 (il ne peut gagner un
 * départage que si tous les ex æquo sont absents — auquel cas règle 3).
 */
export interface HostTiebreak {
  ctx: MatchingContext;
  candidates: ReadonlyMap<string, PlaceWithSignals>;
}

export interface CrewResolution {
  proposal_id: string;
  place_id: string;
  votes: number;
  /** Règle qui a tranché — trace UI/analytics. */
  decided_by: "majority" | "host_palais" | "first_proposed";
}

/**
 * Résout le vote du crew. Retourne null si aucune proposition (le caller
 * affiche l'état vide — on ne tranche pas dans le vide).
 *
 * @param proposals ordre = ordre de proposition (premier proposé en tête).
 * @param host      départage Palais de l'hôte — optionnel (démo côté membre,
 *                  hôte parti…) ; absent → règle 3 directement en cas d'égalité.
 */
export function resolveCrewWinner(
  proposals: readonly CrewProposalTally[],
  host?: HostTiebreak | null,
): CrewResolution | null {
  if (proposals.length === 0) return null;

  // 1. Majorité simple.
  const maxVotes = proposals.reduce((m, p) => Math.max(m, p.votes), 0);
  const tied = proposals.filter((p) => p.votes === maxVotes);
  const first = tied[0];
  if (!first) return null; // impossible (length > 0) — totalité défensive
  if (tied.length === 1) {
    return { ...toResolution(first), decided_by: "majority" };
  }

  // 2. Départage par le Palais de l'hôte. On score tous les ex æquo, puis on
  // re-filtre sur le score max : s'il reste plusieurs candidats (scores
  // identiques), la règle 3 s'applique PARMI EUX (pas parmi tous les ex æquo
  // initiaux — « nouvelle égalité → premier proposé » se lit en cascade).
  let pool: readonly CrewProposalTally[] = tied;
  if (host) {
    const scores = tied.map((p) => {
      const candidate = host.candidates.get(p.place_id);
      return candidate ? computeRawScore(host.ctx, candidate) : 0;
    });
    const maxScore = scores.reduce((m, s) => Math.max(m, s), 0);
    pool = tied.filter((_, i) => scores[i] === maxScore);
    const winner = pool[0];
    if (pool.length === 1 && winner) {
      return { ...toResolution(winner), decided_by: "host_palais" };
    }
  }

  // 3. Ultime départage : premier proposé parmi les ex æquo restants.
  const fallback = pool[0] ?? first;
  return { ...toResolution(fallback), decided_by: "first_proposed" };
}

function toResolution(p: CrewProposalTally): Omit<CrewResolution, "decided_by"> {
  return { proposal_id: p.proposal_id, place_id: p.place_id, votes: p.votes };
}
