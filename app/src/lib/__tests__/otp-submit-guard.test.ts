// Le scénario qu'aucun test ne rejouait : le MÊME code envoyé deux fois.
//
// Sur la base réelle, chaque tentative de connexion laissait une seule ligne
// `otp_attempts`, validée une seule fois — et la personne voyait quand même
// « Aucun code en cours pour ce numéro ». La première requête consommait l'OTP
// et ouvrait la session ; la seconde, partie parce que l'effet d'auto-envoi se
// rejouait quand le verrou retombait, ne trouvait plus rien et affichait son
// erreur par-dessus le succès.
//
// Ces tests décrivent le cycle de vie complet d'une saisie, dans l'ordre où il
// se produit à l'écran.

import { doitEnvoyerLeCode, type EtatEnvoiCode } from "../otp-submit-guard";

const etat = (p: Partial<EtatEnvoiCode> = {}): EtatEnvoiCode => ({
  complet: true,
  friction: false,
  enCours: false,
  code: "123456",
  codeDejaTente: null,
  ...p,
});

describe("envoi automatique du code", () => {
  it("part quand les 6 cases sont remplies", () => {
    expect(doitEnvoyerLeCode(etat())).toBe(true);
  });

  it("ne part pas tant que la saisie est incomplète", () => {
    expect(doitEnvoyerLeCode(etat({ complet: false, code: "12345" }))).toBe(false);
  });

  it("ne part pas si une vérification est déjà en vol", () => {
    // Ce verrou ne tient que s'il est lu depuis une ref : un état n'est visible
    // qu'au rendu suivant, et deux appels du même tour le liraient à faux.
    expect(doitEnvoyerLeCode(etat({ enCours: true }))).toBe(false);
  });

  it("NE REPART PAS après la fin de la requête, code toujours à l'écran", () => {
    // La régression exacte. Le verrou est retombé, les 6 chiffres sont
    // toujours là : sans mémoire du code déjà tenté, l'effet renvoyait tout.
    expect(
      doitEnvoyerLeCode(etat({ enCours: false, codeDejaTente: "123456" })),
    ).toBe(false);
  });

  it("repart si le champ a été vidé puis re-saisi à l'identique", () => {
    // `reset()` remet la mémoire à null : redemander un code puis retaper le
    // même doit fonctionner.
    expect(
      doitEnvoyerLeCode(etat({ codeDejaTente: null, code: "123456" })),
    ).toBe(true);
  });

  it("repart sur un code différent", () => {
    expect(
      doitEnvoyerLeCode(etat({ code: "654321", codeDejaTente: "123456" })),
    ).toBe(true);
  });

  it("ne part pas en friction, même avec un code neuf", () => {
    // Au-delà de 3 essais l'écran impose un renvoi ou un changement de numéro ;
    // l'auto-envoi ne doit pas passer outre.
    expect(doitEnvoyerLeCode(etat({ friction: true }))).toBe(false);
  });

  it("la friction l'emporte sur tout le reste", () => {
    expect(
      doitEnvoyerLeCode(etat({ friction: true, enCours: false, codeDejaTente: null })),
    ).toBe(false);
  });
});
