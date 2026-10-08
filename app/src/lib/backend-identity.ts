// =============================================================================
// SPAWT — QUELLE adresse et QUELLE clé ce binaire porte-t-il, et d'où viennent-elles
// =============================================================================
//
// Pourquoi ce module existe.
//
// La même expression de résolution était recopiée dans quatre fichiers
// (`supabase.ts`, `data-source.ts`, l'écran téléphone, l'écran OTP). Tant que
// tout va bien, la duplication ne coûte rien. Le jour où ça casse, elle coûte
// très cher : on ne peut pas répondre à la seule question qui compte —
// « qu'est-ce que l'app INSTALLÉE envoie réellement ? » — parce que chaque
// appelant a sa propre copie de la réponse, et qu'aucune n'est observable.
//
// Ce qu'on a payé pour l'apprendre. Un compte se connecte, le serveur émet bien
// une session, et le téléphone affiche « la session n'a pas pu s'ouvrir ». Trois
// mesures ont fini par cadrer la panne :
//
//   1. `/functions/v1/*` ne vérifie AUCUNE clé côté passerelle (Kong n'y pose
//      pas de plugin `key-auth` : les fonctions gèrent leur propre autorisation).
//      Une clé fausse — ou même la chaîne « demo-anon-key-placeholder » — y passe
//      avec un 200. L'envoi et la vérification du code marchent donc PARFAITEMENT
//      avec une clé invalide. C'est le piège : la partie visible du tunnel de
//      connexion ne prouve rien sur la configuration du binaire.
//   2. `/auth/v1/*` et `/rest/v1/*`, eux, sont derrière `key-auth`. Une clé que
//      la passerelle ne connaît pas y produit exactement, et seulement,
//      `401 {"message":"Unauthorized","request_id":…}`.
//   3. Donc un binaire mal branché passe l'OTP puis meurt à l'ouverture de
//      session — et TOUT le reste de l'app (lieux, profil, favoris) serait mort
//      aussi, pour la même raison, sans jamais nommer la cause.
//
// D'où les deux règles que ce module applique :
//   * une seule résolution, partagée — on ne peut plus diverger ;
//   * une **empreinte** publiable. La clé anonyme est publique par conception
//     (elle part dans chaque requête, elle est lisible dans le binaire), mais on
//     n'affiche jamais une clé entière dans une UI : une empreinte suffit à
//     comparer ce que le téléphone porte avec ce que le serveur attend.
//
// Voir aussi `scripts/check-eas-env.mjs`, qui interroge la vraie passerelle
// avant chaque build distribuable : c'est lui qui empêche de réexpédier une clé
// que le serveur refuse. Ce module-ci sert quand le mal est déjà installé.

import Constants from "expo-constants";

/** D'où vient la valeur — utile parce que les trois sources n'ont pas le même correctif. */
export type Provenance =
  /** `app.json` → `extra` (embarqué dans le manifeste, gagne sur tout le reste). */
  | "manifeste"
  /** `EXPO_PUBLIC_*`, figé dans le bundle au moment du build (profil `eas.json`). */
  | "build"
  /** Rien nulle part. */
  | "absente";

export interface ValeurTracee {
  valeur: string;
  provenance: Provenance;
}

function resoudre(depuisManifeste: unknown, depuisBuild: string | undefined): ValeurTracee {
  if (typeof depuisManifeste === "string" && depuisManifeste.length > 0) {
    return { valeur: depuisManifeste, provenance: "manifeste" };
  }
  if (typeof depuisBuild === "string" && depuisBuild.length > 0) {
    return { valeur: depuisBuild, provenance: "build" };
  }
  return { valeur: "", provenance: "absente" };
}

const extra = Constants.expoConfig?.extra as
  | { supabaseUrl?: unknown; supabaseAnonKey?: unknown }
  | undefined;

export const backendUrl = resoudre(extra?.supabaseUrl, process.env.EXPO_PUBLIC_SUPABASE_URL);
export const backendAnonKey = resoudre(
  extra?.supabaseAnonKey,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

/**
 * Empreinte lisible d'un secret-qui-n'en-est-pas-un.
 *
 * Format : `8 premiers…6 derniers (longueur)`. Assez pour comparer deux clés à
 * l'œil sans jamais recopier la clé entière dans une capture d'écran ou un
 * ticket. Une chaîne vide dit « VIDE » plutôt que de produire une empreinte
 * trompeuse : « rien » et « faux » ne se réparent pas pareil.
 */
export function empreinte(v: string): string {
  if (v.length === 0) return "VIDE";
  if (v.length <= 14) return `${v} (${v.length})`;
  return `${v.slice(0, 8)}…${v.slice(-6)} (${v.length})`;
}

/**
 * Ligne de diagnostic compacte, affichable dans l'app et recopiable telle
 * quelle. C'est ce qu'on demande à quelqu'un de lire au téléphone quand on
 * n'a pas l'appareil sous la main.
 */
export function empreinteBackend(): string {
  const hote = backendUrl.valeur.replace(/^https?:\/\//, "") || "VIDE";
  return `${hote} [${backendUrl.provenance}] · clé ${empreinte(backendAnonKey.valeur)} [${backendAnonKey.provenance}]`;
}
