// CR Chunk B m2 — Tests masquage E.164.
//
// Old maskPhone: "+22501020304" → "+225 XX XX 04" (préservait les chiffres
// opérateur 01 — un staff connaissait Orange/MTN/Moov via l'indicatif).
// New maskPhone : "+225 •• •• 04" (masque TOUT sauf indicatif + 2 derniers).

import { describe, expect, it } from "vitest";
import { maskPhone } from "./index";

describe("maskPhone — strict masking (CR m2)", () => {
  it("masque les chiffres opérateur (anti-leak Orange/MTN/Moov)", () => {
    expect(maskPhone("+22501020304")).toBe("+225 •• •• 04");
  });

  it("garde un préfixe jusqu'à 3 chiffres + 2 derniers chiffres (regex greedy)", () => {
    // Note: regex \+\d{1,3} est greedy → toujours 3 digits si dispo.
    // SPAWT V1 = CIV (+225), donc ce comportement est correct pour le cas
    // métier réel. Les tests +33/+1 valident juste le pattern générique.
    expect(maskPhone("+33612345678")).toBe("+336 •• •• 78");
  });

  it("indicatif jusqu'à 3 chiffres (greedy)", () => {
    expect(maskPhone("+15551234567")).toBe("+155 •• •• 67");
  });

  it("retourne tel quel si trop court pour être masqué", () => {
    expect(maskPhone("12345")).toBe("12345");
  });

  it("fallback ••• si format inattendu (pas de +)", () => {
    expect(maskPhone("0102030405")).toBe("••• 05");
  });

  it("string vide retournée intacte", () => {
    expect(maskPhone("")).toBe("");
  });
});
