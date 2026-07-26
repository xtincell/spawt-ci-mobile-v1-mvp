// Mode Crew — façade métier de la session (l'API que consomme le store/l'UI).
//
// Chaque fonction passe par le data layer (data-source.ts) qui dispatch
// démo/Supabase, et émet les signaux analytics de la feature. Le vote émet le
// signal `crew_vote` (0046) — le cas d'usage roi se mesure : « 3 heures de
// débat WhatsApp » → temps entre crew_session_created et crew_session_resolved.

import { Linking } from "react-native";

import {
  createCrewSession as dsCreate,
  joinCrewSession as dsJoin,
  fetchCrewSnapshot as dsFetch,
  proposeCrewPlace as dsPropose,
  voteCrewProposal as dsVote,
  leaveCrewSession as dsLeave,
  resolveCrewSession as dsResolve,
} from "../data-source";
import { track } from "../analytics";
import type {
  CrewJoinResult,
  CrewMutationResult,
  CrewSelf,
  CrewSessionRef,
  CrewSnapshot,
} from "./crew-types";

/** Lien profond partagé dans le message WhatsApp (même domaine que le partage lieu). */
export function buildCrewInviteUrl(code: string): string {
  return `https://spawt.ci/crew/${code}`;
}

/**
 * Ouvre WhatsApp avec un message pré-rempli, sans destinataire (le spawter
 * choisit son groupe). `wa.me/?text=` ouvre le picker de conversation.
 */
export function openWhatsAppWithMessage(message: string): void {
  void Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`).catch(
    (err: unknown) => {
      if (__DEV__) console.warn("[crew] WhatsApp open failed", err);
    },
  );
}

/** Crée une session — le spawter courant devient l'hôte. */
export async function createSession(self: CrewSelf): Promise<CrewSessionRef | null> {
  const ref = await dsCreate(self);
  if (ref) {
    track({
      name: "crew_session_created",
      properties: { session_id: ref.session_id },
    });
  }
  return ref;
}

/** Rejoint une session par code (normalisé serveur-side : trim + upper). */
export async function joinSession(code: string, self: CrewSelf): Promise<CrewJoinResult> {
  const result = await dsJoin(code, self);
  if (result.ok) {
    track({
      name: "crew_session_joined",
      properties: { session_id: result.ref.session_id },
    });
  }
  return result;
}

/** Snapshot complet (source de vérité du store après chaque événement). */
export async function fetchSnapshot(
  session_id: string,
  self_id: string,
): Promise<CrewSnapshot | null> {
  return dsFetch(session_id, self_id);
}

/** Propose un lieu au vote. "duplicate" = déjà en lice (UNIQUE session+place). */
export async function proposePlace(
  session_id: string,
  place: { id: string; name: string; neighborhood: string },
  self_id: string,
): Promise<CrewMutationResult> {
  const result = await dsPropose(session_id, place, self_id);
  if (result === "ok") {
    track({
      name: "crew_place_proposed",
      properties: { session_id, place_id: place.id },
    });
  }
  return result;
}

/**
 * Vote une proposition. Un vote par (proposition, spawter) — la PK DB (ou le
 * moteur démo) rejette le double vote → "duplicate". Émet le signal ML
 * `crew_vote` (user_signals, 0046) : un vote de crew est un signal de goût.
 */
export async function vote(
  session_id: string,
  proposal_id: string,
  place_id: string,
  self_id: string,
): Promise<CrewMutationResult> {
  const result = await dsVote(session_id, proposal_id, self_id);
  if (result === "ok") {
    track({
      name: "crew_vote_cast",
      properties: { session_id, proposal_id, place_id },
    });
  }
  return result;
}

/** Quitte la session (DELETE self / nettoyage moteur démo). */
export async function leaveSession(session_id: string, self_id: string): Promise<void> {
  await dsLeave(session_id, self_id);
}

/**
 * Persiste la clôture (hôte uniquement — le gagnant est calculé en amont par
 * crew-resolution via le store). Best-effort en mode supabase (limite RLS
 * documentée dans data-source.supabase.ts) — la révélation temps réel passe
 * par le broadcast de crew-realtime.
 */
export async function resolveSession(
  session_id: string,
  winning_place_id: string | null,
  decided_by: "majority" | "host_palais" | "first_proposed",
): Promise<boolean> {
  const persisted = await dsResolve(session_id, winning_place_id);
  track({
    name: "crew_session_resolved",
    properties: {
      session_id,
      place_id: winning_place_id,
      decided_by,
      persisted,
    },
  });
  return persisted;
}
