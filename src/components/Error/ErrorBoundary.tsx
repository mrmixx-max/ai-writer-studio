// Panel-Fehlergrenze mit Fehler-UX (Sprint 13, Agent 3).
// Datei: src/components/Error/ErrorBoundary.tsx
//
// Klassen-Boundary für Panel-Bereiche: Fallback-Screen mit Was-passiert-ist,
// „Erneut versuchen“ (Reset) und „Fehlerdetails kopieren“ (PII-bereinigt via
// errorReport.ts). Meldet den Crash an das bestehende Monitoring
// (getLogger + reportReactCrash), sonst console als Fallback.

import { Component, type ErrorInfo, type ReactNode } from "react";
import { getLogger, getLogEntries } from "@/services/logger";
import {
  buildErrorReport,
  formatErrorReport,
  type ErrorReport,
} from "./errorReport";

const log = getLogger("errorboundary/panel");

export interface PanelErrorBoundaryProps {
  children: ReactNode;
  /** Anzeigename des Panels, z. B. „KI-Panel“. */
  panelName?: string;
}

interface PanelErrorBoundaryState {
  error: Error | null;
  report: ErrorReport | null;
  copied: boolean;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const nav = navigator as Navigator & {
      clipboard?: { writeText(t: string): Promise<void> };
    };
    if (nav.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* Fallback unten */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export class ErrorBoundary extends Component<
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState
> {
  state: PanelErrorBoundaryState = { error: null, report: null, copied: false };

  static getDerivedStateFromError(error: Error): Partial<PanelErrorBoundaryState> {
    return { error, copied: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    let recentLogs: string[];
    try {
      recentLogs = getLogEntries(30).map((e) => `[${e.level}] ${e.message}`);
    } catch {
      recentLogs = [];
    }
    const report = buildErrorReport({
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack ?? undefined,
      recentLogs,
    });
    this.setState({ report });

    try {
      log.fatal(`Render-Fehler im Panel: ${error.message}`, error);
    } catch {
      // Monitoring blockiert (z. B. isolierte Tests) → Konsole als Fallback.
      console.error("[ErrorBoundary/panel]", error);
    }
  }

  reset = (): void => {
    this.setState({ error: null, report: null, copied: false });
  };

  copyDetails = async (): Promise<void> => {
    const { report, error } = this.state;
    const text = report
      ? formatErrorReport(report)
      : `AI Writer Studio — Fehlerdetails\nFehler: ${error?.message ?? "unbekannt"}`;
    const ok = await copyToClipboard(text);
    this.setState({ copied: ok });
  };

  render(): ReactNode {
    const { error, copied } = this.state;
    if (!error) return this.props.children;
    const name = this.props.panelName ?? "Panel";
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
        <strong>{name} konnte nicht geladen werden.</strong>
        <p style={{ fontSize: "0.85em", margin: "6px 0" }}>
          Beim Darstellen dieses Bereichs ist ein Fehler aufgetreten. Ihre Daten
          bleiben erhalten — meist hilft ein erneuter Versuch.
        </p>
        <p style={{ fontSize: "0.8em", margin: "6px 0", opacity: 0.85 }}>
          Technisch: {error.message}
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="button" onClick={this.reset} style={{ cursor: "pointer" }}>
            Erneut versuchen
          </button>
          <button type="button" onClick={this.copyDetails} style={{ cursor: "pointer" }}>
            {copied ? "Kopiert!" : "Fehlerdetails kopieren"}
          </button>
        </div>
      </div>
    );
  }
}
