// Console admin 07/2026 — bandeau du Contrat SPAWT sur la page Promotions.
// Composant isolé pour être testé au rendu (garde anti-régression : le texte
// du Contrat doit rester visible tant que la page existe).

import { CONTRAT_PROMO_TEXT } from "./logic";

export const ContratBanner = () => (
  <p
    role="note"
    aria-label="Contrat SPAWT"
    style={{
      background: "var(--bg-warm)",
      border: "1px solid var(--gold)",
      padding: 12,
      borderRadius: 6,
      fontSize: 13,
      maxWidth: 720,
    }}
  >
    ⚠️ {CONTRAT_PROMO_TEXT}
  </p>
);
