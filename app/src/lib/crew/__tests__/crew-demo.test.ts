// Mode Crew — tests du moteur démo (crew-demo.ts) aux fake timers.
// La démo doit faire vivre la feature : bots qui rejoignent, proposent,
// votent, et résolution — le tout sans backend.

import {
  createDemoCrewSession,
  joinDemoCrewSession,
  fetchDemoCrewSnapshot,
  proposeDemoCrewPlace,
  voteDemoCrewProposal,
  resolveDemoCrewSession,
  leaveDemoCrewSession,
  subscribeDemoCrewSession,
  demoCrewSessionExists,
  __resetDemoCrewForTests,
  DEMO_TTL_MS,
} from "../crew-demo";
import type { CrewSelf } from "../crew-types";

const SELF: CrewSelf = { id: "spawter-1", display_name: "Alex", avatar_url: null };

beforeEach(() => {
  jest.useFakeTimers();
  __resetDemoCrewForTests();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("crew-demo — flux HÔTE (créer une session)", () => {
  it("crée une session avec code 5 chars (alphabet sans ambigus) et TTL 30 min", () => {
    const before = Date.now();
    const ref = createDemoCrewSession(SELF);
    expect(ref.code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
    const expires = Date.parse(ref.expires_at);
    expect(expires).toBeGreaterThanOrEqual(before + DEMO_TTL_MS - 1000);
    expect(expires).toBeLessThanOrEqual(before + DEMO_TTL_MS + 1000);

    const snap = fetchDemoCrewSnapshot(ref.session_id);
    expect(snap?.session.status).toBe("open");
    expect(snap?.session.host_id).toBe(SELF.id);
    expect(snap?.members.map((m) => m.spawter_id)).toEqual([SELF.id]);
  });

  it("les 2 bots rejoignent après un délai, puis un bot propose un spot", () => {
    const ref = createDemoCrewSession(SELF);

    jest.advanceTimersByTime(4000);
    let snap = fetchDemoCrewSnapshot(ref.session_id);
    expect(snap?.members).toHaveLength(3); // Alex + Awa + Yao

    jest.advanceTimersByTime(2000);
    snap = fetchDemoCrewSnapshot(ref.session_id);
    expect(snap?.proposals.length).toBeGreaterThanOrEqual(1);
  });

  it("les bots votent la proposition du spawter après un délai (Awa partout, Yao la 1re)", () => {
    const ref = createDemoCrewSession(SELF);
    const p1 = proposeDemoCrewPlace(
      ref.session_id,
      { id: "pl-a", name: "Maquis A", neighborhood: "Cocody" },
      SELF.id,
    );
    expect(p1).toBe("ok");

    // Votes bots : Awa à +2s, Yao (1re proposition) à +2.9s.
    jest.advanceTimersByTime(3000);
    const snap = fetchDemoCrewSnapshot(ref.session_id);
    const prop = snap?.proposals.find((p) => p.place_id === "pl-a");
    expect(prop?.votes).toBe(2);
  });

  it("propose en double → duplicate (UNIQUE session+place rejouée)", () => {
    const ref = createDemoCrewSession(SELF);
    const place = { id: "pl-a", name: "Maquis A", neighborhood: "Cocody" };
    expect(proposeDemoCrewPlace(ref.session_id, place, SELF.id)).toBe("ok");
    expect(proposeDemoCrewPlace(ref.session_id, place, SELF.id)).toBe("duplicate");
  });

  it("double vote du spawter → duplicate (PK proposal+spawter rejouée)", () => {
    const ref = createDemoCrewSession(SELF);
    proposeDemoCrewPlace(
      ref.session_id,
      { id: "pl-a", name: "Maquis A", neighborhood: "Cocody" },
      SELF.id,
    );
    const snap = fetchDemoCrewSnapshot(ref.session_id);
    const proposalId = snap?.proposals[0]?.id ?? "";
    expect(voteDemoCrewProposal(ref.session_id, proposalId)).toBe("ok");
    expect(voteDemoCrewProposal(ref.session_id, proposalId)).toBe("duplicate");

    const after = fetchDemoCrewSnapshot(ref.session_id);
    expect(after?.proposals[0]?.votes).toBe(1);
    expect(after?.proposals[0]?.has_my_vote).toBe(true);
  });

  it("résolution hôte : status resolved + winning_place_id + événement resolved", () => {
    const ref = createDemoCrewSession(SELF);
    proposeDemoCrewPlace(
      ref.session_id,
      { id: "pl-a", name: "Maquis A", neighborhood: "Cocody" },
      SELF.id,
    );
    const events: string[] = [];
    subscribeDemoCrewSession(ref.session_id, (evt) => events.push(evt.type));

    expect(resolveDemoCrewSession(ref.session_id, "pl-a")).toBe(true);
    const snap = fetchDemoCrewSnapshot(ref.session_id);
    expect(snap?.session.status).toBe("resolved");
    expect(snap?.session.winning_place_id).toBe("pl-a");
    expect(events).toContain("resolved");

    // Les bots ne bougent plus après résolution (timers coupés).
    jest.advanceTimersByTime(60_000);
    const frozen = fetchDemoCrewSnapshot(ref.session_id);
    expect(frozen?.members).toHaveLength(1);
  });
});

describe("crew-demo — flux MEMBRE (rejoindre par code)", () => {
  it("un code mal formé est rejeté (session_not_found)", () => {
    const result = joinDemoCrewSession("AB", SELF);
    expect(result).toEqual({ ok: false, reason: "session_not_found" });
  });

  it("un code bien formé ouvre une session hébergée par le bot Awa", () => {
    const result = joinDemoCrewSession("ghjkm", SELF);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ref.code).toBe("GHJKM"); // normalisé upper
    const snap = fetchDemoCrewSnapshot(result.ref.session_id);
    expect(snap?.session.host_id).toBe("demo-bot-awa");
    expect(snap?.members.map((m) => m.spawter_id)).toContain(SELF.id);
  });

  it("le bot hôte propose, les bots votent, puis il tranche tout seul", () => {
    const result = joinDemoCrewSession("GHJKM", SELF);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const events: Array<{ type: string; winner?: string | null }> = [];
    subscribeDemoCrewSession(result.ref.session_id, (evt) =>
      events.push(
        evt.type === "resolved"
          ? { type: evt.type, winner: evt.winning_place_id }
          : { type: evt.type },
      ),
    );

    // Propositions bots à +4.5s et +7.5s, votes dans la foulée.
    jest.advanceTimersByTime(10_000);
    let snap = fetchDemoCrewSnapshot(result.ref.session_id);
    expect(snap?.proposals.length).toBe(2);
    expect(snap?.proposals.some((p) => p.votes > 0)).toBe(true);

    // Résolution automatique du bot hôte à +25s.
    jest.advanceTimersByTime(20_000);
    snap = fetchDemoCrewSnapshot(result.ref.session_id);
    expect(snap?.session.status).toBe("resolved");
    expect(snap?.session.winning_place_id).not.toBeNull();
    expect(events.some((e) => e.type === "resolved")).toBe(true);
  });

  it("rejoindre le code d'une session démo existante rejoint CETTE session", () => {
    const ref = createDemoCrewSession(SELF);
    const other: CrewSelf = { id: "spawter-2", display_name: "Bintou", avatar_url: null };
    const result = joinDemoCrewSession(ref.code, other);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ref.session_id).toBe(ref.session_id);
    const snap = fetchDemoCrewSnapshot(ref.session_id);
    expect(snap?.members.map((m) => m.spawter_id)).toContain("spawter-2");
  });
});

describe("crew-demo — cycle de vie", () => {
  it("leave nettoie la session, ses timers et ses listeners", () => {
    const ref = createDemoCrewSession(SELF);
    const events: string[] = [];
    subscribeDemoCrewSession(ref.session_id, (evt) => events.push(evt.type));

    leaveDemoCrewSession(ref.session_id);
    expect(demoCrewSessionExists(ref.session_id)).toBe(false);
    expect(fetchDemoCrewSnapshot(ref.session_id)).toBeNull();

    // Les timers bots sont coupés : plus aucun événement après le leave.
    jest.advanceTimersByTime(60_000);
    expect(events).toHaveLength(0);
  });

  it("unsubscribe retire le listener sans toucher la session", () => {
    const ref = createDemoCrewSession(SELF);
    const events: string[] = [];
    const unsub = subscribeDemoCrewSession(ref.session_id, (evt) => events.push(evt.type));
    unsub();
    jest.advanceTimersByTime(10_000);
    expect(events).toHaveLength(0);
    expect(demoCrewSessionExists(ref.session_id)).toBe(true);
  });
});
