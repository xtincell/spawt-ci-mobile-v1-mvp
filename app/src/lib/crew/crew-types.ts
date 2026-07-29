// Mode Crew — types partagés (lib / store / UI).
//
// Miroir TS des tables de la migration 0038 (crew_sessions, crew_members,
// crew_proposals, crew_votes) + agrégats d'affichage. Les compteurs de votes
// sont ANONYMES par design (sobriété sociale) : on expose `votes` (count) et
// `has_my_vote`, jamais la liste des votants.

export type CrewSessionStatus = "open" | "voting" | "resolved" | "expired";

/** Miroir de `crew_sessions` (0038). */
export interface CrewSession {
  id: string;
  /** Code d'entrée 5 chars A-Z/2-9 (sans 0/1/O/I — partageable à l'oral). */
  code: string;
  host_id: string | null;
  status: CrewSessionStatus;
  winning_place_id: string | null;
  expires_at: string;
  created_at: string;
}

/** Membre du crew — `crew_members` + identité publique (spawters_public). */
export interface CrewMember {
  session_id: string;
  spawter_id: string;
  display_name: string;
  avatar_url: string | null;
  joined_at: string;
}

/**
 * Proposition de lieu — `crew_proposals` + dénormalisation lieu + agrégat de
 * votes. `votes` = compteur anonyme ; `has_my_vote` = le spawter courant a
 * déjà voté cette proposition (PK proposal+spawter côté DB).
 */
export interface CrewProposal {
  id: string;
  session_id: string;
  place_id: string;
  proposed_by: string | null;
  place_name: string;
  place_neighborhood: string;
  votes: number;
  has_my_vote: boolean;
}

/**
 * Snapshot complet d'une session, tel que consommé par le store/l'UI.
 * `proposals` est ORDONNÉ par ordre de proposition (premier proposé en tête) —
 * cet ordre sert de départage ultime à la résolution (crew-resolution.ts).
 */
export interface CrewSnapshot {
  session: CrewSession;
  members: CrewMember[];
  proposals: CrewProposal[];
}

/** Référence légère persistée (re-rejoindre après kill de l'app). */
export interface CrewSessionRef {
  session_id: string;
  code: string;
  expires_at: string;
}

/** Identité minimale du spawter courant, injectée par le store. */
export interface CrewSelf {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

/** Résultat des mutations idempotentes (propose / vote). */
export type CrewMutationResult = "ok" | "duplicate" | "error";

/** Résultat de joinCrewSession — miroir des codes du RPC 0038. */
export type CrewJoinResult =
  | { ok: true; ref: CrewSessionRef }
  | { ok: false; reason: "session_not_found" | "session_closed" | "error" };

/**
 * Événements poussés vers le store par la couche temps réel (crew-realtime)
 * ou par le moteur démo (crew-demo). Contrat volontairement minimal :
 * - "refetch"  → quelque chose a changé, refetch du snapshot (source de vérité).
 * - "resolved" → l'hôte a tranché (broadcast) — payload = lieu gagnant.
 */
export type CrewEvent =
  | { type: "refetch" }
  | { type: "resolved"; winning_place_id: string | null };

export type CrewEventListener = (evt: CrewEvent) => void;
