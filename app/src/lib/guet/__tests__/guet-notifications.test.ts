let mockPlatform = "android";
jest.mock("react-native", () => ({ Platform: { get OS() { return mockPlatform; } } }));
const mockCancel = jest.fn(); const mockSchedule = jest.fn();
jest.mock("expo-notifications", () => ({
  AndroidImportance: { DEFAULT: 3 }, SchedulableTriggerInputTypes: { TIME_INTERVAL: "timeInterval" },
  setNotificationChannelAsync: jest.fn(), setNotificationCategoryAsync: jest.fn(),
  scheduleNotificationAsync: (...args: unknown[]) => mockSchedule(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) => mockCancel(...args),
  getAllScheduledNotificationsAsync: async () => [{ identifier: "spawt:guet:v2:1" }, { identifier: "calendar-reminder" }],
}));
import { scheduleGuetPrompt, cancelAllGuetNotifications } from "../guet-notifications";
beforeEach(() => { jest.clearAllMocks(); mockPlatform = "android"; });
it("uses the typed Expo 55 trigger and puts the Android channel in the trigger", async () => {
  await scheduleGuetPrompt({ row_id: "1", place_id: "p", place_name: "Lieu", owner_id: "a" });
  expect(mockSchedule).toHaveBeenCalledWith(expect.objectContaining({ trigger: { type: "timeInterval", seconds: 120, repeats: false, channelId: "guet" } }));
  expect(mockSchedule.mock.calls[0][0].content.channelId).toBeUndefined();
});
it("cancels only Guet notifications", async () => {
  await cancelAllGuetNotifications(); expect(mockCancel).toHaveBeenCalledTimes(1); expect(mockCancel).toHaveBeenCalledWith("spawt:guet:v2:1");
});
it("does not schedule without an owner or on web", async () => {
  await scheduleGuetPrompt({ row_id: "1", place_id: "p", place_name: "Lieu" });
  mockPlatform = "web"; await scheduleGuetPrompt({ row_id: "1", place_id: "p", place_name: "Lieu", owner_id: "a" });
  expect(mockSchedule).not.toHaveBeenCalled();
});
