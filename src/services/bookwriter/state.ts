// Bookwriter: Statemachine und Workflow-Service.
//
// Der Workflow ist eine Kette von Phasen, die asynchron laufen. Die
// Statemachine hält den Zustand und macht ihn persistierbar, damit ein
// Lauf nach einem Absturz oder einer Pause weitergeführt werden kann.

import { getDb, persistNow } from "@/services/db";
import { uid } from "@/services/knowledge/util";
import type {
  ApprovalMode,
  BookwriterApproval,
  BookwriterPhase,
  BookwriterPhaseState,
  BookwriterRun,
  QualityScore,
} from "@/types/bookwriter";

/** Wandelt eine DB-Zeile in einen Run. */
function rowToRun(r: unknown[]): BookwriterRun {
  return {
    id: String(r[0]),
    projectId: String(r[1]),
    status: String(r[2]) as BookwriterRun["status"],
    mode: String(r[3]) as ApprovalMode,
    currentPhase: String(r[4]) as BookwriterPhase,
    phaseProgress: Number(r[5]),
    createdAt: Number(r[6]),
    updatedAt: Number(r[7]),
  };
}

const RUN_COLUMNS = `id, project_id, status, mode, current_phase, phase_progress, created_at, updated_at`;

/** Lädt den aktiven Lauf eines Projekts, oder null. */
export function loadActiveRun(projectId: string): BookwriterRun | null {
  const res = getDb().exec(
    `SELECT ${RUN_COLUMNS} FROM bookwriter_runs
     WHERE project_id = ? AND status IN ('active','paused')
     ORDER BY updated_at DESC LIMIT 1`,
    [projectId],
  );
  if (res.length === 0 || res[0].values.length === 0) return null;
  return rowToRun(res[0].values[0]);
}

/** Lädt einen Run nach Id. */
export function loadRun(id: string): BookwriterRun | null {
  const res = getDb().exec(`SELECT ${RUN_COLUMNS} FROM bookwriter_runs WHERE id = ?`, [id]);
  if (res.length === 0 || res[0].values.length === 0) return null;
  return rowToRun(res[0].values[0]);
}

/** Legt einen neuen Lauf an. */
export function createRun(projectId: string, mode: ApprovalMode): BookwriterRun {
  const now = Date.now();
  const run: BookwriterRun = {
    id: uid("bwr"),
    projectId,
    status: "active",
    mode,
    currentPhase: "briefing",
    phaseProgress: 0,
    createdAt: now,
    updatedAt: now,
  };

  getDb().run(
    `INSERT INTO bookwriter_runs
       (id, project_id, status, mode, current_phase, phase_progress, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [run.id, run.projectId, run.status, run.mode, run.currentPhase, 0, now, now],
  );

  // Phasen anlegen.
  const phases: BookwriterPhase[] = [
    "briefing", "konzept", "gliederung", "manuskript",
    "qualitaet", "ueberarbeitung", "metadaten", "export",
  ];
  for (const phase of phases) {
    getDb().run(
      `INSERT INTO bookwriter_phases (id, run_id, phase, status, progress, created_at)
       VALUES (?,?,?,?,?,?)`,
      [uid("bwp"), run.id, phase, "pending", 0, now],
    );
  }

  return run;
}

/** Setzt den Status einer Phase. */
export async function setPhaseStatus(
  runId: string,
  phase: BookwriterPhase,
  status: BookwriterPhaseState["status"],
  progress: number | null = null,
  error: string | null = null,
): Promise<void> {
  const db = getDb();
  const now = Date.now();

  // Hinweis: bookwriter_phases hat keine updated_at-Spalte; der Zeitstempel
  // wird auf dem zugehörigen Run aktualisiert (siehe zweites UPDATE unten).
  const sets: string[] = ["status = ?"];
  const args: (string | number | null)[] = [status];

  if (progress !== null) {
    sets.push("progress = ?");
    args.push(progress);
  }
  if (error !== null) {
    sets.push("error = ?");
    args.push(error);
  }
  if (status === "running") {
    sets.push("started_at = COALESCE(started_at, ?)");
    args.push(now);
  }
  if (status === "done" || status === "error") {
    sets.push("completed_at = ?");
    args.push(now);
  }

  args.push(runId, phase);
  db.run(
    `UPDATE bookwriter_phases SET ${sets.join(", ")} WHERE run_id = ? AND phase = ?`,
    args,
  );

  // Run aktualisieren.
  db.run(
    `UPDATE bookwriter_runs SET updated_at = ?, phase_progress = COALESCE(?, phase_progress) WHERE id = ?`,
    [now, progress, runId],
  );

  await persistNow();
}

/** Setzt die aktuelle Phase des Laufs. */
export async function setCurrentPhase(runId: string, phase: BookwriterPhase): Promise<void> {
  getDb().run(
    `UPDATE bookwriter_runs SET current_phase = ?, updated_at = ? WHERE id = ?`,
    [phase, Date.now(), runId],
  );
  await persistNow();
}

/** Speichert ein Artefakt. */
export async function saveArtifact(
  runId: string,
  phase: BookwriterPhase,
  artifactType: string,
  content: unknown,
): Promise<void> {
  getDb().run(
    `INSERT INTO bookwriter_artifacts (id, run_id, phase, artifact_type, content, created_at)
     VALUES (?,?,?,?,?,?)`,
    [uid("bwa"), runId, phase, artifactType, JSON.stringify(content), Date.now()],
  );
  await persistNow();
}

/** Lädt ein Artefakt. */
export function loadArtifact<T>(runId: string, artifactType: string): T | null {
  // artifact_type ODER phase: Der Workflow speichert teils unter Typ-Namen
  // ("concept", "outline", "chapters") und lädt teils unter Phasennamen
  // ("konzept", "gliederung", "manuskript"). Beide Seiten müssen funktionieren.
  const res = getDb().exec(
    `SELECT content FROM bookwriter_artifacts
     WHERE run_id = ? AND (artifact_type = ? OR phase = ?)
     ORDER BY created_at DESC LIMIT 1`,
    [runId, artifactType, artifactType],
  );
  if (res.length === 0 || res[0].values.length === 0) return null;
  try {
    return JSON.parse(String(res[0].values[0][0])) as T;
  } catch {
    return null;
  }
}

/** Speichert eine Entscheidung. */
export async function saveApproval(
  runId: string,
  phase: BookwriterPhase,
  decision: "approved" | "rejected" | "regenerate",
  note: string | null = null,
): Promise<void> {
  getDb().run(
    `INSERT INTO bookwriter_approvals (id, run_id, phase, decision, note, created_at)
     VALUES (?,?,?,?,?,?)`,
    [uid("bwap"), runId, phase, decision, note, Date.now()],
  );
  await persistNow();
}

/** Lädt die letzte Entscheidung zu einer Phase. */
export function loadLatestApproval(runId: string, phase: BookwriterPhase): BookwriterApproval | null {
  const res = getDb().exec(
    `SELECT id, run_id, phase, decision, note, created_at
     FROM bookwriter_approvals
     WHERE run_id = ? AND phase = ?
     ORDER BY created_at DESC LIMIT 1`,
    [runId, phase],
  );
  if (res.length === 0 || res[0].values.length === 0) return null;
  const r = res[0].values[0];
  return {
    id: String(r[0]),
    runId: String(r[1]),
    phase: String(r[2]) as BookwriterPhase,
    decision: String(r[3]) as "approved" | "rejected" | "regenerate",
    note: r[4] === null ? null : String(r[4]),
    createdAt: Number(r[5]),
  };
}

/** Speichert Qualitätswerte. */
export async function saveQualityScores(runId: string, scores: QualityScore[]): Promise<void> {
  const db = getDb();
  // Alte Werte des Laufs ersetzen.
  db.run("DELETE FROM bookwriter_quality_scores WHERE run_id = ?", [runId]);
  for (const s of scores) {
    db.run(
      `INSERT INTO bookwriter_quality_scores (id, run_id, dimension, level, score, details)
       VALUES (?,?,?,?,?,?)`,
      [uid("bwq"), runId, s.dimension, s.level, s.score, s.details],
    );
  }
  await persistNow();
}

/** Lädt Qualitätswerte. */
export function loadQualityScores(runId: string): QualityScore[] {
  const res = getDb().exec(
    `SELECT id, run_id, dimension, level, score, details
     FROM bookwriter_quality_scores WHERE run_id = ?`,
    [runId],
  );
  if (res.length === 0) return [];
  return res[0].values.map((r) => ({
    id: String(r[0]),
    runId: String(r[1]),
    dimension: String(r[2]) as QualityScore["dimension"],
    level: String(r[3]) as QualityScore["level"],
    score: Number(r[4]),
    details: r[5] === null ? null : String(r[5]),
  }));
}

/** Pausiert einen Lauf. */
export async function pauseRun(runId: string): Promise<void> {
  getDb().run(
    `UPDATE bookwriter_runs SET status = 'paused', updated_at = ? WHERE id = ?`,
    [Date.now(), runId],
  );
  await persistNow();
}

/** Setzt einen pausierten Lauf fort. */
export async function resumeRun(runId: string): Promise<void> {
  getDb().run(
    `UPDATE bookwriter_runs SET status = 'active', updated_at = ? WHERE id = ?`,
    [Date.now(), runId],
  );
  await persistNow();
}

/** Bricht einen Lauf ab. */
export async function abortRun(runId: string): Promise<void> {
  getDb().run(
    `UPDATE bookwriter_runs SET status = 'aborted', updated_at = ? WHERE id = ?`,
    [Date.now(), runId],
  );
  await persistNow();
}

/** Markiert einen Lauf als abgeschlossen. */
export async function completeRun(runId: string): Promise<void> {
  getDb().run(
    `UPDATE bookwriter_runs SET status = 'completed', updated_at = ? WHERE id = ?`,
    [Date.now(), runId],
  );
  await persistNow();
}
