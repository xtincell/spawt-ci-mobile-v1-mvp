import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { createStaffRecoveryClient } from "../../utility/supabaseClient";
import { StaffAccess } from "../../components/StaffAccess";

export const staffRecoveryEnabled = import.meta.env.VITE_STAFF_RECOVERY_ENABLED === "true";
const resetPath = "/reinitialiser";
const tokenPattern = /^(?:pkce_)?(?:[a-f\d]{56}|[a-f\d]{64})$/i;

export function staffRecoveryToken(fragment: string) {
  const p = new URLSearchParams(fragment.replace(/^#/, ""));
  const t = p.get("token_hash");
  return p.getAll("token_hash").length === 1 && t && tokenPattern.test(t) ? t : "";
}

export function StaffRecoveryRequest() {
  const [state, setState] = useState<"form" | "busy" | "confirmation" | "failed">("form");
  const feedback = useRef<HTMLParagraphElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const reopeningForm = useRef(false);
  const busy = state === "busy";
  const showForm = staffRecoveryEnabled && state !== "confirmation";

  useEffect(() => {
    if (state === "confirmation" || state === "failed") feedback.current?.focus();
    if (state === "form" && reopeningForm.current) {
      emailInput.current?.focus();
      reopeningForm.current = false;
    }
  }, [state]);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!staffRecoveryEnabled || pending.current) return;
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    pending.current = true;
    setState("busy");
    try {
      const { error } = await createStaffRecoveryClient().auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + resetPath,
      });
      // HTTP outcomes (including throttling and mail errors) may depend on the
      // address. Only a transport failure can change the visible response.
      setState(error?.status === 0 ? "failed" : "confirmation");
    } catch {
      setState("failed");
    } finally {
      pending.current = false;
    }
  }

  return (
    <StaffAccess
      title="Mot de passe oublié"
      description={showForm ? "Saisis ton adresse e-mail professionnelle pour demander un lien de réinitialisation." : undefined}
      focusTitleOnMount
    >
      {!staffRecoveryEnabled && (
        <p className="staff-access__alert" role="alert">La récupération n’est pas encore disponible.</p>
      )}
      {state === "confirmation" && (
        <>
          <p className="staff-access__status" role="status" ref={feedback} tabIndex={-1}>
            Si cette adresse est associée à un compte, vérifie ta boîte de réception et tes indésirables.
            Si le lien n’arrive pas, réessaie dans quelques minutes.
          </p>
          <p className="staff-access__footer">
            <button type="button" className="staff-access__link" onClick={() => {
              reopeningForm.current = true;
              setState("form");
            }}>Faire une nouvelle demande</button>
          </p>
        </>
      )}
      {showForm && (
        <form className="staff-access__form" aria-busy={busy} onSubmit={submitRequest}>
          <label className="staff-access__field">
            Adresse e-mail
            <input required type="email" name="email" autoComplete="email" maxLength={254} readOnly={busy} ref={emailInput} />
          </label>
          {state === "failed" && (
            <p className="staff-access__alert" role="alert" ref={feedback} tabIndex={-1}>
              Impossible de traiter la demande pour le moment. Réessaie dans quelques minutes.
            </p>
          )}
          <button type="submit" className="btn-primary staff-access__button" disabled={busy}>
            {busy ? "Envoi en cours…" : "Envoyer le lien"}
          </button>
        </form>
      )}
      <span className="staff-access__pending" aria-live="polite" aria-atomic="true">{busy && "Envoi en cours…"}</span>
      <p className="staff-access__footer">
        <Link className="staff-access__link" to="/login" replace state={{ focusStaffAccessTitle: true }}>Retour à la connexion</Link>
      </p>
    </StaffAccess>
  );
}

type ResetState = "form" | "busy" | "done" | "invalid" | "failed";
type PasswordField = "password" | "confirmation";

export function StaffRecoveryReset() {
  const [token] = useState(() => staffRecoveryToken(window.location.hash));
  const [state, setState] = useState<ResetState>(token ? "form" : "invalid");
  const [fieldError, setFieldError] = useState<PasswordField | null>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const confirmationInput = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const attemptedReset = useRef(false);
  const busy = state === "busy";
  const needsNewLink = staffRecoveryEnabled && (state === "invalid" || state === "failed");
  const showForm = staffRecoveryEnabled && (state === "form" || busy);

  useEffect(() => {
    if (window.location.hash) window.history.replaceState(window.history.state, "", window.location.pathname);
  }, []);

  useEffect(() => {
    if (attemptedReset.current && (state === "done" || state === "invalid" || state === "failed")) {
      feedback.current?.focus();
    }
  }, [state]);

  useEffect(() => {
    if (fieldError === "password") passwordInput.current?.focus();
    if (fieldError === "confirmation") confirmationInput.current?.focus();
  }, [fieldError]);

  function validatePassword(field: PasswordField) {
    setFieldError(field);
    if (fieldError === field) {
      (field === "password" ? passwordInput : confirmationInput).current?.focus();
    }
  }

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!staffRecoveryEnabled || pending.current || !token) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < 12 || password.length > 72) {
      validatePassword("password");
      return;
    }
    if (password !== form.get("confirmation")) {
      validatePassword("confirmation");
      return;
    }

    pending.current = true;
    attemptedReset.current = true;
    setFieldError(null);
    setState("busy");
    let client: ReturnType<typeof createStaffRecoveryClient> | undefined;
    let outcome: ResetState = "failed";
    try {
      client = createStaffRecoveryClient();
      const verification = await client.auth.verifyOtp({ type: "recovery", token_hash: token });
      const verificationStatus = verification.error?.status;
      if (verificationStatus === 0 || verificationStatus === 429 || (verificationStatus ?? 0) >= 500) return;
      if (verification.error || !verification.data.session) {
        outcome = "invalid";
        return;
      }
      const staff = await client.rpc("current_staff").maybeSingle();
      if (staff.error) return;
      if (!staff.data) {
        outcome = "invalid";
        return;
      }
      const change = await client.auth.updateUser({ password });
      if (change.error) return;
      await client.auth.signOut({ scope: "global" }).catch(() => undefined);
      outcome = "done";
    } catch {
      outcome = "failed";
    } finally {
      await client?.auth.signOut({ scope: "local" }).catch(() => undefined);
      pending.current = false;
      setState(outcome);
    }
  }

  return (
    <StaffAccess
      title="Réinitialiser le mot de passe"
      description={showForm ? "Choisis un mot de passe unique de 12 à 72 caractères." : undefined}
      focusTitleOnMount
    >
      {!staffRecoveryEnabled && (
        <p className="staff-access__alert" role="alert">La récupération n’est pas encore disponible.</p>
      )}
      {staffRecoveryEnabled && state === "done" && (
        <p className="staff-access__status" role="status" ref={feedback} tabIndex={-1}>
          Mot de passe modifié. Connecte-toi avec ton nouveau mot de passe.
        </p>
      )}
      {needsNewLink && (
        <>
          <p className="staff-access__alert" role="alert" ref={feedback} tabIndex={-1}>
            {state === "invalid" ? "Ce lien est invalide ou expiré." : "La modification n’a pas abouti."}
          </p>
          <p className="staff-access__footer">
            <Link className="staff-access__link" replace to="/mot-de-passe-oublie">Demander un nouveau lien</Link>
          </p>
        </>
      )}
      {showForm && (
        <form className="staff-access__form" aria-busy={busy} onSubmit={submitReset} onChange={() => setFieldError(null)}>
          <div className="staff-access__field">
            <label htmlFor="staff-new-password">Nouveau mot de passe</label>
            <input
              id="staff-new-password" name="password" type="password" required minLength={12} maxLength={72}
              autoComplete="new-password" readOnly={busy} ref={passwordInput}
              aria-invalid={fieldError === "password" || undefined}
              aria-describedby={fieldError === "password" ? "staff-password-error" : undefined}
            />
            {fieldError === "password" && (
              <p id="staff-password-error" className="staff-access__field-error" role="alert">Saisis entre 12 et 72 caractères.</p>
            )}
          </div>
          <div className="staff-access__field">
            <label htmlFor="staff-confirm-password">Confirme le mot de passe</label>
            <input
              id="staff-confirm-password" name="confirmation" type="password" required minLength={12} maxLength={72}
              autoComplete="new-password" readOnly={busy} ref={confirmationInput}
              aria-invalid={fieldError === "confirmation" || undefined}
              aria-describedby={fieldError === "confirmation" ? "staff-confirmation-error" : undefined}
            />
            {fieldError === "confirmation" && (
              <p id="staff-confirmation-error" className="staff-access__field-error" role="alert">Les deux mots de passe ne correspondent pas.</p>
            )}
          </div>
          <button type="submit" className="btn-primary staff-access__button" disabled={busy}>
            {busy ? "Modification en cours…" : "Modifier le mot de passe"}
          </button>
        </form>
      )}
      <span className="staff-access__pending" aria-live="polite" aria-atomic="true">{busy && "Modification en cours…"}</span>
      <p className="staff-access__footer">
        <Link className="staff-access__link" to="/login" replace state={{ focusStaffAccessTitle: true }}>Retour à la connexion</Link>
      </p>
    </StaffAccess>
  );
}
