import AsyncStorage from "@react-native-async-storage/async-storage";
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("expo-crypto", () => { let id = 0; return { randomUUID: () => `id-${++id}` }; });
let mockOwner = "a";
let mockVisits: { id: string }[] = [];
const mockQuery = { select: jest.fn(), eq: jest.fn(), is: jest.fn(), neq: jest.fn(), gte: jest.fn(), lte: jest.fn(), order: jest.fn(), limit: jest.fn(), abortSignal: jest.fn() };
jest.mock("../../supabase", () => ({ supabase: { from: () => mockQuery, auth: { getSession: async () => ({ data: { session: { user: { id: mockOwner } } } }) } } }));
const mockSchedule = jest.fn(); const mockCancel = jest.fn();
jest.mock("../guet-notifications", () => ({ scheduleGuetPrompt: (...args: unknown[]) => mockSchedule(...args), cancelGuetPrompt: (...args: unknown[]) => mockCancel(...args) }));
import { GUET_CONTEXT_KEY, handleNearbyEvent, mayNotify, proximityCopy } from "../guet-nearby";
const place = { id: "p", name: "Chez Tantie", lat: 5, lng: -4, saved: true, visited: false };
const noon = new Date(2026, 9, 22, 12).getTime();
beforeEach(async () => {
  mockVisits = [];
  Object.values(mockQuery).forEach(f => f.mockReturnValue(mockQuery));
  mockQuery.abortSignal.mockImplementation(async () => ({ data: mockVisits, error: null }));
  await AsyncStorage.clear(); jest.clearAllMocks(); mockOwner = "a"; mockSchedule.mockResolvedValue("notification");
  await AsyncStorage.setItem(GUET_CONTEXT_KEY, JSON.stringify({ owner: "a", expiresAt: Date.now() + 3600_000, places: [place] }));
});
it("handles a headless entry and ignores duplicate events", async () => {
  await Promise.all([handleNearbyEvent("enter", "p", noon), handleNearbyEvent("enter", "p", noon)]);
  expect(mockSchedule).toHaveBeenCalledTimes(1);
  expect(mockSchedule).toHaveBeenCalledWith(expect.objectContaining({ owner_id: "a", kind: "nearby", body: expect.stringContaining("gardé") }), 120);
});
it("cancels a short pass, allowing a genuine subsequent arrival", async () => {
  await handleNearbyEvent("enter", "p", noon); await handleNearbyEvent("exit", "p", noon + 30_000);
  expect(mockCancel).toHaveBeenCalledTimes(1);
  await handleNearbyEvent("enter", "p", noon + 60_000); expect(mockSchedule).toHaveBeenCalledTimes(2);
});
it("does not remind the same place again within seven days", async () => {
  await handleNearbyEvent("enter", "p", noon); await handleNearbyEvent("exit", "p", noon + 600_000);
  await handleNearbyEvent("enter", "p", noon + 3600_000); expect(mockSchedule).toHaveBeenCalledTimes(1);
});
it("fails closed for another account or an unknown place", async () => {
  mockOwner = "b"; await handleNearbyEvent("enter", "p", noon);
  mockOwner = "a"; await handleNearbyEvent("enter", "unknown", noon);
  expect(mockSchedule).not.toHaveBeenCalled();
});
it("keeps scheduling failure visible in its own diagnostic state", async () => {
  mockSchedule.mockResolvedValue(null); await handleNearbyEvent("enter", "p", noon);
  const state = JSON.parse((await AsyncStorage.getItem("spawt:guet:v2:state:a"))!);
  expect(state.history).toHaveLength(0); expect(state.lastFailure).toBe("notification_schedule_failed");
});
it("enforces local quiet hours and the daily cap", () => {
  expect(mayNotify([], "p", new Date(2026, 9, 22, 23).getTime())).toBe(false);
  expect(mayNotify([{ id: "1", placeId: "x", dueAt: noon }, { id: "2", placeId: "y", dueAt: noon }], "p", noon + 1000)).toBe(false);
});
it("uses four distinct saved / visited messages", () => {
  const copies = [false, true].flatMap(saved => [false, true].map(visited => proximityCopy({ ...place, saved, visited })));
  expect(new Set(copies).size).toBe(4); expect(copies.every(c => c.includes(place.name))).toBe(true);
});

it("requests a review only for an explicit persisted visit, after exit", async () => {
  await handleNearbyEvent("enter", "p", noon);
  mockVisits = [{ id: "explicit-visit" }];
  await handleNearbyEvent("exit", "p", noon + 600_000);
  expect(mockSchedule).toHaveBeenCalledTimes(2);
  expect(mockSchedule).toHaveBeenLastCalledWith(expect.objectContaining({ row_id: "explicit-visit", kind: "review", owner_id: "a" }), 120);
  expect(mockQuery.neq).toHaveBeenCalledWith("check_in_type", "passive");
  expect(mockQuery.eq).toHaveBeenCalledWith("spawter_id", "a");
});
