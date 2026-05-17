// Voix du Chat — PRD §9.3
// Le ton du Chat évolue avec la maturité du spawter.
// Strings i18n-extractées via fr.json (Claude amendment 5.6).
//
// Matrice (stade × moment) — décision SILENT volontaire vs PARLE documentée
// dans Story 2.1 §4 Dev Notes. Une entrée vide dans fr.json est traitée comme
// silence par ChatBubble (returnEmptyString: false → t() renvoie la clé,
// ChatBubble teste `text === chatKey(...)` et retourne null).

import type { Stade } from "../types/stade";

export type ChatToneId = Stade;

/** Liste exhaustive des moments où le Chat peut parler — exportée pour les
 *  tests de coverage (chat-voice-coverage.test.ts) afin d'éviter le drift
 *  entre l'union TS et la matrice i18n. */
export const CHAT_MOMENTS = [
  "welcome_first_open",
  "welcome_back",
  "post_calibration",
  "first_spawt_invite",
  "post_first_spawt",
  "stade_up_explorateur",
  "stade_up_detective",
  "stade_up_djidji",
  "stade_up_guide",
  "geoloc_consent_request",
  "demographics_consent_request",
] as const;

/** Clé i18n correspondante à un message du Chat selon le contexte */
export type ChatMoment = (typeof CHAT_MOMENTS)[number];

/** Construit la clé i18n complète pour un moment + un stade */
export function chatKey(moment: ChatMoment, stade: Stade): string {
  return `chat.${stade}.${moment}`;
}

/** Le Chat se tait au stade Guide (PRD §9.3 — silence + animation) */
export function isChatSilent(stade: Stade, moment: ChatMoment): boolean {
  return stade === "guide" && !moment.startsWith("stade_up");
}
