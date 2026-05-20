// ErrorBoundary global — transforme un crash React en message visible (sinon page blanche).

import { Component, type ReactNode } from "react";

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
      return (
        <div
          style={{
            padding: 32,
            fontFamily: "system-ui",
            color: "#C0392B",
            background: "#fff",
            minHeight: "100vh",
          }}
        >
          <h1>Erreur de l'app admin</h1>
          <p>{this.state.error.message}</p>
          <pre style={{ whiteSpace: "pre-wrap", background: "#f5f5f5", padding: 16, fontSize: 12 }}>
            {this.state.error.stack}
          </pre>
          <button type="button" onClick={() => location.reload()}>
            Recharger
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
