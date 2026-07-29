// Câblage MVP — logique pure de la page Signalements (testable sans Refine).
// La table review_reports (migration 0026) est la file d'attente du bouton
// « Signaler » côté app mobile (Feature 17).

export type ReportReason = "fake_review" | "hater" | "gatekeeping" | "autre";
export type ResolutionAction = "kept" | "removed" | "warned";

export const REASON_LABELS: Record<ReportReason, string> = {
  fake_review: "Avis suspect ou faux",
  hater: "Méchanceté gratuite",
  gatekeeping: "Fausses infos volontaires",
  autre: "Autre",
};

export function reasonLabel(code: string): string {
  return REASON_LABELS[code as ReportReason] ?? code;
}

/** Payload de résolution — resolved_by_staff_id/resolved_at auto-populés par
 *  le trigger 0026 côté DB (défense en profondeur), envoyés explicitement
 *  quand l'identité est connue (cohérence client, pattern moderation C1). */
export function buildResolutionPayload(
  action: ResolutionAction,
  staffId: string | null,
): Record<string, unknown> {
  return {
    status: "resolved",
    resolution_action: action,
    ...(staffId
      ? { resolved_by_staff_id: staffId, resolved_at: new Date().toISOString() }
      : {}),
  };
}
