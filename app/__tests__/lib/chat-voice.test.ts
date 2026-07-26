// Story 2.1 — AC #4 (étendu Story 3.3c : ajout moment `home_edito`).
// Story 3.5 — ajout moment `search_suggestions` (chat-voice élargi à l'écran search).
// Moteur pur `lib/chat-voice.ts` : cible #1 des tests unit per project-context.md
// §Testing Rules. Zéro I/O, 5 × 13 = 65 combinaisons.

import { CHAT_MOMENTS, chatKey, isChatSilent, type ChatMoment } from "../../src/lib/chat-voice";
import { STADES, type Stade } from "../../src/types/stade";

describe("chatKey", () => {
  it("retourne `chat.<stade>.<moment>` pour les 5 × 13 = 65 combinaisons", () => {
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
    // 11 moments non-stade_up : welcome_first_open, welcome_back,
    // post_calibration, first_spawt_invite, post_first_spawt,
    // geoloc_consent_request, demographics_consent_request, home_edito,
    // search_suggestions, guet_prompt, archetype_mue.
    // Story 3.3c — `home_edito` ajouté pour le HomeD édito Chat.
    // Story 3.5 — `search_suggestions` ajouté pour l'écran de recherche vide.
    // Story 4.2 — `guet_prompt` ajouté pour la notif post-spawt (V1 body neutre).
    // Chantier 13 archétypes — `archetype_mue` (constat neutre, PRD §5.5).
    // Assertion stricte : la suppression accidentelle d'un moment doit faire
    // échouer ce test (review finding P1 — 2026-05-17).
    expect(nonStadeUpMoments).toHaveLength(11);
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
  it("expose 15 moments (filet anti-régression — ajouter un moment doit casser ici + les tests i18n)", () => {
    expect(CHAT_MOMENTS).toHaveLength(15);
  });
});
