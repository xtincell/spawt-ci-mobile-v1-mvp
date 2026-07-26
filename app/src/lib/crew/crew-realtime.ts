// Mode Crew — abonnement temps réel avec bascule POLLING automatique.
//
// Contrat (identique pour l'UI quel que soit le transport) :
//   subscribeCrewSession(sessionId, listener) → { getMode, broadcastResolved, close }
//   listener reçoit :
//     { type: "refetch" }  → quelque chose a bougé, refetch du snapshot
//     { type: "resolved" } → l'hôte a tranché (broadcast) — révélation
//
// Transports, par ordre de préférence :
//   1. DÉMO (pas de Supabase configuré) : émetteur du moteur crew-demo.
//   2. REALTIME : channel supabase-js `postgres_changes` — INSERT sur
//      crew_votes / crew_members / crew_proposals filtré `session_id=eq.<id>`
//      (publication 0038, la RLS s'applique au stream) + broadcast
//      `crew_resolved` (la résolution ne peut pas transiter par
//      postgres_changes : crew_sessions n'est pas dans la publication).
//   3. POLLING : si le channel n'est pas SUBSCRIBED sous 5 s (Realtime
//      self-hosted capricieux) ou décroche ensuite → tick { type: "refetch" }
//      toutes les 3 s. Bascule loggée (__DEV__) et SILENCIEUSE pour le
//      spawter — l'UI ne change pas, elle refetch juste un peu plus fort.
//
// Cleanup rigoureux : close() coupe timer de garde, interval de polling et
// channel — à appeler à l'unmount de l'écran ET au leaveSession.

import { isSupabaseConfigured } from "../data-source";
// Import statique du moteur démo (comme dans data-source.ts) : la branche
// démo doit marcher partout, y compris sous jest où `import()` runtime n'est
// pas disponible. Le client supabase, lui, reste importé dynamiquement.
import { subscribeDemoCrewSession } from "./crew-demo";
import type { CrewEventListener } from "./crew-types";

export const SUBSCRIBE_TIMEOUT_MS = 5000;
export const POLL_INTERVAL_MS = 3000;

/** Nom d'événement broadcast de la révélation (hôte → membres). */
export const CREW_RESOLVED_EVENT = "crew_resolved";

export type CrewTransportMode = "connecting" | "realtime" | "polling" | "demo" | "closed";

export interface CrewSubscription {
  /** Transport courant — exposé pour tests/debug, jamais montré au spawter. */
  getMode: () => CrewTransportMode;
  /**
   * Diffuse la révélation aux membres connectés (hôte uniquement). Retourne
   * false si le transport ne le permet pas (polling/démo — en démo la
   * résolution émet déjà son événement via le moteur local).
   */
  broadcastResolved: (winning_place_id: string | null) => Promise<boolean>;
  close: () => void;
}

// ─── Interfaces structurelles (injection de test + découplage supabase-js) ──
// On ne dépend que de la surface utilisée : channel().on().subscribe(),
// send(), removeChannel(). Le client réel (supabase-js ^2.45) s'y conforme
// structurellement — le cast est localisé dans defaultClient().

export interface CrewChannelLike {
  on: (
    type: string,
    filter: Record<string, unknown>,
    callback: (payload: Record<string, unknown>) => void,
  ) => CrewChannelLike;
  subscribe: (callback?: (status: string) => void) => CrewChannelLike;
  send: (args: {
    type: string;
    event: string;
    payload: Record<string, unknown>;
  }) => Promise<unknown>;
}

export interface CrewRealtimeClientLike {
  channel: (name: string, opts?: Record<string, unknown>) => CrewChannelLike;
  removeChannel: (channel: CrewChannelLike) => unknown;
}

async function defaultClient(): Promise<CrewRealtimeClientLike> {
  // Import dynamique — cohérent avec la règle d'or data-source : le client
  // supabase n'est chargé que si le mode live est actif.
  const { supabase } = await import("../supabase");
  return supabase as unknown as CrewRealtimeClientLike;
}

export interface SubscribeCrewOptions {
  /** Client injectable (tests). Fourni → transport remote forcé (pas démo). */
  client?: CrewRealtimeClientLike;
  subscribeTimeoutMs?: number;
  pollIntervalMs?: number;
}

/**
 * Abonne aux événements d'une session. Voir contrat en tête de fichier.
 */
export function subscribeCrewSession(
  sessionId: string,
  listener: CrewEventListener,
  opts?: SubscribeCrewOptions,
): CrewSubscription {
  // ─── Transport démo ───────────────────────────────────────────────────────
  if (!isSupabaseConfigured && !opts?.client) {
    let closed = false;
    let unsubscribe: (() => void) | null = subscribeDemoCrewSession(sessionId, listener);
    return {
      getMode: () => (closed ? "closed" : "demo"),
      broadcastResolved: () => Promise.resolve(false),
      close: () => {
        closed = true;
        unsubscribe?.();
        unsubscribe = null;
      },
    };
  }

  // ─── Transport remote (realtime → fallback polling) ───────────────────────
  const subscribeTimeoutMs = opts?.subscribeTimeoutMs ?? SUBSCRIBE_TIMEOUT_MS;
  const pollIntervalMs = opts?.pollIntervalMs ?? POLL_INTERVAL_MS;

  let mode: CrewTransportMode = "connecting";
  let closed = false;
  let client: CrewRealtimeClientLike | null = null;
  let channel: CrewChannelLike | null = null;
  let guardTimer: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const clearGuard = () => {
    if (guardTimer !== null) {
      clearTimeout(guardTimer);
      guardTimer = null;
    }
  };

  const dropChannel = () => {
    if (channel && client) {
      try {
        client.removeChannel(channel);
      } catch (err) {
        if (__DEV__) console.warn("[crew-realtime] removeChannel failed", err);
      }
    }
    channel = null;
  };

  const startPolling = (reason: string) => {
    if (closed || mode === "polling") return;
    clearGuard();
    dropChannel();
    mode = "polling";
    if (__DEV__) {
      console.info(`[crew-realtime] bascule POLLING (${reason}) — refetch/${pollIntervalMs}ms`);
    }
    pollTimer = setInterval(() => {
      listener({ type: "refetch" });
    }, pollIntervalMs);
  };

  const attach = (c: CrewRealtimeClientLike) => {
    if (closed) return;
    client = c;

    const insertOn = (table: string) => ({
      event: "INSERT",
      schema: "public",
      table,
      filter: `session_id=eq.${sessionId}`,
    });

    channel = c
      .channel(`crew:${sessionId}`)
      .on("postgres_changes", insertOn("crew_votes"), () => listener({ type: "refetch" }))
      .on("postgres_changes", insertOn("crew_members"), () => listener({ type: "refetch" }))
      .on("postgres_changes", insertOn("crew_proposals"), () => listener({ type: "refetch" }))
      .on("broadcast", { event: CREW_RESOLVED_EVENT }, (payload) => {
        const inner = payload.payload as { winning_place_id?: string | null } | undefined;
        listener({ type: "resolved", winning_place_id: inner?.winning_place_id ?? null });
      });

    // Garde 5 s : Realtime self-hosted peut ne jamais répondre — on n'attend pas.
    guardTimer = setTimeout(() => {
      guardTimer = null;
      if (mode === "connecting") startPolling("timeout SUBSCRIBED > 5s");
    }, subscribeTimeoutMs);

    channel.subscribe((status) => {
      if (closed) return;
      if (status === "SUBSCRIBED") {
        clearGuard();
        if (mode !== "polling") mode = "realtime";
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        // Décrochage post-connexion inclus : on repasse en polling, silencieux.
        startPolling(`status ${status}`);
      }
    });
  };

  if (opts?.client) {
    attach(opts.client);
  } else {
    void defaultClient().then(attach);
  }

  return {
    getMode: () => (closed ? "closed" : mode),
    broadcastResolved: async (winning_place_id) => {
      if (closed || mode !== "realtime" || !channel) return false;
      try {
        await channel.send({
          type: "broadcast",
          event: CREW_RESOLVED_EVENT,
          payload: { winning_place_id },
        });
        return true;
      } catch (err) {
        if (__DEV__) console.warn("[crew-realtime] broadcast failed", err);
        return false;
      }
    },
    close: () => {
      if (closed) return;
      closed = true;
      mode = "closed";
      clearGuard();
      if (pollTimer !== null) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      dropChannel();
    },
  };
}
