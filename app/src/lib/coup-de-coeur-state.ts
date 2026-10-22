// Que devient l'écran après une réponse du serveur sur le Coup de Cœur ?
//
// Cette décision vivait en ligne dans `CoupDeCoeurButton`, et elle était fausse
// de deux façons qu'aucun test ne pouvait voir :
//
//   * il n'y avait pas de chemin de retour. `given` passait à vrai et le bouton
//     à `disabled` pour de bon : un tap de travers coûtait une unité de quota
//     du mois, définitivement ;
//   * les deux réponses de DÉSACCORD — `already_given` (le serveur a mon cœur,
//     pas l'écran) et `not_given` (l'inverse) — étaient traitées comme des
//     échecs, alors qu'elles disent simplement que la vue est en retard. La
//     bonne réaction est de s'aligner sur le serveur, pas d'afficher une
//     erreur.
//
// Extraire la décision la rend rejouable hors appareil. Le rendu, lui, reste
// dans le composant : ici, aucune couleur, aucun texte — seulement des clés.

/** Ce que l'écran montre à un instant donné. */
export interface EtatCoupDeCoeur {
  /** J'ai donné mon Coup de Cœur à ce lieu, ce mois-ci. */
  given: boolean;
  /** Compteur public du lieu pour le mois courant. */
  count: number;
  /** Ce qu'il me reste ce mois-ci ; `null` tant que le serveur ne l'a pas dit. */
  remaining: number | null;
}

/** Réponse des RPC `give_coup_de_coeur` / `remove_coup_de_coeur`. */
export interface ReponseCoupDeCoeur {
  ok: boolean;
  code: string;
  quota?: number;
  used?: number;
  remaining?: number;
}

export interface IssueCoupDeCoeur {
  etat: EtatCoupDeCoeur;
  /** Clé i18n du message à afficher, ou `null` pour n'en afficher aucun. */
  messageKey: "given_remaining" | "given_last" | "removed" | "already_given" | "quota_exhausted" | "error" | null;
  /** Événement analytics à émettre, ou `null`. */
  evenement: "coup_de_coeur_posted" | "coup_de_coeur_removed" | "coup_de_coeur_quota_exhausted" | null;
  /** Le parent doit-il recharger sa liste (le profil affiche mes cœurs). */
  rechargerListe: boolean;
}

/**
 * `null` en entrée = le transport a échoué (réseau, RPC absente). On garde
 * l'état tel quel : inventer un basculement afficherait un succès qui n'a pas
 * eu lieu.
 */
export function appliquerReponseCoupDeCoeur(
  etat: EtatCoupDeCoeur,
  res: ReponseCoupDeCoeur | null,
): IssueCoupDeCoeur {
  if (res === null) {
    return { etat, messageKey: "error", evenement: null, rechargerListe: false };
  }

  if (res.ok && res.code === "removed") {
    return {
      etat: {
        given: false,
        // Jamais en dessous de zéro : le compteur public peut avoir été chargé
        // avant que d'autres retirent le leur.
        count: Math.max(0, etat.count - 1),
        remaining: res.remaining ?? etat.remaining,
      },
      messageKey: "removed",
      evenement: "coup_de_coeur_removed",
      rechargerListe: true,
    };
  }

  if (res.ok) {
    return {
      etat: { given: true, count: etat.count + 1, remaining: res.remaining ?? etat.remaining },
      messageKey: res.remaining && res.remaining > 0 ? "given_remaining" : "given_last",
      evenement: "coup_de_coeur_posted",
      rechargerListe: true,
    };
  }

  // ── Les deux désaccords : l'écran est en retard, on s'aligne ──────────────
  if (res.code === "already_given") {
    return {
      etat: { ...etat, given: true, remaining: res.remaining ?? etat.remaining },
      messageKey: "already_given",
      evenement: null,
      rechargerListe: false,
    };
  }
  if (res.code === "not_given") {
    // Silencieux : il n'y avait rien à retirer, la vue se corrige seule. Rien
    // à reprocher à qui que ce soit, donc aucun message.
    return {
      etat: { ...etat, given: false, remaining: res.remaining ?? etat.remaining },
      messageKey: null,
      evenement: null,
      rechargerListe: false,
    };
  }

  if (res.code === "quota_exhausted") {
    return {
      etat: { ...etat, remaining: 0 },
      messageKey: "quota_exhausted",
      evenement: "coup_de_coeur_quota_exhausted",
      rechargerListe: false,
    };
  }

  return { etat, messageKey: "error", evenement: null, rechargerListe: false };
}
