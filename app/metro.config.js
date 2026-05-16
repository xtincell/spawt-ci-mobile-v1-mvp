// Metro config — overrides Expo defaults uniquement quand strictement nécessaire.
//
// Pourquoi : Expo SDK 55 web bundle exécute le JS dans un <script defer>
// classique (sans type="module"). Plusieurs paquets ESM modernes (zustand@^4.4)
// référencent `import.meta.env.MODE` pour leur warning dev ; en non-module,
// c'est une SyntaxError fatale. La fix la moins invasive : intercepter la
// résolution Metro pour `zustand` sur la plateforme web et forcer le build CJS
// (qui n'utilise pas `import.meta`).
// No-op sur natif : zustand utilise déjà `exports["react-native"]` (CJS) là.

const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Mapping explicite zustand sub-exports → fichier CJS. zustand v4 expose ces
// 4 entry points ; tout ajout futur (`zustand/persist`, etc.) doit être listé
// ici sinon le sub-import fallthrough vers ESM et casse le bundle web.
const ZUSTAND_CJS = {
  zustand: "node_modules/zustand/index.js",
  "zustand/middleware": "node_modules/zustand/middleware.js",
  "zustand/shallow": "node_modules/zustand/shallow.js",
  "zustand/vanilla": "node_modules/zustand/vanilla.js",
  "zustand/traditional": "node_modules/zustand/traditional.js",
};

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && Object.hasOwn(ZUSTAND_CJS, moduleName)) {
    return {
      type: "sourceFile",
      filePath: path.resolve(__dirname, ZUSTAND_CJS[moduleName]),
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
