// Unit-Tests: Job-Recovery (Start-Prüfung auf abgebrochene Jobs).
// Nutzt dieselbe In-Memory-DB-Einrichtung wie jobs.test.ts.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
vi.mock("sql.js", async (importOriginal) => await importOriginal());
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { createProject } from "@/services/project";
import { createBookJob, setBookJobStatus, updateBookJobProgress } from "@/services/bookwriter/jobs";
import type { BookWriterConfig } from "@/services/writing/bookwriter";
import { findInterruptedJobs, formatRecoveryPrompt, buildRecoveryChoice } from "./jobRecovery";

const config: BookWriterConfig = {
  topic: "KI im Alltag", genre: "Sachbuch", targetAudience: "Erwachsene",
  chapterCount: 8, model: "mock", baseUrl: "http://127.0.0.1:11434", language: "Deutsch",
};

const outline = {
  title: "KI im Alltag", genre: "Sachbuch", targetAudience: "Erwachsene",
  chapters: [{ number: 1, title: "K1", summary: "Inhalt mit ausreichend langer Beschreibung." }],
};

let projectId: string;

beforeEach(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;
  const p = await createProject("Recovery-Test-Projekt");
  projectId = p.id;
});

afterEach(() => {
  delete (globalThis as any).__aws_db;
});

describe("Job-Recovery", () => {
  it("findet abgebrochene (interrupted) Jobs mit Fortschritt", async () => {
    const j = await createBookJob(projectId, config, outline);
    await updateBookJobProgress(j.id, 3);
    await setBookJobStatus(j.id, "interrupted");

    const jobs = findInterruptedJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe("interrupted");
    expect(jobs[0].currentChapter).toBe(3);
  });

  it("findet auch laufende (running) Jobs mit Fortschritt", async () => {
    const j = await createBookJob(projectId, config, outline);
    await updateBookJobProgress(j.id, 2);
    // status bleibt 'running' (Crash ohne Statuswechsel)

    const jobs = findInterruptedJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe("running");
  });

  it("ignoriert Jobs ohne Fortschritt (current_chapter = 0)", async () => {
    const j = await createBookJob(projectId, config, outline);
    await setBookJobStatus(j.id, "interrupted");

    expect(findInterruptedJobs()).toHaveLength(0);
  });

  it("ignoriert abgeschlossene und verworfene Jobs", async () => {
    const j1 = await createBookJob(projectId, config, outline);
    await updateBookJobProgress(j1.id, 5);
    await setBookJobStatus(j1.id, "completed");
    const j2 = await createBookJob(projectId, config, outline);
    await updateBookJobProgress(j2.id, 4);
    await setBookJobStatus(j2.id, "aborted");

    expect(findInterruptedJobs()).toHaveLength(0);
  });

  it("sortiert mehrere Jobs nach updatedAt absteigend (jüngster zuerst)", async () => {
    const j1 = await createBookJob(projectId, config, outline);
    await updateBookJobProgress(j1.id, 1);
    await new Promise((r) => setTimeout(r, 15));
    const j2 = await createBookJob(projectId, config, outline);
    await updateBookJobProgress(j2.id, 2);
    await setBookJobStatus(j2.id, "interrupted");

    const jobs = findInterruptedJobs();
    expect(jobs.length).toBe(2);
    expect(jobs[0].jobId).toBe(j2.id);
    expect(jobs[1].jobId).toBe(j1.id);
  });

  it("liefert Buchtitel aus der Outline für den Recovery-Prompt", async () => {
    const j = await createBookJob(projectId, config, outline);
    await updateBookJobProgress(j.id, 3);
    await setBookJobStatus(j.id, "interrupted");

    const jobs = findInterruptedJobs();
    expect(jobs[0].projectTitle).toBe("KI im Alltag");
  });

  it("formatRecoveryPrompt nennt Titel und Fortsetzungskapitel", async () => {
    const j = await createBookJob(projectId, config, outline);
    await updateBookJobProgress(j.id, 3);
    await setBookJobStatus(j.id, "interrupted");

    const [job] = findInterruptedJobs();
    const prompt = formatRecoveryPrompt(job);
    expect(prompt).toContain("KI im Alltag");
    expect(prompt).toContain("Kapitel 4");
    expect(prompt).toContain("fortsetzen");
    expect(prompt).toContain("3/"); // bereits gespeichert
  });

  it("buildRecoveryChoice: resume → Kapitel current+1", async () => {
    const j = await createBookJob(projectId, config, outline);
    await updateBookJobProgress(j.id, 3);
    await setBookJobStatus(j.id, "interrupted");

    const [job] = findInterruptedJobs();
    const choice = await buildRecoveryChoice(job, "resume");
    expect(choice.action).toBe("resume");
    expect(choice.startChapter).toBe(4);
    expect(choice.jobId).toBe(job.jobId);
  });

  it("buildRecoveryChoice: discard → löscht den Job", async () => {
    const j = await createBookJob(projectId, config, outline);
    await updateBookJobProgress(j.id, 3);
    await setBookJobStatus(j.id, "interrupted");

    const [job] = findInterruptedJobs();
    const choice = await buildRecoveryChoice(job, "discard");
    expect(choice.action).toBe("discard");
    expect(findInterruptedJobs()).toHaveLength(0);
  });
});
