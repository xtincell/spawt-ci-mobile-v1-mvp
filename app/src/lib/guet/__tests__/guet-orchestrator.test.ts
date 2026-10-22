jest.mock("expo-location", () => ({}));
jest.mock("expo-task-manager", () => ({ defineTask: jest.fn() }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("../../data-source", () => ({ dataSourceMode: "supabase" }));
const mockState = { spawter: { id: "a" } };
jest.mock("../../../store/spawter-store", () => ({ useSpawterStore: { getState: () => mockState } }));
jest.mock("../../../store/feature-flags", () => ({ useFeatureFlagsStore: { getState: () => ({ flags: {} }) } }));
const mockSession = jest.fn();
jest.mock("../../supabase", () => ({ supabase: { auth: { getSession: (...args: unknown[]) => mockSession(...args) } } }));
jest.mock("../guet-notifications", () => ({ cancelAllGuetNotifications: jest.fn(), registerNotificationResponseHandler: jest.fn() }));
jest.mock("../geofence", () => ({ disarmGuet: jest.fn() }));
import { router } from "expo-router";
import { handleNotifResponse } from "../guet-orchestrator";
const payload = { row_id: "r", owner_id: "a", place_id: "p", place_name: "Lieu", kind: "nearby" as const };
beforeEach(() => { jest.clearAllMocks(); mockState.spawter.id = "a"; mockSession.mockResolvedValue({ data: { session: { user: { id: "a" } } } }); });
it("opens the menu without generating a visit or review", async () => {
  await handleNotifResponse("confirm", payload);
  expect(router.push).toHaveBeenCalledWith({ pathname: "/place/[id]", params: { id: "p", tab: "menu" } });
});
it("rejects a previous account notification", async () => {
  mockState.spawter.id = "b"; await handleNotifResponse("default", payload);
  expect(router.push).not.toHaveBeenCalled(); expect(mockSession).not.toHaveBeenCalled();
});
it("checks the authenticated identity, including an account switch during the request", async () => {
  mockSession.mockImplementation(async () => { mockState.spawter.id = "b"; return { data: { session: { user: { id: "a" } } } }; });
  await handleNotifResponse("default", payload); expect(router.push).not.toHaveBeenCalled();
});
