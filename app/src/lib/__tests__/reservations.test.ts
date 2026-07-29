// Résa 1-tap — tests des helpers purs (URL WhatsApp, clamp du groupe) et du
// moteur démo (trace AsyncStorage, tri fraîcheur, robustesse).

import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import {
  buildWaMeUrl,
  clampPartySize,
  createDemoReservationRequest,
  listDemoReservations,
  PARTY_SIZE_MAX,
  PARTY_SIZE_MIN,
  type ReservationRequestInput,
} from "../reservations";

const STORAGE_KEY = "spawt:reservations";

function input(overrides: Partial<ReservationRequestInput> = {}): ReservationRequestInput {
  return {
    place_id: "place-1",
    place_name: "Chez Tantie Rosalie",
    party_size: 4,
    slot_at: "2026-08-01T20:00:00.000Z",
    channel: "whatsapp",
    ...overrides,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("buildWaMeUrl", () => {
  it("compose wa.me avec le numéro nettoyé et le texte encodé", () => {
    const url = buildWaMeUrl("+225 07 08 09 10 11", "Table pour 4 ce soir ?");
    expect(url).toBe(
      "https://wa.me/2250708091011?text=Table%20pour%204%20ce%20soir%20%3F",
    );
  });

  it("numéro sans aucun chiffre → null (jamais de wa.me dans le vide)", () => {
    expect(buildWaMeUrl("", "coucou")).toBeNull();
    expect(buildWaMeUrl("pas un numéro", "coucou")).toBeNull();
  });
});

describe("clampPartySize — bornes du CHECK DB 0042", () => {
  it("clampe entre 1 et 20, arrondit, tolère l'invalide", () => {
    expect(clampPartySize(0)).toBe(PARTY_SIZE_MIN);
    expect(clampPartySize(21)).toBe(PARTY_SIZE_MAX);
    expect(clampPartySize(7.6)).toBe(8);
    expect(clampPartySize(Number.NaN)).toBe(PARTY_SIZE_MIN);
  });
});

describe("createDemoReservationRequest / listDemoReservations", () => {
  it("trace la demande en statut sent et la restitue", async () => {
    const row = await createDemoReservationRequest(input());
    expect(row).toMatchObject({
      place_id: "place-1",
      place_name: "Chez Tantie Rosalie",
      party_size: 4,
      channel: "whatsapp",
      status: "sent",
    });
    const list = await listDemoReservations();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(row?.id);
  });

  it("party_size hors bornes → clampé à l'écriture (jamais de row invalide)", async () => {
    const row = await createDemoReservationRequest(input({ party_size: 99 }));
    expect(row?.party_size).toBe(PARTY_SIZE_MAX);
  });

  it("tri par fraîcheur (plus récentes d'abord)", async () => {
    const rows = [
      { ...input({ place_name: "Ancien" }), id: "a", status: "sent", created_at: "2026-05-01T00:00:00Z" },
      { ...input({ place_name: "Récent" }), id: "b", status: "sent", created_at: "2026-07-01T00:00:00Z" },
    ];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    const list = await listDemoReservations();
    expect(list.map((r) => r.place_name)).toEqual(["Récent", "Ancien"]);
  });

  it("stockage corrompu → liste vide puis réécriture propre, aucun crash", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, "{corrompu[");
    expect(await listDemoReservations()).toEqual([]);
    expect(await createDemoReservationRequest(input())).not.toBeNull();
    expect(await listDemoReservations()).toHaveLength(1);
  });
});
