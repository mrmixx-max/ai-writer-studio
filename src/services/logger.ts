// Zentrales Logging für die App.
//
// Ersetzt console.log/console.warn an einer Stelle, damit das Logging
// in der Produktion ausgeschaltet werden kann und in Tests überprüfbar ist.

type Level = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: Level;
  message: string;
  context?: string;
  error?: unknown;
  timestamp: number;
}

const BUFFER_SIZE = 100;
const buffer: LogEntry[] = [];

let enabled = true;

/** Schaltet das Logging ein/aus. In Produktion: aus. */
export function setLoggingEnabled(value: boolean): void {
  enabled = value;
}

/** Gibt die letzten Log-Einträge zurück — für Diagnose-Panel. */
export function getLogEntries(count = BUFFER_SIZE): LogEntry[] {
  return buffer.slice(-count);
}

function log(level: Level, message: string, context?: string, error?: unknown): void {
  if (!enabled && level !== "error") return;

  const entry: LogEntry = {
    level,
    message,
    context,
    error,
    timestamp: Date.now(),
  };

  buffer.push(entry);
  if (buffer.length > BUFFER_SIZE * 2) {
    buffer.splice(0, buffer.length - BUFFER_SIZE);
  }

  // In Entwicklung auch auf die Konsole.
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

export function warn(message: string, context?: string, error?: unknown): void {
  log("warn", message, context, error);
}

export function error(message: string, context?: string, error?: unknown): void {
  log("error", message, context, error);
}

/** Ausnahme mit Stack in den Log-Puffer schreiben. */
function exception(message: string, err: unknown): void {
  log("error", message, undefined, err);
}

export interface LogEntryPublic {
  ts: number;
  level: Level;
  scope: string;
  message: string;
}

export interface Logger {
  debug: (message: string, ...rest: unknown[]) => void;
  info: (message: string, ...rest: unknown[]) => void;
  warn: (message: string, ...rest: unknown[]) => void;
  error: (message: string, ...rest: unknown[]) => void;
  /** Fehler mit zusätzlichem Kontextobjekt (z. B. CrashReport). */
  exception: (message: string, err: unknown) => void;
  /** Noch schwerwiegender als error — immer protokolliert. */
  fatal: (message: string, ...rest: unknown[]) => void;
  /** Letzte n Log-Einträge (für Crash-Reports). */
  getRecent: (count?: number) => LogEntryPublic[];
}

/** Namensgebender Logger für Module — delegiert auf die zentralen Funktionen. */
export function getLogger(context: string): Logger {
  const withContext =
    (fn: (message: string, error?: unknown) => void) =>
    (message: string, ...rest: unknown[]) => {
      if (rest.length) fn(`${message} ${rest.map((r) => JSON.stringify(r) ?? String(r)).join(" ")}`);
      else fn(`[${context}] ${message}`);
    };
  return {
    debug: withContext((m) => log("debug", m)),
    info: withContext((m) => log("info", m)),
    warn: withContext((m) => log("warn", m)),
    error: withContext((m) => log("error", m)),
    exception,
    fatal: withContext((m) => log("error", m)),
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
