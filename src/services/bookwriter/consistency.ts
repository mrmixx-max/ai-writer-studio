// Sprint 3, Teil 3: Konsistenz-Prüfer — Kapitel gegen die Memory-Base.
//
// Erkennt logische Brüche in fertigen Kapiteln:
// - Namensänderungen/Drift (Entität aus der Fakten-Base taucht in abweichender
//   Schreibweise auf bzw. verbindliche Entität fehlt in späteren Kapiteln)
// - Zeitlinien-Brüche (Widerspruch zu expliziten Zeitlinien-Fakten)
// - Alters-/Zahlkonflikte (Charakter-Eigenschaft widerspricht Text)
//
// Übergabe an den Revisions-Loop (Sprint 2): Befunde vom Severity "error"
// setzen das Kapitel auf needs_revision (updateChapterFields) und der
// findings-Status wird auf "revision_queued" gesetzt — der Loop konsumiert
// diese Kapitel wie gehabt (reviseChapter, ChapterReview-UI).
//
// Die Prüfung ist regelbasiert und deterministisch (kein LLM-Call nötig);
// ein optionaler LLM-Faktencheck kann über den Router (task_class=logic)
// nachgeschaltet werden — der Konsistenz-Kern funktioniert offline.

import { getDb, persist } from "@/services/db";
import { uid } from "@/services/knowledge/util";
import { listFacts, type StoredFact, type FactKind } from "./contextManager";
import { updateChapterFields } from "@/services/project";

/** Typ eines Konsistenz-Befunds. */
export type ConsistencyType = "name_drift" | "missing_entity" | "timeline_break" | "attribute_conflict";

export const CONSISTENCY_TYPE_LABELS: Record<ConsistencyType, string> = {
  name_drift: "Namensänderung",
  missing_entity: "Fehlende Entität",
  timeline_break: "Zeitlinien-Bruch",
  attribute_conflict: "Eigenschaftskonflikt",
};

/** Severity eines Befunds. */
export type ConsistencySeverity = "warning" | "error";

/** Ein Befund des Konsistenz-Prüfers. */
export interface ConsistencyFinding {
  id: string;
  runId: string;
  projectId: string;
  chapterIndex: number;
  chapterTitle: string;
  type: ConsistencyType;
  severity: ConsistencySeverity;
  factKey: string | null;
  expected: string | null;
  found: string | null;
  details: string;
  status: "open" | "revision_queued" | "dismissed";
  createdAt: number;
}

/** Kapitel-Input für die Prüfung. */
export interface ChapterToCheck {
  index: number;
  title: string;
  content: string;
}

const FINDING_COLUMNS =
  "id, run_id, project_id, chapter_index, chapter_title, type, severity, fact_key, expected, found, details, status, created_at";

function rowToFinding(v: unknown[]): ConsistencyFinding {
  return {
    id: String(v[0]),
    runId: String(v[1]),
    projectId: String(v[2]),
    chapterIndex: Number(v[3]),
    chapterTitle: String(v[4]),
    type: String(v[5]) as ConsistencyType,
    severity: String(v[6]) as ConsistencySeverity,
    factKey: v[7] === null || v[7] === undefined ? null : String(v[7]),
    expected: v[8] === null || v[8] === undefined ? null : String(v[8]),
    found: v[9] === null || v[9] === undefined ? null : String(v[9]),
    details: String(v[10]),
    status: String(v[11]) as ConsistencyFinding["status"],
    createdAt: Number(v[12]),
  };
}

/** Stopwörter, die nie Entitäten sein können (Einzelwörter). */
const NAME_STOPWORDS = new Set([
  "Der", "Die", "Das", "Ein", "Eine", "Ich", "Er", "Sie", "Es", "Wir",
  "Und", "Aber", "Denn", "Doch", "Wie", "Was", "Wer", "Wo", "Wann",
  "Kapitel", "Zusammenfassung", "Ergebnis", "Ziel", "Konflikt", "Im", "In",
  "Am", "Zur", "Zum", "Beim", "Nach", "Vor", "Bei", "Mit", "Ohne", "Als",
]);

/**
 * Extrahiert Namens-Kandidaten als Wortfolgen (1–3 aufeinanderfolgende
 * groß geschriebene Wörter) — "Anna Weber" bleibt ein Name statt zweier
 * Tokens, "Weber" allein ist eine zulässige Kurzform.
 */
export function extractNameSequences(text: string): string[] {
  const seqs = text.match(/\p{Lu}\p{L}{2,}(?:\s+\p{Lu}\p{L}{2,}){0,2}/gu) ?? [];
  const out: string[] = [];
  for (const raw of seqs) {
    const seq = raw.trim();
    if (!seq) continue;
    // Nur komplette Folgen als Kandidaten; Einzelwörter durch Stopwort-Filter.
    const words = seq.split(/\s+/);
    if (words.length === 1 && NAME_STOPWORDS.has(words[0])) continue;
    out.push(seq);
  }
  return [...new Set(out)];
}

/** Zerlegt einen Fakt-Schlüssel in Tokens (für Kurzform-Erkennung). */
function keyTokens(key: string): string[] {
  return key.split(/\s+/).map((w) => w.trim()).filter(Boolean);
}

/**
 * Prüft, ob ein Kandidat eine zulässige Kurzform eines bekannten Schlüssels
 * ist (einzelnes Token, das im Schlüssel vorkommt — z.B. "Weber" für
 * "Anna Weber"). Kurzformen sind Prosa-normal, kein Drift.
 */
function isShortFormOf(candidate: string, key: string): boolean {
  if (candidate.includes(" ")) return false;
  return keyTokens(key).some((t) => normalizeName(t) === normalizeName(candidate));
}

/** Normalisiert einen Namen für den Drift-Vergleich (Groß/Klein, Trennzeichen, Umlaut-Varianten). */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\u200b/g, "")
    .replace(/\u200c/g, "")
    .replace(/\u200d/g, "")
    .replace(/\ufeff/g, "")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

/** Prüft, ob zwei Namen nahe genug sind, um dieselbe Entität zu meinen. */
export function namesLikelySame(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Drift-Kandidat: einer enthält den anderen (z.B. "Max" vs "Max Weber")
  // gilt als gleich — echte Drift ist bei gleicher Länge + Edit-Distanz.
  if (na.includes(nb) || nb.includes(na)) return true;
  // Levenshtein-Distanz ≤ 1 für Namen ab 5 Zeichen → Tippvarianten.
  if (na.length >= 5 && nb.length >= 5 && Math.abs(na.length - nb.length) <= 1) {
    return levenshtein(na, nb) <= 1;
  }
  // Tokenweise: gleiche Token-Anzahl und alle Token ähnlich (z.B.
  // "Ann Weber" vs "Anna Weber" — Vorname um einen Buchstaben gedriftet).
  const ta = a.trim().split(/\s+/);
  const tb = b.trim().split(/\s+/);
  if (ta.length === tb.length && ta.length > 0) {
    return ta.every((x, i) => {
      const nx = normalizeName(x);
      const ny = normalizeName(tb[i]);
      if (nx === ny) return true;
      return nx.length >= 3 && ny.length >= 3 && levenshtein(nx, ny) <= 1;
    });
  }
  return false;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 2) return Math.max(m, n);
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

/** Zieht Zahl+Einheit aus einem Fakten-Wert (z.B. "34 Jahre alt"). */
function extractNumber(text: string): number | null {
  const m = text.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Alter im Text einer Charakter-Beschreibung (z.B. "war 34 Jahre alt"). */
function extractAgeMentions(content: string, name: string): Array<{ years: number; context: string }> {
  const out: Array<{ years: number; context: string }> = [];
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}[^.!?]{0,80}?\\b(\\d{1,3})\\s*(?:Jahre(?:\\s+alt)?|jahrig(?:e|er|es)?)`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    out.push({ years: Number(m[1]), context: m[0].trim() });
  }
  return out;
}

/**
 * Prüft ein Kapitel gegen die Fakten-Base. Rein synchron/regelbasiert.
 * runId dient nur der Signatur-Symmetrie (Befund-Erzeugung ohne Persistenz).
 */
export function checkChapterConsistency(
  _runId: string,
  projectId: string,
  chapter: ChapterToCheck,
  facts: StoredFact[],
): Omit<ConsistencyFinding, "id" | "runId" | "projectId" | "createdAt">[] {
  const findings: Omit<ConsistencyFinding, "id" | "runId" | "projectId" | "createdAt">[] = [];

  const relevant = facts.filter((f) => f.projectId === projectId);
  const characters = relevant.filter((f) => f.kind === "character");
  const entities = relevant.filter((f) => ["entity", "place", "terminology"].includes(f.kind));
  const timelines = relevant.filter((f) => f.kind === "timeline");

  // --- 1. Namensdrift: bekannte Entität erscheint in abweichender Schreibweise.
  const knownNames = [...characters.map((f) => f.key), ...entities.map((f) => f.key)];
  const candidates = extractNameSequences(chapter.content);
  // Sequenzen, die einen bekannten Schlüssel exakt (oder als zulässige
  // Kurzform) repräsentieren, sind konsistent — kein Drift-Befund.
  // Bewusst NICHT fuzzy: Fuzzy-Ähnlichkeit ist das Drift-Signal selbst.
  const matchesKnownKey = (seq: string): boolean =>
    knownNames.some(
      (k) => normalizeName(seq) === normalizeName(k) || isShortFormOf(seq, k) || normalizeName(k).includes(normalizeName(seq)),
    );

  for (const cand of candidates) {
    if (matchesKnownKey(cand)) continue;
    for (const known of knownNames) {
      if (namesLikelySame(cand, known)) {
        findings.push({
          chapterIndex: chapter.index,
          chapterTitle: chapter.title,
          type: "name_drift",
          severity: "warning",
          factKey: known,
          expected: known,
          found: cand,
          details: `„${cand}" ähnelt der verbindlichen Entität „${known}" — mögliche Namensänderung im Kapitel „${chapter.title}".`,
          status: "open",
        });
        break; // ein Befund pro Kandidat reicht
      }
    }
  }

  // --- 2. Fehlende verbindliche Entität: wird auf Buch-Ebene geprüft
  // (checkMissingEntities) — Charaktere müssen nicht in jedem Kapitel
  // auftauchen, nur in mindestens einem Folgekapitel nach ihrem Debüt.

  // --- 3. Zeitlinien-Brüche: Fakten der Art timeline widersprechen dem Text.
  for (const tl of timelines) {
    const tlYear = extractNumber(tl.value);
    if (tlYear === null) continue;
    // Timeline-Fakt besagt z.B. key "Handlungszeitraum", value "1987".
    // Im Text genannte Jahreszahlen, die klar außerhalb liegen, sind Brüche.
    const yearsInText = chapter.content.match(/\b(1\d{3}|20\d{2})\b/g) ?? [];
    for (const y of yearsInText) {
      const year = Number(y);
      const gap = Math.abs(year - tlYear);
      if (gap > 1) {
        findings.push({
          chapterIndex: chapter.index,
          chapterTitle: chapter.title,
          type: "timeline_break",
          severity: "error",
          factKey: tl.key,
          expected: String(tlYear),
          found: y,
          details: `Jahreszahl ${y} widerspricht der Zeitlinie „${tl.key}": ${tl.value}.`,
          status: "open",
        });
      }
      break; // nur die erste abweichende Jahreszahl je Zeitlinien-Fakt
    }
  }

  // --- 4. Attribut-Konflikte: Alter aus der Fakten-Base vs. Text.
  for (const ch of characters) {
    const baseAge = extractNumber(ch.value);
    if (baseAge === null) continue;
    for (const mention of extractAgeMentions(chapter.content, ch.key)) {
      if (Math.abs(mention.years - baseAge) > 2) {
        findings.push({
          chapterIndex: chapter.index,
          chapterTitle: chapter.title,
          type: "attribute_conflict",
          severity: "error",
          factKey: ch.key,
          expected: `${baseAge} Jahre`,
          found: String(mention.years),
          details: `Alter von „${ch.key}" widerspricht der Fakten-Base: ${mention.context}.`,
          status: "open",
        });
      }
    }
  }

  return findings;
}

/**
 * Buch-Ebene: verbindliche Charaktere (confidence >= 0.9), die nach ihrem
 * ersten Auftreten in keinem Folgekapitel mehr vorkommen.
 * runId/projectId dienen der Signatur-Symmetrie; gefiltert wird über die
 * übergebenen facts.
 */
export function checkMissingEntities(
  _runId: string,
  _projectId: string,
  chapters: ChapterToCheck[],
  facts: StoredFact[],
): Omit<ConsistencyFinding, "id" | "runId" | "projectId" | "createdAt">[] {
  const findings: Omit<ConsistencyFinding, "id" | "runId" | "projectId" | "createdAt">[] = [];
  const characters = facts.filter((f) => f.kind === "character" && f.confidence >= 0.9);

  for (const ch of characters) {
    let lastSeen = -1;
    for (const c of chapters) {
      if (c.content.includes(ch.key)) lastSeen = Math.max(lastSeen, c.index);
    }
    if (lastSeen >= 0 && lastSeen < chapters.length - 1) {
      const later = chapters.filter((c) => c.index > lastSeen);
      const missing = later.filter((c) => !c.content.includes(ch.key));
      if (missing.length === later.length && later.length >= 2) {
        const last = chapters[chapters.length - 1];
        findings.push({
          chapterIndex: last.index,
          chapterTitle: last.title,
          type: "missing_entity",
          severity: "warning",
          factKey: ch.key,
          expected: `Auftritt seit Kapitel ${lastSeen + 1}`,
          found: "fehlt in allen Folgekapiteln",
          details: `„${ch.key}" taucht nach Kapitel ${lastSeen + 1} in keinem der ${later.length} Folgekapitel mehr auf.`,
          status: "open",
        });
      }
    }
  }
  return findings;
}

/** Speichert einen Befund. */
export async function saveFinding(
  runId: string,
  projectId: string,
  finding: Omit<ConsistencyFinding, "id" | "runId" | "projectId" | "createdAt">,
): Promise<ConsistencyFinding> {
  const db = getDb();
  const full: ConsistencyFinding = {
    ...finding,
    id: uid("bwc"),
    runId,
    projectId,
    createdAt: Date.now(),
  };
  db.run(
    `INSERT INTO bookwriter_consistency_findings (${FINDING_COLUMNS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [full.id, full.runId, full.projectId, full.chapterIndex, full.chapterTitle, full.type, full.severity, full.factKey, full.expected, full.found, full.details, full.status, full.createdAt],
  );
  await persist();
  return full;
}

/** Alle Befunde eines Laufs. */
export function listFindings(runId: string): ConsistencyFinding[] {
  const res = getDb().exec(
    `SELECT ${FINDING_COLUMNS} FROM bookwriter_consistency_findings WHERE run_id = ? ORDER BY chapter_index, created_at`,
    [runId],
  );
  if (!res.length) return [];
  return res[0].values.map(rowToFinding);
}

/** Setzt einen Befund auf dismissed (Autor hat ihn geprüft und verworfen). */
export async function dismissFinding(id: string): Promise<void> {
  getDb().run("UPDATE bookwriter_consistency_findings SET status = 'dismissed' WHERE id = ?", [id]);
  await persist();
}

export interface ConsistencyRunResult {
  checkedChapters: number;
  findings: ConsistencyFinding[];
  /** Kapitel-Indizes, die wegen Severity=error an den Revisions-Loop übergeben wurden. */
  queuedForRevision: number[];
}

/**
 * Prüft alle Kapitel eines Laufs gegen die Memory-Base und übergibt
 * Fehler-Befunde an den Revisions-Loop:
 * - Befund wird in bookwriter_consistency_findings persistiert.
 * - Kapitel mit Severity "error" → Status needs_revision (Sprint-2-Loop
 *   konsumiert needs_revision in ChapterReview via reviseChapter).
 * - findings-Status → "revision_queued".
 *
 * Diese Funktion ruft selbst KEIN LLM auf — sie klassifiziert und übergibt.
 */
export async function runConsistencyCheck(
  runId: string,
  projectId: string,
  chapters: ChapterToCheck[],
  options: { queueRevision?: boolean } = {},
): Promise<ConsistencyRunResult> {
  const facts = listFacts(projectId);
  const queueRevision = options.queueRevision ?? true;
  const findings: ConsistencyFinding[] = [];
  const queued: number[] = [];

  for (const chapter of chapters) {
    const chapterFindings = [
      ...checkChapterConsistency(runId, projectId, chapter, facts),
    ];
    for (const f of chapterFindings) {
      const saved = await saveFinding(runId, projectId, f);
      findings.push(saved);
      if (saved.severity === "error" && queueRevision && !queued.includes(chapter.index)) {
        queued.push(chapter.index);
      }
    }
  }

  // Buch-Ebene: fehlende verbindliche Entitäten.
  for (const f of checkMissingEntities(runId, projectId, chapters, facts)) {
    const saved = await saveFinding(runId, projectId, f);
    findings.push(saved);
  }

  // Übergabe an den Revisions-Loop (Sprint 2): Kapitel-Status setzen.
  if (queueRevision) {
    for (const idx of queued) {
      const chapterId = chapterIdForIndex(runId, projectId, idx);
      if (chapterId) {
        await updateChapterFields(chapterId, { status: "needs_revision", lastError: "Konsistenz-Prüfer: Befunde erfordern Revision." });
      }
      // findings-Status auf revision_queued setzen.
      const db = getDb();
      db.run(
        `UPDATE bookwriter_consistency_findings SET status = 'revision_queued' WHERE run_id = ? AND chapter_index = ? AND severity = 'error'`,
        [runId, idx],
      );
      await persist();
    }
  }

  return { checkedChapters: chapters.length, findings, queuedForRevision: queued };
}

/**
 * Löst die Kapitel-ID für einen Kapitel-Index auf (Artefakt "chapters" des
 * Manuskript-Phase). Gibt null zurück, wenn nicht auffindbar — die Prüfung
 * bricht nicht, wenn die UI-Struktur abweicht.
 */
function chapterIdForIndex(runId: string, projectId: string, index: number): string | null {
  void projectId;
  const res = getDb().exec(
    `SELECT content FROM bookwriter_artifacts WHERE run_id = ? AND artifact_type = 'chapters' ORDER BY created_at DESC LIMIT 1`,
    [runId],
  );
  if (!res.length || !res[0].values.length) return null;
  try {
    const chapters = JSON.parse(String(res[0].values[0][0])) as Array<{ id?: string }>;
    return chapters[index]?.id ?? null;
  } catch {
    return null;
  }
}

/** Re-export für Import-Komfort im Workflow. */
export type { StoredFact, FactKind };
