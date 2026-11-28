// @ts-ignore — react-test-renderer ships JS only.
import TestRenderer from "react-test-renderer";
import { Platform } from "react-native";
import fr from "../../src/i18n/fr.json";
import { AndroidGuetDisclosure } from "../../src/components/AndroidGuetDisclosure";
import { ThemeProvider } from "../../src/theme/ThemeProvider";

jest.mock("expo-router", () => ({ useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]) }));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) =>
    require("../../src/i18n/fr.json").guet_disclosure[(key.split(".")[1] ?? "")] ?? key }),
}));
jest.mock("../../src/store/spawter-store", () => {
  const state = { spawter: { id: "review", geoloc_consent_at: "2026-11-01" } };
  return { useSpawterStore: Object.assign((select: (value: typeof state) => unknown) => select(state), { getState: () => state }) };
});
jest.mock("../../src/store/feature-flags", () => ({
  useFeatureFlagsStore: (select: Function) => select({ spawterId: "review", flags: { "guet-proximity-v2": true } }),
}));
let mockChoice: "accepted" | "declined" | null;
const mockSetChoice = jest.fn(async (_id: string, enabled: boolean) => {
  mockChoice = enabled ? "accepted" : "declined";
});
jest.mock("../../src/lib/guet/guet-orchestrator", () => ({
  setAndroidGuetChoice: (...args: [string, boolean]) => mockSetChoice(...args),
}));
jest.mock("../../src/lib/guet/guet-disclosure", () => ({ readGuetChoice: async () => mockChoice }));

const originalOS = Platform.OS;
let tree: ReturnType<typeof TestRenderer.create>;

beforeEach(() => {
  Platform.OS = "android";
  mockChoice = null;
  mockSetChoice.mockClear();
});

afterEach(async () => {
  await TestRenderer.act(async () => tree?.unmount());
  Platform.OS = originalOS;
});

async function mount(placement: "home" | "settings") {
  await TestRenderer.act(async () => {
    tree = TestRenderer.create(<ThemeProvider><AndroidGuetDisclosure placement={placement} /></ThemeProvider>);
  });
}

async function press(id: string) {
  const control = tree.root.findAllByProps({ testID: id }).find((node: { props: { onPress?: unknown } }) => typeof node.props.onPress === "function");
  if (!control) throw new Error(`Missing pressable: ${id}`);
  await TestRenderer.act(async () => control.props.onPress());
}

it("shows the disclosure before it allows activation from the ordinary home screen", async () => {
  await mount("home");
  expect(mockSetChoice).not.toHaveBeenCalled();
  await press("guet-open-disclosure");
  expect(mockSetChoice).not.toHaveBeenCalled();
  expect(fr.guet_disclosure.android_body).toMatch(/localisation même quand l’app est fermée/);
  expect(JSON.stringify(tree.toJSON())).toContain(fr.guet_disclosure.android_body);

  await press("guet-confirm-disclosure");
  expect(mockSetChoice).toHaveBeenCalledWith("review", true);
});

it("keeps the Guet suspended when the user says not now", async () => {
  await mount("home");
  await press("guet-open-disclosure");
  await press("guet-cancel-disclosure");
  expect(mockSetChoice.mock.calls).toEqual([["review", false]]);
  expect(tree.toJSON()).toBeNull();
});

it("allows withdrawal from Settings without opening an OS permission request", async () => {
  mockChoice = "accepted";
  await mount("settings");
  await press("guet-dismiss-or-disable");
  expect(mockSetChoice.mock.calls).toEqual([["review", false]]);
});

it("does not expose the Android dialog on iOS", async () => {
  Platform.OS = "ios";
  await mount("home");
  expect(tree.toJSON()).toBeNull();
});
