// PRD §11 — Spawter Gold (premium). V1 = stub `false` car le funnel paiement
// CinetPay arrive Sprint 2. Hook prêt pour V1.5 wirage `customer_id !== null
// && subscriptions.is_active` (jointure avec table customers Story 1.x amend 4.2).

import type { Spawter } from "../types/spawter";

/** Indique si un spawter est Gold (premium actif). V1 = toujours false. */
export function isGoldSpawter(_spawter: Spawter): boolean {
  return false;
}
