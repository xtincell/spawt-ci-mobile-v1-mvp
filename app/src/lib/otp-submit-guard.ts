// Décision « faut-il envoyer ce code ? » — extraite pour être testable.
//
// Elle vivait en ligne dans l'effet d'auto-envoi de l'écran OTP, et elle était
// fausse d'une façon qu'aucun test ne pouvait voir : l'effet dépendait de
// l'état `submitting`, si bien qu'à la fin d'une vérification — quand le verrou
// retombe — il se redéclenchait alors que les 6 chiffres étaient toujours
// saisis, et renvoyait LE MÊME CODE.
//
// Ce que ça donnait en production : la première requête consommait l'OTP et
// ouvrait la session ; la seconde ne trouvait plus de demande en attente et
// répondait `no_pending_otp`. Son erreur écrasait le succès à l'écran.
// Connexion réussie côté serveur, échec affiché côté app — visible seulement
// en croisant `otp_attempts` (une ligne, validée une fois) avec ce que la
// personne avait sous les yeux.
//
// Deux garde-fous, et ils ne font pas le même travail :
//   * `enCours` doit venir d'une **ref**, pas d'un état : un état n'est visible
//     qu'au rendu suivant, donc deux appels partis dans le même tour le lisent
//     tous les deux à faux ;
//   * `codeDejaTente` couvre le cas où le verrou est déjà retombé — c'est lui
//     qui empêche le rejeu, et le premier ne suffit pas.

export interface EtatEnvoiCode {
  /** Les 6 cases sont remplies. */
  complet: boolean;
  /** Trop d'essais : l'écran demande un renvoi ou un changement de numéro. */
  friction: boolean;
  /** Une vérification est en vol (lu depuis une ref, jamais depuis un état). */
  enCours: boolean;
  /** Le code saisi actuellement. */
  code: string;
  /** Le dernier code déjà parti, ou null si le champ a été vidé/renvoyé. */
  codeDejaTente: string | null;
}

export function doitEnvoyerLeCode(e: EtatEnvoiCode): boolean {
  if (!e.complet) return false;
  if (e.friction) return false;
  if (e.enCours) return false;
  // Un code identique déjà parti ne repart pas : côté serveur il a été
  // consommé, et le renvoyer produit une erreur qui masque le succès.
  if (e.codeDejaTente !== null && e.codeDejaTente === e.code) return false;
  return true;
}
