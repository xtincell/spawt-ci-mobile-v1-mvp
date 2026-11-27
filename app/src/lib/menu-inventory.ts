import { listMenuItems, type MenuItem } from "./outings";

/** Search and place budgets read the same complete public catalog for each content revision. */
let snapshot: { revision: number; rows: Promise<MenuItem[]> } | undefined;
export function readMenuInventory(revision: number): Promise<MenuItem[]> {
  if (snapshot?.revision === revision) return snapshot.rows;
  const rows = listMenuItems().catch(error => {
    // A superseded request must not clear the new revision's cache.
    if (snapshot?.rows === rows) snapshot = undefined;
    throw error;
  });
  snapshot = { revision, rows };
  return rows;
}

