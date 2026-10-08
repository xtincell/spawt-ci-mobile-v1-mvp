// Le scénario qu'aucun test ne rejouait : reprendre son Coup de Cœur.
//
// Signalé depuis un téléphone — « le coup de cœur ne peut pas être retiré ».
// C'était exact et par construction : il n'existait que `give_coup_de_coeur`,
// et le bouton passait `disabled` à vie après un don. Une fausse manœuvre
// coûtait une unité de quota du mois, définitivement.
//
// Ces tests décrivent le cycle de vie complet d'un cœur, dans l'ordre où il se
// produit à l'écran, plus les deux cas de désaccord entre la vue et le serveur.

import {
  appliquerReponseCoupDeCoeur,
  type EtatCoupDeCoeur,
} from "../coup-de-coeur-state";

const etat = (p: Partial<EtatCoupDeCoeur> = {}): EtatCoupDeCoeur => ({
  given: false,
  count: 3,
  remaining: 1,
  ...p,
});

describe("donner", () => {
  it("bascule en donné, incrémente le compteur du lieu, et dit ce qu'il reste", () => {
    const r = appliquerReponseCoupDeCoeur(etat(), {
      ok: true,
      code: "given",
      quota: 3,
      used: 1,
      remaining: 2,
    });
    expect(r.etat).toEqual({ given: true, count: 4, remaining: 2 });
    expect(r.messageKey).toBe("given_remaining");
    expect(r.evenement).toBe("coup_de_coeur_posted");
    expect(r.rechargerListe).toBe(true);
  });

  it("annonce le DERNIER du mois autrement — la rareté doit se sentir", () => {
    const r = appliquerReponseCoupDeCoeur(etat(), {
      ok: true,
      code: "given",
      remaining: 0,
    });
    expect(r.messageKey).toBe("given_last");
    expect(r.etat.remaining).toBe(0);
  });
});

describe("retirer", () => {
  it("rend l'unité de quota et redevient donnable — LA régression signalée", () => {
    const r = appliquerReponseCoupDeCoeur(etat({ given: true, count: 4, remaining: 0 }), {
      ok: true,
      code: "removed",
      quota: 1,
      used: 0,
      remaining: 1,
    });
    expect(r.etat).toEqual({ given: false, count: 3, remaining: 1 });
    expect(r.messageKey).toBe("removed");
    expect(r.evenement).toBe("coup_de_coeur_removed");
    // Le profil affiche mes cœurs : il doit se recharger, sinon il montre un
    // cœur qui n'existe plus.
    expect(r.rechargerListe).toBe(true);
  });

  it("ne fait pas descendre le compteur public sous zéro", () => {
    // Possible : le compteur a été chargé, puis d'autres ont retiré le leur.
    const r = appliquerReponseCoupDeCoeur(etat({ given: true, count: 0 }), {
      ok: true,
      code: "removed",
      remaining: 1,
    });
    expect(r.etat.count).toBe(0);
  });
});

describe("désaccord entre la vue et le serveur", () => {
  it("« already_given » aligne la vue sur le serveur au lieu d'échouer", () => {
    // Cas réel : l'écran a été remonté et avait oublié le don.
    const r = appliquerReponseCoupDeCoeur(etat({ given: false }), {
      ok: false,
      code: "already_given",
      quota: 1,
      used: 1,
      remaining: 0,
    });
    expect(r.etat.given).toBe(true);
    expect(r.etat.remaining).toBe(0);
    expect(r.evenement).toBeNull();
  });

  it("« not_given » se corrige EN SILENCE — il n'y a rien à reprocher", () => {
    const r = appliquerReponseCoupDeCoeur(etat({ given: true }), {
      ok: false,
      code: "not_given",
      remaining: 1,
    });
    expect(r.etat.given).toBe(false);
    expect(r.messageKey).toBeNull();
  });
});

describe("refus et pannes", () => {
  it("quota épuisé : message, et il ne reste rien", () => {
    const r = appliquerReponseCoupDeCoeur(etat({ remaining: 0 }), {
      ok: false,
      code: "quota_exhausted",
      quota: 1,
      used: 1,
    });
    expect(r.messageKey).toBe("quota_exhausted");
    expect(r.etat.given).toBe(false);
    expect(r.etat.remaining).toBe(0);
    expect(r.evenement).toBe("coup_de_coeur_quota_exhausted");
  });

  it("transport en panne : l'état ne bouge PAS", () => {
    // Inventer un basculement afficherait un succès qui n'a pas eu lieu — le
    // défaut exact qu'on a passé la semaine à traquer sur l'écran OTP.
    const avant = etat({ given: true, count: 4, remaining: 0 });
    const r = appliquerReponseCoupDeCoeur(avant, null);
    expect(r.etat).toEqual(avant);
    expect(r.messageKey).toBe("error");
    expect(r.rechargerListe).toBe(false);
  });

  it("code inconnu : erreur générique, état inchangé", () => {
    const avant = etat();
    const r = appliquerReponseCoupDeCoeur(avant, { ok: false, code: "not_authenticated" });
    expect(r.etat).toEqual(avant);
    expect(r.messageKey).toBe("error");
  });
});
