const mockQueueResume = jest.fn();
const mockSavedResume = jest.fn(async () => undefined);
const mockUnsubscribe = jest.fn();
let mockNetworkEvent: (state: { isConnected: boolean }) => void;
jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    addEventListener: (cb: typeof mockNetworkEvent) => { mockNetworkEvent = cb; return mockUnsubscribe; },
    fetch: async () => ({ isConnected: true }),
  },
}));
jest.mock("../data-source", () => ({ isSupabaseConfigured: true }));
jest.mock("../offline-queue", () => ({
  setSyncBackend: jest.fn(),
  initOfflineQueue: (options: { subscribe: (cb: () => void) => () => void }) => options.subscribe(mockQueueResume),
}));
jest.mock("../../store/spawter-store", () => ({ useSpawterStore: { getState: () => ({ refreshSaved: mockSavedResume }) } }));
import { bootOfflineQueue, shutdownOfflineQueue } from "../offline-queue-init";
it("le même retour réseau reprend les favoris et les spawts, sans rappel sur un état inchangé", async () => {
  await bootOfflineQueue();
  mockNetworkEvent({ isConnected: true });
  expect(mockSavedResume).not.toHaveBeenCalled();
  mockNetworkEvent({ isConnected: false });
  mockNetworkEvent({ isConnected: true });
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect(mockQueueResume).toHaveBeenCalledTimes(1);
  expect(mockSavedResume).toHaveBeenCalledTimes(1);
  mockNetworkEvent({ isConnected: true });
  expect(mockSavedResume).toHaveBeenCalledTimes(1);
  shutdownOfflineQueue();
  expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
});
