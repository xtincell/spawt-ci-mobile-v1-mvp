// Story 5.3 — Stub V1 : tous les spawters retournent false.

import { isGoldSpawter } from "../../src/lib/spawter-gold";
import { SAMPLE_SPAWTER } from "../../src/data/seed/sample-spawter";

describe("isGoldSpawter — Story 5.3 stub V1", () => {
  it("retourne false pour le SAMPLE_SPAWTER", () => {
    expect(isGoldSpawter(SAMPLE_SPAWTER)).toBe(false);
  });

  it("retourne false même avec un customer_id non-null (Sprint 2 wiring)", () => {
    expect(isGoldSpawter({ ...SAMPLE_SPAWTER, customer_id: "cus-123" })).toBe(false);
  });
});
