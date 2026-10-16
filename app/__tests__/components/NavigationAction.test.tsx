import { useNavigationAction } from "../../src/lib/use-navigation-action";
import TestRenderer, { act } from "react-test-renderer";
let mockFocus: () => void;
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) => {
    mockFocus = effect;
    require("react").useEffect(effect, [effect]);
  },
}));
let invoke: (fn: () => void) => void;
function Harness() {
  invoke = useNavigationAction();
  return null;
}
it("blocks double navigation, then unlocks when the source regains focus", () => {
  let tree!: TestRenderer.ReactTestRenderer;
  const push = jest.fn();
  act(() => {
    tree = TestRenderer.create(<Harness />);
  });
  act(() => {
    invoke(push);
    invoke(push);
  });
  expect(push).toHaveBeenCalledTimes(1);
  act(() => {
    mockFocus();
    invoke(push);
  });
  expect(push).toHaveBeenCalledTimes(2);
  act(() => tree.unmount());
});
