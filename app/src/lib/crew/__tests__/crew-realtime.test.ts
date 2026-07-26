// Mode Crew — tests du transport temps réel (crew-realtime.ts).
// Le point critique : un Realtime self-hosted capricieux (channel jamais
// SUBSCRIBED) doit basculer AUTOMATIQUEMENT en polling — même interface pour
// l'UI, bascule silencieuse.

import {
  subscribeCrewSession,
  CREW_RESOLVED_EVENT,
  POLL_INTERVAL_MS,
  SUBSCRIBE_TIMEOUT_MS,
  type CrewChannelLike,
  type CrewRealtimeClientLike,
} from "../crew-realtime";
import type { CrewEvent } from "../crew-types";

interface Handler {
  type: string;
  filter: Record<string, unknown>;
  cb: (payload: Record<string, unknown>) => void;
}

class FakeChannel implements CrewChannelLike {
  handlers: Handler[] = [];
  statusCb: ((status: string) => void) | null = null;
  send = jest.fn(() => Promise.resolve("ok"));

  on(type: string, filter: Record<string, unknown>, cb: Handler["cb"]): CrewChannelLike {
    this.handlers.push({ type, filter, cb });
    return this;
  }

  subscribe(cb?: (status: string) => void): CrewChannelLike {
    this.statusCb = cb ?? null;
    return this;
  }

  /** Simule un INSERT postgres_changes sur `table`. */
  firePostgres(table: string): void {
    for (const h of this.handlers) {
      if (h.type === "postgres_changes" && h.filter.table === table) h.cb({});
    }
  }

  /** Simule la réception du broadcast de révélation. */
  fireResolved(winning_place_id: string | null): void {
    for (const h of this.handlers) {
      if (h.type === "broadcast" && h.filter.event === CREW_RESOLVED_EVENT) {
        h.cb({ payload: { winning_place_id } });
      }
    }
  }
}

function makeClient(): { client: CrewRealtimeClientLike; channel: FakeChannel; removed: jest.Mock } {
  const channel = new FakeChannel();
  const removed = jest.fn();
  const client: CrewRealtimeClientLike = {
    channel: () => channel,
    removeChannel: removed,
  };
  return { client, channel, removed };
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("crew-realtime — mode realtime nominal", () => {
  it("SUBSCRIBED → mode realtime, les INSERT des 3 tables émettent refetch", () => {
    const { client, channel } = makeClient();
    const events: CrewEvent[] = [];
    const sub = subscribeCrewSession("sess-1", (e) => events.push(e), { client });

    channel.statusCb?.("SUBSCRIBED");
    expect(sub.getMode()).toBe("realtime");

    channel.firePostgres("crew_votes");
    channel.firePostgres("crew_members");
    channel.firePostgres("crew_proposals");
    expect(events).toEqual([
      { type: "refetch" },
      { type: "refetch" },
      { type: "refetch" },
    ]);

    // Filtre session_id posé sur chacun des 3 handlers postgres_changes.
    const pgFilters = channel.handlers
      .filter((h) => h.type === "postgres_changes")
      .map((h) => h.filter.filter);
    expect(pgFilters).toEqual([
      "session_id=eq.sess-1",
      "session_id=eq.sess-1",
      "session_id=eq.sess-1",
    ]);
    sub.close();
  });

  it("le broadcast crew_resolved émet l'événement resolved avec le gagnant", () => {
    const { client, channel } = makeClient();
    const events: CrewEvent[] = [];
    const sub = subscribeCrewSession("sess-1", (e) => events.push(e), { client });
    channel.statusCb?.("SUBSCRIBED");

    channel.fireResolved("place-9");
    expect(events).toEqual([{ type: "resolved", winning_place_id: "place-9" }]);
    sub.close();
  });

  it("broadcastResolved envoie sur le channel en mode realtime", async () => {
    const { client, channel } = makeClient();
    const sub = subscribeCrewSession("sess-1", () => {}, { client });
    channel.statusCb?.("SUBSCRIBED");

    const sent = await sub.broadcastResolved("place-9");
    expect(sent).toBe(true);
    expect(channel.send).toHaveBeenCalledWith({
      type: "broadcast",
      event: CREW_RESOLVED_EVENT,
      payload: { winning_place_id: "place-9" },
    });
    sub.close();
  });
});

describe("crew-realtime — bascule POLLING automatique", () => {
  it("channel jamais SUBSCRIBED → polling après 5 s, refetch toutes les 3 s", () => {
    const { client, removed } = makeClient();
    const events: CrewEvent[] = [];
    const sub = subscribeCrewSession("sess-1", (e) => events.push(e), { client });

    expect(sub.getMode()).toBe("connecting");
    jest.advanceTimersByTime(SUBSCRIBE_TIMEOUT_MS);

    expect(sub.getMode()).toBe("polling");
    expect(removed).toHaveBeenCalledTimes(1); // channel jeté proprement

    jest.advanceTimersByTime(POLL_INTERVAL_MS * 3);
    expect(events).toEqual([
      { type: "refetch" },
      { type: "refetch" },
      { type: "refetch" },
    ]);
    sub.close();
  });

  it("SUBSCRIBED à temps → pas de bascule, la garde 5 s ne tire pas", () => {
    const { client, channel } = makeClient();
    const events: CrewEvent[] = [];
    const sub = subscribeCrewSession("sess-1", (e) => events.push(e), { client });

    channel.statusCb?.("SUBSCRIBED");
    jest.advanceTimersByTime(SUBSCRIBE_TIMEOUT_MS + POLL_INTERVAL_MS * 2);
    expect(sub.getMode()).toBe("realtime");
    expect(events).toHaveLength(0); // aucun tick de polling
    sub.close();
  });

  it("décrochage post-connexion (CHANNEL_ERROR) → repasse en polling", () => {
    const { client, channel } = makeClient();
    const events: CrewEvent[] = [];
    const sub = subscribeCrewSession("sess-1", (e) => events.push(e), { client });

    channel.statusCb?.("SUBSCRIBED");
    expect(sub.getMode()).toBe("realtime");

    channel.statusCb?.("CHANNEL_ERROR");
    expect(sub.getMode()).toBe("polling");
    jest.advanceTimersByTime(POLL_INTERVAL_MS);
    expect(events).toEqual([{ type: "refetch" }]);
    sub.close();
  });

  it("broadcastResolved en polling → false (transport indisponible)", async () => {
    const { client } = makeClient();
    const sub = subscribeCrewSession("sess-1", () => {}, { client });
    jest.advanceTimersByTime(SUBSCRIBE_TIMEOUT_MS);
    expect(sub.getMode()).toBe("polling");
    await expect(sub.broadcastResolved("place-9")).resolves.toBe(false);
    sub.close();
  });
});

describe("crew-realtime — cleanup rigoureux", () => {
  it("close() coupe le polling et jette le channel — plus aucun événement", () => {
    const { client, removed } = makeClient();
    const events: CrewEvent[] = [];
    const sub = subscribeCrewSession("sess-1", (e) => events.push(e), { client });

    jest.advanceTimersByTime(SUBSCRIBE_TIMEOUT_MS + POLL_INTERVAL_MS);
    expect(events).toHaveLength(1);

    sub.close();
    expect(sub.getMode()).toBe("closed");
    jest.advanceTimersByTime(POLL_INTERVAL_MS * 5);
    expect(events).toHaveLength(1);
    expect(removed).toHaveBeenCalled();
  });

  it("close() avant la garde 5 s annule la garde (pas de polling fantôme)", () => {
    const { client } = makeClient();
    const events: CrewEvent[] = [];
    const sub = subscribeCrewSession("sess-1", (e) => events.push(e), { client });

    sub.close();
    jest.advanceTimersByTime(SUBSCRIBE_TIMEOUT_MS + POLL_INTERVAL_MS * 3);
    expect(events).toHaveLength(0);
  });

  it("un statut SUBSCRIBED arrivant après close() est ignoré", () => {
    const { client, channel } = makeClient();
    const sub = subscribeCrewSession("sess-1", () => {}, { client });
    sub.close();
    channel.statusCb?.("SUBSCRIBED");
    expect(sub.getMode()).toBe("closed");
  });
});
