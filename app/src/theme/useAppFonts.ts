// Chargement des polices SPAWT canoniques (Klinsman + Gotham) via expo-font.
// iOS résout fontFamily par nom PostScript exact (pas famille + poids) — d'où
// une clé par fichier, alignée sur les noms PostScript consommés dans
// `tokens.ts` → `typography.preset.*`. Si une police échoue, l'app démarre
// quand même : RN tombe sur la fallback système (San Francisco / Roboto).

import { useEffect, useRef, useState } from "react";
import { useFonts } from "expo-font";

// Garde-fou contre un splash infini si `useFonts` ne résout ni `loaded` ni
// `error` (cas observé sur RAM bas / Fast Refresh agressif). Après ce délai,
// on force `fontsLoaded=true` côté splash gate : l'app démarre en fallback
// système plutôt que de bloquer l'utilisateur sur le splash natif.
const FONTS_TIMEOUT_MS = 8000;

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

  const [timedOut, setTimedOut] = useState(false);
  const timerStarted = useRef(false);

  // Démarre le timer **une seule fois** au premier render. `fontError` retourné
  // par `useFonts` peut avoir une identité instable entre renders ; le mettre
  // dans `useEffect` deps recrée le setTimeout et empêche les 8s d'expirer.
  // Booleans stables → deps stables.
  useEffect(() => {
    if (timerStarted.current) return;
    if (fontsLoaded || fontError) return;
    timerStarted.current = true;
    const id = setTimeout(() => {
      if (__DEV__) {
        console.warn(
          `[fonts] timeout après ${FONTS_TIMEOUT_MS}ms — démarrage en fallback système`,
        );
      }
      setTimedOut(true);
    }, FONTS_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [fontsLoaded, !!fontError]);

  if (__DEV__ && fontError) {
    // Log dev-only : pas une string UI utilisateur (pas i18n).
    console.warn("[fonts] load failed", fontError);
  }

  return { fontsLoaded: fontsLoaded || timedOut, fontError };
}
