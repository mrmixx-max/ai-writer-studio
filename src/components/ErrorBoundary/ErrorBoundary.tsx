// React Error Boundary für die gesamte App.
// Datei: src/components/ErrorBoundary/ErrorBoundary.tsx
//
// Fängt Render-/Lifecycle-Fehler, zeigt eine verständliche Fallback-UI mit
// "Erneut versuchen" (Reset) und "Neu starten" (Reload) und meldet den Crash
// über reportReactCrash() in den strukturierten Logger.

import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { getLogger } from "@/services/logger";
import { reportReactCrash } from "@/services/resilience/globalErrorHandler";

const log = getLogger("errorboundary");

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional: eigene Fallback-UI. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Fehlergrenze innerhalb eines Panels statt der ganzen App (Betonung in der UI). */
  compact?: boolean;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    log.exception(`Render-Fehler in Komponente: ${error.message}`, error);
    reportReactCrash(error, info.componentStack ?? undefined);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    if (this.props.compact) {
      return (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            border: "1px solid #b91c1c",
            borderRadius: 8,
            background: "#fef2f2",
            color: "#7f1d1d",
            margin: 8,
          }}
        >
          <strong>Dieses Panel konnte nicht geladen werden.</strong>
          <p style={{ fontSize: "0.85em", margin: "6px 0" }}>{error.message}</p>
          <button type="button" onClick={this.reset} style={{ cursor: "pointer" }}>
            Erneut versuchen
          </button>
        </div>
      );
    }

    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          fontFamily: "system-ui, sans-serif",
          background: "#111827",
          color: "#f3f4f6",
          padding: 24,
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>
          Ein unerwarteter Fehler ist aufgetreten
        </h1>
        <p style={{ maxWidth: 560, color: "#d1d5db" }}>
          AI Writer Studio konnte diese Ansicht nicht darstellen. Ihre Daten
          bleiben erhalten. Der Fehler wurde protokolliert.
        </p>
        <details style={{ maxWidth: 640, width: "100%", textAlign: "left" }}>
          <summary style={{ cursor: "pointer", color: "#9ca3af" }}>
            Technische Details
          </summary>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontSize: "0.75rem",
              color: "#9ca3af",
              overflow: "auto",
              maxHeight: 240,
            }}
          >
            {error.stack ?? error.message}
          </pre>
        </details>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            type="button"
            onClick={this.reset}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Erneut versuchen
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "1px solid #4b5563",
              background: "transparent",
              color: "#f3f4f6",
              cursor: "pointer",
            }}
          >
            App neu starten
          </button>
        </div>
      </div>
    );
  }
}

/** HOC-Form für einzelne Komponenten. */
export function withErrorBoundary<P extends object>(
  Wrapped: React.ComponentType<P>,
  props?: Omit<ErrorBoundaryProps, "children">,
): React.ComponentType<P> {
  const WithBoundary = (componentProps: P) => (
    <ErrorBoundary {...props}>
      <Wrapped {...componentProps} />
    </ErrorBoundary>
  );
  WithBoundary.displayName = `withErrorBoundary(${Wrapped.displayName ?? Wrapped.name ?? "Component"})`;
  return WithBoundary;
}

export default ErrorBoundary;
