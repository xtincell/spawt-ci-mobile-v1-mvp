import TestRenderer, { act } from "react-test-renderer";
import {
  useSpawterPosition,
  getFallbackPosition,
  type SpawterPosition,
} from "../use-spawter-position";
import * as Location from "expo-location";
jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
let latest: SpawterPosition;
function Probe() {
  latest = useSpawterPosition();
  return null;
}
it("permission denied keeps the real city reference without requesting permission or a GPS fix", async () => {
  (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
    status: "denied",
  });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<Probe />);
  });
  expect(latest).toEqual(getFallbackPosition());
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
