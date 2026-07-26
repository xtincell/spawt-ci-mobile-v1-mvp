// Visuels des 13 archétypes — copiés depuis le quiz « La Meute »
// (spawt-meute-quiz/public/assets/archetypes/<key>.webp, ~1,4 Mo au total,
// sous le budget ~3 Mo du chantier — variantes uniques, pas de HD).
//
// Pattern RN/Metro : les require() doivent être des LITTÉRAUX statiques
// (même contrainte que les poses Moka dans brand/CatMark.tsx) — pas de
// require dynamique par template string.

import type { ImageSourcePropType } from "react-native";
import type { ArchetypeKey } from "../lib/archetype-engine";

/** Map clé archétype → asset embarqué (webp supporté nativement iOS/Android). */
export const ARCHETYPE_ASSETS: Record<ArchetypeKey, ImageSourcePropType> = {
  omnivore: require("../../assets/archetypes/omnivore.webp"),
  gardien: require("../../assets/archetypes/gardien.webp"),
  ancre: require("../../assets/archetypes/ancre.webp"),
  bouchedor: require("../../assets/archetypes/bouchedor.webp"),
  braise: require("../../assets/archetypes/braise.webp"),
  memoire: require("../../assets/archetypes/memoire.webp"),
  pisteur: require("../../assets/archetypes/pisteur.webp"),
  vent: require("../../assets/archetypes/vent.webp"),
  fantome: require("../../assets/archetypes/fantome.webp"),
  murmure: require("../../assets/archetypes/murmure.webp"),
  oeil: require("../../assets/archetypes/oeil.webp"),
  lame: require("../../assets/archetypes/lame.webp"),
  passeport: require("../../assets/archetypes/passeport.webp"),
};
