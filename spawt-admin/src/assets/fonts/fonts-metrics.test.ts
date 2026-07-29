// Garde-fou contre le retour d'une police aux métriques verticales nulles.
//
// Les Gotham TTF du projet ont déjà été livrés avec une table `hhea` à zéro
// (conversion OTF → TTF ratée) : hauteur de ligne nulle dans Blink et Android,
// texte peint mais n'occupant aucun espace, console illisible — sans la
// moindre erreur nulle part. Le piège complet est décrit dans FONTS.md.
//
// Ce test lit les binaires du dossier et échoue si l'un d'eux revient cassé —
// typiquement lors d'un futur remplacement de fonte par un fichier reconverti.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DOSSIER = __dirname;

/** Métriques verticales `hhea` d'une police sfnt (TTF/OTF). */
function metriquesHhea(buf: Buffer): { ascender: number; descender: number } {
  const nbTables = buf.readUInt16BE(4);
  for (let i = 0; i < nbTables; i++) {
    const rec = 12 + 16 * i;
    if (buf.toString("latin1", rec, rec + 4) === "hhea") {
      const offset = buf.readUInt32BE(rec + 8);
      return {
        ascender: buf.readInt16BE(offset + 4),
        descender: buf.readInt16BE(offset + 6),
      };
    }
  }
  throw new Error("table hhea introuvable");
}

describe("polices embarquées — métriques verticales", () => {
  const fichiers = readdirSync(DOSSIER).filter((f) => /\.(ttf|otf)$/i.test(f));

  it("le dossier contient bien les six fontes de la charte", () => {
    expect(fichiers.length).toBeGreaterThanOrEqual(6);
  });

  it.each(fichiers)("%s a une hauteur de ligne exploitable", (fichier) => {
    const { ascender, descender } = metriquesHhea(
      readFileSync(join(DOSSIER, fichier)),
    );
    // Une police saine monte au-dessus de la ligne de base et descend dessous.
    // ascender = descender = 0 ⇒ ligne de 0 px avec `line-height: normal`.
    expect(ascender, `${fichier} : hhea.ascender nul — police reconvertie cassée, voir FONTS.md`).toBeGreaterThan(0);
    expect(descender, `${fichier} : hhea.descender nul — police reconvertie cassée, voir FONTS.md`).toBeLessThan(0);
  });
});
