// finding P2#7 — reset() (logout / suppression de compte) doit purger les caches
// des features V2 (résas, suggestions de lieux, dernière session Crew, token
// push) et quitter le Crew, sinon fuite inter-comptes sur le même device.

import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("../../lib/analytics", () => ({ track: jest.fn() }));

import { useSpawterStore } from "../spawter-store";
import { useCrewStore, CREW_SESSION_STORAGE_KEY } from "../crew-store";
import { STORAGE_KEY as RESERVATIONS_KEY } from "../../lib/reservations";
import { STORAGE_KEY as SUGGESTIONS_KEY } from "../../lib/place-suggestions";

const PUSH_TOKEN_KEY = "spawt:push:token"; // = push-token.PUSH_TOKEN_STORAGE_KEY

async function flush(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await Promise.resolve();
}

describe("spawter-store.reset — purge cross-compte (P2#7)", () => {
  it("purge résas / suggestions / session Crew / token push et quitte le Crew", async () => {
    const keys = [RESERVATIONS_KEY, SUGGESTIONS_KEY, CREW_SESSION_STORAGE_KEY, PUSH_TOKEN_KEY];
    // Ces clés portent bien les valeurs attendues (garde anti-dérive des libellés).
    expect(keys).toEqual([
      "spawt:reservations",
      "spawt:place-suggestions",
      "spawt:crew:last-session",
      "spawt:push:token",
    ]);

    for (const k of keys) await AsyncStorage.setItem(k, "compte-A");
    const leaveSpy = jest
      .spyOn(useCrewStore.getState(), "leave")
      .mockResolvedValue(undefined);

    useSpawterStore.getState().reset();
    await flush();

    for (const k of keys) {
      expect(await AsyncStorage.getItem(k)).toBeNull();
    }
    expect(leaveSpy).toHaveBeenCalled();
    leaveSpy.mockRestore();
  });
});
