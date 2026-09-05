// Log-Rotation (Sprint 6, Agent 4).
//
// Reine Logik für monatsbasierte Logdateien mit Größen-Rotation und
// Aufbewahrungsregeln. Bewusst ohne winston/pino als harte Abhängigkeit:
// Die App läuft im Tauri-WebView (kein Node-FS im Frontend), daher kapselt
// dieses Modul die Rotation-Logik deterministisch testbar (kein IO, keine
// echte Uhr). Die Persistenz dockt in logPersistence.ts an.

export interface LogEntryInput {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  context?: string;
  error?: unknown;
  timestamp: number;
}

/** Aktive Monats-Logdatei: app-YYYY-MM.log (lokale Zeit). */
export function monthlyLogFileName(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return `app-${year}-${String(month).padStart(2, "0")}.log`;
}

export interface ParsedLogName {
  year: number;
  month: number;
  /** Nummer der rotierten Datei, null für die aktive Datei. */
  rotated: number | null;
}

const MONTHLY_RE = /^app-(\d{4})-(\d{2})\.log$/;
const ROTATED_RE = /^app-(\d{4})-(\d{2})\.(\d+)\.log$/;

export function parseMonthlyLogFileName(name: string): ParsedLogName | null {
  const active = name.match(MONTHLY_RE);
  if (active) {
    const year = Number(active[1]);
    const month = Number(active[2]);
    if (month < 1 || month > 12) return null;
    return { year, month, rotated: null };
  }
  const rot = name.match(ROTATED_RE);
  if (rot) {
    const year = Number(rot[1]);
    const month = Number(rot[2]);
    if (month < 1 || month > 12) return null;
    return { year, month, rotated: Number(rot[3]) };
  }
  return null;
}

/** Verschiebt einen Logdateinamen eine Rotationsstufe weiter. */
export function rotatedName(name: string): string {
  const active = name.match(MONTHLY_RE);
  if (active) return `app-${active[1]}-${active[2]}.1.log`;
  const rot = name.match(ROTATED_RE);
  if (rot) return `app-${rot[1]}-${rot[2]}.${Number(rot[3]) + 1}.log`;
  return name;
}

export interface RenameStep {
  from: string;
  to: string;
  /** Ausführungsreihenfolge (0 = zuerst). */
  sequence: number;
}

export interface RotationPlan {
  rotate: boolean;
  renames: RenameStep[];
}

/**
 * Plant die Rotation: Wenn size >= maxBytes, werden bestehende rotierte
 * Dateien in absteigender Nummerierung eine Stufe weitergeschoben und die
 * aktive Datei wird zur .1.log (startet danach leer).
 */
export function planRotation(
  size: number,
  maxBytes: number,
  existingRotated: string[] = [],
): RotationPlan {
  if (size < maxBytes) return { rotate: false, renames: [] };

  // Absteigend sortieren: höchste Rotationsnummer zuerst verschieben,
  // sonst überschreiben sich die Dateien gegenseitig.
  const sorted = [...existingRotated].sort(
    (a, b) =>
      (parseMonthlyLogFileName(b)?.rotated ?? 0) -
      (parseMonthlyLogFileName(a)?.rotated ?? 0),
  );

  const renames: RenameStep[] = [];
  let seq = 0;
  for (const name of sorted) {
    renames.push({ from: name, to: rotatedName(name), sequence: seq++ });
  }
  // Aktive Datei zuletzt (nach allen .n → .n+1 Verschiebungen).
  renames.push({ from: monthlyLogFileName(), to: `${monthlyBaseName()}.1.log`, sequence: seq });
  return { rotate: true, renames };
}

function monthlyBaseName(): string {
  // "app-2026-09" aus der aktiven Monatsdatei ableiten.
  return monthlyLogFileName().replace(/\.log$/, "");
}

/** Standard-Größenlimit je Logdatei: 5 MiB. */
export const DEFAULT_MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Standard-Aufbewahrung: 10 Dateien pro Monat, 180 Tage. */
export const DEFAULT_MAX_FILES = 10;
export const DEFAULT_MAX_AGE_DAYS = 180;

/**
 * Aufbewahrung: Gibt zurück, welche Dateien gelöscht werden dürfen.
 * - Nie die aktive Datei löschen.
 * - Behalte die neuesten `maxFiles` (inkl. aktiver) pro Monat.
 * - Lösche Monate älter als maxAgeDays.
 * - Fremd-/Korrupteinträge werden nie gemeldet (Schutz).
 */
export function retentionList(
  files: string[],
  maxFiles: number = DEFAULT_MAX_FILES,
  opts: { now?: Date; maxAgeDays?: number } = {},
): { keep: string[]; remove: string[] } {
  const remove: string[] = [];
  const now = opts.now ?? new Date();
  const maxAgeDays = opts.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;

  // 1) Abgelaufene Monate entfernen (First-of-Month-Alter).
  const byMonth = new Map<string, string[]>();
  for (const f of files) {
    const parsed = parseMonthlyLogFileName(f);
    if (!parsed) continue; // Fremd-/Korrupteinträge: Schutz
    const key = `${parsed.year}-${String(parsed.month).padStart(2, "0")}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(f);
  }

  for (const [key, group] of byMonth) {
    const [y, m] = key.split("-").map(Number);
    const fileDate = new Date(y, m - 1, 1);
    const ageDays = (now.getTime() - fileDate.getTime()) / (24 * 60 * 60 * 1000);
    if (ageDays > maxAgeDays) {
      remove.push(...group);
      byMonth.delete(key);
    }
  }

  // 2) Pro Monat: nur die neuesten maxFiles behalten.
  if (maxFiles > 0) {
    for (const group of byMonth.values()) {
      const sorted = [...group].sort((a, b) => {
        const pa = parseMonthlyLogFileName(a)!;
        const pb = parseMonthlyLogFileName(b)!;
        // Aufsteigend nach Neuzähler: aktive Datei (rotated: null) = neueste,
        // dann .1, .2 … (älteste Rotation zuletzt).
        const na = pa.rotated ?? -1;
        const nb = pb.rotated ?? -1;
        return na - nb;
      });
      // Aktive Datei immer behalten.
      const active = sorted.find((f) => parseMonthlyLogFileName(f)!.rotated === null);
      const keepSet = new Set<string>(sorted.slice(0, maxFiles));
      if (active) keepSet.add(active);
      for (const f of group) {
        if (!keepSet.has(f)) remove.push(f);
      }
    }
  }

  const removeSet = new Set(remove);
  return { keep: files.filter((f) => !removeSet.has(f)), remove };
}

/** Eine Logzeile im Format: ISO-Zeit LEVEL [context] message [json] */
export function formatLogLine(entry: LogEntryInput): string {
  const iso = new Date(entry.timestamp).toISOString();
  const level = entry.level.toUpperCase();
  const ctx = entry.context ? `[${entry.context}]` : "[app]";
  let line = `${iso} ${level} ${ctx} ${entry.message}`;
  if (entry.error !== undefined) {
    let detail: string;
    try {
      detail = JSON.stringify(entry.error) ?? String(entry.error);
    } catch {
      detail = String(entry.error);
    }
    line += ` ${detail}`;
  }
  return line;
}

/** Liest eine formatierte Logzeile zurück (null bei Fremdformat). */
export function parseLogLine(line: string): {
  level: LogEntryInput["level"];
  message: string;
  context: string;
  timestamp: number;
  error?: unknown;
} | null {
  const m = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z) (DEBUG|INFO|WARN|ERROR) \[([^\]]*)\] (.*)$/);
  if (!m) return null;
  const timestamp = Date.parse(m[1]);
  if (Number.isNaN(timestamp)) return null;
  const level = m[2].toLowerCase() as LogEntryInput["level"];
  let message = m[4];
  let error: unknown = undefined;
  // Trailing JSON (Error-Detail) abspalten: beginnt mit { oder ".
  const jsonStart = message.search(/\\s(?=\\{|")/);
  if (jsonStart !== -1) {
    const candidate = message.slice(jsonStart + 1);
    try {
      error = JSON.parse(candidate);
      message = message.slice(0, jsonStart);
    } catch {
      // kein gültiges JSON — bleibt Teil der Nachricht
    }
  }
  return { level, message, context: m[3], timestamp, error };
}