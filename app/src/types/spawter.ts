// Aligné PRD §13 + amendements team (cahier des charges Sprint 1 §4)
// La table publique B2C est `spawters` (renommée depuis `users` — amendement 4.1).
// Les attributs commerciaux vivent dans `customers` (amendement 4.2).

import type { Stade } from "./stade";

export type Gender = "homme" | "femme" | "autre" | "non_renseigne";

export type AgeRange = "18-24" | "25-34" | "35-44" | "45-54" | "55+";

/** Story 4.8 — Date ISO 'YYYY-MM-DD' (date_of_birth). */
export type ISODateString = string;

export type CountryCode = "CI" | "NG" | "SN" | "CM" | "TG" | "BJ" | "BF" | "ML" | "GN" | "GH";

export interface Spawter {
  id: string;
  /** Téléphone E.164 — clé d'authentification primaire (PRD §3.1 Feature 1) */
  phone_e164: string;
  display_name: string;
  avatar_url: string | null;
  /** Quartier de résidence déclaré (PRD §3.1 Feature 1) */
  neighborhood: string | null;
  /** Pays de résidence — amendement team 4.5 */
  country_code: CountryCode;
  /** Pays d'origine déclaré — amendement team 4.5 */
  origin_country_code: CountryCode | null;
  /** Démographique — amendement team 4.5 (KPIs Madame Sun) */
  gender: Gender;
  /** Story 4.8 — Date de naissance précise (Epic 4 PASS 2).
   *  Reste DB-only — jamais émis dans analytics (PII brute).
   *  Nullable pour back-compat rows pré-4.8. */
  date_of_birth: ISODateString | null;
  /** Tranche d'âge — dérivée de `date_of_birth` au finalize onboarding via
   *  `ageRangeFromDateOfBirth()`. Conservée pour KPI funnel Madame Sun. */
  age_range: AgeRange | null;
  stade: Stade;
  total_spawts: number;
  unique_spots: number;
  /** Statut Premium / Gold (lien vers customers.id si actif) */
  customer_id: string | null;
  /** Consentement géoloc + collecte données (FR-040 — bloc 2 du gate ARTCI) */
  geoloc_consent_at: string | null;
  /** Acceptation CGU/CGV (FR-040 — bloc 1 du gate ARTCI, DR-CGV-01) */
  cgv_accepted_at: string | null;
  /** Chantier 13 archétypes (migration 0033) — archétype COURANT du spawter.
   *  Colonne `spawters.quiz_archetype` : sert aux DEUX flux (héritage quiz
   *  « La Meute » ET recalculs in-app post-spawt). Clé du catalogue
   *  `data/archetypes.ts` — nullable pour back-compat rows pré-0033. */
  quiz_archetype: string | null;
  /** Numéro de pionnier hérité du quiz « La Meute » (migration 0033,
   *  `claim_meute_heritage`). Null si pas d'héritage réclamé. */
  pionnier_seq: number | null;
  created_at: string;
  updated_at: string;
}

/** Résultat de `claim_meute_heritage` relayé par otp-verify (`meute_heritage`
 *  dans la réponse JSON). Le client PEUT l'ignorer — l'échec ne casse jamais
 *  le login (pattern P-07 côté Edge). */
export interface MeuteHeritage {
  claimed: boolean;
  archetype: string | null;
  pionnier_seq: number | null;
}

/** Données récoltées à l'onboarding (PRD §3.1 Feature 2 + amendements 4.5) */
export interface OnboardingDraft {
  phone_e164: string;
  display_name: string;
  /** Email retourné par Apple Sign-In à la 1re auth (P-04, jamais re-renvoyé
   *  par Apple après). Persiste dans le draft pour account recovery. */
  email: string | null;
  neighborhood: string;
  country_code: CountryCode;
  origin_country_code: CountryCode | null;
  gender: Gender;
  /** Story 4.8 — Date de naissance (remplace `age_range` côté saisie UI).
   *  `age_range` est dérivé via `ageRangeFromDateOfBirth()` au finalize.
   *  Le champ `age_range` du draft est supprimé (V1 — Story 4.8) — n'est
   *  plus saisi user-side, calculé uniquement au moment du finalize. */
  date_of_birth: ISODateString | null;
  /** Timestamps des 2 consents ARTCI saisis pré-auth (Story 2.2 / FR-040).
   *  Le finalize de l'onboarding les transfère sur le row spawters à l'insert. */
  consent: {
    cgv_accepted_at: string | null;
    geoloc_consent_at: string | null;
  };
  /** Réponses aux 5 questions de calibrage (PRD §20.2).
   *  Sentinel `null` = skip explicite ("Pas d'avis") — distingué d'un `0`
   *  (réponse neutre via cartes sélectionnées balanced). P-33 (review 2026-05-18). */
  calibration_answers: Record<import("./palais").PalaisAxis, number | null>;
  /** ms epoch posé au tap CTA Splash (Story 2.6). Sert au calcul
   *  `time_to_complete_seconds` à l'émission `onboarding_completed`. */
  started_at: number | null;
  /** Chantier 13 archétypes — héritage quiz « La Meute » capturé à l'étape
   *  OTP (réponse otp-verify). Si `claimed`, l'archétype hérité devient
   *  l'archétype INITIAL au finalize (au lieu du calcul calibration). Null en
   *  mode démo ou si rien à réclamer. */
  meute_heritage: MeuteHeritage | null;
}
