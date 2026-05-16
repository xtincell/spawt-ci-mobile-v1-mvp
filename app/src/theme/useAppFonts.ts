// Chargement des polices SPAWT canoniques (Klinsman + Gotham) via expo-font.
// iOS résout fontFamily par nom PostScript exact (pas famille + poids) — d'où
// une clé par fichier, alignée sur les noms PostScript consommés dans
// `tokens.ts` → `typography.preset.*`. Si une police échoue, l'app démarre
// quand même : RN tombe sur la fallback système (San Francisco / Roboto).

import { useFonts } from "expo-font";

// Les clés correspondent EXACTEMENT au nom PostScript embarqué dans chaque
// fichier (vérifié via lecture de la table `name` OpenType, nameID=6) :
// - Klinsman-*.otf  embarquent `KlinsmanTypeface{Light,Regular,Bold}`
// - Gotham-*.ttf    embarquent `Gotham-{Book,Medium,Bold}`
// iOS résout fontFamily par nom PostScript ; aligner la clé sur le nom PostScript
// court-circuite la couche d'alias d'expo-font et garantit la résolution
// y compris si l'alias runtime devait échouer (race condition, Fast Refresh, etc.).
export function useAppFonts(): { fontsLoaded: boolean; fontError: Error | null } {
  const [fontsLoaded, fontError] = useFonts({
    KlinsmanTypefaceLight: require("./fonts/Klinsman-Light.otf"),
    KlinsmanTypefaceRegular: require("./fonts/Klinsman-Regular.otf"),
    KlinsmanTypefaceBold: require("./fonts/Klinsman-Bold.otf"),
    "Gotham-Book": require("./fonts/Gotham-Book.ttf"),
    "Gotham-Medium": require("./fonts/Gotham-Medium.ttf"),
    "Gotham-Bold": require("./fonts/Gotham-Bold.ttf"),
  });

  if (__DEV__ && fontError) {
    // Log dev-only : pas une string UI utilisateur (pas i18n).
    console.warn("[fonts] load failed", fontError);
  }

  return { fontsLoaded, fontError };
}
