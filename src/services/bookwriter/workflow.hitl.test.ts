// Integrationstest: HITL-Haltepunkte im Bookwriter-Workflow (Sprint 5).
// Simuliert einen Lauf mit --hitl=true-Hooks: Nach Gliederung, Memory-Base
// und finalem Revisions-Loop wird pausiert; eingespeiste Änderungswünsche
// werden als verbindlicher Inject-Block in die Prompts übergeben.
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
vi.mock("sql.js", async (importOriginal) => await importOriginal());
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { createProject } from "@/services/project";
import {
  startBookwriter,
  runBookwriter,
  type HitlHooks,
} from "@/services/bookwriter/workflow";
import { loadRun } from "@/services/bookwriter/state";
import type { BookBriefing } from "@/types/bookwriter";
import type { HitlGate } from "@/services/cli/hitl";

vi.mock("@/services/llm", () => ({
  completeOnce: vi.fn(async (_settings: unknown, userContent: string) => {
    if (userContent.includes("10 Titel")) return "Der stille Wald";
    if (userContent.includes("Untertitel")) return "Eine Reise ins Unbekannte";
    if (userContent.includes("Positionierungen")) return "Positionierung A";
    if (userContent.includes("Klappentext")) return "Klappentext …";
    if (userContent.includes("Gliederung") || userContent.includes("JSON-Array")) {
      return JSON.stringify([
        { title: "1. Der Anfang", goal: "Welt etablieren.", conflict: "Ein Besuch.", outcome: "Eine Wahl.",
          estimatedWords: 1500, pov: "dritte Person", research: [], subchapters: ["Ankunft"] },
        { title: "2. Die Mitte", goal: "Spannung steigern.", conflict: "Ein Verrat.", outcome: "Allianz.",
          estimatedWords: 1500, pov: "dritte Person", research: [], subchapters: ["Verrat"] },
        { title: "3. Das Ende", goal: "Auflösung.", conflict: "Konfrontation.", outcome: "Versprechen eingelöst.",
          estimatedWords: 1500, pov: "dritte Person", research: [], subchapters: ["Finale"] },
      ]);
    }
    if (userContent.includes("Schreibe ein Kapitel")) {
      // Der Inject-Block muss im Prompt angekommen sein — wir spiegeln ihn zurück.
      return userContent.includes("Redaktionelle Anweisungen des Verlags")
        ? "KAPITEL-MIT-INJECT"
        : "Kapitel ohne Inject.";
    }
    if (userContent.includes("Fasse das folgende Kapitel")) return "Zusammenfassung.";
    if (userContent.includes("Keywords")) return "Wald\nÖkosystem";
    return "Mock-Antwort";
  }),
  buildMessages: vi.fn((userContent: string) => [{ role: "user" as const, content: userContent }]),
}));

vi.mock("@/services/kdp/packaging", () => ({
  downloadKdpPackage: vi.fn(async () => ({ folderName: "kdp", files: [] })),
}));

const briefing: BookBriefing = {
  genre: "krimi",
  targetAudience: "Erwachsene",
  tone: "düsel-spannend",
  chapterCount: 3,
  wordsPerChapter: 1500,
  idea: "Ein Krimi im Dorf.",
  uniqueAngle: "Ermittlerin mit Gedächtnisverlust.",
  corePromise: "Spannung bis zur letzten Seite.",
  kdpTarget: "ebook",
  language: "de",
  styleReferences: "",
  customOutline: null,
};

let projectId: string;

beforeEach(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;
  const p = await createProject("HITL-Workflow-Test");
  projectId = p.id;
});

afterEach(() => {
  vi.clearAllMocks();
  delete (globalThis as any).__aws_db;
});

/** Scripted HITL-Hooks: sammelt Gates + Antworten, Injektion einmalig. */
function makeScriptedHooks(answers: Partial<Record<HitlGate, "approved" | "rejected">>): {
  hooks: HitlHooks;
  gates: HitlGate[];
} {
  const gates: HitlGate[] = [];
  return {
    gates,
    hooks: {
      shouldPause: (gate) => HITL_GATES_ALL.includes(gate),
      onGate: async (gate) => {
        gates.push(gate);
        if (answers[gate] === "rejected") throw new Error(`Haltepunkt '${gate}' vom Publisher abgelehnt.`);
      },
      applyInjects: (prompt) => prompt, // Injects separat prüfbar
    },
  };
}

const HITL_GATES_ALL: HitlGate[] = ["outline", "memory", "revision"];

describe("HITL-Workflow-Integration", () => {
  it("ohne hitl: Lauf läuft komplett durch (keine Breaking Changes)", async () => {
    const runId = await startBookwriter(projectId, briefing, "auto");
    await expect(runBookwriter(runId, "HITL-Workflow-Test")).resolves.toBeUndefined();
    expect(loadRun(runId)!.status).toBe("completed");
  });

  it("mit hitl: alle drei Haltepunkte werden durchlaufen und approvt", async () => {
    const { hooks, gates } = makeScriptedHooks({});
    const runId = await startBookwriter(projectId, briefing, "auto");
    await runBookwriter(runId, "HITL-Workflow-Test", undefined, undefined, hooks);
    expect(gates).toEqual(["outline", "memory", "revision"]);
    expect(loadRun(runId)!.status).toBe("completed");
  });

  it("Approve am Outline-Gate wird vom Hook-Callback registriert", async () => {
    let approved = false;
    const hooks: HitlHooks = {
      shouldPause: () => true,
      onGate: async (gate) => {
        if (gate === "outline") approved = true;
      },
      applyInjects: (p) => p,
    };
    const runId = await startBookwriter(projectId, briefing, "auto");
    await runBookwriter(runId, "HITL-Workflow-Test", undefined, undefined, hooks);
    expect(approved).toBe(true);
  });

  it("Reject am Outline-Gate pausiert den Lauf", async () => {
    const hooks: HitlHooks = {
      shouldPause: () => true,
      onGate: async (gate) => {
        if (gate === "outline") throw new Error("Haltepunkt 'outline' vom Publisher abgelehnt.");
      },
      applyInjects: (p) => p,
    };
    const runId = await startBookwriter(projectId, briefing, "auto");
    await runBookwriter(runId, "HITL-Workflow-Test", undefined, undefined, hooks);
    expect(loadRun(runId)!.status).toBe("paused");
  });

  it("Injects aus dem Editor landen im Kapitel-Prompt (Model-Inject)", async () => {
    const injectBlock = "\n\nRedaktionelle Anweisungen des Verlags (verbindlich umzusetzen):\n- Kapitel 3 Fokus ändern: Mehr Spannung\n";
    const hooks: HitlHooks = {
      shouldPause: () => true,
      onGate: async () => {},
      applyInjects: (prompt) => `${prompt}${injectBlock}`,
    };
    const spy = vi.mocked((await import("@/services/llm")).completeOnce);
    const runId = await startBookwriter(projectId, briefing, "auto");
    await runBookwriter(runId, "HITL-Workflow-Test", undefined, undefined, hooks);

    const writeCalls = spy.mock.calls.filter((c) => String(c[1]).includes("Schreibe ein Kapitel"));
    expect(writeCalls.length).toBe(3);
    for (const call of writeCalls) {
      expect(String(call[1])).toContain("Kapitel 3 Fokus ändern: Mehr Spannung");
    }
  });
});
