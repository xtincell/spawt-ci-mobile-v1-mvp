// Story 4.1 — Tests guet-active micro-store.

import { useGuetActive } from "../guet-active";

beforeEach(() => {
  useGuetActive.setState({ active: null });
});

describe("guet-active store", () => {
  it("enter() définit la zone active", () => {
    useGuetActive.getState().enter({ place_id: "abc", place_name: "Bô Zinc" });
    expect(useGuetActive.getState().active).toEqual({
      place_id: "abc",
      place_name: "Bô Zinc",
    });
  });

  it("exit() reset à null", () => {
    useGuetActive.getState().enter({ place_id: "x", place_name: "X" });
    useGuetActive.getState().exit();
    expect(useGuetActive.getState().active).toBeNull();
  });

  it("enter() overwrite la zone précédente (re-entry sur autre lieu)", () => {
    useGuetActive.getState().enter({ place_id: "a", place_name: "A" });
    useGuetActive.getState().enter({ place_id: "b", place_name: "B" });
    expect(useGuetActive.getState().active?.place_id).toBe("b");
  });
});
