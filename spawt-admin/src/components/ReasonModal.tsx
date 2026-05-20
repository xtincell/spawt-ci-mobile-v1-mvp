// Story 6.4 — Modal partagé pour les actions critiques avec motif obligatoire.

import { useState } from "react";

interface ReasonModalProps {
  isOpen: boolean;
  title: string;
  confirmLabel: string;
  destructive?: boolean;
  fauxPasOptions?: string[];
  onConfirm: (reason: string) => void | Promise<void>;
  onCancel: () => void;
}

export const ReasonModal = ({
  isOpen,
  title,
  confirmLabel,
  destructive,
  fauxPasOptions,
  onConfirm,
  onCancel,
}: ReasonModalProps) => {
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  if (!isOpen) return null;

  const valid = reason.trim().length >= 3;
  const canSubmit = valid && (!destructive || confirmed);

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{title}</h2>
        {fauxPasOptions ? (
          <div className="faux-pas-presets" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
            {fauxPasOptions.map((option) => (
              <button key={option} type="button" onClick={() => setReason(option)}>
                {option}
              </button>
            ))}
          </div>
        ) : null}
        <label style={{ display: "block", marginTop: 12 }}>
          Motif (obligatoire, ≥ 3 caractères)
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={500}
            style={{ width: "100%", marginTop: 4 }}
          />
        </label>
        {destructive ? (
          <label style={{ display: "block", marginTop: 12 }}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            Je confirme cette action irréversible.
          </label>
        ) : null}
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            Annuler
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            className={destructive ? "btn-destructive" : "btn-primary"}
            onClick={() => onConfirm(reason)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export const FAUX_PAS_REVIEW = [
  "Fake Review (avis fictif)",
  "Hater Toxique (insultes / propos discriminants)",
  "Spam / publicité",
  "Hors-sujet (n'a pas spawté ce lieu)",
];

export const FAUX_PAS_SPAWTER = [
  "Fake Reviews répétées",
  "Gatekeeping (revendique un lieu)",
  "Hater Toxique (récidive)",
  "Faux compte / usurpation",
];
