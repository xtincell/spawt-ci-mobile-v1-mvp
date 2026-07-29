// Story 5.2 — Row de `collection_titres` (append-only mémoire d'identité).
// Aligné migration 0014 + PRD §3.1 FR-008 + §5.4.

import type { TitleSource } from "../lib/titres-catalogue";

export interface CollectionTitreRow {
  id: string;
  spawter_id: string;
  title_key: string;
  source: TitleSource;
  is_displayed: boolean;
  unlocked_at: string;
}
