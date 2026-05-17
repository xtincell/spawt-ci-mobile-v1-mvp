// Story 2.1 — AC #4
// Moteur pur `lib/chat-voice.ts` : cible #1 des tests unit per project-context.md
// §Testing Rules. Zéro I/O, 5 × 11 = 55 combinaisons.

import { CHAT_MOMENTS, chatKey, isChatSilent, type ChatMoment } from "../../src/lib/chat-voice";
import { STADES, type Stade } from "../../src/types/stade";

describe("chatKey", () => {
  it("retourne `chat.<stade>.<moment>` pour les 5 × 11 = 55 combinaisons", () => {
    for (const stade of STADES) {
      for (const moment of CHAT_MOMENTS) {
        expect(chatKey(moment, stade)).toBe(`chat.${stade}.${moment}`);
      }
    }
  });

  it("préserve la signature : moment d'abord, stade ensuite", () => {
    expect(chatKey("welcome_back", "touriste")).toBe("chat.touriste.welcome_back");
    expect(chatKey("stade_up_guide", "djidji")).toBe("chat.djidji.stade_up_guide");
  });
});

describe("isChatSilent", () => {
  it("retourne true pour tous les moments non-stade_up quand stade=guide", () => {
    const nonStadeUpMoments: ChatMoment[] = CHAT_MOMENTS.filter(
      (m) => !m.startsWith("stade_up"),
    );
    for (const moment of nonStadeUpMoments) {
      expect(isChatSilent("guide", moment)).toBe(true);
    }
    // 7 moments non-stade_up : welcome_first_open, welcome_back,
    // post_calibration, first_spawt_invite, post_first_spawt,
    // geoloc_consent_request, demographics_consent_request.
    // Assertion stricte : la suppression accidentelle d'un moment doit faire
    // échouer ce test (review finding P1 — 2026-05-17).
    expect(nonStadeUpMoments).toHaveLength(7);
  });

  it("retourne false pour tous les moments stade_up_*, quel que soit le stade", () => {
    const stadeUpMoments: ChatMoment[] = CHAT_MOMENTS.filter((m) =>
      m.startsWith("stade_up"),
    );
    for (const stade of STADES) {
      for (const moment of stadeUpMoments) {
        expect(isChatSilent(stade, moment)).toBe(false);
      }
    }
  });

  it("retourne false pour tous les (stade !== guide, moment)", () => {
    const nonGuideStades: Stade[] = STADES.filter((s) => s !== "guide");
    for (const stade of nonGuideStades) {
      for (const moment of CHAT_MOMENTS) {
        expect(isChatSilent(stade, moment)).toBe(false);
      }
    }
  });
});

describe("CHAT_MOMENTS", () => {
  it("expose 11 moments (filet anti-régression — ajouter un moment doit casser ici + les tests i18n)", () => {
    expect(CHAT_MOMENTS).toHaveLength(11);
  });
});
