// Mode Crew — store de la session courante (pattern micro-store guet-active :
// état transient séparé de spawter-store, + persistance LÉGÈRE : la référence
// {session_id, code, expires_at} survit à un kill de l'app pour re-rejoindre
// une session non expirée. Le snapshot lui-même n'est jamais persisté — la
// source de vérité est le serveur (ou le moteur démo).
//
// Le handle temps réel vit en module-scope (pas dans le state zustand — un
// objet à effets de bord n'a rien à faire dans un state sérialisable).
// attach() à l'ouverture de l'écran de session, detach() à l'unmount/leave.

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createSession,
  joinSession,
  fetchSnapshot,
  proposePlace,
  vote,
  leaveSession,
  resolveSession,
} from "../lib/crew/crew-session";
import {
  subscribeCrewSession,
  type CrewSubscription,
  type CrewTransportMode,
} from "../lib/crew/crew-realtime";
import {
  resolveCrewWinner,
  type CrewResolution,
  type HostTiebreak,
} from "../lib/crew/crew-resolution";
import { getPlace } from "../lib/data-source";
import { DEMO_LAT, DEMO_LNG } from "../lib/demo-constants";
import { useSpawterStore } from "./spawter-store";
import type { PlaceWithSignals } from "../lib/matching";
import type {
  CrewJoinResult,
  CrewMember,
  CrewMutationResult,
  CrewProposal,
  CrewSelf,
  CrewSession,
  CrewSessionRef,
} from "../lib/crew/crew-types";

export const CREW_SESSION_STORAGE_KEY = "spawt:crew:last-session";

/** Gagnant révélé — construit par trancher() (hôte) ou reçu par broadcast. */
export interface CrewWinner {
  place_id: string;
  place_name: string;
  place_neighborhood: string;
  votes: number;
  decided_by: CrewResolution["decided_by"] | "remote";
}

interface CrewStoreState {
  self: CrewSelf | null;
  session: CrewSession | null;
  members: CrewMember[];
  proposals: CrewProposal[];
  winner: CrewWinner | null;
  /** Dernier refresh en échec (réseau) — bandeau offline + retry côté UI. */
  offline: boolean;
  busy: boolean;
  /** Référence persistée (CrewBlock : « Reprendre la session »). */
  persistedRef: CrewSessionRef | null;

  isHost: () => boolean;
  transportMode: () => CrewTransportMode | "idle";

  hydrateFromStorage: () => Promise<CrewSessionRef | null>;
  start: (self: CrewSelf) => Promise<CrewSessionRef | null>;
  join: (code: string, self: CrewSelf) => Promise<CrewJoinResult>;
  /** Ouvre/adopte une session (deep link ou reprise) — pose self + refresh. */
  open: (session_id: string, self: CrewSelf) => Promise<boolean>;
  attach: (session_id: string) => void;
  detach: () => void;
  refresh: () => Promise<void>;
  propose: (place: { id: string; name: string; neighborhood: string }) => Promise<CrewMutationResult>;
  castVote: (proposal_id: string) => Promise<CrewMutationResult>;
  /** Clôture par l'hôte (« On tranche ») ou forcée par l'expiration TTL. */
  trancher: (opts?: { hostTiebreak?: HostTiebreak | null }) => Promise<CrewWinner | null>;
  markExpired: () => Promise<void>;
  leave: () => Promise<void>;
}

// Handle temps réel courant — un seul abonnement actif à la fois.
let subscription: CrewSubscription | null = null;
let subscribedSessionId: string | null = null;

async function persistRef(ref: CrewSessionRef | null): Promise<void> {
  try {
    if (ref) await AsyncStorage.setItem(CREW_SESSION_STORAGE_KEY, JSON.stringify(ref));
    else await AsyncStorage.removeItem(CREW_SESSION_STORAGE_KEY);
  } catch (err) {
    if (__DEV__) console.warn("[crew-store] persistRef failed", err);
  }
}

function isExpiredRef(ref: CrewSessionRef): boolean {
  const t = Date.parse(ref.expires_at);
  return Number.isFinite(t) && t <= Date.now();
}

/**
 * Construit le départage Palais de l'HÔTE depuis spawter-store (import
 * statique — l'écran de session charge de toute façon spawter-store pour
 * l'identité ; pas de cycle, spawter-store ignore crew-store). Position :
 * fallback démo Cocody Riviera — cohérent avec le feed sans GPS.
 */
async function buildHostTiebreak(
  proposals: readonly CrewProposal[],
): Promise<HostTiebreak | null> {
  try {
    const s = useSpawterStore.getState();
    if (!s.palais) return null;
    const candidates = new Map<string, PlaceWithSignals>();
    for (const p of proposals) {
      const place = await getPlace(p.place_id);
      if (place) {
        candidates.set(p.place_id, { place, adn: place.adn, last_spawt_at: null });
      }
    }
    return {
      ctx: {
        spawter_palais: s.palais,
        spawter_lat: DEMO_LAT,
        spawter_lng: DEMO_LNG,
        visited_place_ids: new Set(s.spawts.map((sp) => sp.place_id)),
        saved_place_ids: s.savedPlaceIds,
        now: new Date(),
      },
      candidates,
    };
  } catch (err) {
    if (__DEV__) console.warn("[crew-store] buildHostTiebreak failed", err);
    return null;
  }
}

export const useCrewStore = create<CrewStoreState>((set, get) => ({
  self: null,
  session: null,
  members: [],
  proposals: [],
  winner: null,
  offline: false,
  busy: false,
  persistedRef: null,

  isHost: () => {
    const { session, self } = get();
    return Boolean(session && self && session.host_id === self.id);
  },

  transportMode: () => subscription?.getMode() ?? "idle",

  hydrateFromStorage: async () => {
    try {
      const raw = await AsyncStorage.getItem(CREW_SESSION_STORAGE_KEY);
      if (!raw) return null;
      const ref = JSON.parse(raw) as CrewSessionRef;
      if (!ref?.session_id || !ref?.expires_at || isExpiredRef(ref)) {
        await persistRef(null);
        set({ persistedRef: null });
        return null;
      }
      set({ persistedRef: ref });
      return ref;
    } catch {
      return null;
    }
  },

  start: async (self) => {
    set({ busy: true, offline: false });
    try {
      const ref = await createSession(self);
      if (!ref) {
        set({ busy: false, offline: true });
        return null;
      }
      set({ self, winner: null, persistedRef: ref, busy: false });
      await persistRef(ref);
      await get().refresh();
      return ref;
    } catch (err) {
      if (__DEV__) console.warn("[crew-store] start failed", err);
      set({ busy: false, offline: true });
      return null;
    }
  },

  join: async (code, self) => {
    set({ busy: true, offline: false });
    try {
      const result = await joinSession(code, self);
      if (result.ok) {
        set({ self, winner: null, persistedRef: result.ref, busy: false });
        await persistRef(result.ref);
        await get().refresh();
      } else {
        set({ busy: false });
      }
      return result;
    } catch (err) {
      if (__DEV__) console.warn("[crew-store] join failed", err);
      set({ busy: false, offline: true });
      return { ok: false, reason: "error" };
    }
  },

  open: async (session_id, self) => {
    const current = get();
    if (current.session?.id !== session_id) {
      // Adoption (deep link / reprise post-kill) : repartir d'un état neuf.
      set({ self, session: null, members: [], proposals: [], winner: null, offline: false });
    } else {
      set({ self });
    }
    await get().refresh();
    const sess = get().session;
    if (!sess) return false;
    return sess.id === session_id;
  },

  attach: (session_id) => {
    if (subscription && subscribedSessionId === session_id) return;
    get().detach();
    subscribedSessionId = session_id;
    subscription = subscribeCrewSession(session_id, (evt) => {
      if (evt.type === "refetch") {
        void get().refresh();
        return;
      }
      // Révélation reçue (broadcast hôte ou moteur démo).
      const { proposals, session } = get();
      const prop = proposals.find((p) => p.place_id === evt.winning_place_id);
      set({
        session: session
          ? { ...session, status: "resolved", winning_place_id: evt.winning_place_id }
          : session,
        winner: {
          place_id: evt.winning_place_id ?? "",
          place_name: prop?.place_name ?? "",
          place_neighborhood: prop?.place_neighborhood ?? "",
          votes: prop?.votes ?? 0,
          decided_by: "remote",
        },
      });
    });
  },

  detach: () => {
    subscription?.close();
    subscription = null;
    subscribedSessionId = null;
  },

  refresh: async () => {
    const { self } = get();
    const sessionId = subscribedSessionId ?? get().session?.id ?? get().persistedRef?.session_id;
    if (!self || !sessionId) return;
    try {
      const snapshot = await fetchSnapshot(sessionId, self.id);
      if (!snapshot) {
        // Session inconnue (kill en mode démo, RLS post-leave…) — l'écran
        // affichera l'état expiré ; on nettoie la référence persistée.
        set({ session: null, members: [], proposals: [], offline: false });
        await persistRef(null);
        set({ persistedRef: null });
        return;
      }
      const expired =
        snapshot.session.status === "expired" ||
        Date.parse(snapshot.session.expires_at) <= Date.now();
      set({
        session: expired && snapshot.session.status === "open"
          ? { ...snapshot.session, status: "expired" }
          : snapshot.session,
        members: snapshot.members,
        proposals: snapshot.proposals,
        offline: false,
      });
      // Résolution vue via le snapshot (UPDATE DB qui a pris / autre device).
      const st = get();
      if (st.session?.status === "resolved" && !st.winner) {
        const prop = st.proposals.find((p) => p.place_id === st.session?.winning_place_id);
        if (prop) {
          set({
            winner: {
              place_id: prop.place_id,
              place_name: prop.place_name,
              place_neighborhood: prop.place_neighborhood,
              votes: prop.votes,
              decided_by: "remote",
            },
          });
        }
      }
      if (expired) await persistRef(null);
    } catch (err) {
      if (__DEV__) console.warn("[crew-store] refresh failed", err);
      set({ offline: true });
    }
  },

  propose: async (place) => {
    const { self, session } = get();
    if (!self || !session) return "error";
    const result = await proposePlace(session.id, place, self.id);
    if (result === "ok") await get().refresh();
    return result;
  },

  castVote: async (proposal_id) => {
    const { self, session, proposals } = get();
    if (!self || !session) return "error";
    const prop = proposals.find((p) => p.id === proposal_id);
    if (!prop) return "error";
    const result = await vote(session.id, proposal_id, prop.place_id, self.id);
    if (result === "ok") await get().refresh();
    return result;
  },

  trancher: async (opts) => {
    const { session, proposals } = get();
    if (!session || proposals.length === 0) return null;
    set({ busy: true });
    try {
      // Départage : explicite (tests) > Palais de l'hôte (spawter-store).
      const tiebreak =
        opts?.hostTiebreak !== undefined
          ? opts.hostTiebreak
          : await buildHostTiebreak(proposals);
      const resolution = resolveCrewWinner(
        proposals.map((p) => ({ proposal_id: p.id, place_id: p.place_id, votes: p.votes })),
        tiebreak,
      );
      if (!resolution) {
        set({ busy: false });
        return null;
      }
      const prop = proposals.find((p) => p.id === resolution.proposal_id);
      const winner: CrewWinner = {
        place_id: resolution.place_id,
        place_name: prop?.place_name ?? "",
        place_neighborhood: prop?.place_neighborhood ?? "",
        votes: resolution.votes,
        decided_by: resolution.decided_by,
      };
      // Persistance best-effort + broadcast aux membres connectés.
      await resolveSession(session.id, resolution.place_id, resolution.decided_by);
      await subscription?.broadcastResolved(resolution.place_id);
      set({
        session: { ...session, status: "resolved", winning_place_id: resolution.place_id },
        winner,
        busy: false,
      });
      return winner;
    } catch (err) {
      if (__DEV__) console.warn("[crew-store] trancher failed", err);
      set({ busy: false, offline: true });
      return null;
    }
  },

  markExpired: async () => {
    const { session } = get();
    if (session && session.status === "open") {
      set({ session: { ...session, status: "expired" } });
    }
    set({ persistedRef: null });
    await persistRef(null);
  },

  leave: async () => {
    const { self, session } = get();
    get().detach();
    if (self && session) {
      try {
        await leaveSession(session.id, self.id);
      } catch (err) {
        if (__DEV__) console.warn("[crew-store] leave failed", err);
      }
    }
    set({
      session: null,
      members: [],
      proposals: [],
      winner: null,
      offline: false,
      busy: false,
      persistedRef: null,
    });
    await persistRef(null);
  },
}));
