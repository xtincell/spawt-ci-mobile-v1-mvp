// Aligné PRD §13 + amendements team (cahier des charges Sprint 1 §4)
// La table publique B2C est `spawters` (renommée depuis `users` — amendement 4.1).
// Les attributs commerciaux vivent dans `customers` (amendement 4.2).

import type { Stade } from "./stade";

export type Gender = "homme" | "femme" | "autre" | "non_renseigne";

export type AgeRange = "18-24" | "25-34" | "35-44" | "45-54" | "55+";

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
  /** Tranche d'âge — pas de date de naissance brute pour limiter PII */
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
  created_at: string;
  updated_at: string;
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
  age_range: AgeRange | null;
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
}
