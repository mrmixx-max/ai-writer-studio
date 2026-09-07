// Fehlerbericht-Baustein (Sprint 13, Agent 3).
// Datei: src/components/Error/errorReport.ts
//
// Reine, testbare Funktionen ohne React-/DOM-Abhängigkeiten:
// - sanitizeErrorText: entfernt PII (Benutzernamen, absolute Dateipfade)
// - buildErrorReport: sammelt message, stack, App-Version, Plattform, Log-Tail
// - formatErrorReport: kopierfähige Textdarstellung (für „Fehlerdetails kopieren")

export interface ErrorReportInput {
  message: string;
  stack?: string;
  /** React componentStack aus componentDidCatch. */
  componentStack?: string;
  appVersion?: string;
  platform?: string;
  /** Neueste Log-Zeilen, neueste zuletzt. */
  recentLogs?: string[];
}

export interface ErrorReport {
  message: string;
  stack?: string;
  componentStack?: string;
  appVersion: string;
  platform: string;
  recentLogs: string[];
  ts: number;
}

/** Max. Log-Zeilen im Bericht — hält Copy-Paste handhabbar. */
export const MAX_LOG_TAIL = 30;

/** Fallback-Version, wenn der Aufrufer keine mitgibt (rein, kein Package-Import). */
export const UNKNOWN_VERSION = "unknown";

/**
 * Entfernt personenbezogene Pfadanteile aus einem Text:
 * - Windows-Absolutpfade (C:\…) → [path]
 * - /home/<user>, /Users/<user> → /home/<redacted> bzw. /Users/<redacted>
 * - sonstige Unix-Absolutpfade mit mind. 2 Segmenten → [path]
 * - verbliebene C:\Users\<name>-Reste → redigiert
 */
export function sanitizeErrorText(text: string): string {
  if (!text) return text;
  let out = text;
  // Windows-Absolutpfade zuerst (fangen auch C:\Users\<name>\… vollständig ab).
  out = out.replace(/\b[A-Za-z]:[\\/][^\s"'()`]*?(?=[\s"'()`,;]|$)/g, "[path]");
  // Unix-Home-Verzeichnisse (Benutzername folgt direkt).
  out = out.replace(/\/(home|Users)\/[^/\s"'()`]+/g, "/$1/<redacted>");
  // Sonstige Unix-Absolutpfade (mind. zwei Segmente).
  out = out.replace(/(^|[\s"'()«»“”‘’])(\/[\w.-]+(?:\/[\w.-]+)+)/g, "$1[path]");
  // Reste wie „Users\webma" (Backslash-Schreibweise ohne Laufwerk).
  out = out.replace(/Users\\[^"'()`\\]+/gi, "Users\\<redacted>");
  return out;
}

/** Erkennt die Plattform — im Browser via navigator, sonst „unknown“. */
export function detectPlatform(): string {
  try {
    if (typeof navigator !== "undefined" && navigator.platform) return navigator.platform;
    if (typeof navigator !== "undefined" && (navigator as { userAgent?: string }).userAgent) {
      return (navigator as { userAgent?: string }).userAgent as string;
    }
    if (typeof process !== "undefined" && process.platform) return process.platform;
  } catch {
    /* ignore */
  }
  return "unknown";
}

function sanitizeOptional(value: string | undefined): string | undefined {
  return value === undefined ? undefined : sanitizeErrorText(value);
}

/** Baut einen PII-bereinigten Fehlerbericht. Alle String-Felder werden sanitisiert. */
export function buildErrorReport(input: ErrorReportInput): ErrorReport {
  const tail = (input.recentLogs ?? []).slice(-MAX_LOG_TAIL).map(sanitizeErrorText);
  return {
    message: sanitizeErrorText(input.message),
    stack: sanitizeOptional(input.stack),
    componentStack: sanitizeOptional(input.componentStack),
    appVersion: input.appVersion ?? UNKNOWN_VERSION,
    platform: input.platform ?? detectPlatform(),
    recentLogs: tail,
    ts: Date.now(),
  };
}

/** Kopierfähige Textdarstellung eines Berichts (bereits sanitisiert). */
export function formatErrorReport(report: ErrorReport): string {
  const lines = [
    "AI Writer Studio — Fehlerdetails",
    `Zeit: ${new Date(report.ts).toISOString()}`,
    `Version: ${report.appVersion}`,
    `Plattform: ${report.platform}`,
    `Fehler: ${report.message}`,
  ];
  if (report.stack) lines.push(`Stack:\n${report.stack}`);
  if (report.componentStack) lines.push(`Komponenten:\n${report.componentStack}`);
  if (report.recentLogs.length > 0) {
    lines.push(`Log (letzte ${report.recentLogs.length}):`);
    for (const entry of report.recentLogs) lines.push(`  ${entry}`);
  }
  return lines.join("\n");
}
