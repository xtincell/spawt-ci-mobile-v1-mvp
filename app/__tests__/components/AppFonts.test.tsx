import { StrictMode } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [false, null] }));
import { useAppFonts } from "../../src/theme/useAppFonts";

it("libère le splash après le délai de secours même si StrictMode rejoue l'effet", () => {
  jest.useFakeTimers();
  const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
  let loaded = false;
  function Probe() {
    loaded = useAppFonts().fontsLoaded;
    return null;
  }
  let renderer: { unmount: () => void } | undefined;
  try {
    TestRenderer.act(() => { renderer = TestRenderer.create(<StrictMode><Probe /></StrictMode>); });
    expect(loaded).toBe(false);
    TestRenderer.act(() => { jest.advanceTimersByTime(8001); });
    expect(loaded).toBe(true);
  } finally {
    TestRenderer.act(() => renderer?.unmount());
    warning.mockRestore();
    jest.useRealTimers();
  }
});
