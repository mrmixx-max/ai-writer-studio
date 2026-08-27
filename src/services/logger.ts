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
      // eslint-disable-next-line no-console
      console[level === "debug" ? "log" : level](prefix, message, error);
    } else {
      // eslint-disable-next-line no-console
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
