// Persistenz des Preflight: Berichte, Befunde, Entscheidungen, Regeln.

import { getDb, persist } from "@/services/db";
import { uid } from "@/services/knowledge/util";
import type {
  ExportFormat,
  PreflightFinding,
  PreflightReport,
  PreflightRule,
  PreflightStatus,
} from "@/types/preflight";

/** Wandelt eine DB-Zeile in einen Befund. */
function rowToFinding(r: unknown[]): PreflightFinding {
  return {
    id: String(r[0]),
    reportId: String(r[1]),
    projectId: String(r[2]),
    chapterId: r[3] === null ? null : String(r[3]),
    chapterTitle: null,
    category: String(r[4]) as PreflightFinding["category"],
    severity: String(r[5]) as PreflightFinding["severity"],
    kind: String(r[6]) as PreflightFinding["kind"],
    status: String(r[7]) as PreflightStatus,
    ruleId: String(r[8]),
    title: String(r[9]),
    explanation: String(r[10]),
    recommendation: r[11] === null ? null : String(r[11]),
    excerpt: r[12] === null ? null : String(r[12]),
    structureHint: r[13] === null ? null : String(r[13]),
    affectedFormats: String(r[14] ?? "")
      .split(",")
      .filter(Boolean) as ExportFormat[],
    charStart: r[15] === null ? null : Number(r[15]),
    charEnd: r[16] === null ? null : Number(r[16]),
    fingerprint: String(r[17] ?? ""),
    createdAt: Number(r[18]),
  };
}

const FINDING_COLUMNS = `id, report_id, project_id, chapter_id, category, severity,
  kind, status, rule_id, title, explanation, recommendation, excerpt,
  structure_hint, affected_formats, char_start, char_end, fingerprint, created_at`;

/** Lädt alle Befunde eines Projekts, unsortiert und ungefiltert. */
export function loadFindings(projectId: string): PreflightFinding[] {
  const res = getDb().exec(
    `SELECT ${FINDING_COLUMNS} FROM preflight_findings WHERE project_id = ?`,
    [projectId],
  );
  if (res.length === 0) return [];
  return res[0].values.map(rowToFinding);
}

/** Der jüngste Bericht eines Projekts, oder null. */
export function latestReport(projectId: string): PreflightReport | null {
  const res = getDb().exec(
    `SELECT id, project_id, chapter_id, scope, formats, blocker_count,
            warning_count, hint_count, checked_frontmatter, checked_backmatter,
            notice, created_at, duration_ms
     FROM preflight_reports WHERE project_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [projectId],
  );
  if (res.length === 0 || res[0].values.length === 0) return null;

  const r = res[0].values[0];
  return {
    id: String(r[0]),
    projectId: String(r[1]),
    chapterId: r[2] === null ? null : String(r[2]),
    scope: String(r[3]) as "project" | "chapter",
    formats: String(r[4] ?? "").split(",").filter(Boolean) as ExportFormat[],
    blockerCount: Number(r[5]),
    warningCount: Number(r[6]),
    hintCount: Number(r[7]),
    checkedFrontmatter: Number(r[8]) === 1,
    checkedBackmatter: Number(r[9]) === 1,
    notice: r[10] === null ? null : String(r[10]),
    createdAt: Number(r[11]),
    durationMs: Number(r[12]),
  };
}

/**
 * Speichert Bericht und Befunde.
 *
 * Alte Befunde desselben Umfangs werden ersetzt. Die Entscheidungen liegen
 * in preflight_decisions und bleiben davon unberührt.
 */
export async function saveReport(
  report: PreflightReport,
  findings: PreflightFinding[],
): Promise<void> {
  const db = getDb();

  db.run(
    `INSERT INTO preflight_reports
       (id, project_id, chapter_id, scope, formats, target_format,
        blocker_count, warning_count, hint_count,
        checked_frontmatter, checked_backmatter, notice, created_at, duration_ms)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      report.id,
      report.projectId,
      report.chapterId,
      report.scope,
      report.formats.join(","),
      // target_format stammt aus Migration 002 und ist NOT NULL. Das erste
      // geprüfte Format als Hauptformat eintragen.
      report.formats[0] ?? "docx",
      report.blockerCount,
      report.warningCount,
      report.hintCount,
      report.checkedFrontmatter ? 1 : 0,
      report.checkedBackmatter ? 1 : 0,
      report.notice,
      report.createdAt,
      report.durationMs,
    ],
  );

  // Befunde des geprüften Umfangs ersetzen.
  if (report.chapterId) {
    db.run("DELETE FROM preflight_findings WHERE project_id = ? AND chapter_id = ?", [
      report.projectId,
      report.chapterId,
    ]);
  } else {
    db.run("DELETE FROM preflight_findings WHERE project_id = ?", [report.projectId]);
  }

  for (const f of findings) {
    db.run(
      `INSERT INTO preflight_findings
         (id, report_id, project_id, chapter_id, category, severity, kind,
          status, rule_id, title, explanation, recommendation, excerpt,
          structure_hint, affected_formats, char_start, char_end, fingerprint,
          created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        f.id, f.reportId, f.projectId, f.chapterId, f.category, f.severity,
        f.kind, f.status, f.ruleId, f.title, f.explanation, f.recommendation,
        f.excerpt, f.structureHint, f.affectedFormats.join(","),
        f.charStart, f.charEnd, f.fingerprint, f.createdAt, f.createdAt,
      ],
    );
  }

  await persist();
}

// ---------------------------------------------------------------------------
//  Entscheidungen
// ---------------------------------------------------------------------------

/** Alle Entscheidungen eines Projekts, nach Fingerabdruck. */
export function loadDecisions(projectId: string): Map<string, PreflightStatus> {
  const res = getDb().exec(
    "SELECT fingerprint, decision FROM preflight_decisions WHERE project_id = ?",
    [projectId],
  );
  const out = new Map<string, PreflightStatus>();
  if (res.length === 0) return out;
  for (const r of res[0].values) {
    out.set(String(r[0]), String(r[1]) as PreflightStatus);
  }
  return out;
}

/**
 * Speichert eine Entscheidung dauerhaft.
 *
 * "open" löscht die Entscheidung — der Befund erscheint wieder.
 */
export async function saveDecision(
  projectId: string,
  fingerprint: string,
  decision: PreflightStatus,
  note: string | null = null,
): Promise<void> {
  const db = getDb();

  if (decision === "open") {
    db.run("DELETE FROM preflight_decisions WHERE project_id = ? AND fingerprint = ?", [
      projectId,
      fingerprint,
    ]);
  } else {
    db.run(
      `INSERT OR REPLACE INTO preflight_decisions
         (id, project_id, fingerprint, decision, note, created_at)
       VALUES (?,?,?,?,?,?)`,
      [uid("pfd"), projectId, fingerprint, decision, note, Date.now()],
    );
  }

  // Den aktuellen Befund gleich mitziehen, damit die Oberfläche sofort stimmt.
  db.run(
    `UPDATE preflight_findings SET status = ?, kind = CASE WHEN ? = 'accepted'
       THEN 'intentional' ELSE kind END, updated_at = ?
     WHERE project_id = ? AND fingerprint = ?`,
    [decision, decision, Date.now(), projectId, fingerprint],
  );

  await persist();
}

// ---------------------------------------------------------------------------
//  Regeln
// ---------------------------------------------------------------------------

/** Abgeschaltete Regeln eines Projekts. */
export function loadDisabledRules(projectId: string): Set<string> {
  const res = getDb().exec(
    "SELECT rule_id FROM preflight_rules WHERE project_id = ? AND enabled = 0",
    [projectId],
  );
  if (res.length === 0) return new Set();
  return new Set(res[0].values.map((r) => String(r[0])));
}

/** Schaltet eine Regel für ein Projekt ein oder aus. */
export async function setRuleEnabled(
  projectId: string,
  ruleId: string,
  enabled: boolean,
  note: string | null = null,
): Promise<void> {
  const now = Date.now();
  getDb().run(
    `INSERT OR REPLACE INTO preflight_rules
       (id, project_id, rule_id, enabled, threshold, note, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [uid("pfr"), projectId, ruleId, enabled ? 1 : 0, null, note, now, now],
  );
  await persist();
}

/** Alle Regeleinstellungen eines Projekts. */
export function listRules(projectId: string): PreflightRule[] {
  const res = getDb().exec(
    "SELECT id, project_id, rule_id, enabled, threshold, note FROM preflight_rules WHERE project_id = ?",
    [projectId],
  );
  if (res.length === 0) return [];
  return res[0].values.map((r) => ({
    id: String(r[0]),
    projectId: String(r[1]),
    ruleId: String(r[2]),
    enabled: Number(r[3]) === 1,
    threshold: r[4] === null ? null : Number(r[4]),
    note: r[5] === null ? null : String(r[5]),
  }));
}
