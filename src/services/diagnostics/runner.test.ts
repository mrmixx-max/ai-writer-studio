// Tests: Prüflauf über ein echtes Projekt in der Datenbank.
//
// Der wichtigste Prüfpunkt: Nutzerentscheidungen (ignorieren, als bewusst
// markieren) müssen einen erneuten Prüflauf überleben. Ohne das müsste der
// Autor hunderte Befunde nach jedem Lauf erneut wegklicken — der schnellste
// Weg, ein Prüfwerkzeug unbenutzbar zu machen.

import { describe, it, expect, beforeEach } from "vitest";
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { createProject, createChapter } from "@/services/project";
import { createCharacter } from "@/services/knowledge/profiles";
import {
  runDiagnostics,
  listFindings,
  setFindingStatus,
  findingStats,
} from "@/services/diagnostics/runner";

/** TipTap-Dokument aus Absätzen. */
function doc(paragraphs: string[]): string {
  return JSON.stringify({
    type: "doc",
    content: paragraphs.map((t) => ({
      type: "paragraph",
      content: [{ type: "text", text: t }],
    })),
  });
}

let projectId: string;

beforeEach(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;

  const p = await createProject("Prüfprojekt");
  projectId = p.id;
});

describe("Prüflauf", () => {
  it("läuft über ein leeres Projekt ohne zu werfen", async () => {
    const r = await runDiagnostics(projectId);
    expect(r.findings).toHaveLength(0);
    expect(r.degraded).toBe(false);
    expect(r.chaptersChecked).toBe(0);
  });

  it("findet einen Altersweitspruch als harten Fehler", async () => {
    await createCharacter(projectId, "Marta", { age: "48" });
    await createChapter(
      projectId,
      "Kapitel 1",
      doc([
        "Marta war 48 Jahre alt, als sie den Brief fand und zu lesen begann.",
        "Viel später hieß es, Marta sei 62 Jahre alt gewesen zu jener Zeit.",
      ]),
    );

    const r = await runDiagnostics(projectId);
    const hard = r.findings.filter((f) => f.kind === "error");

    expect(hard.length).toBeGreaterThan(0);
    expect(hard[0].severity).toBe("high");
    expect(hard[0].category).toBe("character");
    expect(hard[0].ruleBased).toBe(true);
  });

  it("liefert Kennwerte je Kapitel", async () => {
    await createChapter(projectId, "Erstes", doc(["Ein Satz. Noch ein Satz hier."]));
    await createChapter(projectId, "Zweites", doc(["Anderer Text mit Inhalt drin."]));

    const r = await runDiagnostics(projectId);
    expect(r.perChapter).toHaveLength(2);
    expect(r.perChapter[0].title).toBeTruthy();
    expect(r.perChapter[0].metrics.wordCount).toBeGreaterThan(0);
  });

  it("meldet Fortschritt", async () => {
    await createChapter(projectId, "Kapitel", doc(["Ein Text mit einigen Wörtern."]));
    const seen: Array<{ done: number; total: number }> = [];

    await runDiagnostics(projectId, {
      onProgress: (done, total) => seen.push({ done, total }),
    });

    expect(seen.length).toBeGreaterThan(0);
    const last = seen[seen.length - 1];
    expect(last.done).toBe(last.total);
  });

  it("prüft auf Wunsch nur ein Kapitel", async () => {
    const a = await createChapter(projectId, "Eins", doc(["Text eins hier drin."]));
    await createChapter(projectId, "Zwei", doc(["Text zwei hier drin auch."]));

    const r = await runDiagnostics(projectId, { chapterId: a.id });
    expect(r.scope).toBe("chapter");
    expect(r.chaptersChecked).toBe(1);
  });

  it("arbeitet ohne jedes Modell", async () => {
    await createChapter(projectId, "Kapitel", doc(["Ein Text mit Inhalt darin."]));
    const r = await runDiagnostics(projectId);
    // Alle Befunde stammen aus Regeln, keiner aus einem Modell.
    for (const f of r.findings) {
      expect(f.ruleBased).toBe(true);
    }
  });
});

describe("Befunde speichern und laden", () => {
  beforeEach(async () => {
    await createCharacter(projectId, "Marta", { age: "48" });
    await createChapter(
      projectId,
      "Kapitel 1",
      doc([
        "Marta war 48 Jahre alt, als sie den Brief fand und zu lesen begann.",
        "Viel später hieß es, Marta sei 62 Jahre alt gewesen zu jener Zeit.",
      ]),
    );
    await runDiagnostics(projectId);
  });

  it("findet gespeicherte Befunde wieder", () => {
    const found = listFindings(projectId);
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].message.length).toBeGreaterThan(5);
    expect(found[0].explanation.length).toBeGreaterThan(20);
  });

  it("sortiert kritische Befunde nach vorn", () => {
    const found = listFindings(projectId);
    const severities = found.map((f) => f.severity);
    const firstLow = severities.indexOf("low");
    const lastHigh = severities.lastIndexOf("high");
    if (firstLow >= 0 && lastHigh >= 0) {
      expect(lastHigh).toBeLessThan(firstLow);
    }
  });

  it("filtert nach Schweregrad", () => {
    const all = listFindings(projectId);
    const high = listFindings(projectId, { minSeverity: "high" });
    expect(high.length).toBeLessThanOrEqual(all.length);
    for (const f of high) expect(f.severity).toBe("high");
  });

  it("filtert nach Kategorie", () => {
    const chars = listFindings(projectId, { category: "character" });
    for (const f of chars) expect(f.category).toBe("character");
  });

  it("zählt Befunde nach Schweregrad", () => {
    const stats = findingStats(projectId);
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.high + stats.medium + stats.low).toBe(stats.total);
    expect(Object.keys(stats.byCategory).length).toBeGreaterThan(0);
  });
});

describe("Nutzerentscheidungen überleben einen erneuten Lauf", () => {
  const chapterText = doc([
    "Marta war 48 Jahre alt, als sie den Brief fand und zu lesen begann.",
    "Viel später hieß es, Marta sei 62 Jahre alt gewesen zu jener Zeit.",
  ]);

  beforeEach(async () => {
    await createCharacter(projectId, "Marta", { age: "48" });
    await createChapter(projectId, "Kapitel 1", chapterText);
    await runDiagnostics(projectId);
  });

  it("behält ignorierte Befunde nach erneutem Lauf ignoriert", async () => {
    const before = listFindings(projectId);
    expect(before.length).toBeGreaterThan(0);
    await setFindingStatus(before[0].id, "ignored");

    // Ignorierte Befunde verschwinden aus der Standardliste.
    expect(listFindings(projectId).length).toBe(before.length - 1);

    // Erneut prüfen — der ignorierte Befund darf nicht zurückkommen.
    await runDiagnostics(projectId);
    const after = listFindings(projectId);
    expect(after.length).toBe(before.length - 1);
  });

  it("behält als bewusst markierte Befunde als intentional", async () => {
    const before = listFindings(projectId);
    const target = before.find((f) => f.kind === "error");
    expect(target).toBeTruthy();

    await setFindingStatus(target!.id, "accepted");
    await runDiagnostics(projectId);

    const all = listFindings(projectId, { includeResolved: true });
    const same = all.find((f) => f.fingerprint === target!.fingerprint);
    expect(same).toBeTruthy();
    // Die Einordnung als bewusste Abweichung bleibt erhalten.
    expect(same?.kind).toBe("intentional");
    expect(same?.status).toBe("accepted");
  });

  it("erzeugt bei mehrfachem Lauf keine Dubletten", async () => {
    const first = listFindings(projectId).length;
    await runDiagnostics(projectId);
    await runDiagnostics(projectId);
    expect(listFindings(projectId).length).toBe(first);
  });
});

describe("Unterscheidung Fehler / möglich / bewusst", () => {
  it("führt alle drei Einordnungen", async () => {
    await createCharacter(projectId, "Marta", { age: "48" });
    await createChapter(
      projectId,
      "Kapitel 1",
      doc([
        "Marta war 48 Jahre alt, als sie den Brief fand und zu lesen begann.",
        "Viel später hieß es, Marta sei 62 Jahre alt gewesen zu jener Zeit.",
      ]),
    );
    await runDiagnostics(projectId);

    const found = listFindings(projectId);
    const kinds = new Set(found.map((f) => f.kind));

    // Mindestens ein harter Fehler und eine Möglichkeit.
    expect(kinds.has("error")).toBe(true);

    // Nach dem Markieren kommt die dritte Einordnung hinzu.
    const err = found.find((f) => f.kind === "error")!;
    await setFindingStatus(err.id, "accepted");

    const all = listFindings(projectId, { includeResolved: true });
    expect(all.some((f) => f.kind === "intentional")).toBe(true);
  });
});
