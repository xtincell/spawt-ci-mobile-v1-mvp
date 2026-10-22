jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

it("résout les pluriels français lorsque Hermes ne fournit pas les API Intl", async () => {
  const keys = ["PluralRules", "Locale", "getCanonicalLocales"] as const;
  const originals = keys.map(key => Object.getOwnPropertyDescriptor(Intl, key));
  for (const key of keys) Reflect.deleteProperty(Intl, key);
  try {
    jest.resetModules();
    const { default: i18n } = await import("../index");
    if (!i18n.isInitialized) await new Promise<void>(resolve => i18n.on("initialized", () => resolve()));
    expect(i18n.t("a11y.stars", { count: 4.3, max: 5 })).toBe("4.3 étoiles sur 5");
    expect(i18n.t("a11y.stars", { count: 1, max: 5 })).toBe("1 étoile sur 5");
    expect(i18n.t("explore.items_count", { count: 2 })).toBe("2 adresses");
  } finally {
    keys.forEach((key, index) => {
      const descriptor = originals[index];
      if (descriptor) Object.defineProperty(Intl, key, descriptor);
    });
  }
});
