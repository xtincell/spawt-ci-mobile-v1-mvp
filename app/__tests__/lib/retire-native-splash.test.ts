import { Platform } from "react-native";
const mockOptional = jest.fn();
const mockHide = jest.fn();
jest.mock("expo", () => ({ requireOptionalNativeModule: (...args: unknown[]) => mockOptional(...args) }));
jest.mock("expo-splash-screen", () => ({ hideAsync: () => mockHide() }));
import { retireNativeSplash } from "../../src/lib/retire-native-splash";

describe("retrait effectif du splash Android", () => {
  const original = Platform.OS;
  beforeEach(() => { jest.clearAllMocks(); Platform.OS = "android"; mockHide.mockResolvedValue(undefined); });
  afterEach(() => { Platform.OS = original; });
  it("installe l'écoute avant hideAsync et attend le retrait réel", async () => {
    const calls: string[] = [];
    let release!: () => void;
    mockOptional.mockReturnValue({
      prepareAsync: async () => { calls.push("prepare"); },
      waitAsync: () => new Promise<void>(resolve => { calls.push("wait"); release = resolve; }),
    });
    mockHide.mockImplementation(async () => { calls.push("hide"); });
    let finished = false;
    const result = retireNativeSplash().then(() => { finished = true; });
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(calls).toEqual(["prepare", "hide", "wait"]);
    expect(finished).toBe(false);
    release(); await result;
    expect(finished).toBe(true);
  });
  it("garde le comportement standard sur iOS et web", async () => {
    for (const os of ["ios", "web"] as const) { Platform.OS = os; await retireNativeSplash(); }
    expect(mockOptional).not.toHaveBeenCalled();
    expect(mockHide).toHaveBeenCalledTimes(2);
  });
  it("libère une ancienne runtime sans le module Android", async () => {
    mockOptional.mockReturnValue(null);
    await retireNativeSplash(); expect(mockHide).toHaveBeenCalledTimes(1);
  });
  it("retire le splash même si le module échoue à se préparer", async () => {
    const wait = jest.fn();
    mockOptional.mockReturnValue({ prepareAsync: async () => { throw new Error("activity"); }, waitAsync: wait });
    await retireNativeSplash(); expect(mockHide).toHaveBeenCalledTimes(1); expect(wait).not.toHaveBeenCalled();
  });
});
