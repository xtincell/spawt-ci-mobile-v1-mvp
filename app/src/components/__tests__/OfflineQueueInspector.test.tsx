// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only.
import TestRenderer from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { OfflineQueueInspector } from "../OfflineQueueInspector";

const mockT = (key: string) => key;
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: mockT }) }));

it("une file illisible affiche l'échec, jamais Tout est synchronisé, et permet une nouvelle lecture", async () => {
  await AsyncStorage.setItem("spawt:offline:queue", "{interrompu");
  let rendered: { toJSON: () => unknown; root: { findAllByProps: (props: Record<string, unknown>) => Array<{ props: Record<string, unknown> }> }; unmount: () => void };
  await TestRenderer.act(async () => {
    rendered = TestRenderer.create(<OfflineQueueInspector visible onClose={() => undefined} />);
  });
  const view = JSON.stringify(rendered!.toJSON());
  expect(view).toContain("offline_queue.error");
  expect(view).not.toContain("offline_queue.empty");
  const sync = rendered!.root.findAllByProps({ accessibilityLabel: "offline_queue.sync_now" });
  expect(sync.length).toBeGreaterThan(0);
  expect(sync[0]!.props.disabled).toBe(false);
  expect(await AsyncStorage.getItem("spawt:offline:queue")).toBe("{interrompu");
  await TestRenderer.act(async () => rendered!.unmount());
});
