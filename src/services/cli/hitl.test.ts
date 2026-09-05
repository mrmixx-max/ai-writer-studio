// Unit-Tests: HITL (Human-in-the-Loop) — Approval-Gates & CLI-Editor (Sprint 5).
// Reine Logik — kein Terminal nötig. Persistenz-Tests nutzen dieselbe
// In-Memory-DB-Einrichtung wie jobRecovery.test.ts.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
vi.mock("sql.js", async (importOriginal) => await importOriginal());
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { createProject } from "@/services/project";
import { loadLatestApproval, createRun } from "@/services/bookwriter/state";
import {
  HITL_GATES,
  GATE_PHASE,
  parseHitlArg,
  createHitl,
  shouldPauseAt,
  buildGatePrompt,
  resolveGate,
  addInject,
  buildInjectBlock,
  withInjects,
  formatOutlineSummary,
  formatMemorySummary,
  formatRevisionSummary,
  parseEditorLine,
  createHitlSession,
  type HitlIo,
} from "./hitl";

// ---- DB-Setup (nur für Persistenz-Tests) -------------------------------

let projectId: string;
let runId: string;

beforeEach(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;
  const p = await createProject("HITL-Test-Projekt");
  projectId = p.id;
  // bookwriter_approvals hat einen FK auf bookwriter_runs → echten Run anlegen.
  runId = createRun(projectId, "auto").id;
});

afterEach(() => {
  delete (globalThis as any).__aws_db;
});

// ---- Gates & Flag -------------------------------------------------------

describe("HITL: Gates & Flag", () => {
  it("definiert genau die drei Haltepunkte Outline, Memory, Revision", () => {
    expect(HITL_GATES).toEqual(["outline", "memory", "revision"]);
  });

  it("mappt Gates auf Workflow-Phasen", () => {
    expect(GATE_PHASE.outline).toBe("gliederung");
    expect(GATE_PHASE.memory).toBe("manuskript");
    expect(GATE_PHASE.revision).toBe("ueberarbeitung");
  });

  it("parseHitlArg: --hitl=true aktiviert, --hitl=false nicht", () => {
    expect(parseHitlArg(["node", "cli.mjs", "--hitl=true"])).toBe(true);
    expect(parseHitlArg(["node", "cli.mjs", "--hitl=false"])).toBe(false);
  });

  it("parseHitlArg: Flag ohne Wert zählt als aktiv, ohne Flag deaktiviert", () => {
    expect(parseHitlArg(["node", "cli.mjs", "--hitl"])).toBe(true);
    expect(parseHitlArg(["node", "cli.mjs"])).toBe(false);
  });

  it("ohne Aktivierung pausiert kein Gate", () => {
    const s = createHitl(false);
    expect(shouldPauseAt(s, "outline")).toBe(false);
    expect(shouldPauseAt(s, "memory")).toBe(false);
    expect(shouldPauseAt(s, "revision")).toBe(false);
  });

  it("mit --hitl=true pausieren alle drei Gates", () => {
    const s = createHitl(true);
    expect(shouldPauseAt(s, "outline")).toBe(true);
    expect(shouldPauseAt(s, "memory")).toBe(true);
    expect(shouldPauseAt(s, "revision")).toBe(true);
  });

  it("buildGatePrompt nennt Haltepunkt und Frage", () => {
    const q = buildGatePrompt("outline");
    expect(q).toContain("Gliederung");
    expect(q).toContain("freigeben");
  });
});

// ---- Approve / Reject ----------------------------------------------------

describe("HITL: Approve/Reject", () => {
  it("resolveGate approved → Entscheidung gesetzt, Gate frei gegeben", async () => {
    const s0 = createHitl(true);
    const s = await resolveGate(s0, projectId, runId, "outline", "approved", null);
    expect(s.decisions.outline).toBe("approved");
    expect(s.pendingGate).toBeNull();
  });

  it("resolveGate rejected → Entscheidung rejected", async () => {
    const s0 = createHitl(true);
    const s = await resolveGate(s0, projectId, runId, "memory", "rejected", "Charaktere inkonsistent");
    expect(s.decisions.memory).toBe("rejected");
  });

  it("resolveGate persistiert die Entscheidung in der DB", async () => {
    const s0 = createHitl(true);
    await resolveGate(s0, projectId, runId, "revision", "approved", "ok so");
    const stored = loadLatestApproval(runId, "ueberarbeitung");
    expect(stored).not.toBeNull();
    expect(stored!.decision).toBe("approved");
    expect(stored!.note).toBe("ok so");
  });

  it("resolveGate auf fremdem Gate wirft", async () => {
    const s = createHitl(true);
    await expect(
      resolveGate(s, projectId, runId, "kapitel3" as never, "approved", null),
    ).rejects.toThrow();
  });
});

// ---- Injects -------------------------------------------------------------

describe("HITL: Injects", () => {
  it("addInject übernimmt freitextliche Änderungswünsche getrimmt", () => {
    const s = addInject(createHitl(true), "  Kapitel 3 Fokus ändern: Mehr Spannung  ");
    expect(s.injects).toEqual(["Kapitel 3 Fokus ändern: Mehr Spannung"]);
  });

  it("addInject wirft bei leerem Text", () => {
    expect(() => addInject(createHitl(true), "   ")).toThrow();
  });

  it("addInject dedupliziert identische Injektionen", () => {
    let s = createHitl(true);
    s = addInject(s, "Mehr Spannung");
    s = addInject(s, "Mehr Spannung");
    expect(s.injects).toHaveLength(1);
  });

  it("buildInjectBlock: leer ohne Injektionen, mit Anweisungsblock sonst", () => {
    expect(buildInjectBlock(createHitl(true).injects)).toBe("");
    const block = buildInjectBlock(["Kapitel 3 Fokus ändern: Mehr Spannung"]);
    expect(block).toContain("Redaktion");
    expect(block).toContain("Kapitel 3 Fokus ändern: Mehr Spannung");
    expect(block).toContain("verbindlich");
  });

  it("withInjects hängt den Injektionsblock an den Prompt an", () => {
    const prompt = "Schreibe ein Kapitel.";
    const out = withInjects(prompt, ["Mehr Spannung"]);
    expect(out.startsWith(prompt)).toBe(true);
    expect(out).toContain("Mehr Spannung");
    expect(out).not.toBe(prompt);
  });

  it("withInjects ohne Injektionen lässt den Prompt unverändert", () => {
    const prompt = "Schreibe ein Kapitel.";
    expect(withInjects(prompt, [])).toBe(prompt);
  });
});

// ---- Gate-Zusammenfassungen ----------------------------------------------

describe("HITL: Gate-Zusammenfassungen", () => {
  it("formatOutlineSummary listet Kapitel und Wortbudget", () => {
    const s = formatOutlineSummary({
      totalWords: 4500,
      chapters: [
        { title: "1. Der Anfang", estimatedWords: 1500 },
        { title: "2. Die Mitte", estimatedWords: 1500 },
        { title: "3. Das Ende", estimatedWords: 1500 },
      ],
    } as never);
    expect(s).toContain("1. Der Anfang");
    expect(s).toContain("2. Die Mitte");
    expect(s).toContain("4500");
  });

  it("formatOutlineSummary ohne Gliederung → Hinweistext", () => {
    expect(formatOutlineSummary(null)).toContain("Keine Gliederung");
  });

  it("formatMemorySummary zeigt Fakten-Block oder 'leer'", () => {
    expect(formatMemorySummary("Charaktere:\n- Anna: Detektivin")).toContain("Anna");
    expect(formatMemorySummary("")).toContain("leer");
  });

  it("formatRevisionSummary nennt die Überarbeitungs-Phase", () => {
    expect(formatRevisionSummary()).toContain("Überarbeitung");
  });
});

// ---- CLI-Editor ------------------------------------------------------------

describe("HITL: CLI-Editor", () => {
  it("parseEditorLine: Freitext ist eine Inject-Anweisung", () => {
    expect(parseEditorLine("Kapitel 3 Fokus ändern: Mehr Spannung")).toEqual({
      type: "inject", text: "Kapitel 3 Fokus ändern: Mehr Spannung",
    });
  });

  it("parseEditorLine: 'a' / 'ok' approvt, 'x' rejected, 'l' listet, 'c' leert", () => {
    expect(parseEditorLine("a").type).toBe("approve");
    expect(parseEditorLine("ok").type).toBe("approve");
    expect(parseEditorLine("x").type).toBe("reject");
    expect(parseEditorLine("l").type).toBe("list");
    expect(parseEditorLine("c").type).toBe("clear");
  });

  it("Session-Gate: Injektion einspeisen und approven (scripted IO)", async () => {
    const answers = [
      "Kapitel 3 Fokus ändern: Mehr Spannung",
      "a",
    ];
    const printed: string[] = [];
    const io: HitlIo = {
      question: async () => answers.shift() ?? "a",
      print: (m) => printed.push(m),
    };
    const session = createHitlSession(true, io);
    const verdict = await session.runGate(runId, projectId, "outline");
    expect(verdict).toBe("approved");
    expect(session.allInjects()).toContain("Kapitel 3 Fokus ändern: Mehr Spannung");
    expect(printed.join("\n")).toContain("Mehr Spannung");
  });

  it("Session-Gate: 'x' bricht mit rejected ab", async () => {
    const io: HitlIo = { question: async () => "x", print: () => {} };
    const session = createHitlSession(true, io);
    const verdict = await session.runGate(runId, projectId, "outline");
    expect(verdict).toBe("rejected");
  });

  it("Session ohne HITL läuft ohne Rückfrage durch", async () => {
    let asked = 0;
    const io: HitlIo = { question: async () => { asked++; return "a"; }, print: () => {} };
    const session = createHitlSession(false, io);
    const verdict = await session.runGate(runId, projectId, "outline");
    expect(verdict).toBe("approved");
    expect(asked).toBe(0);
  });

  it("Session stellt Workflow-Hooks bereit: onGate wirft bei rejected, applyInjects injiziert", async () => {
    const answers = ["x"];
    const io: HitlIo = { question: async () => answers.shift() ?? "a", print: () => {} };
    const session = createHitlSession(true, io);
    const hooks = session.workflowHooks();
    expect(hooks.shouldPause("outline")).toBe(true);
    await expect(hooks.onGate("outline", runId, projectId)).rejects.toThrow("abgelehnt");
  });

  it("applyInjects übernimmt eingespeiste Änderungen in den Prompt", async () => {
    const answers = ["Mehr Spannung", "a"];
    const io: HitlIo = { question: async () => answers.shift() ?? "a", print: () => {} };
    const session = createHitlSession(true, io);
    await session.runGate(runId, projectId, "outline");
    const out = session.workflowHooks().applyInjects("Schreibe ein Kapitel.");
    expect(out).toContain("Mehr Spannung");
  });
});
