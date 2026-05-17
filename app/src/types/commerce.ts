// Entités commerciales — amendement team §4.2 (séparation B2C/commercial).
// Aligné sur supabase/migrations/0002_create_customers_plans_currencies.sql.
// La conversion de devise est stubbée V1 (`lib/currency.ts`) — activation V2.

import type { CountryCode } from "./spawter";

export type CustomerType = "b2c_individual" | "b2b_business" | "influencer";

export type PlanPeriod = "monthly" | "annual" | "lifetime";

/** Devise ISO 4217. `code` = clé naturelle (text PK côté DB). */
export interface Currency {
  code: string;
  label: string;
  /** Taux de référence vers USD. Informatif V1, utilisé V2 cross-currency. */
  base_rate: number;
  /** Modificateur local (ajustement par pays). Défaut 1. */
  modifier: number;
  country_code: CountryCode;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Offre commerciale. `code` = slug stable (`gold_monthly`). */
export interface Plan {
  id: string;
  code: string;
  label: string;
  /** Prix hors taxe dans la devise du plan. */
  price_ht: number;
  currency_code: string;
  country_code: CountryCode;
  period: PlanPeriod;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Entité commerciale liée à un spawter (B2C/B2B/influencer).
 * Un spawter peut avoir un customer par `customer_type` (UNIQUE en DB).
 */
export interface Customer {
  id: string;
  spawter_id: string;
  customer_type: CustomerType;
  display_name: string;
  billing_country_code: CountryCode;
  billing_currency_code: string;
  created_at: string;
  updated_at: string;
}
