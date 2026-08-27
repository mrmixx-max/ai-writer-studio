// Prüflauf über ein Projekt oder ein Kapitel.
//
// Führt alle regelbasierten Prüfungen aus, speichert die Befunde und liefert
// einen Bericht. Läuft vollständig offline — ein Modell wird nie benötigt.
//
// Entscheidungen des Nutzers (ignorieren, als bewusst markieren) überleben
// einen erneuten Prüflauf: Befunde werden über einen Fingerabdruck
// wiedererkannt, damit niemand seine Bewertungen zweimal treffen muss.

import { getDb, persist } from "@/services/db";
import { listChapters, getChapter } from "@/services/project";
import { listCharacters, listLocations } from "@/services/knowledge/profiles";
import { tiptapToText } from "@/services/editor/count";
import { analyzeText } from "./textmodel";
import { checkStyle, type StyleMetrics } from "./style";
import {
  checkCharacters,
  checkWorld,
  checkPointOfView,
  checkTerminology,
  checkTimeline,
} from "./consistency";
import { contentHash, uid } from "@/services/knowledge/util";

/** Ein gespeicherter Befund mit Nutzerentscheidung. */
export interface Finding {
  id: string;
  projectId: string;
  chapterId: string | null;
  chapterTitle: string | null;
  category: string;
  kind: "error" | "possible" | "intentional";
  severity: "high" | "medium" | "low";
  message: string;
  explanation: string;
  subject: string | null;
  start: number | null;
  end: number | null;
  snippet: string | null;
  /** Stabiler Fingerabdruck zur Wiedererkennung nach erneutem Lauf. */
  fingerprint: string;
  /** true, wenn der Befund von einer Regel stammt (nicht von einem Modell). */
  ruleBased: boolean;
  status: "open" | "ignored" | "accepted";
  createdAt: number;
}

/** Ergebnis eines Prüflaufs. */
export interface DiagnosticReport {
  reportId: string;
  projectId: string;
  scope: "project" | "chapter";
  chaptersChecked: number;
  findings: Finding[];
  metrics: StyleMetrics | null;
  /** Je Kapitel die Kennwerte, für den Stil-Tab. */
  perChapter: Array<{ chapterId: string; title: string; metrics: StyleMetrics }>;
  /** true, wenn Teile der Prüfung nicht möglich waren. */
  degraded: boolean;
  notice: string | null;
  durationMs: number;
}

/** Schweregrad aus dem Gewicht ableiten. */
function severityOf(weight: number, kind: string): "high" | "medium" | "low" {
  if (kind === "error") return "high";
  if (weight >= 0.6) return "medium";
  return "low";
}

/**
 * Fingerabdruck eines Befunds.
 *
 * Bewusst OHNE Position: Fügt der Autor oben einen Absatz ein, verschieben
 * sich alle Offsets — der Befund wäre sonst ein anderer, und die Entscheidung
 * "ignorieren" ginge verloren. Kategorie, Meldung und Textausschnitt genügen
 * zur Wiedererkennung.
 */
function fingerprintOf(
  chapterId: string | null,
  category: string,
  message: string,
  snippet: string | null,
): string {
  return contentHash([chapterId ?? "project", category, message, snippet ?? ""].join("\u0001"));
}

interface RunOptions {
  /** Nur dieses Kapitel prüfen. */
  chapterId?: string;
  onProgress?: (done: number, total: number, label?: string) => void;
}

/**
 * Führt alle regelbasierten Prüfungen aus.
 * Wirft nicht: Fehler an einem Kapitel überspringen dieses und werden im
 * Bericht vermerkt, statt den ganzen Lauf abzubrechen.
 */
export async function runDiagnostics(
  projectId: string,
  options: RunOptions = {},
): Promise<DiagnosticReport> {
  const started = Date.now();
  const reportId = uid("rep");

  const chapters = options.chapterId
    ? listChapters(projectId).filter((c) => c.id === options.chapterId)
    : listChapters(projectId);

  const characters = listCharacters(projectId);
  const locations = listLocations(projectId);

  const findings: Finding[] = [];
  const perChapter: DiagnosticReport["perChapter"] = [];
  const failed: string[] = [];

  // Gesamttext für projektweite Prüfungen (Zeitlinie, Begriffsdrift).
  const wholeParts: string[] = [];

  const total = chapters.length + 1; // +1 für den projektweiten Durchgang
  let done = 0;

  for (const ch of chapters) {
    options.onProgress?.(done, total, `Kapitel „${ch.title}“ wird geprüft…`);
    try {
      const full = getChapter(ch.id);
      const text = tiptapToText(full?.content ?? "{}");
      wholeParts.push(text);

      if (!text.trim()) {
        done++;
        continue;
      }

      const a = analyzeText(text);

      // Stil
      const { issues: styleIssues, metrics } = checkStyle(a);
      perChapter.push({ chapterId: ch.id, title: ch.title, metrics });

      for (const s of styleIssues) {
        findings.push(makeFinding(projectId, ch.id, ch.title, "style", "possible", s));
      }

      // Konsistenz je Kapitel
      const consistency = [
        ...checkCharacters(a, characters),
        ...checkWorld(a, locations),
        ...checkPointOfView(a),
      ];
      for (const c of consistency) {
        findings.push(
          makeFinding(projectId, ch.id, ch.title, c.category, c.kind, c),
        );
      }
    } catch (e) {
      failed.push(`${ch.title}: ${(e as Error)?.message ?? String(e)}`);
    }
    done++;
  }

  // --- Projektweite Prüfungen --------------------------------------------
  options.onProgress?.(done, total, "Projektweite Prüfungen…");
  let projectMetrics: StyleMetrics | null = null;

  const whole = wholeParts.join("\n\n");
  if (whole.trim()) {
    try {
      const a = analyzeText(whole);
      projectMetrics = checkStyle(a).metrics;

      for (const c of [...checkTimeline(a), ...checkTerminology(a)]) {
        findings.push(makeFinding(projectId, null, null, c.category, c.kind, c));
      }
    } catch (e) {
      failed.push(`Projektweite Prüfung: ${(e as Error)?.message ?? String(e)}`);
    }
  }
  done++;
  options.onProgress?.(done, total, "Fertig");

  // Frühere Entscheidungen übernehmen.
  applyPreviousDecisions(projectId, findings);

  await saveFindings(reportId, projectId, options.chapterId ?? null, findings);

  return {
    reportId,
    projectId,
    scope: options.chapterId ? "chapter" : "project",
    chaptersChecked: chapters.length,
    findings,
    metrics: projectMetrics,
    perChapter,
    degraded: failed.length > 0,
    notice:
      failed.length > 0
        ? `${failed.length} Teil(e) der Prüfung sind fehlgeschlagen: ${failed.join("; ")}. ` +
          "Der übrige Bericht ist gültig, aber unvollständig."
        : null,
    durationMs: Date.now() - started,
  };
}

/** Baut einen Finding-Datensatz aus einem Prüfergebnis. */
function makeFinding(
  projectId: string,
  chapterId: string | null,
  chapterTitle: string | null,
  category: string,
  kind: "error" | "possible",
  src: { message: string; explanation: string; snippet: string | null; start: number | null; end: number | null; weight: number; subject?: string | null },
): Finding {
  return {
    id: uid("fnd"),
    projectId,
    chapterId,
    chapterTitle,
    category,
    kind,
    severity: severityOf(src.weight, kind),
    message: src.message,
    explanation: src.explanation,
    subject: src.subject ?? null,
    start: src.start,
    end: src.end,
    snippet: src.snippet,
    fingerprint: fingerprintOf(chapterId, category, src.message, src.snippet),
    ruleBased: true,
    status: "open",
    createdAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
//  Persistenz
// ---------------------------------------------------------------------------

/**
 * Übernimmt frühere Nutzerentscheidungen auf neue Befunde.
 *
 * Ohne das müsste der Autor nach jedem Prüflauf erneut hunderte Befunde
 * wegklicken, die er längst bewertet hat. Das wäre der schnellste Weg, ein
 * Prüfwerkzeug unbenutzbar zu machen.
 */
function applyPreviousDecisions(projectId: string, findings: Finding[]): void {
  if (findings.length === 0) return;

  const db = getDb();
  const res = db.exec(
    `SELECT rule_id, status, kind FROM consistency_findings
     WHERE project_id = ? AND status != 'open' AND rule_id IS NOT NULL`,
    [projectId],
  );
  if (res.length === 0) return;

  const known = new Map<string, { status: string; kind: string }>();
  for (const row of res[0].values) {
    known.set(String(row[0]), { status: String(row[1]), kind: String(row[2]) });
  }

  for (const f of findings) {
    const prev = known.get(f.fingerprint);
    if (!prev) continue;
    f.status = prev.status as Finding["status"];
    // Als bewusst markierte Abweichungen behalten diese Einordnung.
    if (prev.kind === "intentional") f.kind = "intentional";
  }
}

/** Schreibt Bericht und Befunde. */
async function saveFindings(
  reportId: string,
  projectId: string,
  chapterId: string | null,
  findings: Finding[],
): Promise<void> {
  const db = getDb();
  const now = Date.now();

  db.run(
    `INSERT INTO consistency_reports
       (id, project_id, chapter_id, categories, used_llm, notice,
        finding_count, critical_count, metrics, created_at, duration_ms)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      reportId,
      projectId,
      chapterId,
      // Welche Kategorien geprueft wurden - fuer spaetere Teilberichte.
      "style,character,world,pov,terminology,timeline",
      0,
      null,
      findings.length,
      findings.filter((f) => f.severity === "high").length,
      null,
      now,
      0,
    ],
  );

  // Alte Befunde desselben Umfangs entfernen, damit die Liste nicht wächst.
  // Die Entscheidungen sind über applyPreviousDecisions bereits übernommen.
  db.run(
    `DELETE FROM consistency_findings
     WHERE project_id = ? AND (? IS NULL OR chapter_id = ?)`,
    [projectId, chapterId, chapterId],
  );

  for (const f of findings) {
    db.run(
      `INSERT INTO consistency_findings
         (id, report_id, project_id, chapter_id, category, kind, severity,
          status, title, explanation, excerpt, char_start, char_end,
          suggestion, rule_id, rule_based, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        f.id, reportId, f.projectId, f.chapterId, f.category, f.kind,
        f.severity, f.status, f.message, f.explanation, f.snippet,
        f.start, f.end, f.subject,
        // rule_id traegt den Fingerabdruck: Das Schema hat keine eigene
        // Spalte dafuer, und die Regel-Identitaet ist genau das, was den
        // Befund ueber Laeufe hinweg wiedererkennbar macht.
        f.fingerprint,
        f.ruleBased ? 1 : 0, f.createdAt, f.createdAt,
      ],
    );
  }

  await persist();
}

/** Lädt gespeicherte Befunde eines Projekts. */
export function listFindings(
  projectId: string,
  filter: {
    chapterId?: string | null;
    category?: string;
    minSeverity?: "high" | "medium" | "low";
    includeResolved?: boolean;
  } = {},
): Finding[] {
  const db = getDb();
  const where: string[] = ["project_id = ?"];
  const args: (string | number | null)[] = [projectId];

  if (filter.chapterId !== undefined) {
    if (filter.chapterId === null) {
      where.push("chapter_id IS NULL");
    } else {
      where.push("chapter_id = ?");
      args.push(filter.chapterId);
    }
  }
  if (filter.category) {
    where.push("category = ?");
    args.push(filter.category);
  }
  if (filter.minSeverity === "high") {
    where.push("severity = 'high'");
  } else if (filter.minSeverity === "medium") {
    where.push("severity IN ('high','medium')");
  }
  if (!filter.includeResolved) {
    where.push("status = 'open'");
  }

  const res = db.exec(
    `SELECT id, report_id, project_id, chapter_id, category, kind, severity,
            title, explanation, suggestion, char_start, char_end, excerpt,
            rule_id, rule_based, status, created_at
     FROM consistency_findings
     WHERE ${where.join(" AND ")}
     ORDER BY CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
              category, created_at`,
    args,
  );
  if (res.length === 0) return [];

  return res[0].values.map((r) => ({
    id: String(r[0]),
    projectId: String(r[2]),
    chapterId: r[3] === null ? null : String(r[3]),
    chapterTitle: null,
    category: String(r[4]),
    kind: String(r[5]) as Finding["kind"],
    severity: String(r[6]) as Finding["severity"],
    message: String(r[7]),
    explanation: String(r[8]),
    subject: r[9] === null ? null : String(r[9]),
    start: r[10] === null ? null : Number(r[10]),
    end: r[11] === null ? null : Number(r[11]),
    snippet: r[12] === null ? null : String(r[12]),
    fingerprint: String(r[13]),
    ruleBased: Number(r[14]) === 1,
    status: String(r[15]) as Finding["status"],
    createdAt: Number(r[16]),
  }));
}

/**
 * Setzt den Status eines Befunds.
 * "accepted" bedeutet: als bewusste literarische Abweichung markiert.
 */
export async function setFindingStatus(
  findingId: string,
  status: "open" | "ignored" | "accepted",
): Promise<void> {
  const db = getDb();
  db.run("UPDATE consistency_findings SET status = ? WHERE id = ?", [status, findingId]);
  // Als bewusst markierte Befunde bekommen auch die passende Einordnung,
  // damit ein späterer Lauf sie nicht wieder als Problem zeigt.
  if (status === "accepted") {
    db.run("UPDATE consistency_findings SET kind = 'intentional' WHERE id = ?", [findingId]);
  }
  await persist();
}

/** Zählt Befunde nach Schweregrad und Kategorie. */
export function findingStats(projectId: string): {
  total: number;
  high: number;
  medium: number;
  low: number;
  byCategory: Record<string, number>;
} {
  const db = getDb();
  const res = db.exec(
    `SELECT severity, category, COUNT(*) FROM consistency_findings
     WHERE project_id = ? AND status = 'open'
     GROUP BY severity, category`,
    [projectId],
  );

  const out = { total: 0, high: 0, medium: 0, low: 0, byCategory: {} as Record<string, number> };
  if (res.length === 0) return out;

  for (const row of res[0].values) {
    const sev = String(row[0]);
    const cat = String(row[1]);
    const n = Number(row[2]);
    out.total += n;
    if (sev === "high") out.high += n;
    else if (sev === "medium") out.medium += n;
    else out.low += n;
    out.byCategory[cat] = (out.byCategory[cat] ?? 0) + n;
  }
  return out;
}
