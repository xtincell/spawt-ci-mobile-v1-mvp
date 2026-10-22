import { AppState, type AppStateStatus } from "react-native";
import { startContentSync, subscribePublishedContent } from "../content-sync";

beforeEach(() => { jest.useFakeTimers(); Object.defineProperty(AppState,"currentState",{ configurable:true, value:"active" }); });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
it("refreshes on server publication changes, retries after outage, pauses in background", async () => {
  const read=jest.fn().mockResolvedValue("1:100"); const changed=jest.fn(); const off=subscribePublishedContent(changed);
  const stop=startContentSync(read); await tick(); expect(changed).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(30000); await tick(); expect(changed).toHaveBeenCalledTimes(1);
  read.mockRejectedValueOnce(new Error("offline")); jest.advanceTimersByTime(30000); await tick(); expect(changed).toHaveBeenCalledTimes(1);
  read.mockResolvedValue("2:100"); jest.advanceTimersByTime(30000); await tick(); expect(changed).toHaveBeenCalledTimes(2);
  Object.defineProperty(AppState,"currentState",{ configurable:true,value:"background" });
  jest.advanceTimersByTime(30000); await tick(); expect(read).toHaveBeenCalledTimes(4);
  stop(); off(); jest.advanceTimersByTime(30000); expect(read).toHaveBeenCalledTimes(4);
});
it("foreground refreshes even when server status cannot be read", async () => {
  let change!: (state:AppStateStatus)=>void; const remove=jest.fn();
  jest.spyOn(AppState,"addEventListener").mockImplementation((_,listener)=>{ change=listener; return { remove }; });
  const changed=jest.fn();const off=subscribePublishedContent(changed);
  const stop=startContentSync(jest.fn().mockRejectedValue(new Error("offline")));await tick();
  change("active");expect(changed).toHaveBeenCalledTimes(1);stop();off();expect(remove).toHaveBeenCalled();
});
