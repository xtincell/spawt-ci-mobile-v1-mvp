// i18n setup — Claude amendment 5.6 (cahier des charges Sprint 1)
// Toutes les strings de l'app passent par i18next. Aucune string FR
// hardcodée hors de fr.json. Lint check : `npm run i18n:check`.
//
// EN sera ajouté en sprint dédié (multi-villes V2 / Lagos).

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";

import fr from "./fr.json";

void i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  resources: {
    fr: { translation: fr },
  },
  lng: getLocales()[0]?.languageCode ?? "fr",
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

export default i18n;
