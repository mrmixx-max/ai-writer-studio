// Tests: Konsistenz-Prüfer (Sprint 3, Teil 3).
//
// Akzeptanzkriterium: erkennt Namens-/Zeitlinien-Brüche und übergibt an
// den Revisions-Loop (needs_revision + findings-Status revision_queued).
import { describe, it, expect, beforeEach, vi } from "vitest";
vi.mock("sql.js", async (importOriginal) => await importOriginal());
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { upsertFacts, type StoredFact } from "./contextManager";
import {
  checkChapterConsistency,
  checkMissingEntities,
  runConsistencyCheck,
  listFindings,
  dismissFinding,
  normalizeName,
  namesLikelySame,
} from "./consistency";
import { getChapterDecrypted } from "@/services/project";

let projectId: string;
const RUN = "run-1";

let factCache: StoredFact[] = [];

/** Legt Run + Kapitel + Manuskript-Artefakt an (Kapitel-ID-Auflösung). */
function seedRunAndChapters(runId: string, chapterIds: string[]): void {
  const db = (globalThis as any).__aws_db;
  db.run(`INSERT INTO bookwriter_runs (id, project_id, status, mode, current_phase, phase_progress, created_at, updated_at) VALUES ('${runId}','p1','active','auto','manuskript',0,1,1)`);
  chapterIds.forEach((id, i) => {
    db.run(`INSERT INTO chapters (id, project_id, title, content, order_index, status, created_at, updated_at) VALUES ('${id}','p1','K${i + 1}','x',${i},'completed',1,1)`);
  });
  const content = JSON.stringify(chapterIds.map((id) => ({ id })));
  db.run(`INSERT INTO bookwriter_artifacts (id, run_id, phase, artifact_type, content, created_at) VALUES ('a-${runId}','${runId}','manuskript','chapters','${content}',1)`);
}

async function seed(): Promise<void> {
  const saved = await upsertFacts(projectId, [
    { kind: "character", key: "Anna Weber", value: "Detektivin, 34 Jahre", confidence: 1 },
    { kind: "character", key: "Ben Roth", value: "Assistent, 26 Jahre", confidence: 1 },
    { kind: "timeline", key: "Handlungszeitraum", value: "Herbst 1987", confidence: 1 },
  ]);
  factCache = saved;
}

beforeEach(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;
  db.exec("INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p1','Test',1,1)");
  projectId = "p1";
  await seed();
});

describe("Namensnormalisierung", () => {
  it("normalisiert Groß/Klein, Umlaute, Zero-Width und Trennstriche", () => {
    expect(normalizeName("Anna Weber")).toBe(normalizeName("anna weber"));
    expect(normalizeName("Müller-Lüdenscheidt")).toBe(normalizeName("mueller-luedenscheidt"));
    expect(normalizeName("Anna\u200bWeber")).toBe(normalizeName("Anna Weber"));
  });

  it("namesLikelySame erkennt Drift-Varianten, unterscheidet fremde Namen", () => {
    expect(namesLikelySame("Anna Weber", "Anna  Weber")).toBe(true);
    expect(namesLikelySame("Weber", "Anna Weber")).toBe(true);
    expect(namesLikelySame("Müller", "Mueller")).toBe(true);
    expect(namesLikelySame("Anna Weber", "Klaus-Dieter")).toBe(false);
  });
});

describe("checkChapterConsistency", () => {
  it("kein Bruch: kohärenter Text erzeugt keine Befunde", () => {
    const findings = checkChapterConsistency(RUN, projectId, {
      index: 0, title: "Kapitel 1", content: "Anna Weber betrat den Hafen. Es war Herbst 1987.",
    }, factCache);
    expect(findings).toHaveLength(0);
  });

  it("Namensdrift: 'Ann Weber' erzeugt warning gegen Fakt 'Anna Weber'", () => {
    const findings = checkChapterConsistency(RUN, projectId, {
      index: 1, title: "Kapitel 2", content: "Ann Weber zündete ihre Pfeife an und dachte nach.",
    }, factCache);
    const drift = findings.filter((f) => f.type === "name_drift");
    expect(drift.length).toBeGreaterThan(0);
    expect(drift[0].severity).toBe("warning");
    expect(drift[0].expected).toBe("Anna Weber");
    expect(drift[0].found).toBe("Ann Weber");
  });

  it("Zeitlinien-Bruch: Jahreszahl 2020 gegen 'Herbst 1987' erzeugt error", () => {
    const findings = checkChapterConsistency(RUN, projectId, {
      index: 2, title: "Kapitel 3", content: "Im Jahr 2020 schloss Anna den Fall ab.",
    }, factCache);
    const breaks = findings.filter((f) => f.type === "timeline_break");
    expect(breaks).toHaveLength(1);
    expect(breaks[0].severity).toBe("error");
    expect(breaks[0].expected).toBe("1987");
    expect(breaks[0].found).toBe("2020");
  });

  it("Attribut-Konflikt: Alter 58 gegen Fakt '34 Jahre' erzeugt error", () => {
    const findings = checkChapterConsistency(RUN, projectId, {
      index: 0, title: "Kapitel 1", content: "Anna Weber war 58 Jahre alt und bald in Rente.",
    }, factCache);
    const conflicts = findings.filter((f) => f.type === "attribute_conflict");
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].factKey).toBe("Anna Weber");
    expect(conflicts[0].found).toBe("58");
  });

  it("nahe am Fakt liegendes Alter (±2) ist kein Konflikt", () => {
    const findings = checkChapterConsistency(RUN, projectId, {
      index: 0, title: "Kapitel 1", content: "Anna Weber war 36 Jahre alt.",
    }, factCache);
    expect(findings.filter((f) => f.type === "attribute_conflict")).toHaveLength(0);
  });
});

describe("checkMissingEntities", () => {
  it("verbindlicher Charakter, der in allen Folgekapiteln fehlt, wird gemeldet", () => {
    const mk = (i: number, content: string) => ({ index: i, title: `K${i + 1}`, content });
    const chapters = [
      mk(0, "Anna Weber und Ben Roth treffen sich."),
      mk(1, "Anna Weber ermittelt allein."),
      mk(2, "Der Fall kühlt ab. Niemand kommt vor."),
      mk(3, "Schluss. Der Täter gesteht. Ben Roth bleibt verschwunden."),
    ];
    const findings = checkMissingEntities(RUN, projectId, chapters, factCache);
    const missing = findings.filter((f) => f.type === "missing_entity" && f.factKey === "Anna Weber");
    expect(missing).toHaveLength(1);
  });
});

describe("runConsistencyCheck: Übergabe an Revisions-Loop", () => {
  it("persistiert Befunde und queued error-Kapitel (needs_revision)", async () => {
    seedRunAndChapters("run-1", ["c-1", "c-2"]);

    const result = await runConsistencyCheck(RUN, projectId, [
      { index: 0, title: "Kapitel 1", content: "Anna Weber ermittelt. Alles im Jahr 1987." },
      { index: 1, title: "Kapitel 2", content: "Im Jahr 2020 ruht der Fall. Ann Weber schläft." },
    ]);

    expect(result.checkedChapters).toBe(2);
    expect(result.queuedForRevision).toContain(1);
    expect(result.findings.length).toBeGreaterThan(0);

    // findings persistiert.
    const all = listFindings(RUN);
    expect(all.length).toBe(result.findings.length);
    expect(all.some((f) => f.status === "revision_queued" && f.chapterIndex === 1)).toBe(true);

    // Revisions-Loop-Übergabe: Kapitel-Status needs_revision.
    const chapter = await getChapterDecrypted("c-2");
    expect(chapter?.status).toBe("needs_revision");

    // dismissFinding setzt Status zurück.
    const open = all.find((f) => f.status === "open");
    if (open) {
      await dismissFinding(open.id);
      expect(listFindings(RUN).find((f) => f.id === open.id)?.status).toBe("dismissed");
    }
  });

  it("queueRevision=false prüft, ohne Kapitel-Status zu ändern", async () => {
    seedRunAndChapters("run-2", ["c-9"]);

    await runConsistencyCheck("run-2", projectId, [
      { index: 0, title: "Kapitel 2", content: "Im Jahr 2020 ruht der Fall." },
    ], { queueRevision: false });

    const chapter = await getChapterDecrypted("c-9");
    expect(chapter?.status).toBe("completed");
    expect(listFindings("run-2").every((f) => f.status === "open")).toBe(true);
  });

  it("ohne Fakten in der Base: keine false positives", async () => {
    const result = await runConsistencyCheck(RUN, projectId, [
      { index: 0, title: "Kapitel 1", content: "Willkommen in Marlagu, Jahr 342 der Zweiten Ära." },
    ]);
    expect(result.findings).toHaveLength(0);
  });
});
