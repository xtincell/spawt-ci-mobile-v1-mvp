// Conversion de devise — stub V1.
//
// V1 : tous les plans sont en XOF, tous les spawters en CI → aucune conversion
//      réelle. La fonction retourne `amount` tel quel.
// V2 : activer la conversion (`amount * from.base_rate / to.base_rate * to.modifier`)
//      quand les subscriptions cross-currency seront wirées (Sprint 2+).
//
// L'API publique est stable. Les callers peuvent dès maintenant brancher leurs
// affichages prix sur `convertPrice(...)` et la conversion s'activera
// automatiquement en V2 sans refactor.

import type { Currency } from "../types/commerce";

/**
 * Retourne le montant converti `from` → `to`.
 * V1 : no-op (retourne `amount` tel quel).
 * V2 : `amount * from.base_rate / to.base_rate * to.modifier`.
 */
export function convertPrice(amount: number, _from: Currency, _to: Currency): number {
  // V1 : pas de conversion. Variables préfixées `_` pour ne pas alerter
  // les linters sur l'usage non-effectif (préparées V2).
  return amount;
}

/** Format prix avec code devise — ex : `2500 XOF`. */
export function formatPrice(amount: number, currency: Currency): string {
  return `${amount.toLocaleString("fr-CI")} ${currency.code}`;
}
