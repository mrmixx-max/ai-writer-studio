// Zentrales Logging für die App (Sprint 8 + Sprint 13, kompatibel).
//
// Ersetzt console.log/console.warn an einer Stelle, damit das Logging
// in der Produktion ausgeschaltet werden kann und in Tests überprüfbar ist.

type Level = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: Level;
  message: string;
  context?: string;
  error?: unknown;
  timestamp: number;
}

// Öffentliches Interface für getRecent() (Sprint 8, globalErrorHandler).
export interface LogEntryPublic {
  ts: number;
  level: Level;
  scope: string;
  message: string;
}

const BUFFER_SIZE = 200;
const buffer: LogEntry[] = [];

let enabled = true;

/** Schaltet das Logging ein/aus. In Produktion: aus. */
export function setLoggingEnabled(value: boolean): void {
  enabled = value;
}

/** Gibt die letzten Log-Einträge zurück — für Diagnose-Panel. */
export function getLogEntries(count = BUFFER_SIZE): LogEntry[] {
  return buffer.slice(-count).map((e) => ({
    ...e,
    context: e.context ?? "app",
  }));
}

function log(level: Level, message: string, context?: string, error?: unknown): void {
  if (!enabled && level !== "error") return;

  const entry: LogEntry = { level, message, context, error, timestamp: Date.now() };
  buffer.push(entry);
  if (buffer.length > BUFFER_SIZE * 2) {
    buffer.splice(0, buffer.length - BUFFER_SIZE);
  }

  if (import.meta.env?.DEV) {
    const prefix = `[${level.toUpperCase()}${context ? `/${context}` : ""}]`;
    if (error !== undefined) {
      console[level === "debug" ? "log" : level](prefix, message, error);
    } else {
      console[level === "debug" ? "log" : level](prefix, message);
    }
  }
}

export function debug(message: string, context?: string): void {
  log("debug", message, context);
}
export function info(message: string, context?: string): void {
  log("info", message, context);
}
export function warn(message: string, context?: string): void {
  log("warn", message, context);
}
export function error(message: string, context?: string): void {
  log("error", message, context);
}

function exception(message: string, err: unknown): void {
  log("error", message, undefined, err);
}

// Logger-Interface (Sprint 8, resilience/).
export interface Logger {
  debug: (message: string, ...rest: unknown[]) => void;
  info: (message: string, ...rest: unknown[]) => void;
  warn: (message: string, ...rest: unknown[]) => void;
  error: (message: string, ...rest: unknown[]) => void;
  exception: (message: string, err: unknown) => void;
  fatal: (message: string, ...rest: unknown[]) => void;
  getRecent: (count?: number) => LogEntryPublic[];
}

export function getLogger(context: string): Logger {
  const withContext =
    (level: Level) =>
    (message: string, ...rest: unknown[]) => {
      if (rest.length) log(level, `${message} ${rest.map((r) => JSON.stringify(r) ?? String(r)).join(" ")}`, context);
      else log(level, `[${context}] ${message}`, context);
    };
  return {
    debug: withContext("debug"),
    info: withContext("info"),
    warn: withContext("warn"),
    error: withContext("error"),
    exception,
    fatal: withContext("error"),
    getRecent: (count = 30): LogEntryPublic[] =>
      buffer.slice(-count).map((e) => ({
        ts: e.timestamp,
        level: e.level,
        scope: e.context ?? context,
        message: e.message,
      })),
  };
}

/** Default-Logger-Objekt (für Imports der Form `import { logger } from …`). */
export const logger: Logger = getLogger("app");

// Sprint-13 API (ErrorBoundary) — additive Helpers.
export function logEntry(level: LogEntry["level"], context: string, message: string): void {
  log(level, message, context);
}
