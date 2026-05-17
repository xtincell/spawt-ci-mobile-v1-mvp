// Story 2.2 — AC #7-1 : storage.setConsent / getConsent supportent "cgv" + "geoloc".

jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
      setItem: jest.fn((k: string, v: string) => {
        store.set(k, v);
        return Promise.resolve();
      }),
      removeItem: jest.fn((k: string) => {
        store.delete(k);
        return Promise.resolve();
      }),
      multiRemove: jest.fn((keys: string[]) => {
        for (const k of keys) store.delete(k);
        return Promise.resolve();
      }),
      __dump: () => Object.fromEntries(store),
      __reset: () => store.clear(),
    },
  };
});

import { setConsent, getConsent, resetAll } from "../../src/lib/storage";

describe("storage.setConsent — Story 2.2 (cgv | geoloc)", () => {
  beforeEach(async () => {
    await resetAll();
  });

  it("setConsent(\"cgv\", true) historise un ISO timestamp lisible par getConsent", async () => {
    await setConsent("cgv", true);
    const value = await getConsent("cgv");
    expect(value).not.toBeNull();
    expect(new Date(value as string).toISOString()).toBe(value);
  });

  it("setConsent(\"geoloc\", true) historise indépendamment du bloc cgv", async () => {
    await setConsent("geoloc", true);
    const geoloc = await getConsent("geoloc");
    const cgv = await getConsent("cgv");
    expect(geoloc).not.toBeNull();
    expect(cgv).toBeNull();
  });

  it("setConsent(kind, false) écrit la string vide (réservé révocation future)", async () => {
    await setConsent("cgv", true);
    await setConsent("cgv", false);
    const value = await getConsent("cgv");
    expect(value).toBe("");
  });
});
