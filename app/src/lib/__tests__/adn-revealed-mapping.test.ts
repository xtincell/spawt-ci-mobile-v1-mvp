// Non-régression : `adn_revealed` doit être DÉRIVÉ de `adn_revealed_at`.
//
// La base stocke une date (cliquet 0059), l'app un booléen. Le schéma Zod porte
// un `.default(false)` — utile quand la colonne manque vraiment (base pas
// encore migrée), mais qui masquait ici une colonne mal nommée : le radar ADN
// n'était révélé sur AUCUNE fiche, sans erreur, sans log, sans test rouge.
//
// La ligne d'entrée est une VRAIE réponse de PostgREST (lieu Kaiten, capturée
// le 29/07/2026) et non une fixture écrite à la main : une fixture reflète ce
// qu'on croit que le serveur envoie, ce qui est précisément ce qui nous a
// trompés.
import { parseRowsForTest } from "../data-source.supabase";
import LIGNE_REELLE from "./fixtures/place-row-live.json";

const avecAdn = (adn: Record<string, unknown>) => ({
  ...LIGNE_REELLE,
  place_adn: { ...(LIGNE_REELLE as { place_adn: object }).place_adn, ...adn },
});

describe("dérivation de adn_revealed", () => {
  it("parse une ligne réelle de PostgREST", () => {
    expect(parseRowsForTest([LIGNE_REELLE])).toHaveLength(1);
  });

  it("révélé quand la base porte une date", () => {
    const [p] = parseRowsForTest([avecAdn({ adn_revealed_at: "2026-07-28T10:00:00.000Z" })]);
    expect(p?.adn.adn_revealed).toBe(true);
  });

  it("non révélé quand la date est nulle", () => {
    const [p] = parseRowsForTest([avecAdn({ adn_revealed_at: null })]);
    expect(p?.adn.adn_revealed).toBe(false);
  });

  it("non révélé quand la colonne est absente (base pas encore migrée)", () => {
    const ligne = avecAdn({});
    delete (ligne.place_adn as Record<string, unknown>).adn_revealed_at;
    const [p] = parseRowsForTest([ligne]);
    expect(p?.adn.adn_revealed).toBe(false);
  });
});
