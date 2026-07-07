// Story 6.1 — Login email/password (provider Supabase Auth).
// Le authProvider vérifie ensuite spawt_staff.is_active + log audit.

import { useState } from "react";
import { useLogin } from "@refinedev/core";

// Moka en PNG (règle DS : jamais de chat vectoriel/SVG).
import mokaSalut from "../../assets/mascots/moka-salut.png";

export const LoginPage = () => {
  const { mutate: login, isPending } = useLogin<{ email: string; password: string }>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          login(
            { email, password },
            {
              onError: (err) => setError(err?.message ?? "Erreur de connexion."),
            },
          );
        }}
        style={{
          width: 360,
          background: "var(--bg-card)",
          padding: 32,
          borderRadius: 12,
          border: "1px solid var(--line)",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.06)",
        }}
      >
        <img
          src={mokaSalut}
          alt="Moka"
          style={{ display: "block", width: 104, height: "auto", margin: "0 auto 12px" }}
        />
        <h1
          style={{
            margin: "0 0 4px",
            textAlign: "center",
            fontFamily: "var(--font-display)",
            fontSize: 30,
            letterSpacing: "0.02em",
          }}
        >
          SPAWT <span style={{ color: "var(--spawt-gold-deep)" }}>admin</span>
        </h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 13, textAlign: "center", marginTop: 0 }}>
          Connexion réservée à l'équipe interne (spawt_staff).
        </p>
        <label style={{ display: "block", marginTop: 16 }}>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8 }}
          />
        </label>
        <label style={{ display: "block", marginTop: 16 }}>
          Mot de passe
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8 }}
          />
        </label>
        {error ? <p style={{ color: "var(--danger)", marginTop: 12 }}>{error}</p> : null}
        <button type="submit" className="btn-primary" disabled={isPending} style={{ marginTop: 16, width: "100%" }}>
          {isPending ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
};
