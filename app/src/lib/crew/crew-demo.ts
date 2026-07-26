// Mode Crew — moteur DÉMO local (fallback sans Supabase).
//
// Objectif : faire VIVRE la feature en preview. Une session simulée embarque
// 2 membres bots (Awa et Yao) qui rejoignent, proposent et votent après de
// courts délais — le flux complet (création → code → arrivées → propositions
// → votes → résolution) se joue sans backend.
//
// Comportement bot DÉTERMINISTE (testable aux fake timers) :
//   - Awa vote TOUTES les propositions (l'enthousiaste) ;
//   - Yao ne vote que la PREMIÈRE (le fidèle) ;
//   → la 1re proposition prend 2 voix bots, les suivantes 1 : les votes du
//     spawter créent naturellement des égalités qui exercent la résolution.
//
// Flux « rejoindre par code » : n'importe quel code bien formé ouvre une
// session hébergée par Awa (bot hôte) — propositions et votes arrivent, puis
// le bot hôte tranche tout seul après un délai. Le spawter vit ainsi le flux
// MEMBRE de bout en bout.
//
// État module-scope (singleton applicatif, même pattern qu'analytics.ts).
// Timers nettoyés à leaveSession / résolution — rien ne fuit après unmount.

import { SEED_PLACES } from "../../data/seed/places";
import type {
  CrewEvent,
  CrewEventListener,
  CrewJoinResult,
  CrewMember,
  CrewMutationResult,
  CrewProposal,
  CrewSelf,
  CrewSessionRef,
  CrewSnapshot,
} from "./crew-types";

// ─── Constantes démo ────────────────────────────────────────────────────────

/** TTL démo : 30 min — session courte, la faim n'attend pas. */
export const DEMO_TTL_MS = 30 * 60 * 1000;

/** Alphabet du code — miroir de generate_crew_code (0038) : sans 0/1/O/I. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const BOT_AWA: Omit<CrewMember, "session_id" | "joined_at"> = {
  spawter_id: "demo-bot-awa",
  display_name: "Awa",
  avatar_url: null,
};
const BOT_YAO: Omit<CrewMember, "session_id" | "joined_at"> = {
  spawter_id: "demo-bot-yao",
  display_name: "Yao",
  avatar_url: null,
};

// Délais courts : la preview doit bouger sous les yeux du spawter.
const DELAY_AWA_JOINS_MS = 1500;
const DELAY_YAO_JOINS_MS = 3200;
const DELAY_BOT_VOTE_MS = 2000;
const DELAY_BOT_PROPOSES_MS = 4500;
/** Flux membre : le bot hôte tranche tout seul après ce délai. */
const DELAY_BOT_HOST_RESOLVES_MS = 25_000;

// ─── État interne ───────────────────────────────────────────────────────────

interface DemoSessionState {
  snapshot: CrewSnapshot;
  /** proposal_ids déjà votés par chaque bot (rejoue la PK proposal+spawter). */
  botVotes: Map<string, Set<string>>;
  /** proposal_ids votés par le spawter courant (has_my_vote). */
  myVotes: Set<string>;
  selfId: string;
  timers: Set<ReturnType<typeof setTimeout>>;
  listeners: Set<CrewEventListener>;
}

const sessions = new Map<string, DemoSessionState>();
let idCounter = 0;

function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function generateDemoCode(): string {
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

function emit(state: DemoSessionState, evt: CrewEvent): void {
  for (const l of state.listeners) l(evt);
}

function schedule(state: DemoSessionState, ms: number, fn: () => void): void {
  const timer = setTimeout(() => {
    state.timers.delete(timer);
    // Session terminée entre-temps → le bot n'agit plus.
    if (state.snapshot.session.status === "resolved") return;
    fn();
  }, ms);
  state.timers.add(timer);
}

function clearTimers(state: DemoSessionState): void {
  for (const t of state.timers) clearTimeout(t);
  state.timers.clear();
}

function addMember(
  state: DemoSessionState,
  bot: Omit<CrewMember, "session_id" | "joined_at">,
): void {
  const already = state.snapshot.members.some((m) => m.spawter_id === bot.spawter_id);
  if (already) return;
  state.snapshot.members.push({
    ...bot,
    session_id: state.snapshot.session.id,
    joined_at: new Date().toISOString(),
  });
  emit(state, { type: "refetch" });
}

function addProposal(
  state: DemoSessionState,
  place_id: string,
  place_name: string,
  place_neighborhood: string,
  proposed_by: string | null,
): CrewProposal | null {
  // UNIQUE (session, place) — miroir de la contrainte 0038.
  if (state.snapshot.proposals.some((p) => p.place_id === place_id)) return null;
  const proposal: CrewProposal = {
    id: nextId("demo-prop"),
    session_id: state.snapshot.session.id,
    place_id,
    proposed_by,
    place_name,
    place_neighborhood,
    votes: 0,
    has_my_vote: false,
  };
  state.snapshot.proposals.push(proposal);
  emit(state, { type: "refetch" });
  scheduleBotVotes(state, proposal);
  return proposal;
}

function botVote(state: DemoSessionState, botId: string, proposalId: string): void {
  const voted = state.botVotes.get(botId) ?? new Set<string>();
  if (voted.has(proposalId)) return;
  const proposal = state.snapshot.proposals.find((p) => p.id === proposalId);
  if (!proposal) return;
  voted.add(proposalId);
  state.botVotes.set(botId, voted);
  proposal.votes += 1;
  emit(state, { type: "refetch" });
}

/** Awa vote tout ; Yao ne vote que la première proposition de la session. */
function scheduleBotVotes(state: DemoSessionState, proposal: CrewProposal): void {
  const isFirst = state.snapshot.proposals[0]?.id === proposal.id;
  schedule(state, DELAY_BOT_VOTE_MS, () => botVote(state, BOT_AWA.spawter_id, proposal.id));
  if (isFirst) {
    schedule(state, DELAY_BOT_VOTE_MS + 900, () =>
      botVote(state, BOT_YAO.spawter_id, proposal.id),
    );
  }
}

function markResolved(state: DemoSessionState, winning_place_id: string | null): void {
  clearTimers(state);
  state.snapshot.session.status = "resolved";
  state.snapshot.session.winning_place_id = winning_place_id;
  emit(state, { type: "resolved", winning_place_id });
}

function makeSession(self: CrewSelf, code: string, host_id: string): DemoSessionState {
  const now = new Date();
  const id = nextId("demo-crew");
  const state: DemoSessionState = {
    snapshot: {
      session: {
        id,
        code,
        host_id,
        status: "open",
        winning_place_id: null,
        expires_at: new Date(now.getTime() + DEMO_TTL_MS).toISOString(),
        created_at: now.toISOString(),
      },
      members: [],
      proposals: [],
    },
    botVotes: new Map(),
    myVotes: new Set(),
    selfId: self.id,
    timers: new Set(),
    listeners: new Set(),
  };
  sessions.set(id, state);
  return state;
}

// ─── API (miroir du data layer) ─────────────────────────────────────────────

/** Crée une session démo dont le spawter courant est l'hôte. Bots en approche. */
export function createDemoCrewSession(self: CrewSelf): CrewSessionRef {
  const state = makeSession(self, generateDemoCode(), self.id);
  state.snapshot.members.push({
    session_id: state.snapshot.session.id,
    spawter_id: self.id,
    display_name: self.display_name,
    avatar_url: self.avatar_url,
    joined_at: new Date().toISOString(),
  });

  // Le crew arrive… puis Yao propose un spot (la démo doit vivre même si le
  // spawter reste spectateur).
  schedule(state, DELAY_AWA_JOINS_MS, () => addMember(state, BOT_AWA));
  schedule(state, DELAY_YAO_JOINS_MS, () => addMember(state, BOT_YAO));
  const seed = SEED_PLACES[1] ?? SEED_PLACES[0];
  if (seed) {
    schedule(state, DELAY_BOT_PROPOSES_MS, () =>
      addProposal(
        state,
        seed.id,
        seed.name,
        seed.location.neighborhood,
        BOT_YAO.spawter_id,
      ),
    );
  }

  return {
    session_id: state.snapshot.session.id,
    code: state.snapshot.session.code,
    expires_at: state.snapshot.session.expires_at,
  };
}

/**
 * Rejoint une session par code. Démo : tout code bien formé (5 chars) ouvre
 * une session hébergée par le bot Awa — le spawter vit le flux MEMBRE complet
 * (propositions et votes qui tombent, résolution par l'hôte bot).
 */
export function joinDemoCrewSession(code: string, self: CrewSelf): CrewJoinResult {
  const cleaned = code.trim().toUpperCase();
  if (!/^[A-Z2-9]{5}$/.test(cleaned)) {
    return { ok: false, reason: "session_not_found" };
  }

  // Code d'une session démo existante (ex. deux devices en preview) → rejoint.
  for (const state of sessions.values()) {
    if (state.snapshot.session.code === cleaned) {
      if (state.snapshot.session.status !== "open") {
        return { ok: false, reason: "session_closed" };
      }
      addMember(state, { spawter_id: self.id, display_name: self.display_name, avatar_url: self.avatar_url });
      return {
        ok: true,
        ref: {
          session_id: state.snapshot.session.id,
          code: cleaned,
          expires_at: state.snapshot.session.expires_at,
        },
      };
    }
  }

  const state = makeSession(self, cleaned, BOT_AWA.spawter_id);
  state.snapshot.members.push({
    ...BOT_AWA,
    session_id: state.snapshot.session.id,
    joined_at: new Date().toISOString(),
  });
  state.snapshot.members.push({
    session_id: state.snapshot.session.id,
    spawter_id: self.id,
    display_name: self.display_name,
    avatar_url: self.avatar_url,
    joined_at: new Date().toISOString(),
  });

  schedule(state, DELAY_YAO_JOINS_MS, () => addMember(state, BOT_YAO));
  const seedA = SEED_PLACES[0];
  const seedB = SEED_PLACES[2] ?? SEED_PLACES[0];
  if (seedA) {
    schedule(state, DELAY_BOT_PROPOSES_MS, () =>
      addProposal(state, seedA.id, seedA.name, seedA.location.neighborhood, BOT_AWA.spawter_id),
    );
  }
  if (seedB) {
    schedule(state, DELAY_BOT_PROPOSES_MS + 3000, () =>
      addProposal(state, seedB.id, seedB.name, seedB.location.neighborhood, BOT_AWA.spawter_id),
    );
  }
  // Le bot hôte tranche : majorité simple, égalité → premier proposé (le
  // Palais de l'hôte bot n'existe pas — règle 3 de crew-resolution).
  schedule(state, DELAY_BOT_HOST_RESOLVES_MS, () => {
    const sorted = [...state.snapshot.proposals].sort((a, b) => b.votes - a.votes);
    markResolved(state, sorted[0]?.place_id ?? null);
  });

  return {
    ok: true,
    ref: {
      session_id: state.snapshot.session.id,
      code: cleaned,
      expires_at: state.snapshot.session.expires_at,
    },
  };
}

/** Snapshot copié (l'UI ne doit jamais muter l'état interne du moteur). */
export function fetchDemoCrewSnapshot(session_id: string): CrewSnapshot | null {
  const state = sessions.get(session_id);
  if (!state) return null;
  return {
    session: { ...state.snapshot.session },
    members: state.snapshot.members.map((m) => ({ ...m })),
    proposals: state.snapshot.proposals.map((p) => ({
      ...p,
      has_my_vote: state.myVotes.has(p.id),
    })),
  };
}

export function proposeDemoCrewPlace(
  session_id: string,
  place: { id: string; name: string; neighborhood: string },
  proposed_by: string,
): CrewMutationResult {
  const state = sessions.get(session_id);
  if (!state || state.snapshot.session.status === "resolved") return "error";
  const created = addProposal(state, place.id, place.name, place.neighborhood, proposed_by);
  return created ? "ok" : "duplicate";
}

export function voteDemoCrewProposal(
  session_id: string,
  proposal_id: string,
): CrewMutationResult {
  const state = sessions.get(session_id);
  if (!state || state.snapshot.session.status === "resolved") return "error";
  const proposal = state.snapshot.proposals.find((p) => p.id === proposal_id);
  if (!proposal) return "error";
  if (state.myVotes.has(proposal_id)) return "duplicate"; // rejoue la PK 0038
  state.myVotes.add(proposal_id);
  proposal.votes += 1;
  emit(state, { type: "refetch" });
  return "ok";
}

/** Résolution par l'hôte (le store calcule le gagnant via crew-resolution). */
export function resolveDemoCrewSession(
  session_id: string,
  winning_place_id: string | null,
): boolean {
  const state = sessions.get(session_id);
  if (!state) return false;
  markResolved(state, winning_place_id);
  return true;
}

/** Quitte + nettoie : timers coupés, session oubliée. */
export function leaveDemoCrewSession(session_id: string): void {
  const state = sessions.get(session_id);
  if (!state) return;
  clearTimers(state);
  state.listeners.clear();
  sessions.delete(session_id);
}

/**
 * Abonnement aux événements de la session (interface commune avec
 * crew-realtime — l'UI ne voit pas la différence démo/live).
 */
export function subscribeDemoCrewSession(
  session_id: string,
  listener: CrewEventListener,
): () => void {
  const state = sessions.get(session_id);
  if (!state) return () => {};
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}

/** La session existe-t-elle encore côté moteur ? (hydrate post-kill : non.) */
export function demoCrewSessionExists(session_id: string): boolean {
  return sessions.has(session_id);
}

/** Reset complet — réservé aux tests. */
export function __resetDemoCrewForTests(): void {
  for (const state of sessions.values()) {
    clearTimers(state);
    state.listeners.clear();
  }
  sessions.clear();
  idCounter = 0;
}
