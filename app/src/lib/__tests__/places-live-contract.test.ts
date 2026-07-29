// Contrat entre la BASE RÉELLE et l'app — le test qui manquait le jour où un
// APK est parti vide.
//
// Les fixtures de ce fichier ne sont pas écrites à la main : ce sont les 10
// lieux publiés, capturés tels que PostgREST les rend (29/07/2026). C'est la
// différence qui compte. Une fixture écrite à la main décrit ce qu'on CROIT que
// le serveur envoie — et c'est exactement cette croyance qui était fausse.
//
// Ce que ce test aurait attrapé, et qu'aucun autre n'attrapait :
//   `places.hours` était seedé avec des clés de jours en français et des
//   créneaux en couples de chaînes (`{"lun": [["11:00","15:00"]]}`), là où le
//   schéma attend `{"mon": [{"open":"11:00","close":"15:00"}]}`. La validation
//   Zod rejetait alors le LIEU ENTIER — pas le champ. `listPlaces()` renvoyait
//   une liste vide, donc feed vide, bouton central vide, recherche vide.
//   Et en silence : le rejet n'est journalisé que sous `__DEV__`, jamais dans
//   un binaire distribué. Corrigé par la migration 0065.
//
// Quand la base change de forme, ce test devient rouge AVANT le build.
// Rafraîchir la fixture :
//   curl "$SUPABASE_URL/rest/v1/places?is_published=eq.true&city_code=eq.abidjan\
//     &select=*,place_adn(*)" -H "apikey: $ANON" > fixtures/places-live.json

import { parseRowsForTest } from "../data-source.supabase";
import { NEARBY_RADIUS_KM, listNearbyPlaces } from "../nearby-places";
import LIEUX_LIVE from "./fixtures/places-live.json";

const LIGNES = LIEUX_LIVE as unknown[];

/** Riviera 2, à quelques centaines de mètres de Texas Grillz. */
const MOI = { lat: 5.3536, lng: -3.9868 };

describe("contrat base réelle ↔ app", () => {
  it("la fixture porte bien les 10 lieux publiés", () => {
    expect(LIGNES.length).toBe(10);
  });

  it("AUCUN lieu réel n'est rejeté par la validation", () => {
    const parses = parseRowsForTest(LIGNES);
    // L'assertion porte sur le compte exact, pas sur « au moins un » : un seul
    // lieu qui tombe est un lieu qui disparaît de l'app sans que rien ne le dise.
    expect(parses).toHaveLength(LIGNES.length);
  });

  it("les horaires sont au format canonique (mon…sun + {open, close})", () => {
    const [p] = parseRowsForTest(LIGNES);
    const jours = Object.keys(p!.hours);
    expect(jours.length).toBeGreaterThan(0);
    for (const j of jours) {
      expect(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]).toContain(j);
    }
    const creneaux = Object.values(p!.hours).flat();
    for (const c of creneaux) {
      expect(c).toHaveProperty("open");
      expect(c).toHaveProperty("close");
    }
  });

  it("depuis la Riviera, le bouton central trouve des spots dans les 2 km", () => {
    // Le symptôme qui a mis la puce à l'oreille : « Aucun spot connu dans les
    // 2 km autour de toi », debout à 250 m d'un lieu publié.
    const proches = listNearbyPlaces(parseRowsForTest(LIGNES), MOI.lat, MOI.lng);
    expect(proches.length).toBeGreaterThan(0);
    expect(proches[0]!.distance_km).toBeLessThanOrEqual(NEARBY_RADIUS_KM);
  });

  it("chaque lieu porte de quoi s'afficher : nom, position, quartier", () => {
    for (const p of parseRowsForTest(LIGNES)) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(Number.isFinite(p.location.lat)).toBe(true);
      expect(Number.isFinite(p.location.lng)).toBe(true);
      expect(p.location.neighborhood.length).toBeGreaterThan(0);
    }
  });
});
