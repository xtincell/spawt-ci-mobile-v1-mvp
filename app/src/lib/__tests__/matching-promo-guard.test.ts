// Test-garde du Contrat SPAWT (migration 0050) — assertion STATIQUE sur les
// sources : une promotion est un AFFICHAGE ÉTIQUETÉ, elle n'entre JAMAIS dans
// le score de matching ni dans la note d'un lieu. Un lieu ne peut pas acheter
// sa visibilité algorithmique — les avis appartiennent à la Meute.
//
// Si ce test casse, ce n'est pas le test qu'il faut changer : c'est le code
// qui vient de violer le Contrat (poids promo dans matching.ts, import des
// promos dans weighted-rating.ts…). Toute exception exige une décision
// produit explicite + mise à jour de la migration 0050.

import * as fs from "node:fs";
import * as path from "node:path";

const LIB_DIR = path.resolve(__dirname, "..");

/** Source SANS commentaires — un commentaire qui MENTIONNE le Contrat est
 *  légitime, seul le code exécutable est audité. */
function loadStrippedSource(file: string): string {
  const src = fs.readFileSync(path.join(LIB_DIR, file), "utf-8");
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

// Identifiants interdits dans les moteurs de score : tout ce qui touche aux
// promotions/événements (tables 0049/0050, types, adaptateur, fixtures).
const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /promo/i, // PlacePromotion, place_promotions, has_promo, promoBonus…
  /place_events?/i,
  /place-activity/, // le module types/helpers des événements & promos
  /listPlaceActivity/,
  /listUpcomingEvents/,
];

describe.each(["matching.ts", "weighted-rating.ts"])(
  "Contrat SPAWT — %s n'importe RIEN des promotions/événements",
  (file) => {
    const source = loadStrippedSource(file);

    it.each(FORBIDDEN_PATTERNS.map((p) => [String(p), p] as const))(
      "aucune occurrence de %s dans le code exécutable",
      (_label, pattern) => {
        expect(source).not.toMatch(pattern);
      },
    );

    it("n'importe pas l'adaptateur data-source (moteur pur, sans I/O)", () => {
      expect(source).not.toMatch(/from\s+["'][^"']*data-source/);
    });
  },
);

describe("Contrat SPAWT — le schéma des promos ne fuit pas vers l'ADN", () => {
  it("la migration 0050 ne touche ni place_adn ni les notes (garde documentaire)", () => {
    const sql = fs.readFileSync(
      path.resolve(__dirname, "../../../../supabase/migrations/0050_create_place_promotions.sql"),
      "utf-8",
    );
    // Pas de trigger/écriture vers place_adn ni weighted_rating : le contrat
    // est garanti par construction côté DB aussi.
    const stripped = sql
      .split("\n")
      .filter((line) => !/^\s*--/.test(line))
      .join("\n");
    expect(stripped).not.toMatch(/place_adn/i);
    expect(stripped).not.toMatch(/weighted_rating/i);
  });
});
