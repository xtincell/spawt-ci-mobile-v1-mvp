// Catalogue des 13 archétypes — porté depuis le quiz « La Meute »
// (spawt-meute-quiz/public/jeu.html, const ARCHETYPES l.566-593).
//
// Chantier « 13 archétypes » (PRD final §5.5) : remplace le set de 5 du MVP.
// Répartition des données (même logique que titres-catalogue.ts) :
//   - AFFICHABLE à l'écran (nom, épithète, devise, portrait, rareté) → clés
//     i18n dans src/i18n/fr.json section `archetype.*` — jamais de texte dur.
//   - NON affiché tel quel (clé, code SPWT-XX-NNN, paire d'axes) → dans ce
//     module. Le code SPWT est un identifiant produit, pas une string FR.
//   - Paires d'axes : source unique dans archetype-engine.ts (ordre signifiant
//     pour le tri stable) — ce module les référence, ne les duplique pas.
//
// Vocabulaire : les textes du quiz contenant « resto/restaurant » ont été
// alignés sur le lexique SPAWT (spot/table/lieu) dans fr.json — cf. lint:vocab.

import {
  ARCHETYPE_KEYS,
  ARCHETYPE_PAIRS,
  type ArchetypeKey,
  type ArchetypePole,
} from "../lib/archetype-engine";

/** Rareté d'un archétype — valeurs du quiz, affichées via i18n `archetype.rarity.*`. */
export type ArchetypeRarity = "commun" | "rare" | "epique" | "legendaire";

export interface ArchetypeDescriptor {
  key: ArchetypeKey;
  /** Code carte produit (SPWT-XX-NNN) — affiché tel quel, non traduit. */
  code: string;
  rarity: ArchetypeRarity;
  /** Paire d'axes (null pour omnivore) — miroir de archetype-engine. */
  pair: readonly [ArchetypePole, ArchetypePole] | null;
  /** Clé i18n du nom (ex. « Gardien du Maquis »). */
  nameKey: string;
  /** Clé i18n de l'épithète courte (ex. « Habitué »). */
  epithetKey: string;
  /** Clé i18n de la devise / esprit (motto du quiz). */
  mottoKey: string;
  /** Clé i18n du portrait (description longue). */
  portraitKey: string;
  /** Clé de titre pour `collection_titres` (mue / héritage — cf. titres-catalogue). */
  titleKey: string;
}

const PAIR_BY_KEY = new Map(ARCHETYPE_PAIRS.map((p) => [p.key, p.pair]));

function descriptor(
  key: ArchetypeKey,
  code: string,
  rarity: ArchetypeRarity,
): ArchetypeDescriptor {
  return {
    key,
    code,
    rarity,
    pair: PAIR_BY_KEY.get(key as Exclude<ArchetypeKey, "omnivore">) ?? null,
    nameKey: `archetype.${key}.name`,
    epithetKey: `archetype.${key}.epithet`,
    mottoKey: `archetype.${key}.motto`,
    portraitKey: `archetype.${key}.portrait`,
    titleKey: `title.archetype.${key}`,
  };
}

/** Les 13 archétypes complets — codes et raretés fidèles au quiz. */
export const ARCHETYPES: Record<ArchetypeKey, ArchetypeDescriptor> = {
  omnivore: descriptor("omnivore", "SPWT-OM-001", "legendaire"),
  gardien: descriptor("gardien", "SPWT-GA-002", "commun"),
  ancre: descriptor("ancre", "SPWT-AN-003", "commun"),
  bouchedor: descriptor("bouchedor", "SPWT-BO-004", "rare"),
  braise: descriptor("braise", "SPWT-BR-005", "rare"),
  memoire: descriptor("memoire", "SPWT-ME-006", "rare"),
  pisteur: descriptor("pisteur", "SPWT-PI-007", "rare"),
  vent: descriptor("vent", "SPWT-VE-008", "epique"),
  fantome: descriptor("fantome", "SPWT-FA-009", "epique"),
  murmure: descriptor("murmure", "SPWT-MU-010", "legendaire"),
  oeil: descriptor("oeil", "SPWT-OE-011", "epique"),
  lame: descriptor("lame", "SPWT-LA-012", "legendaire"),
  passeport: descriptor("passeport", "SPWT-PA-013", "epique"),
};

/** Clés de titres d'archétype (collection_titres) — pour isKnownTitleKey. */
export const ARCHETYPE_TITLE_KEYS: readonly string[] = ARCHETYPE_KEYS.map(
  (k) => `title.archetype.${k}`,
);

/** Helper : descripteur depuis une clé potentiellement inconnue (DB/réseau). */
export function getArchetype(key: string | null | undefined): ArchetypeDescriptor | null {
  if (!key) return null;
  return (ARCHETYPES as Record<string, ArchetypeDescriptor>)[key] ?? null;
}
