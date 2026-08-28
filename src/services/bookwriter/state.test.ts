// Unit-Tests für die Bookwriter-Statemachine (state.ts).
//
// Nutzt dieselbe In-Memory-DB-Einrichtung wie der E2E-Test:
// initSqlJs → runMigrations → (globalThis).__aws_db.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
// setup.ts mockt sql.js global durch eine Fake-DB — für diese Tests brauchen
// wir das echte In-Memory-SQLite, daher nehmen wir das Original zurück.
vi.mock("sql.js", async (importOriginal) => await importOriginal());
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { createProject } from "@/services/project";
import {
  createRun,
  loadRun,
  loadActiveRun,
  setPhaseStatus,
  setCurrentPhase,
  saveArtifact,
  loadArtifact,
  saveApproval,
  loadLatestApproval,
  saveQualityScores,
  loadQualityScores,
  pauseRun,
  resumeRun,
  abortRun,
  completeRun,
} from "./state";
import type { QualityScore } from "@/types/bookwriter";

let projectId: string;

beforeEach(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;
  const p = await createProject("State-Test-Projekt");
  projectId = p.id;
});

afterEach(() => {
  delete (globalThis as any).__aws_db;
});

describe("Runs", () => {
  it("createRun legt einen aktiven Lauf in Phase 'briefing' an", async () => {
    const run = createRun(projectId, "phase");
    expect(run.id).toMatch(/^bwr/);
    expect(run.projectId).toBe(projectId);
    expect(run.status).toBe("active");
    expect(run.currentPhase).toBe("briefing");

    const loaded = loadRun(run.id);
    expect(loaded?.mode).toBe("phase");
    expect(loadActiveRun(projectId)?.id).toBe(run.id);
  });

  it("loadRun/loadActiveRun liefern null für Unbekanntes", () => {
    expect(loadRun("gibt-es-nicht")).toBeNull();
    expect(loadActiveRun("unbekanntes-projekt")).toBeNull();
  });

  it("Pause → Resume → Abort → Complete ändern den Status", async () => {
    const run = createRun(projectId, "auto");

    await pauseRun(run.id);
    expect(loadRun(run.id)?.status).toBe("paused");
    expect(loadActiveRun(projectId)?.status).toBe("paused");

    await resumeRun(run.id);
    expect(loadRun(run.id)?.status).toBe("active");

    await abortRun(run.id);
    expect(loadRun(run.id)?.status).toBe("aborted");
    // Abgebrochene Läufe sind nicht mehr „aktiv“:
    expect(loadActiveRun(projectId)).toBeNull();

    // Neuer Lauf bis zum Abschluss:
    const run2 = createRun(projectId, "phase");
    await completeRun(run2.id);
    expect(loadRun(run2.id)?.status).toBe("completed");
    expect(loadActiveRun(projectId)).toBeNull();
  });

  it("setPhaseStatus und setCurrentPhase persistieren Phase und Fortschritt", async () => {
    const run = createRun(projectId, "phase");
    await setCurrentPhase(run.id, "gliederung");
    await setPhaseStatus(run.id, "gliederung", "running", 45);

    const loaded = loadRun(run.id);
    expect(loaded?.currentPhase).toBe("gliederung");
    expect(loaded?.phaseProgress).toBe(45);
  });
});

describe("Artefakte", () => {
  it("speichert und lädt Artefakte als JSON (rundetrip)", async () => {
    const run = createRun(projectId, "phase");
    const briefing = { genre: "Fantasy", theme: "Freundschaft", kdpTarget: "ebook" };
    await saveArtifact(run.id, "briefing", "briefing", briefing);

    expect(loadArtifact<typeof briefing>(run.id, "briefing")).toEqual(briefing);
    // Auch über den Phasennamen ladbar:
    expect(loadArtifact<typeof briefing>(run.id, "briefing")).toEqual(briefing);
  });

  it("liefert null für fehlende Artefakte", () => {
    const run = createRun(projectId, "phase");
    expect(loadArtifact(run.id, "concept")).toBeNull();
    expect(loadArtifact("unbekannt", "briefing")).toBeNull();
  });

  it("Artefakte sind sowohl über Typ- als auch Phasennamen ladbar", async () => {
    const run = createRun(projectId, "phase");
    await saveArtifact(run.id, "konzept", "concept", { positionierung: "P" });
    expect(loadArtifact(run.id, "concept")).toEqual({ positionierung: "P" });
    expect(loadArtifact(run.id, "konzept")).toEqual({ positionierung: "P" });
  });
});

describe("Entscheidungen", () => {
  it("speichert und lädt die letzte Entscheidung je Phase", async () => {
    const run = createRun(projectId, "manual");
    await saveApproval(run.id, "konzept", "approved", "Sieht gut aus.");
    // created_at hat ms-Auflösung — kurz warten, damit „die letzte“ deterministisch ist.
    await new Promise((r) => setTimeout(r, 15));
    await saveApproval(run.id, "konzept", "rejected", null);
    await saveApproval(run.id, "gliederung", "approved", null);

    const latest = loadLatestApproval(run.id, "konzept");
    expect(latest?.decision).toBe("rejected");
    expect(latest?.note).toBeNull();
    expect(latest?.phase).toBe("konzept");
    expect(loadLatestApproval(run.id, "gliederung")?.decision).toBe("approved");
    expect(loadLatestApproval(run.id, "manuskript")).toBeNull();
  });
});

describe("Qualitätswerte", () => {
  it("speichert, lädt und ersetzt Qualitätswerte", async () => {
    const run = createRun(projectId, "phase");
    const scores: QualityScore[] = [
      { id: "q1", runId: run.id, dimension: "kohaerenz", level: "green", score: 85, details: "stimmig" },
      { id: "q2", runId: run.id, dimension: "originalitaet", level: "yellow", score: 60, details: null },
    ];
    await saveQualityScores(run.id, scores);

    const loaded = loadQualityScores(run.id);
    expect(loaded).toHaveLength(2);
    expect(loaded.find((s) => s.dimension === "kohaerenz")?.score).toBe(85);
    expect(loaded.find((s) => s.dimension === "originalitaet")?.level).toBe("yellow");

    // Ersetzen: alter Stand wird gelöscht.
    await saveQualityScores(run.id, [
      { id: "q3", runId: run.id, dimension: "stilgleichheit", level: "red", score: 30, details: null },
    ]);
    expect(loadQualityScores(run.id)).toHaveLength(1);
    expect(loadQualityScores(run.id)[0].dimension).toBe("stilgleichheit");

    expect(loadQualityScores("unbekannt")).toEqual([]);
  });
});
