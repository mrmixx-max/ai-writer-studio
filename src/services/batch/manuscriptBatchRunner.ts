// Manuskript-Batch-Runner (WP 41.1)
//
// Führt Analyse-Tools über alle Kapitel eines Manuskripts aus und sammelt die
// Befunde zu einem Report zusammen. Der Runner ist bewusst:
//
// - deterministisch: keine LLM-Aufrufe, keine Seiteneffekte, keine Timer-Logik
//   außer dem bewussten Yield an die Event-Loop.
// - UI-schonend: Zwischen Kapiteln (bzw. Chunks von Kapiteln) wird über
//   `yieldToEventLoop()` (setTimeout/Promise) die Kontrolle abgegeben, damit
//   auch 100 Kapitel die Oberfläche nicht blockieren.
// - defensiv: kaputte Eingaben, werfende Tools, Nicht-String-Ausgaben und
//   ausufernde Befundmengen werden abgefangen (keine Endlos-Läufe).
//
// Tool-Ausgabeformat (pro Zeile ein Befund, tolerant geparst):
//   error:12:Zu langer Satz        → severity=error, line=12
//   warning:5:Wiederholung         → severity=warning, line=5
//   [info] 3:Stilhinweis           → severity=info, line=3
//   12:Zu langer Satz              → severity=info (Default), line=12
//   Zu langer Satz                 → severity=info (Default), line=1

/** Schweregrad eines Befunds. */
export type BatchSeverity = "error" | "warning" | "info";

export interface BatchChapter {
  id: string;
  title: string;
  content: string;
}

export interface BatchTool {
  id: string;
  label: string;
  run: (text: string) => string | Promise<string>;
  category: string;
}

export interface BatchFinding {
  chapterId: string;
  chapterTitle: string;
  line: number;
  toolId: string;
  toolLabel: string;
  severity: BatchSeverity;
  message: string;
}

export interface BatchReport {
  findings: BatchFinding[];
  chaptersScanned: number;
  toolsRun: number;
  durationMs: number;
}

export interface JumpTarget {
  chapterId: string;
  chapterIndex: number;
  line: number;
}

export interface BatchSummary {
  total: number;
  errors: number;
  warnings: number;
  infos: number;
  byTool: Record<string, number>;
}

export interface BatchRunnerOptions {
  /**
   * Anzahl Kapitel pro Chunk, nach dem die Kontrolle an die Event-Loop
   * abgegeben wird. Default 1 = nach JEDEM Kapitel yielden.
   */
  chunkSize?: number;
  /** Yield-Implementierung (injizierbar für Tests). Default: setTimeout(0). */
  yieldFn?: () => Promise<void>;
  /** Zeitquelle in ms (injizierbar für deterministische Tests). Default: Date.now. */
  nowFn?: () => number;
  /** Obergrenze Befunde pro Kapitel (Endlos-Schutz). Default: 1000. */
  maxFindingsPerChapter?: number;
  /** Obergrenze Befunde gesamt (Endlos-Schutz). Default: 10000. */
  maxTotalFindings?: number;
}

/** Maximale Länge einer Tool-Ausgabe, die geparst wird (Endlos-Schutz). */
export const MAX_OUTPUT_CHARS = 500_000;

const DEFAULT_MAX_FINDINGS_PER_CHAPTER = 1000;
const DEFAULT_MAX_TOTAL_FINDINGS = 10_000;

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/**
 * Gibt die Kontrolle an die Event-Loop ab. setTimeout(0) reicht, um im Browser
 * (und in Node) ausstehende Rendering-/Microtask-Arbeit abzuarbeiten, ohne
 * einen echten Wartezyklus zu erzeugen.
 */
export function yieldToEventLoop(): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** Ganzzahl klemmen; nicht-endliche Werte fallen auf `fallback` zurück. */
function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

/** Fehler defensiv in einen lesbaren String verwandeln. */
function toErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  try {
    return String(err);
  } catch {
    return "unbekannter Fehler";
  }
}

/** Kapitel normalisieren: nur valide Objekte mit id werden übernommen. */
function normalizeChapter(chapter: unknown): BatchChapter | null {
  if (!chapter || typeof chapter !== "object") return null;
  const c = chapter as Partial<BatchChapter>;
  if (typeof c.id !== "string" || c.id.length === 0) return null;
  return {
    id: c.id,
    title: typeof c.title === "string" ? c.title : c.id,
    content: typeof c.content === "string" ? c.content : "",
  };
}

/** Tool normalisieren: nur Objekte mit id und aufrufbarer run-Funktion. */
function normalizeTool(tool: unknown): BatchTool | null {
  if (!tool || typeof tool !== "object") return null;
  const t = tool as Partial<BatchTool>;
  if (typeof t.id !== "string" || t.id.length === 0) return null;
  if (typeof t.run !== "function") return null;
  return {
    id: t.id,
    label: typeof t.label === "string" ? t.label : t.id,
    run: t.run as BatchTool["run"],
    category: typeof t.category === "string" ? t.category : "sonstiges",
  };
}

/** Schweregrad-Token (inkl. deutscher Aliase) auf kanonische Werte abbilden. */
function parseSeverityToken(token: string): BatchSeverity | null {
  switch (token.toLowerCase()) {
    case "error":
    case "fehler":
      return "error";
    case "warning":
    case "warn":
    case "warnung":
      return "warning";
    case "info":
    case "hinweis":
      return "info";
    default:
      return null;
  }
}

// Entweder Bracket-Form `[info]` (Separator optional) oder `info:` / `info-`.
const SEVERITY_PREFIX =
  /^\s*(?:\[(error|warning|warn|info|fehler|warnung|hinweis)\]|(error|warning|warn|info|fehler|warnung|hinweis)\s*[:\-|])\s*/i;
const LINE_PREFIX = /^(?:line\s*)?(\d+)\s*[:\-|)]\s*/i;
const BULLET_PREFIX = /^\s*[-*•]\s*/;

/** Eine einzelne Ausgabezeile in einen Befund verwandeln (oder null). */
function parseOutputLine(
  rawLine: string,
  chapter: BatchChapter,
  tool: BatchTool,
): BatchFinding | null {
  let rest = rawLine.replace(BULLET_PREFIX, "").trim();
  if (rest.length === 0) return null;

  let severity: BatchSeverity = "info";

  const sevMatch = rest.match(SEVERITY_PREFIX);
  if (sevMatch) {
    severity = parseSeverityToken(sevMatch[1] ?? sevMatch[2]) ?? "info";
    rest = rest.slice(sevMatch[0].length).trim();
  }

  let line = 1;
  const lineMatch = rest.match(LINE_PREFIX);
  if (lineMatch) {
    const n = parseInt(lineMatch[1], 10);
    if (Number.isFinite(n) && n >= 0) line = Math.max(1, n);
    rest = rest.slice(lineMatch[0].length).trim();
  }

  if (rest.length === 0) return null;

  return {
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    line,
    toolId: tool.id,
    toolLabel: tool.label,
    severity,
    message: rest,
  };
}

/** Tool-Ausgabe in Befunde übersetzen; Nicht-Strings ergeben keine Befunde. */
function parseToolOutput(raw: unknown, chapter: BatchChapter, tool: BatchTool): BatchFinding[] {
  if (typeof raw !== "string" || raw.trim().length === 0) return [];
  const text = raw.length > MAX_OUTPUT_CHARS ? raw.slice(0, MAX_OUTPUT_CHARS) : raw;
  const out: BatchFinding[] = [];
  for (const line of text.split(/\r?\n/)) {
    const finding = parseOutputLine(line, chapter, tool);
    if (finding) out.push(finding);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

/**
 * Führt alle Tools über alle Kapitel aus. Prozessiert in Chunks und gibt
 * zwischen den Chunks die Kontrolle an die Event-Loop ab (Default: nach jedem
 * Kapitel). Fehler einzelner Tools stoppen den Batch NICHT — sie werden als
 * error-Befund protokolliert. Ausufernde Befundmengen werden begrenzt.
 */
export async function runBatchAnalysis(
  chapters: BatchChapter[],
  tools: BatchTool[],
  options: BatchRunnerOptions = {},
): Promise<BatchReport> {
  const safeChapters = (Array.isArray(chapters) ? chapters : [])
    .map(normalizeChapter)
    .filter((c): c is BatchChapter => c !== null);
  const safeTools = (Array.isArray(tools) ? tools : [])
    .map(normalizeTool)
    .filter((t): t is BatchTool => t !== null);

  const chunkSize = clampInt(options.chunkSize, 1, 1000, 1);
  const yieldFn = typeof options.yieldFn === "function" ? options.yieldFn : yieldToEventLoop;
  const now = typeof options.nowFn === "function" ? options.nowFn : () => Date.now();
  const maxPerChapter = clampInt(
    options.maxFindingsPerChapter,
    1,
    MAX_OUTPUT_CHARS,
    DEFAULT_MAX_FINDINGS_PER_CHAPTER,
  );
  const maxTotal = clampInt(
    options.maxTotalFindings,
    1,
    MAX_OUTPUT_CHARS,
    DEFAULT_MAX_TOTAL_FINDINGS,
  );

  const startedAt = now();
  const findings: BatchFinding[] = [];
  const executedToolIds = new Set<string>();
  let chaptersScanned = 0;
  let stopped = false;

  const push = (finding: BatchFinding): boolean => {
    if (findings.length >= maxTotal) {
      stopped = true;
      return false;
    }
    findings.push(finding);
    return true;
  };

  for (let i = 0; i < safeChapters.length; i++) {
    if (stopped) break;
    const chapter = safeChapters[i];
    let chapterFindingCount = 0;

    for (const tool of safeTools) {
      if (stopped) break;
      if (chapterFindingCount >= maxPerChapter) break;

      let raw: unknown;
      try {
        raw = await tool.run(chapter.content);
        executedToolIds.add(tool.id);
      } catch (err) {
        executedToolIds.add(tool.id);
        if (
          push({
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            line: 1,
            toolId: tool.id,
            toolLabel: tool.label,
            severity: "error",
            message: `Tool "${tool.label}" fehlgeschlagen: ${toErrorMessage(err)}`,
          })
        ) {
          chapterFindingCount++;
        }
        continue;
      }

      for (const finding of parseToolOutput(raw, chapter, tool)) {
        if (stopped) break;
        if (chapterFindingCount >= maxPerChapter) break;
        if (push(finding)) chapterFindingCount++;
      }
    }

    chaptersScanned++;

    const isLast = i === safeChapters.length - 1;
    if (!isLast && (i + 1) % chunkSize === 0) {
      await yieldFn();
    }
  }

  return {
    findings,
    chaptersScanned,
    toolsRun: executedToolIds.size,
    durationMs: Math.max(0, now() - startedAt),
  };
}

/**
 * Erzeugt ein Sprungziel für die Editor-Navigation. Wird `chapters` mitgegeben,
 * wird der Kapitel-Index aufgelöst; sonst bleibt er -1. Ungültige Zeilen
 * werden defensiv auf 1 geklemmt.
 */
export function createJumpTarget(finding: BatchFinding, chapters: BatchChapter[] = []): JumpTarget {
  if (!finding || typeof finding !== "object") {
    return { chapterId: "", chapterIndex: -1, line: 1 };
  }

  const list = Array.isArray(chapters) ? chapters : [];
  const chapterId = typeof finding.chapterId === "string" ? finding.chapterId : "";
  const chapterIndex = list.findIndex((c) => c && c.id === chapterId);

  const rawLine = Number(finding.line);
  const line = Number.isFinite(rawLine) ? Math.max(1, Math.floor(rawLine)) : 1;

  return { chapterId, chapterIndex, line };
}

/**
 * Aggregiert Befunde eines Reports nach Schweregrad und nach Tool. Robuste
 * Variante: fehlende/ungültige Findings werden übersprungen, unbekannte
 * Schweregrade zählen als info.
 */
export function summarizeReport(report: BatchReport): BatchSummary {
  const summary: BatchSummary = {
    total: 0,
    errors: 0,
    warnings: 0,
    infos: 0,
    byTool: {},
  };

  const findings = report && Array.isArray(report.findings) ? report.findings : [];

  for (const finding of findings) {
    if (!finding || typeof finding !== "object") continue;
    summary.total += 1;

    if (finding.severity === "error") summary.errors += 1;
    else if (finding.severity === "warning") summary.warnings += 1;
    else summary.infos += 1;

    const toolKey =
      typeof finding.toolId === "string" && finding.toolId.length > 0 ? finding.toolId : "unknown";
    summary.byTool[toolKey] = (summary.byTool[toolKey] ?? 0) + 1;
  }

  return summary;
}
