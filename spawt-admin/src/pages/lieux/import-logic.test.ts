import { describe, expect, it } from "vitest";

import { analyser, gabaritCsv, normaliserEntete, normaliserTelephone } from "./import-logic";

const ligneOk = {
  nom: "Kaiten",
  cuisine: "asiatique",
  lat: "5.2962",
  lng: "-3.9948",
  adresse: "Rue du Docteur Blanchard",
  quartier: "Zone 4",
  ville: "Abidjan",
  gamme: "3",
  ticket_moyen: "16750",
  telephone: "27 21 25 44 61",
  whatsapp: "",
  publie: "oui",
};

describe("normaliserEntete", () => {
  it("rend équivalents les en-têtes tapés à la main", () => {
    // Un opérateur qui écrit « Ticket moyen (F CFA) » ne doit pas voir sa
    // colonne ignorée à cause d'un espace ou d'une parenthèse.
    expect(normaliserEntete("Ticket moyen (F CFA)")).toBe("ticketmoyenfcfa");
    expect(normaliserEntete("QUARTIER")).toBe("quartier");
    expect(normaliserEntete("Téléphone")).toBe("telephone");
    expect(normaliserEntete("  Publié  ")).toBe("publie");
  });
});

describe("normaliserTelephone", () => {
  it("accepte les écritures courantes du terrain", () => {
    expect(normaliserTelephone("07 07 70 10 10")).toBe("+2250707701010");
    expect(normaliserTelephone("+225 07 08 31 70 60")).toBe("+2250708317060");
    expect(normaliserTelephone("0022527212544")).toBe("+22527212544");
  });

  it("renvoie null plutôt que d'inventer un numéro", () => {
    // Un numéro faux est pire qu'un champ vide : un Spawter appellera.
    expect(normaliserTelephone("à demander")).toBeNull();
    expect(normaliserTelephone("")).toBeNull();
    expect(normaliserTelephone("123")).toBeNull();
  });
});

describe("analyser", () => {
  it("accepte une ligne complète et normalise ses champs", () => {
    const r = analyser([ligneOk]);
    expect(r.erreurs).toEqual([]);
    expect(r.valides).toHaveLength(1);
    expect(r.valides[0]).toMatchObject({
      name: "Kaiten",
      cuisine: ["asiatique"],
      lat: 5.2962,
      lng: -3.9948,
      price_tier: 3,
      avg_ticket_xof: 16750,
      phone: "+2252721254461", // « 27 21 25 44 61 » recollé en E.164
      is_published: true,
    });
  });

  it("lit les nombres au format tableur francophone", () => {
    const r = analyser([{ ...ligneOk, lat: "5,2962", ticket_moyen: "16 750" }]);
    expect(r.erreurs).toEqual([]);
    expect(r.valides[0]?.lat).toBe(5.2962);
    expect(r.valides[0]?.avg_ticket_xof).toBe(16750);
  });

  it("numérote les erreurs comme le tableur, en-tête comprise", () => {
    // L'opérateur corrige dans Excel : le numéro doit correspondre à ce
    // qu'il voit, sinon il cherche la mauvaise ligne.
    const r = analyser([ligneOk, { ...ligneOk, nom: "", quartier: "" }]);
    expect(r.erreurs).toHaveLength(1);
    expect(r.erreurs[0]?.ligne).toBe(3);
    expect(r.erreurs[0]?.erreurs).toContain("le nom est vide");
    expect(r.erreurs[0]?.erreurs).toContain("le quartier est vide");
  });

  it("refuse une cuisine hors liste en disant lesquelles sont admises", () => {
    const r = analyser([{ ...ligneOk, cuisine: "mexicaine" }]);
    expect(r.valides).toHaveLength(0);
    expect(r.erreurs[0]?.erreurs.join(" ")).toContain("cuisine inconnue");
    expect(r.erreurs[0]?.erreurs.join(" ")).toContain("ivoirienne");
  });

  it("accepte plusieurs cuisines séparées par virgule, point-virgule ou barre", () => {
    const r = analyser([{ ...ligneOk, cuisine: "francaise ; fusion" }]);
    expect(r.erreurs).toEqual([]);
    expect(r.valides[0]?.cuisine).toEqual(["francaise", "fusion"]);
  });

  it("attrape un doublon interne au fichier et pointe la première ligne", () => {
    const r = analyser([ligneOk, { ...ligneOk }]);
    expect(r.valides).toHaveLength(1);
    expect(r.erreurs[0]?.erreurs.join(" ")).toContain("doublon de la ligne 2");
  });

  it("ne rejette pas un lieu excentré — Assinie doit passer", () => {
    // La Edge Function seed-inventory bornait à lng ≥ -4.3 / ≤ -3.7 et
    // rejetait Assinie (-3.435), pourtant dans la cible Mission 1.
    const r = analyser([{ ...ligneOk, nom: "Assinie Spot", lat: "5.1350", lng: "-3.4350" }]);
    expect(r.erreurs).toEqual([]);
    expect(r.valides[0]?.lng).toBe(-3.435);
  });

  it("refuse en revanche des coordonnées absurdes", () => {
    const r = analyser([{ ...ligneOk, lat: "95", lng: "abc" }]);
    expect(r.valides).toHaveLength(0);
    const msg = r.erreurs[0]?.erreurs.join(" ") ?? "";
    expect(msg).toContain("latitude hors bornes");
    expect(msg).toContain("longitude absente ou illisible");
  });

  it("signale les colonnes qu'il ne sait pas lire au lieu de les avaler", () => {
    const r = analyser([{ ...ligneOk, "Note interne": "à rappeler" }]);
    expect(r.valides).toHaveLength(1);
    expect(r.colonnesIgnorees).toContain("Note interne");
  });

  it("comprend les façons d'écrire oui/non", () => {
    expect(analyser([{ ...ligneOk, publie: "OUI" }]).valides[0]?.is_published).toBe(true);
    expect(analyser([{ ...ligneOk, publie: "non" }]).valides[0]?.is_published).toBe(false);
    expect(analyser([{ ...ligneOk, publie: "1" }]).valides[0]?.is_published).toBe(true);
    expect(analyser([{ ...ligneOk, publie: "peut-être" }]).erreurs).toHaveLength(1);
  });

  it("ne jette jamais, même sur un fichier vide ou aberrant", () => {
    expect(() => analyser([])).not.toThrow();
    expect(() => analyser([{}])).not.toThrow();
    expect(analyser([{}]).erreurs).toHaveLength(1);
  });
});

describe("gabaritCsv", () => {
  it("se relit lui-même sans erreur — le gabarit ne doit jamais être invalide", () => {
    const lignes = gabaritCsv().split("\n");
    const entetes = lignes[0]!.split(",");
    const parseLigne = (l: string) => {
      // Découpage simple respectant les guillemets, suffisant pour le gabarit.
      const out: string[] = [];
      let cur = "";
      let dansGuillemets = false;
      for (const ch of l) {
        if (ch === '"') dansGuillemets = !dansGuillemets;
        else if (ch === "," && !dansGuillemets) {
          out.push(cur);
          cur = "";
        } else cur += ch;
      }
      out.push(cur);
      return Object.fromEntries(entetes.map((h, i) => [h, out[i] ?? ""]));
    };
    const r = analyser(lignes.slice(1).map(parseLigne));
    expect(r.erreurs).toEqual([]);
    expect(r.valides).toHaveLength(2);
  });
});
