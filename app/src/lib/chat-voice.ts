// Voix du Chat — PRD §9.3
// Le ton du Chat évolue avec la maturité du spawter.
// Strings i18n-extractées via fr.json (Claude amendment 5.6).

import type { Stade } from "../types/stade";

export type ChatToneId = Stade;

/** Clé i18n correspondante à un message du Chat selon le contexte */
export type ChatMoment =
  | "welcome_first_open"
  | "welcome_back"
  | "post_calibration"
  | "first_spawt_invite"
  | "post_first_spawt"
  | "stade_up_explorateur"
  | "stade_up_detective"
  | "stade_up_djidji"
  | "stade_up_guide"
  | "geoloc_consent_request"
  | "demographics_consent_request";

/** Construit la clé i18n complète pour un moment + un stade */
export function chatKey(moment: ChatMoment, stade: Stade): string {
  return `chat.${stade}.${moment}`;
}

/** Le Chat se tait au stade Guide (PRD §9.3 — silence + animation) */
export function isChatSilent(stade: Stade, moment: ChatMoment): boolean {
  return stade === "guide" && !moment.startsWith("stade_up");
}
