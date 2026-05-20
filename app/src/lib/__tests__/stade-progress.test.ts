// Story 5.4 — Tests pour getNextStadeProgress (pure helper).

import { getNextStadeProgress } from "../stade-progress";

describe("getNextStadeProgress — Story 5.4", () => {
  it("touriste 0 spots → next=explorateur, threshold=11, percent=0", () => {
    const p = getNextStadeProgress("touriste", 0);
    expect(p.next_stade).toBe("explorateur");
    expect(p.next_threshold).toBe(11);
    expect(p.percent).toBe(0);
  });

  it("touriste 5 spots → percent ≈ 0.45", () => {
    const p = getNextStadeProgress("touriste", 5);
    expect(p.percent).toBeCloseTo(5 / 11, 2);
  });

  it("touriste 10 spots → percent ≈ 0.91", () => {
    const p = getNextStadeProgress("touriste", 10);
    expect(p.percent).toBeCloseTo(10 / 11, 2);
  });

  it("touriste 11 spots → percent=1 (clamped, même si stade=explorateur attendu)", () => {
    const p = getNextStadeProgress("touriste", 11);
    expect(p.percent).toBe(1);
  });

  it("guide 100 spots → next_stade=null, percent=1", () => {
    const p = getNextStadeProgress("guide", 100);
    expect(p.next_stade).toBeNull();
    expect(p.next_threshold).toBeNull();
    expect(p.percent).toBe(1);
  });

  it("explorateur 15 spots → next=detective, threshold=21, percent=0.4", () => {
    const p = getNextStadeProgress("explorateur", 15);
    expect(p.next_stade).toBe("detective");
    expect(p.next_threshold).toBe(21);
    expect(p.percent).toBeCloseTo(0.4, 2);
  });
});
