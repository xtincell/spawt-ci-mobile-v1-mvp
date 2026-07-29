// Chantier 13 archétypes — anti-drift du catalogue (data/archetypes.ts).
// Vérifie : complétude 13, unicité des codes SPWT, présence de TOUTES les
// clés i18n référencées dans fr.json (aucun trou d'affichage possible),
// couverture des assets, intégration titres-catalogue.

import { ARCHETYPES, ARCHETYPE_TITLE_KEYS, getArchetype } from "../../data/archetypes";
import { ARCHETYPE_ASSETS } from "../../data/archetype-assets";
import { ARCHETYPE_KEYS } from "../archetype-engine";
import { isKnownTitleKey } from "../titres-catalogue";
import fr from "../../i18n/fr.json";

/** Résout une clé i18n pointée (ex. `archetype.pisteur.name`) dans fr.json. */
function resolve(key: string): unknown {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[part];
    return undefined;
  }, fr);
}

describe("catalogue des 13 archétypes", () => {
  it("couvre exactement les 13 clés canoniques du moteur", () => {
    expect(Object.keys(ARCHETYPES).sort()).toEqual([...ARCHETYPE_KEYS].sort());
  });

  it("codes SPWT-XX-NNN uniques et bien formés (fidèles au quiz)", () => {
    const codes = Object.values(ARCHETYPES).map((a) => a.code);
    expect(new Set(codes).size).toBe(13);
    for (const code of codes) {
      expect(code).toMatch(/^SPWT-[A-Z]{2}-\d{3}$/);
    }
    // Échantillons épinglés depuis jeu.html (anti-drift).
    expect(ARCHETYPES.omnivore.code).toBe("SPWT-OM-001");
    expect(ARCHETYPES.passeport.code).toBe("SPWT-PA-013");
  });

  it("raretés fidèles au quiz (échantillons épinglés)", () => {
    expect(ARCHETYPES.gardien.rarity).toBe("commun");
    expect(ARCHETYPES.pisteur.rarity).toBe("rare");
    expect(ARCHETYPES.vent.rarity).toBe("epique");
    expect(ARCHETYPES.omnivore.rarity).toBe("legendaire");
    expect(ARCHETYPES.murmure.rarity).toBe("legendaire");
    expect(ARCHETYPES.lame.rarity).toBe("legendaire");
  });

  it("seul omnivore n'a pas de paire d'axes", () => {
    for (const a of Object.values(ARCHETYPES)) {
      if (a.key === "omnivore") expect(a.pair).toBeNull();
      else expect(a.pair).not.toBeNull();
    }
  });

  it("toutes les clés i18n référencées existent dans fr.json (non vides)", () => {
    for (const a of Object.values(ARCHETYPES)) {
      for (const key of [a.nameKey, a.epithetKey, a.mottoKey, a.portraitKey, a.titleKey]) {
        const value = resolve(key);
        expect(typeof value).toBe("string");
        expect((value as string).length).toBeGreaterThan(0);
      }
    }
    // Les 4 labels de rareté aussi.
    for (const rarity of ["commun", "rare", "epique", "legendaire"]) {
      expect(typeof resolve(`archetype.rarity.${rarity}`)).toBe("string");
    }
  });

  it("un asset visuel embarqué par archétype (13/13)", () => {
    for (const key of ARCHETYPE_KEYS) {
      expect(ARCHETYPE_ASSETS[key]).toBeDefined();
    }
  });

  it("les 13 clés de titre sont connues du catalogue de titres", () => {
    expect(ARCHETYPE_TITLE_KEYS).toHaveLength(13);
    for (const titleKey of ARCHETYPE_TITLE_KEYS) {
      expect(isKnownTitleKey(titleKey)).toBe(true);
    }
    // Les clés hors catalogue restent rejetées.
    expect(isKnownTitleKey("title.archetype.licorne")).toBe(false);
  });

  it("getArchetype tolère null / clé inconnue", () => {
    expect(getArchetype(null)).toBeNull();
    expect(getArchetype("licorne")).toBeNull();
    expect(getArchetype("pisteur")?.code).toBe("SPWT-PI-007");
  });
});
