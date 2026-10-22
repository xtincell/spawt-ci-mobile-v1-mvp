module.exports = function (api) {
  // Détermine la plateforme via api.caller — invalide automatiquement le cache
  // par plateforme (le plugin import.meta ne doit s'appliquer qu'au bundle web).
  // Fallback `"unknown"` : jest, eslint, et d'autres tools peuvent ne pas
  // passer de caller.platform — sans fallback la clé de cache devient
  // `undefined` et Babel mélange les transforms natif/web/jest.
  const platform =
    api.caller((caller) => caller && caller.platform) ?? "unknown";
  api.cache.using(() => platform);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "react" }]],
    plugins: [
      // Les polyfills Intl utilisent des blocs statiques. Expo les transforme
      // pour Hermes ; cette entrée couvre aussi les tests Node et le web.
      ["@babel/plugin-transform-class-static-block", { loose: true }],
      ...(api.env("test") ? ["./scripts/babel-jest-dynamic-import.cjs"] : []),
      // Transpile `import.meta` en polyfill — nécessaire pour le bundle web Expo
      // SDK 55 qui émet `import.meta` dans un <script> classique (sans
      // type="module"), provoquant SyntaxError dans le navigateur. No-op sur natif.
      ...(platform === "web" ? ["babel-plugin-transform-import-meta"] : []),
      "react-native-reanimated/plugin",
    ],
  };
};
