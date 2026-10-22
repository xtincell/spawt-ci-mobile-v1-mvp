import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";
import { Text } from "react-native";
import fr from "../../src/i18n/fr.json";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockTranslate = jest.fn((key: string, options: { defaultValue: string }) => {
  const labelKey = key.slice(4) as keyof typeof fr.nav;
  return fr.nav[labelKey] ?? options.defaultValue;
});
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

import { TabBar } from "../../src/components/primitives/TabBar";

describe("TabBar visible and accessibility labels", () => {
  it.each([false, true])("keeps labels, selection and navigation consistent (fallback: %s)", async (fallback) => {
    if (fallback) mockTranslate.mockImplementation((_key, options) => options.defaultValue);
    const onTabPress = jest.fn();
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<TabBar active="home" onTabPress={onTabPress} />);
    });
    const labels = renderer.root.findAllByType(Text).map((node) => node.props.children);
    for (const node of renderer.root.findAllByType(Text)) {
      expect(node.props.numberOfLines).toBeUndefined();
      expect(node.props.adjustsFontSizeToFit).toBeUndefined();
    }
    expect(labels).toEqual(["Accueil", "Carte", "La bande", "Palais"]);
    const controls = renderer.root.findAll((node) => typeof node.type === "string" && ["tab", "button"].includes(node.props.accessibilityRole));
    expect(controls.map((node) => node.props.accessibilityLabel)).toEqual(["Accueil", "Carte", "Spawter", "La bande", "Palais"]);
    expect(controls[0]?.props.accessibilityState).toEqual({ selected: true });
    expect(controls[3]?.props.accessibilityState).toEqual({ selected: false });
    const press = (label: string) => {
      const control = renderer.root.findAll((node) => node.props.accessibilityLabel === label && typeof node.props.onPress === "function")[0];
      if (!control) throw new Error(`Missing press handler for ${label}`);
      control.props.onPress();
    };
    await act(async () => {
      press("La bande");
      press("Accueil");
      press("Accueil");
    });
    expect(onTabPress.mock.calls).toEqual([["tribu"], ["home"], ["home"]]);
    await act(async () => {
      renderer.update(<TabBar active="tribu" onTabPress={onTabPress} />);
    });
    expect(renderer.root.findAll((node) => typeof node.type === "string" && node.props.accessibilityLabel === "La bande")[0]?.props.accessibilityState).toEqual({ selected: true });
    await act(async () => renderer.unmount());
  });
});
