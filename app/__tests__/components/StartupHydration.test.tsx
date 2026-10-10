// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";
import { useStartupHydration } from "../../src/lib/use-startup-hydration";

let state: ReturnType<typeof useStartupHydration>;
function Probe({ restore }: { restore: () => Promise<void> }) {
  state = useStartupHydration(restore);
  return null;
}

describe("restauration au lancement", () => {
  let renderer: { unmount: () => void } | null;
  beforeEach(() => { jest.spyOn(console, "warn").mockImplementation(() => {}); });
  afterEach(() => {
    TestRenderer.act(() => renderer?.unmount());
    renderer = null;
    jest.restoreAllMocks();
  });

  it("expose l'échec de lecture puis permet de relire le compte", async () => {
    const restore = jest.fn().mockRejectedValueOnce(new Error("storage unavailable")).mockResolvedValueOnce(undefined);
    await TestRenderer.act(async () => { renderer = TestRenderer.create(<Probe restore={restore} />); });
    expect(state.failed).toBe(true);
    await TestRenderer.act(async () => { state.retry(); });
    expect(state.failed).toBe(false);
    expect(restore).toHaveBeenCalledTimes(2);
  });

  it("ignore une erreur tardive après démontage", async () => {
    let reject!: (error: Error) => void;
    const restore = () => new Promise<void>((_resolve, rejectPromise) => { reject = rejectPromise; });
    await TestRenderer.act(async () => { renderer = TestRenderer.create(<Probe restore={restore} />); });
    TestRenderer.act(() => renderer?.unmount());
    renderer = null;
    await TestRenderer.act(async () => { reject(new Error("late failure")); });
    expect(console.warn).not.toHaveBeenCalled();
  });
});
