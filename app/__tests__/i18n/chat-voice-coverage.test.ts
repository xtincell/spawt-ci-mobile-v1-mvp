// Story 2.1 — AC #4 (contract test)
// Filet anti-régression : ajouter un nouveau ChatMoment à l'union TS sans
// entrée correspondante dans fr.json doit faire échouer ce test. Une string
// vide ("") est valide (= silent volontaire). Seule une clé `undefined`
// (manquante dans la structure) échoue.

import fr from "../../src/i18n/fr.json";
import { CHAT_MOMENTS, chatKey } from "../../src/lib/chat-voice";
import { STADES } from "../../src/types/stade";

type ChatBlock = {
  [stade: string]: { [moment: string]: string };
};

function resolve(json: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, json);
}

describe("fr.json — couverture matrice chat.* (Story 2.1)", () => {
  it("expose un bloc `chat.<stade>` pour les 5 stades", () => {
    const chat = (fr as { chat: ChatBlock }).chat;
    for (const stade of STADES) {
      expect(chat).toHaveProperty(stade);
    }
  });

  it("chaque combinaison (stade × moment) résout une string définie (peut être vide)", () => {
    for (const stade of STADES) {
      for (const moment of CHAT_MOMENTS) {
        const key = chatKey(moment, stade);
        const value = resolve(fr, key);
        // peut être "" (silent) mais jamais undefined
        expect(typeof value).toBe("string");
      }
    }
  });

  it("le Touriste a au moins 8 entrées non-vides (gold standard validé Alexandre)", () => {
    const chat = (fr as { chat: ChatBlock }).chat;
    const touriste = chat.touriste ?? {};
    const touristeEntries = Object.values(touriste).filter((v) => v.length > 0);
    expect(touristeEntries.length).toBeGreaterThanOrEqual(8);
  });

  it("chaque stade qui doit parler a au moins une string non-vide (PRD §9.3)", () => {
    // Stades qui doivent au moins exprimer leur ton canonique
    const speakingStades = ["touriste", "explorateur", "detective", "djidji"] as const;
    const chat = (fr as { chat: ChatBlock }).chat;
    for (const stade of speakingStades) {
      const block = chat[stade] ?? {};
      const nonEmpty = Object.values(block).filter((v) => v.length > 0);
      expect(nonEmpty.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("le Guide ne parle qu'au moment stade_up_guide (PRD §9.3 silence)", () => {
    const chat = (fr as { chat: ChatBlock }).chat;
    const guide = chat.guide ?? {};
    for (const [moment, value] of Object.entries(guide)) {
      if (moment === "stade_up_guide") continue;
      expect(value).toBe("");
    }
  });
});
