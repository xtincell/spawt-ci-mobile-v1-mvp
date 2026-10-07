it("un import différé CommonJS garde son export par défaut sous Jest", async () => {
  const { default: storage } = await import("@react-native-async-storage/async-storage");
  expect(typeof storage?.getItem).toBe("function");
  const key = "spawt:test:dynamic-import";
  await storage.setItem(key, "conservé");
  expect(await storage.getItem(key)).toBe("conservé");
  await storage.removeItem(key);
});
