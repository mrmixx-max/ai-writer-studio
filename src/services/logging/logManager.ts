// Log-Manager (Sprint 6, Agent 4): verbindet das zentrale Logging
// (src/services/logger.ts) mit der monatsbasierten Log-Rotation.
//
// Konsolen-Outputs und Fehler werden zusätzlich in rotierende Dateien
// geschrieben (app-2026-09.log). Die Dateipersistenz läuft über einen
// Adapter (logPersistence.ts), der im Tauri-Kontext das fs-Plugin nutzt.

import {
  monthlyLogFileName,
  parseMonthlyLogFileName,
  planRotation,
  retentionList,
  formatLogLine,
  DEFAULT_MAX_FILE_BYTES,
  DEFAULT_MAX_FILES,
  DEFAULT_MAX_AGE_DAYS,
  type LogEntryInput,
} from "./logRotation";

export interface LogPersistenceAdapter {
  /** Listet Dateinamen im Log-Verzeichnis auf. */
  list(): Promise<string[]>;
  /** Liest eine Logdatei (Anzahl Bytes am Dateiende messen oder Inhalt). */
  sizeOf(name: string): Promise<number>;
  /** Hängt eine Zeile an eine Datei an (erstellt sie bei Bedarf). */
  append(name: string, line: string): Promise<void>;
  /** Benennt eine Datei um (Rotationsschritt). */
  rename(from: string, to: string): Promise<void>;
  /** Löscht eine Datei (Aufbewahrung). */
  remove(name: string): Promise<void>;
}

export interface LogManagerOptions {
  maxFileBytes?: number;
  maxFilesPerMonth?: number;
  maxAgeDays?: number;
  /** Konsolen-Spiegelung an/aus (Standard: an). */
  mirrorToConsole?: boolean;
}

interface LogSink {
  write(level: LogEntryInput["level"], message: string, context?: string, error?: unknown): void;
  /** Flush von Rotations-/Aufbewahrungswarteschlange (periodisch aufrufen). */
  flush(): Promise<void>;
  /** Name der aktiven Logdatei. */
  activeFileName(): string;
}

export class LogManager implements LogSink {
  private adapter: LogPersistenceAdapter | null;
  private opts: Required<Pick<LogManagerOptions, "maxFileBytes" | "maxFilesPerMonth" | "maxAgeDays" | "mirrorToConsole">>;
  private pending: string[] = [];
  private flushedBytes: Map<string, number> = new Map();
  private activeFile: string;

  constructor(adapter: LogPersistenceAdapter | null, opts: LogManagerOptions = {}) {
    this.adapter = adapter;
    this.opts = {
      maxFileBytes: opts.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES,
      maxFilesPerMonth: opts.maxFilesPerMonth ?? DEFAULT_MAX_FILES,
      maxAgeDays: opts.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS,
      mirrorToConsole: opts.mirrorToConsole ?? true,
    };
    this.activeFile = monthlyLogFileName();
  }

  activeFileName(): string {
    return this.activeFile;
  }

  /** Wird vom zentralen Logger für jeden Eintrag aufgerufen. */
  write(
    level: LogEntryInput["level"],
    message: string,
    context?: string,
    error?: unknown,
  ): void {
    const entry: LogEntryInput = {
      level,
      message,
      context,
      error,
      timestamp: Date.now(),
    };
    const line = formatLogLine(entry);
    this.pending.push(line);

    if (this.opts.mirrorToConsole && typeof console !== "undefined") {
      const prefix = `[${level.toUpperCase()}${context ? `/${context}` : ""}]`;
      const method = level === "debug" ? "log" : level;
       
      (console as unknown as Record<string, (...a: unknown[]) => void>)[method](prefix, message, error !== undefined ? error : "");
    }
  }

  /**
   * Persistiert die Warteschlange: hängt Zeilen an, rotiert bei
   * Größenüberschreitung und räumt gemäß Aufbewahrung auf.
   */
  async flush(): Promise<void> {
    if (!this.adapter) {
      this.pending = [];
      return;
    }
    const a = this.adapter;

    // Monatwechsel? Neue Datei wählen.
    const current = monthlyLogFileName();
    if (current !== this.activeFile) {
      this.activeFile = current;
      this.flushedBytes.set(current, 0);
    }

    // 1) Anhängen
    if (this.pending.length) {
      const lines = this.pending.join("\n") + "\n";
      await a.append(this.activeFile, lines);
      this.pending = [];
      const size = (this.flushedBytes.get(this.activeFile) ?? 0) + lines.length;
      this.flushedBytes.set(this.activeFile, size);
    }

    // 2) Rotation prüfen (NUR die aktive Datei)
    const size = this.flushedBytes.get(this.activeFile) ?? 0;
    const all = await a.list();
    // Nur wirklich rotierte Dateien des aktuellen Monats — die aktive
    // Datei selbst darf NICHT im Rename-Plan landen (Doppel-Rename).
    const rotated = all.filter((f) => {
      const p = parseMonthlyLogFileName(f);
      return p !== null && p.rotated !== null;
    });
    const plan = planRotation(size, this.opts.maxFileBytes, rotated);
    if (plan.rotate) {
      for (const step of plan.renames) {
        await a.rename(step.from, step.to);
      }
      this.flushedBytes.set(this.activeFile, 0);
      // Aktive Datei sofort leer neu anlegen ("touch"), damit die
      // Aufbewahrung im selben Flush sie als neueste Datei sieht.
      await a.append(this.activeFile, "");
    }

    // 3) Aufbewahrung — auf der JETZT aktuellen Dateiliste (nach Rotation),
    // sonst bleiben frisch rotierte Dateien ungelöscht.
    const allAfter = await a.list();
    const { remove } = retentionList(allAfter, this.opts.maxFilesPerMonth, {
      maxAgeDays: this.opts.maxAgeDays,
    });
    for (const f of remove) {
      await a.remove(f);
    }
  }
}