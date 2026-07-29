import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles/fonts.css";
import "./styles/layout.css";

// Empreinte du build, écrite dans la console du navigateur au démarrage.
//
// Pourquoi : quand la console s'affiche mal chez quelqu'un, la première
// question est « quelle version tourne réellement dans TON navigateur ? ».
// Sans réponse, on répare à l'aveugle — un cache abîmé et un bug de code
// donnent le même symptôme. Cette ligne rend la question triviale : F12,
// onglet Console, on lit.
//
// `BUILD_STAMP` doit changer à chaque livraison : c'est aussi ce qui garantit
// de nouvelles empreintes de fichiers pour `index-*.js` / `index-*.css`, donc
// des URL qu'aucun cache existant ne peut servir.
const BUILD_STAMP = "2026-07-29-c";
// eslint-disable-next-line no-console
console.info(
  `%cSPAWT admin%c build ${BUILD_STAMP} — backend ${import.meta.env.VITE_SUPABASE_URL ?? "(non configuré)"}`,
  "font-weight:bold",
  "font-weight:normal",
);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
