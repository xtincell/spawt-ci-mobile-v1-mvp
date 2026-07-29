// ErrorBoundary global — transforme un crash React en message visible (sinon page blanche).

import { Component, type ReactNode } from "react";

// Moka en PNG (règle DS : jamais de chat vectoriel/SVG). Pose erreur pour le crash screen.
import mokaErreur from "../assets/mascots/moka-erreur.png";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info);
  }

  render(): ReactNode {
    if (this.state.error) {
      // CR Chunk B m4 — masquer le stack en prod (leak structure code).
      // En dev (import.meta.env.DEV), affiche le stack pour debug rapide.
      const isDev = (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;
      // Fallbacks hex inline : c'est l'écran de crash, il doit rester lisible
      // même si layout.css n'a pas chargé.
      return (
        <div
          style={{
            padding: 32,
            fontFamily: "var(--font-body, system-ui)",
            color: "var(--ink, #0A0A0A)",
            background: "var(--bg, #fff)",
            minHeight: "100vh",
            maxWidth: 720,
            margin: "0 auto",
          }}
        >
          <img
            src={mokaErreur}
            alt="Moka"
            style={{ display: "block", width: 120, height: "auto", margin: "0 auto 16px" }}
          />
          <h1 style={{ fontFamily: "var(--font-display, system-ui)", textAlign: "center" }}>
            Erreur du panel admin
          </h1>
          <p style={{ color: "var(--danger, #C0392B)" }}>{this.state.error.message}</p>
          {isDev ? (
            <pre style={{ whiteSpace: "pre-wrap", background: "#f5f5f5", padding: 16, fontSize: 12 }}>
              {this.state.error.stack}
            </pre>
          ) : (
            <p style={{ color: "var(--ink-mute, #666)", fontSize: 12 }}>
              Détails techniques masqués en production. Recharger ou contacter le support.
            </p>
          )}
          <button type="button" onClick={() => location.reload()}>
            Recharger
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
