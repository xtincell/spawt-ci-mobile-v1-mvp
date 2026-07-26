// Mode Crew — tests du store de session (crew-store.ts) en mode démo.
// Couvre les transitions : start → propose/vote → trancher → leave, la
// persistance légère (re-rejoindre après kill) et la réception des
// événements temps réel (moteur démo).

import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// track() bufferise avec timers + AppState — hors sujet ici, on le neutralise.
jest.mock("../../lib/analytics", () => ({ track: jest.fn() }));

import { useCrewStore, CREW_SESSION_STORAGE_KEY } from "../crew-store";
import { __resetDemoCrewForTests } from "../../lib/crew/crew-demo";
import type { CrewSelf } from "../../lib/crew/crew-types";

const SELF: CrewSelf = { id: "spawter-1", display_name: "Alex", avatar_url: null };

async function flushMicrotasks(times = 6): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve();
}

beforeEach(async () => {
  jest.useFakeTimers();
  __resetDemoCrewForTests();
  useCrewStore.getState().detach();
  useCrewStore.setState({
    self: null,
    session: null,
    members: [],
    proposals: [],
    winner: null,
    offline: false,
    busy: false,
    persistedRef: null,
  });
  await AsyncStorage.clear();
});

afterEach(() => {
  useCrewStore.getState().detach();
  jest.useRealTimers();
});

describe("crew-store — création et persistance", () => {
  it("start() crée la session démo, hydrate le snapshot et persiste la référence", async () => {
    const ref = await useCrewStore.getState().start(SELF);
    expect(ref).not.toBeNull();

    const s = useCrewStore.getState();
    expect(s.session?.id).toBe(ref?.session_id);
    expect(s.session?.status).toBe("open");
    expect(s.members.map((m) => m.spawter_id)).toEqual([SELF.id]);
    expect(s.isHost()).toBe(true);
    expect(s.persistedRef?.code).toBe(ref?.code);

    const raw = await AsyncStorage.getItem(CREW_SESSION_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw ?? "{}").session_id).toBe(ref?.session_id);
  });

  it("hydrateFromStorage() recharge une référence non expirée", async () => {
    const ref = {
      session_id: "demo-crew-x",
      code: "ABCDE",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    };
    await AsyncStorage.setItem(CREW_SESSION_STORAGE_KEY, JSON.stringify(ref));
    const loaded = await useCrewStore.getState().hydrateFromStorage();
    expect(loaded?.code).toBe("ABCDE");
    expect(useCrewStore.getState().persistedRef?.session_id).toBe("demo-crew-x");
  });

  it("hydrateFromStorage() purge une référence expirée", async () => {
    const ref = {
      session_id: "demo-crew-x",
      code: "ABCDE",
      expires_at: new Date(Date.now() - 1000).toISOString(),
    };
    await AsyncStorage.setItem(CREW_SESSION_STORAGE_KEY, JSON.stringify(ref));
    const loaded = await useCrewStore.getState().hydrateFromStorage();
    expect(loaded).toBeNull();
    expect(useCrewStore.getState().persistedRef).toBeNull();
    expect(await AsyncStorage.getItem(CREW_SESSION_STORAGE_KEY)).toBeNull();
  });
});

describe("crew-store — propositions et votes", () => {
  it("propose() ajoute la proposition ; en double → duplicate", async () => {
    await useCrewStore.getState().start(SELF);
    const place = { id: "pl-a", name: "Maquis A", neighborhood: "Cocody" };

    expect(await useCrewStore.getState().propose(place)).toBe("ok");
    expect(useCrewStore.getState().proposals.map((p) => p.place_id)).toEqual(["pl-a"]);
    expect(await useCrewStore.getState().propose(place)).toBe("duplicate");
  });

  it("castVote() incrémente ; revoter la même proposition → duplicate", async () => {
    await useCrewStore.getState().start(SELF);
    await useCrewStore.getState().propose({ id: "pl-a", name: "A", neighborhood: "Cocody" });
    const proposalId = useCrewStore.getState().proposals[0]?.id ?? "";

    expect(await useCrewStore.getState().castVote(proposalId)).toBe("ok");
    const after = useCrewStore.getState().proposals[0];
    expect(after?.votes).toBe(1);
    expect(after?.has_my_vote).toBe(true);

    expect(await useCrewStore.getState().castVote(proposalId)).toBe("duplicate");
  });

  it("les arrivées bots remontent dans le store via l'abonnement (attach)", async () => {
    const ref = await useCrewStore.getState().start(SELF);
    if (!ref) throw new Error("start failed");
    useCrewStore.getState().attach(ref.session_id);
    await flushMicrotasks(); // souscription démo posée (import dynamique)

    await jest.advanceTimersByTimeAsync(4000); // Awa +1.5s, Yao +3.2s
    await flushMicrotasks();

    expect(useCrewStore.getState().members.length).toBe(3);
  });
});

describe("crew-store — résolution (« On tranche »)", () => {
  it("trancher() sans proposition → null (on ne tranche pas dans le vide)", async () => {
    await useCrewStore.getState().start(SELF);
    const winner = await useCrewStore.getState().trancher({ hostTiebreak: null });
    expect(winner).toBeNull();
    expect(useCrewStore.getState().session?.status).toBe("open");
  });

  it("trancher() résout : égalité sans Palais hôte → premier proposé", async () => {
    await useCrewStore.getState().start(SELF);
    await useCrewStore.getState().propose({ id: "pl-a", name: "A", neighborhood: "Cocody" });
    await useCrewStore.getState().propose({ id: "pl-b", name: "B", neighborhood: "Marcory" });
    const [p1, p2] = useCrewStore.getState().proposals;
    await useCrewStore.getState().castVote(p1?.id ?? "");
    await useCrewStore.getState().castVote(p2?.id ?? ""); // 1-1 : égalité

    const winner = await useCrewStore.getState().trancher({ hostTiebreak: null });
    expect(winner?.place_id).toBe("pl-a");
    expect(winner?.decided_by).toBe("first_proposed");

    const s = useCrewStore.getState();
    expect(s.session?.status).toBe("resolved");
    expect(s.session?.winning_place_id).toBe("pl-a");
    expect(s.winner?.place_name).toBe("A");
  });

  it("la résolution du bot hôte (flux membre) arrive via l'événement resolved", async () => {
    const result = await useCrewStore.getState().join("GHJKM", SELF);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    useCrewStore.getState().attach(result.ref.session_id);
    await flushMicrotasks();

    // Propositions/votes bots puis résolution auto à +25s.
    await jest.advanceTimersByTimeAsync(26_000);
    await flushMicrotasks();

    const s = useCrewStore.getState();
    expect(s.session?.status).toBe("resolved");
    expect(s.winner).not.toBeNull();
    expect(s.winner?.decided_by).toBe("remote");
  });
});

describe("crew-store — expiration et sortie", () => {
  it("markExpired() passe la session en expired et purge la référence", async () => {
    await useCrewStore.getState().start(SELF);
    await useCrewStore.getState().markExpired();

    expect(useCrewStore.getState().session?.status).toBe("expired");
    expect(useCrewStore.getState().persistedRef).toBeNull();
    expect(await AsyncStorage.getItem(CREW_SESSION_STORAGE_KEY)).toBeNull();
  });

  it("leave() vide l'état, coupe l'abonnement et purge la référence", async () => {
    const ref = await useCrewStore.getState().start(SELF);
    if (!ref) throw new Error("start failed");
    useCrewStore.getState().attach(ref.session_id);
    await useCrewStore.getState().leave();

    const s = useCrewStore.getState();
    expect(s.session).toBeNull();
    expect(s.members).toEqual([]);
    expect(s.proposals).toEqual([]);
    expect(s.winner).toBeNull();
    expect(s.persistedRef).toBeNull();
    expect(s.transportMode()).toBe("idle");
    expect(await AsyncStorage.getItem(CREW_SESSION_STORAGE_KEY)).toBeNull();

    // La session démo est nettoyée : plus d'activité bot après le leave.
    await jest.advanceTimersByTimeAsync(60_000);
    expect(useCrewStore.getState().members).toEqual([]);
  });
});
