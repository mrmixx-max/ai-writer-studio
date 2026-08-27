// Integrationstests: Preflight-Lauf gegen eine echte Datenbank.
//
// Wichtigster Prüfpunkt: Entscheidungen überleben einen erneuten Lauf.
// Ohne das müsste der Autor nach jeder Prüfung erneut alles wegklicken —
// der schnellste Weg, ein Preflight unbenutzbar zu machen.

import { describe, it, expect, beforeEach } from "vitest";
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { createProject, createChapter } from "@/services/project";
import { runPreflight, runExportPreflight } from "@/services/preflight/runner";
import {
  loadFindings,
  latestReport,
  saveDecision,
  setRuleEnabled,
  listRules,
} from "@/services/preflight/store";
import { applyFilter, exportGate } from "@/services/preflight/filter";

function doc(paragraphs: string[]): string {
  return JSON.stringify({
    type: "doc",
    content: paragraphs.map((t) => ({ type: "paragraph", content: [{ type: "text", text: t }] })),
  });
}

let projectId: string;

beforeEach(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;

  const p = await createProject("Preflight-Testprojekt");
  projectId = p.id;
});

describe("Prüflauf", () => {
  it("meldet ein Projekt ohne Kapitel als Blocker", async () => {
    const r = await runPreflight(projectId, "Test");
    const blockers = r.findings.filter((f) => f.severity === "blocker");

    expect(blockers.length).toBeGreaterThan(0);
    expect(blockers.some((f) => f.ruleId === "structure.no-chapters")).toBe(true);
    expect(r.report.blockerCount).toBeGreaterThan(0);
  });

  it("findet leere Kapitel", async () => {
    await createChapter(projectId, "Leeres Kapitel", doc([""]));
    const r = await runPreflight(projectId, "Test");
    expect(r.findings.some((f) => f.ruleId === "structure.empty-chapter")).toBe(true);
  });

  it("meldet Fortschritt bis zum Ende", async () => {
    await createChapter(projectId, "Eins", doc(["Ein Text mit genügend Wörtern darin."]));
    const seen: Array<{ done: number; total: number }> = [];

    await runPreflight(projectId, "Test", {
      onProgress: (done, total) => seen.push({ done, total }),
    });

    expect(seen.length).toBeGreaterThan(0);
    const last = seen[seen.length - 1];
    expect(last.done).toBe(last.total);
  });

  it("prüft auf Wunsch nur ein Kapitel", async () => {
    const a = await createChapter(projectId, "Eins", doc(["Text eins."]));
    await createChapter(projectId, "Zwei", doc(["Text zwei."]));

    const r = await runPreflight(projectId, "Test", { chapterId: a.id });
    expect(r.report.scope).toBe("chapter");
    expect(r.report.chapterId).toBe(a.id);
  });

  it("arbeitet ohne jedes Modell", async () => {
    await createChapter(projectId, "Eins", doc(["Ein Text mit Inhalt."]));
    const r = await runPreflight(projectId, "Test");
    // Kein Befund darf eine Modellanbindung voraussetzen.
    expect(r.degraded).toBe(false);
    expect(r.report.notice).toBeNull();
  });

  it("schreibt einen Bericht mit Zählwerk", async () => {
    await createChapter(projectId, "Leer", doc([""]));
    await runPreflight(projectId, "Test");

    const rep = latestReport(projectId);
    expect(rep).toBeTruthy();
    expect(rep?.scope).toBe("project");
    expect(rep?.formats.length).toBeGreaterThan(0);
    expect(rep!.blockerCount + rep!.warningCount + rep!.hintCount).toBeGreaterThan(0);
  });

  it("prüft nur die gewählten Formate", async () => {
    await createChapter(projectId, "Eins", doc(["Ein Text mit Inhalt darin."]));
    const r = await runPreflight(projectId, "Test", { formats: ["txt"] });

    // Kein Befund darf ausschließlich für ein nicht geprüftes Format gelten.
    for (const f of r.findings) {
      if (f.affectedFormats.length === 0) continue;
      expect(f.affectedFormats).toContain("txt");
    }
  });
});

describe("Befunde speichern und laden", () => {
  beforeEach(async () => {
    await createChapter(projectId, "Leeres Kapitel", doc([""]));
    await createChapter(projectId, "Zweites", doc(["Ein Text mit genügend Inhalt darin."]));
    await runPreflight(projectId, "Test");
  });

  it("findet gespeicherte Befunde wieder", () => {
    const found = loadFindings(projectId);
    expect(found.length).toBeGreaterThan(0);
    for (const f of found) {
      expect(f.title.length).toBeGreaterThan(5);
      expect(f.explanation.length).toBeGreaterThan(20);
      expect(f.fingerprint.length).toBeGreaterThan(0);
    }
  });

  it("gibt jedem Befund eine Empfehlung oder einen Strukturhinweis", () => {
    // Eine Feststellung ohne Handlungsanweisung hilft niemandem.
    for (const f of loadFindings(projectId)) {
      const hasHelp = Boolean(f.recommendation || f.structureHint || f.excerpt);
      expect(hasHelp, `Befund "${f.title}" ohne Hilfe`).toBe(true);
    }
  });

  it("erzeugt bei mehrfachem Lauf keine Dubletten", async () => {
    const first = loadFindings(projectId).length;
    await runPreflight(projectId, "Test");
    await runPreflight(projectId, "Test");
    expect(loadFindings(projectId).length).toBe(first);
  });
});

describe("Entscheidungen überleben einen erneuten Lauf", () => {
  beforeEach(async () => {
    await createChapter(projectId, "Leeres Kapitel", doc([""]));
    await runPreflight(projectId, "Test");
  });

  it("behält ignorierte Befunde ignoriert", async () => {
    const before = loadFindings(projectId);
    const target = before[0];
    await saveDecision(projectId, target.fingerprint, "ignored");

    // Nach erneutem Lauf muss der Befund weiter ignoriert sein.
    await runPreflight(projectId, "Test");
    const after = loadFindings(projectId);
    const same = after.find((f) => f.fingerprint === target.fingerprint);

    expect(same).toBeTruthy();
    expect(same?.status).toBe("ignored");
  });

  it("behält als bewusst markierte Befunde als intentional", async () => {
    const target = loadFindings(projectId)[0];
    await saveDecision(projectId, target.fingerprint, "accepted");
    await runPreflight(projectId, "Test");

    const same = loadFindings(projectId).find((f) => f.fingerprint === target.fingerprint);
    expect(same?.status).toBe("accepted");
    expect(same?.kind).toBe("intentional");
  });

  it("kann eine Entscheidung zurücknehmen", async () => {
    const target = loadFindings(projectId)[0];
    await saveDecision(projectId, target.fingerprint, "ignored");
    await saveDecision(projectId, target.fingerprint, "open");
    await runPreflight(projectId, "Test");

    const same = loadFindings(projectId).find((f) => f.fingerprint === target.fingerprint);
    expect(same?.status).toBe("open");
  });

  it("blendet entschiedene Befunde aus der Standardliste aus", async () => {
    const before = applyFilter(loadFindings(projectId), {}).length;
    const target = loadFindings(projectId)[0];
    await saveDecision(projectId, target.fingerprint, "ignored");

    const after = applyFilter(loadFindings(projectId), {}).length;
    expect(after).toBe(before - 1);
  });

  it("zählt entschiedene Befunde nicht mehr im Bericht", async () => {
    const target = loadFindings(projectId).find((f) => f.severity === "blocker");
    expect(target).toBeTruthy();
    await saveDecision(projectId, target!.fingerprint, "accepted");

    const r = await runPreflight(projectId, "Test");
    // Der akzeptierte Blocker darf das Zählwerk nicht mehr belasten.
    const stillCounted = r.findings.filter(
      (f) => f.fingerprint === target!.fingerprint && f.status === "open",
    );
    expect(stillCounted).toHaveLength(0);
  });
});

describe("Abschaltbare Regeln", () => {
  beforeEach(async () => {
    await createChapter(projectId, "Eins", doc(["Ein Text mit genügend Inhalt darin."]));
  });

  it("übergeht abgeschaltete Regeln", async () => {
    const first = await runPreflight(projectId, "Test", { checkFrontmatter: true });
    const hadImprint = first.findings.some((f) => f.ruleId === "frontmatter.missing-imprint");
    expect(hadImprint).toBe(true);

    await setRuleEnabled(projectId, "frontmatter.missing-imprint", false);

    const second = await runPreflight(projectId, "Test", { checkFrontmatter: true });
    expect(second.findings.some((f) => f.ruleId === "frontmatter.missing-imprint")).toBe(false);
  });

  it("merkt sich die Regeleinstellung", async () => {
    await setRuleEnabled(projectId, "structure.short-chapter", false, "Zwischenspiele sind kurz");
    const rules = listRules(projectId);

    expect(rules).toHaveLength(1);
    expect(rules[0].enabled).toBe(false);
    expect(rules[0].note).toContain("Zwischenspiele");
  });

  it("kann eine Regel wieder einschalten", async () => {
    await setRuleEnabled(projectId, "frontmatter.missing-imprint", false);
    await setRuleEnabled(projectId, "frontmatter.missing-imprint", true);

    const r = await runPreflight(projectId, "Test", { checkFrontmatter: true });
    expect(r.findings.some((f) => f.ruleId === "frontmatter.missing-imprint")).toBe(true);
  });
});

describe("Export-Gate am echten Projekt", () => {
  it("verlangt Bestätigung bei einem leeren Kapitel", async () => {
    await createChapter(projectId, "Leer", doc([""]));
    const r = await runExportPreflight(projectId, "Test", "docx");
    const gate = exportGate(r.findings, "docx");

    expect(gate.needsConfirm).toBe(true);
    expect(gate.allowed).toBe(true);
    expect(gate.blockers.length).toBeGreaterThan(0);
  });

  it("lässt ein sauberes Projekt ohne Rückfrage durch", async () => {
    // Ein Kapitel mit Überschrift, Inhalt und ohne Auffälligkeiten.
    const content = JSON.stringify({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Der Fund" }] },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text:
                "Der Brief lag zwischen zwei Buchseiten. Marta hob ihn ans Licht. " +
                "Das Papier war dünn geworden. Sie las die erste Zeile und setzte sich. " +
                "Draußen fiel Regen. Ein Auto fuhr vorbei. Der Name stimmte.",
            },
          ],
        },
      ],
    });
    await createChapter(projectId, "Der Fund", content);

    const r = await runExportPreflight(projectId, "Test", "docx");
    const gate = exportGate(r.findings, "docx");
    expect(gate.needsConfirm).toBe(false);
  });

  it("überspringt Frontmatter beim Export-Gate", async () => {
    await createChapter(projectId, "Eins", doc(["Ein Text mit genügend Inhalt darin."]));
    const r = await runExportPreflight(projectId, "Test", "docx");

    // Frontmatter behindert den Export nicht — beim Gate wäre es nur Lärm.
    expect(r.findings.some((f) => f.category === "frontmatter")).toBe(false);
    expect(r.report.checkedFrontmatter).toBe(false);
  });
});
