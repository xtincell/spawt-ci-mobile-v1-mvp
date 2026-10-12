let mockPlatform = "web";
const mockSetCategory = jest.fn();
jest.mock("react-native", () => ({ Platform: { get OS() { return mockPlatform; } } }));
jest.mock("expo-notifications", () => ({
  setNotificationCategoryAsync: (...args: unknown[]) => mockSetCategory(...args),
}));

function freshSetup(): () => Promise<void> {
  let setup!: () => Promise<void>;
  jest.isolateModules(() => { setup = require("../guet-notifications").setupGuetCategories; });
  return setup;
}

beforeEach(() => { mockSetCategory.mockReset().mockResolvedValue(undefined); });

it("n'appelle pas l'API native de catégories sur le web", async () => {
  mockPlatform = "web";
  await freshSetup()();
  expect(mockSetCategory).not.toHaveBeenCalled();
});

it.each(["ios", "android"])("enregistre les actions une seule fois sur %s", async (platform) => {
  mockPlatform = platform;
  const setup = freshSetup();
  await setup();
  await setup();
  expect(mockSetCategory).toHaveBeenCalledTimes(1);
  expect(mockSetCategory).toHaveBeenCalledWith("guet-prompt", [
    { identifier: "confirm", buttonTitle: "Confirmer", options: { opensAppToForeground: true } },
    { identifier: "snooze", buttonTitle: "Snooze 15min", options: { opensAppToForeground: false } },
  ]);
});
