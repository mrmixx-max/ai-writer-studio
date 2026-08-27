// Preflight-Prüflauf.
//
// Bindet Regelwerk und Persistenz zusammen. Läuft vollständig offline —
// ein Modell wird nie benötigt.

import { listChapters, getChapter } from "@/services/project";
import { tiptapToText } from "@/services/editor/count";
import { uid } from "@/services/knowledge/util";
import { STRUCTURE_RULES } from "./rules-structure";
import { CONTENT_RULES } from "./rules-content";
import { FORMAT_RULES } from "./rules-format";
import { fingerprint, type ChapterInput, type PreflightInput, type RawFinding } from "./rules-base";
import { saveReport, loadDecisions, loadDisabledRules } from "./store";
import { EXPORT_FORMATS } from "@/types/preflight";
import type {
  ExportFormat,
  PreflightFinding,
  PreflightOptions,
  PreflightReport,
  PreflightResult,
} from "@/types/preflight";

/** Alle Regeln in fester Reihenfolge. */
const ALL_RULES = [...STRUCTURE_RULES, ...CONTENT_RULES, ...FORMAT_RULES];

/** Zählt Wörter wie der Editor. */
function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? []).length;
}

/**
 * Führt den Preflight aus.
 *
 * Wirft nicht: Eine Regel, die scheitert, überspringt sich selbst und wird im
 * Bericht vermerkt. Ein einzelner Regelfehler darf nicht den ganzen Lauf
 * unbrauchbar machen.
 */
export async function runPreflight(
  projectId: string,
  projectName: string,
  options: PreflightOptions = {},
): Promise<PreflightResult> {
  const started = Date.now();
  const reportId = uid("pfrep");

  const formats = options.formats ?? EXPORT_FORMATS;
  const checkFrontmatter = options.checkFrontmatter ?? true;
  const checkBackmatter = options.checkBackmatter ?? true;

  // --- Kapitel einlesen ----------------------------------------------------
  options.onProgress?.(0, 3, "Kapitel werden gelesen…");

  const all = listChapters(projectId);
  const selected = options.chapterId ? all.filter((c) => c.id === options.chapterId) : all;

  const chapters: ChapterInput[] = [];
  const failed: string[] = [];

  for (const c of selected) {
    try {
      const full = getChapter(c.id);
      const raw = full?.content ?? "{}";
      const text = tiptapToText(raw);
      chapters.push({
        id: c.id,
        title: c.title,
        text,
        raw,
        orderIndex: c.orderIndex,
        wordCount: countWords(text),
      });
    } catch (e) {
      failed.push(`Kapitel „${c.title}“: ${(e as Error)?.message ?? String(e)}`);
    }
  }

  const input: PreflightInput = {
    projectId,
    projectName,
    chapters,
    formats,
    checkFrontmatter,
    checkBackmatter,
  };

  // --- Regeln ausführen ----------------------------------------------------
  options.onProgress?.(1, 3, `${ALL_RULES.length} Regeln werden geprüft…`);

  const disabled = loadDisabledRulesSafe(projectId);
  const raws: RawFinding[] = [];

  for (const rule of ALL_RULES) {
    try {
      for (const f of rule(input)) {
        // Abgeschaltete Regeln übergehen — der Autor hat entschieden.
        if (disabled.has(f.ruleId)) continue;
        raws.push(f);
      }
    } catch (e) {
      failed.push(`Regel übersprungen: ${(e as Error)?.message ?? String(e)}`);
    }
  }

  // --- Entscheidungen übernehmen -------------------------------------------
  options.onProgress?.(2, 3, "Frühere Entscheidungen werden übernommen…");

  const decisions = loadDecisionsSafe(projectId);
  const now = Date.now();

  const findings: PreflightFinding[] = raws.map((r) => {
    const fp = fingerprint(r);
    const prev = decisions.get(fp);
    return {
      id: uid("pff"),
      reportId,
      projectId,
      chapterId: r.chapterId,
      chapterTitle: chapters.find((c) => c.id === r.chapterId)?.title ?? null,
      category: r.category,
      severity: r.severity,
      // Als bewusst markierte Befunde behalten diese Einordnung.
      kind: prev === "accepted" ? "intentional" : r.kind,
      status: prev ?? "open",
      ruleId: r.ruleId,
      title: r.title,
      explanation: r.explanation,
      recommendation: r.recommendation,
      excerpt: r.excerpt,
      structureHint: r.structureHint,
      affectedFormats: r.affectedFormats,
      charStart: r.charStart,
      charEnd: r.charEnd,
      fingerprint: fp,
      createdAt: now,
    };
  });

  // --- Bericht -------------------------------------------------------------
  const open = findings.filter((f) => f.status === "open");

  const report: PreflightReport = {
    id: reportId,
    projectId,
    chapterId: options.chapterId ?? null,
    scope: options.chapterId ? "chapter" : "project",
    formats,
    blockerCount: open.filter((f) => f.severity === "blocker").length,
    warningCount: open.filter((f) => f.severity === "warning").length,
    hintCount: open.filter((f) => f.severity === "hint").length,
    checkedFrontmatter: checkFrontmatter,
    checkedBackmatter: checkBackmatter,
    notice:
      failed.length > 0
        ? `${failed.length} Teil(e) der Prüfung wurden übersprungen: ${failed.join("; ")}. ` +
          "Der übrige Bericht ist gültig, aber unvollständig."
        : null,
    createdAt: now,
    durationMs: Date.now() - started,
  };

  await saveReport(report, findings);
  options.onProgress?.(3, 3, "Fertig");

  return { report, findings, degraded: failed.length > 0 };
}

/** Lädt Entscheidungen; bei Fehler leer, damit der Lauf nicht scheitert. */
function loadDecisionsSafe(projectId: string) {
  try {
    return loadDecisions(projectId);
  } catch {
    return new Map<string, PreflightFinding["status"]>();
  }
}

/** Lädt abgeschaltete Regeln; bei Fehler leer. */
function loadDisabledRulesSafe(projectId: string): Set<string> {
  try {
    return loadDisabledRules(projectId);
  } catch {
    return new Set<string>();
  }
}

/**
 * Prüft nur, was für ein einzelnes Format vor dem Export relevant ist.
 *
 * Schneller Lauf für das Export-Gate: Frontmatter und Backmatter werden
 * übergangen, weil sie den Export nicht behindern und der Autor sie beim
 * vollen Lauf schon gesehen hat.
 */
export async function runExportPreflight(
  projectId: string,
  projectName: string,
  format: ExportFormat,
): Promise<PreflightResult> {
  return runPreflight(projectId, projectName, {
    formats: [format],
    checkFrontmatter: false,
    checkBackmatter: false,
  });
}
