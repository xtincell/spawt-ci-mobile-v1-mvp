import { useState } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Pressable, Text } from "react-native";
import {
  ModeStories,
  HOME_MODES,
  type ModeKey,
} from "../../src/components/ModeStories";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
import { tokens } from "../../src/theme/tokens";
import fr from "../../src/i18n/fr.json";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const parts = key.split(".");
      return (
        parts.reduce(
          (value: any, part) => value?.[part],
          require("../../src/i18n/fr.json"),
        ) ?? key
      );
    },
  }),
}));

function Harness() {
  const [mode, setMode] = useState<ModeKey>("suggestions");
  return (
    <ThemeProvider>
      <ModeStories selectedMode={mode} onModePress={setMode} />
    </ThemeProvider>
  );
}

it("keeps five peers in order, with all subtitles and one active choice through repeated taps", () => {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<Harness />);
  });
  const buttons = () =>
    tree.root.findAll(
      (n) =>
        n.props.accessibilityRole === "radio" &&
        typeof n.props.onPress === "function",
    );
  expect(buttons().map((b) => b.props.testID)).toEqual(
    HOME_MODES.map((key) => `home-mode-${key}`),
  );
  expect(buttons()).toHaveLength(5);
  for (const key of [
    ...HOME_MODES,
    "rapide",
    "rapide",
    "suggestions",
  ] as ModeKey[]) {
    act(() =>
      buttons()
        .find((b) => b.props.testID === `home-mode-${key}`)!
        .props.onPress(),
    );
    expect(
      buttons().filter((b) => b.props.accessibilityState.selected),
    ).toHaveLength(1);
    for (const button of buttons()) {
      const active = button.props.testID === `home-mode-${key}`;
      expect(button.props.accessibilityState.selected).toBe(active);
      const style = button.props.style({ pressed: false });
      const disc = button.findAll(
        (n) =>
          n.props.testID ===
          button.props.testID.replace("home-mode-", "home-mode-disc-"),
      )[0]!;
      expect(disc.props.style.backgroundColor).toBe(
        active ? tokens.surface.inverse : tokens.surface.subtle,
      );
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
      expect(button.findAllByType(Text)[1]!.props.style.color).toBe(
        tokens.text.secondary,
      );
    }
  }
  expect(buttons().map((b) => b.props.accessibilityLabel)).toEqual(
    HOME_MODES.map(
      (key) =>
        `${fr.home.selector[key].title}, ${fr.home.selector[key].subtitle}`,
    ),
  );
  act(() => tree.unmount());
});

it.each([320, 360, 393])(
  "keeps targets and complete labels at %ipx with enlarged text",
  (width) => {
    const RN = require("react-native");
    const dimensions = jest
      .spyOn(RN, "useWindowDimensions")
      .mockReturnValue({ width, height: 852, scale: 1, fontScale: 1.5 });
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<Harness />);
    });
    const buttons = tree.root.findAll(
      (n) =>
        n.props.accessibilityRole === "radio" &&
        typeof n.props.onPress === "function",
    );
    expect(buttons).toHaveLength(5);
    for (const b of buttons) {
      const style = b.props.style({ pressed: false });
      expect(style.width).toBeGreaterThanOrEqual(102);
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
      for (const label of b.findAllByType(Text))
        expect(label.props.numberOfLines).toBeUndefined();
    }
    act(() => tree.unmount());
    dimensions.mockRestore();
  },
);
