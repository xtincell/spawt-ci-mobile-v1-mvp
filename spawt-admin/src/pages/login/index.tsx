import { Link, useLocation } from "react-router";
import { staffRecoveryEnabled } from "../recovery";
// Story 6.1 — Login email/password (provider Supabase Auth).
// Le authProvider vérifie ensuite spawt_staff.is_active + log audit.

import { useState } from "react";
import { useLogin } from "@refinedev/core";
import { StaffAccess } from "../../components/StaffAccess";

export const LoginPage = () => {
  const { mutate: login, isPending } = useLogin<{ email: string; password: string }>();
  const { state } = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasError, setHasError] = useState(false);

  return (
    <StaffAccess
      title="SPAWT admin"
      description="Connexion réservée à l’équipe interne."
      focusTitleOnMount={state?.focusStaffAccessTitle === true}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (isPending) return;
          setHasError(false);
          login(
            { email, password },
            {
              // Refine résout la mutation même si le fournisseur refuse la connexion.
              onSuccess: ({ success }) => setHasError(!success),
              onError: () => setHasError(true),
            },
          );
        }}
        className="staff-access__form"
        aria-busy={isPending}
      >
        <label className="staff-access__field">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="staff-access__field">
          Mot de passe
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {hasError && (
          <p className="staff-access__alert" role="alert">
            Impossible de se connecter. Vérifie tes identifiants ou réessaie.
          </p>
        )}
        <button type="submit" className="btn-primary staff-access__button" disabled={isPending}>
          {isPending ? "Connexion…" : "Se connecter"}
        </button>
      </form>
      <p className="staff-access__pending" role="status">{isPending ? "Connexion en cours…" : ""}</p>
      {staffRecoveryEnabled && (
        <p className="staff-access__footer">
          <Link className="staff-access__link" to="/mot-de-passe-oublie">Mot de passe oublié&nbsp;?</Link>
        </p>
      )}
    </StaffAccess>
  );
};
