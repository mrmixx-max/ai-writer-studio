// Unit-Tests: Bookwriter-Job-Store (Persistence, Resume, Statuswechsel).
//
// Nutzt dieselbe In-Memory-DB-Einrichtung wie state.test.ts:
// initSqlJs → runMigrations → (globalThis).__aws_db.
// setup.ts mockt sql.js in jsdom — hier das Original zurückholen.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
vi.mock("sql.js", async (importOriginal) => await importOriginal());
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { createProject } from "@/services/project";
import {
  createBookJob, loadBookJob, getResumableBookJob, updateBookJobProgress,
  setBookJobStatus, completeBookJob, deleteBookJob,
} from "./jobs";
import type { BookWriterConfig } from "@/services/writing/bookwriter";

const config: BookWriterConfig = {
  topic: "KI im Alltag", genre: "Sachbuch", targetAudience: "Erwachsene",
  chapterCount: 8, model: "mock", baseUrl: "http://127.0.0.1:11434", language: "Deutsch",
};

const outline = {
  title: "KI im Alltag", genre: "Sachbuch", targetAudience: "Erwachsene",
  chapters: [{ number: 1, title: "Kapitel 1", summary: "Erstes Kapitel mit ausreichend langem Inhalt." }],
};

let projectId: string;

beforeEach(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;
  const p = await createProject("Job-Test-Projekt");
  projectId = p.id;
});

afterEach(() => {
  delete (globalThis as any).__aws_db;
});

describe("bookwriter jobs", () => {
  it("createBookJob legt einen laufenden Job mit config/outline an", async () => {
    const job = createBookJob(projectId, config, outline);
    expect(job.status).toBe("running");
    expect(job.currentChapter).toBe(0);
    const loaded = loadBookJob(job.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.config.topic).toBe("KI im Alltag");
    expect(loaded!.outline!.title).toBe("KI im Alltag");
  });

  it("updateBookJobProgress committet Kapitel-Fortschritt (kein Datenverlust)", async () => {
    const job = createBookJob(projectId, config, outline);
    await updateBookJobProgress(job.id, 5);
    const loaded = loadBookJob(job.id)!;
    expect(loaded.currentChapter).toBe(5);
    expect(loaded.status).toBe("running");
  });

  it("getResumableBookJob liefert interrupted Jobs mit current_chapter > 0", async () => {
    const job = createBookJob(projectId, config, outline);
    await updateBookJobProgress(job.id, 5);
    await setBookJobStatus(job.id, "interrupted", "Kapitel 5: JSON-Fehler");
    const resumable = getResumableBookJob(projectId);
    expect(resumable).not.toBeNull();
    expect(resumable!.id).toBe(job.id);
    expect(resumable!.currentChapter).toBe(5);
    expect(resumable!.error).toContain("Kapitel 5");
  });

  it("getResumableBookJob ignoriert Jobs bei Kapitel 0 (keine Gliederung gespeichert)", async () => {
    createBookJob(projectId, config, outline); // current_chapter=0
    expect(getResumableBookJob(projectId)).toBeNull();
  });

  it("abgeschlossene Jobs sind nicht mehr fortsetzbar", async () => {
    const job = createBookJob(projectId, config, outline);
    await updateBookJobProgress(job.id, 8);
    await completeBookJob(job.id);
    expect(getResumableBookJob(projectId)).toBeNull();
    expect(loadBookJob(job.id)!.status).toBe("completed");
  });

  it("deleteBookJob entfernt den Row (Resume abgelehnt)", async () => {
    const job = createBookJob(projectId, config, outline);
    await updateBookJobProgress(job.id, 3);
    await deleteBookJob(job.id);
    expect(loadBookJob(job.id)).toBeNull();
    expect(getResumableBookJob(projectId)).toBeNull();
  });

  it("Kaskade: Projekt-Löschen entfernt Jobs (FOREIGN KEY ON DELETE CASCADE)", async () => {
    const job = createBookJob(projectId, config, outline);
    const db = (globalThis as any).__aws_db;
    db.run("DELETE FROM projects WHERE id = ?", [projectId]);
    expect(loadBookJob(job.id)).toBeNull();
  });

  it("Migration 018 ist idempotent und legt Planungsspalten an", () => {
    const db = (globalThis as any).__aws_db;
    // Erneut laufen lassen — darf nicht werfen.
    expect(() => runMigrations(db)).not.toThrow();
    const res = db.exec("PRAGMA table_info(chapters)");
    const cols = res[0].values.map((v: unknown[]) => String(v[1]));
    for (const col of ["status", "target_word_count", "minimum_word_count", "maximum_word_count", "current_word_count", "purpose", "synopsis", "last_error"]) {
      expect(cols).toContain(col);
    }
  });
});
