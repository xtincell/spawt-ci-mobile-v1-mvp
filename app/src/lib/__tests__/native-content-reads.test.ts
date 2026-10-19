// Use the same AbortSignal implementation as React Native, not Node's richer API.
import { AbortController as NativeAbortController, AbortSignal as NativeAbortSignal } from "abort-controller";
let mockResult: { data: unknown; error: unknown; count: number | null } = { data: [], error: null, count: 10 };
const mockRequests = jest.fn();
jest.mock("../data-source", () => ({ isSupabaseConfigured: true }));
jest.mock("../city", () => ({ getActiveCity: () => ({ code: "ABJ" }) }));
jest.mock("../offline-queue", () => ({ inspect: async () => [] }));
jest.mock("../push-token", () => ({ getPushRegistrationStatus: () => "unavailable", registerPushToken: jest.fn() }));
jest.mock("../supabase", () => ({ supabase: {
  from: () => {
    const query: Record<string, unknown> = {};
    for (const method of ["select", "or", "order", "limit", "eq"]) query[method] = () => query;
    query.abortSignal = (signal: AbortSignal) => { mockRequests(signal); return Promise.resolve(mockResult); };
    return query;
  },
  rpc: () => ({ abortSignal: (signal: AbortSignal) => { mockRequests(signal); return Promise.resolve({ data: "1:100", error: null }); } }),
} }));
import { listAnnouncements } from "../announcements";
import { checkAppContent } from "../app-support";
import { withReadTimeout } from "../data-read-error";
import { startAppActivity } from "../app-activity";
import { AppState } from "react-native";
const original = { AbortController: global.AbortController, AbortSignal: global.AbortSignal };
beforeEach(() => {
  Object.assign(global, { AbortController: NativeAbortController, AbortSignal: NativeAbortSignal });
  mockResult = { data: [], error: null, count: 10 }; mockRequests.mockClear();
});
afterEach(() => { Object.assign(global, original); jest.useRealTimers(); });
it("queries announcements on the native runtime and treats an empty feed as successful", async () => {
  expect(typeof AbortSignal.timeout).toBe("undefined");
  await expect(listAnnouncements()).resolves.toEqual([]);
  expect(mockRequests).toHaveBeenCalledTimes(1);
});
it("does not turn server denial into an empty feed", async () => {
  mockResult.error = { code: "42501" };
  await expect(listAnnouncements()).rejects.toEqual({ code: "42501" });
});
it("checks all five real content readers without static AbortSignal helpers", async () => {
  const result = await checkAppContent();
  expect(result.checks).toHaveLength(5);
  expect(result.checks?.every(check => check.ok)).toBe(true);
  expect(mockRequests).toHaveBeenCalledTimes(5);
});
it("reports foreground activity with the native AbortSignal implementation", async () => {
  jest.useFakeTimers();
  const previous = AppState.currentState;
  Object.defineProperty(AppState, "currentState", { configurable: true, value: "active" });
  const stop = await startAppActivity("synthetic-account");
  for (let i = 0; i < 10; i++) await Promise.resolve();
  expect(mockRequests).toHaveBeenCalledTimes(1);
  stop();
  Object.defineProperty(AppState, "currentState", { configurable: true, value: previous });
});
it("a transport that ignores abort still releases the screen after the deadline", async () => {
  jest.useFakeTimers(); let signal!: AbortSignal;
  const pending = withReadTimeout("announcements", current => { signal = current; return new Promise(() => {}); });
  const expectation = expect(pending).rejects.toMatchObject({ name: "DataReadError", source: "announcements" });
  jest.advanceTimersByTime(15_000); await expectation; expect(signal.aborted).toBe(true);
});
