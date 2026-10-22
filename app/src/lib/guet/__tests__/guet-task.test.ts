const mockDefine = jest.fn(); const mockNearby = jest.fn();
jest.mock("expo-task-manager", () => ({ defineTask: (...args: unknown[]) => mockDefine(...args) }));
jest.mock("expo-location", () => ({ GeofencingEventType: { Enter: 1, Exit: 2 } }));
jest.mock("../../../store/guet-active", () => ({ useGuetActive: { getState: () => ({ enter: jest.fn(), exit: jest.fn() }) } }));
jest.mock("../guet-nearby", () => ({ handleNearbyEvent: (...args: unknown[]) => mockNearby(...args) }));
it("consumes the real Expo payload with eventType beside region, without a mounted UI", async () => {
  require("../guet-task");
  const task = mockDefine.mock.calls[0][1];
  await task({ data: { eventType: 1, region: { identifier: "p" } } });
  expect(mockNearby).toHaveBeenCalledWith("enter", "p");
  await task({ data: { eventType: 2, region: { identifier: "p" } } });
  expect(mockNearby).toHaveBeenLastCalledWith("exit", "p");
});
