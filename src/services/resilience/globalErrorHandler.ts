// Globaler Error-Handler: fängt alle unbehandelten Fehler und Promise-
// Rejections, loggt sie strukturiert und schreibt bei FATAL einen Crash-Report.
// Datei: src/services/resilience/globalErrorHandler.ts
//
// Installation in main.tsx, VOR dem ersten React-Render.

import { getLogger, logger } from "@/services/logger";

const log = getLogger("global");

export interface CrashReport {
  ts: number;
  kind: "error" | "unhandledrejection" | "react";
  message: string;
  stack?: string;
  source?: string;
  recentLogs?: string[];
}

let lastReportTs = 0;

/** Schreibt einen Crash-Report als Datei (Tauri) — best effort. */
async function writeCrashReport(report: CrashReport): Promise<void> {
  if (typeof window === "undefined" || !(window as any).__TAURI_INTERNALS__) return;
  // Max. ein Report pro 5 s (z.B. bei Loop-Crashes).
  const now = Date.now();
  if (now - lastReportTs < 5000) return;
  lastReportTs = now;
  try {
    const core = await import("@tauri-apps/api/core");
    await core.invoke("log_message", {
      level: "FATAL",
      message: `[crash-report] ${JSON.stringify({
        ...report,
        recentLogs: report.recentLogs?.slice(-30),
      })}`,
    });
  } catch {
    /* ignore */
  }
}

/**
 * Installiert window.onerror, onunhandledrejection und Ressourcen-Error-
 * Listener. Idempotent — mehrfacher Aufruf installiert nur einmal.
 */
export function installGlobalErrorHandlers(): void {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (w.__aws_error_handlers_installed) return;
  w.__aws_error_handlers_installed = true;

  // 1) window.onerror (klassische Sync-Fehler)
  window.addEventListener("error", (event) => {
    // Ressourcen-Fehler (img/script) haben kein error-Objekt
    if (event.target && (event.target as HTMLElement).tagName) {
      const el = event.target as HTMLElement;
      log.error(`Ressource fehlgeschlagen: <${el.tagName.toLowerCase()}> ${el.id || el.className}`);
      return;
    }
    const report: CrashReport = {
      ts: Date.now(),
      kind: "error",
      message: event.message ?? "Unbekannter Fehler",
      stack: event.error instanceof Error ? event.error.stack : undefined,
      source: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
    };
    log.error("Unbehandelter Fehler", report);
    void writeCrashReport({ ...report, recentLogs: summarizeLogs() });
  });

  // 2) Unbehandelte Promise-Rejections
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const report: CrashReport = {
      ts: Date.now(),
      kind: "unhandledrejection",
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    };
    // AbortError durch Nutzer-Abbruch: nur DEBUG, kein Crash-Report.
    if (reason instanceof Error && reason.name === "AbortError") {
      log.debug("Promise-Abbruch (AbortError)", report.message);
      event.preventDefault?.();
      return;
    }
    log.error("Unbehandelte Promise-Rejection", report);
    void writeCrashReport({ ...report, recentLogs: summarizeLogs() });
  });
}

function summarizeLogs(): string[] {
  return logger
    .getRecent(30)
    .map((e) => `${new Date(e.ts).toISOString()} [${e.level}] [${e.scope}] ${e.message}`);
}

/** Für den ErrorBoundary: React-Render-Crash protokollieren. */
export function reportReactCrash(error: Error, componentStack?: string): void {
  const report: CrashReport = {
    ts: Date.now(),
    kind: "react",
    message: error.message,
    stack: [error.stack, componentStack].filter(Boolean).join("\n---\n"),
  };
  log.fatal("React-Render-Crash", report);
  void writeCrashReport({ ...report, recentLogs: summarizeLogs() });
}
