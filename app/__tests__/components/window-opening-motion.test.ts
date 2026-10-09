import { poseMatrix, windowPose, windowWink, WINDOW_EXIT_MS, WINDOW_POSE_MS } from "../../src/components/brand/window-opening-motion";

describe("chorégraphie du pack SPAWT fenêtre V2", () => {
  it("garde le chat en dehors de l’ouverture avant 140 ms", () => {
    expect(windowPose(0).y).toBe(415);
    expect(windowPose(.139).y).toBe(415);
    expect(windowWink(0)).toBe(0);
  });
  it("passe au-dessus du cadre puis amortit le rebond", () => {
    expect(windowPose(.46).y).toBe(-56);
    expect(windowPose(1.14)).toMatchObject({ y: -29, angle: -3.5, sx: 1.025, sy: 1 });
    expect(windowPose(.65).y).toBeLessThan(-29);
  });
  it("ferme un œil pendant la pose puis le rouvre", () => {
    expect(windowWink(.69)).toBe(0);
    expect(windowWink(.79)).toBe(1);
    expect(windowWink(.94)).toBe(0);
  });
  it("termine le fondu à 1,40 seconde et conserve le pivot du personnage", () => {
    expect(WINDOW_POSE_MS + WINDOW_EXIT_MS).toBe(1400);
    const [a, b, c, d, x, y] = poseMatrix(1.14) as [number, number, number, number, number, number];
    expect(a * 309 + c * 275 + x).toBeCloseTo(309);
    expect(b * 309 + d * 275 + y).toBeCloseTo(246);
  });
});
