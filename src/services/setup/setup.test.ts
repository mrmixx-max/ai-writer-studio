// Unit-Tests: Erststart-Assistent — Zustandslogik und Beispielprojekt.
//
// Der Assistent selbst wird nicht gerendert (kein DOM in dieser Testumgebung);
// geprüft wird, was ihn steuert: Abschlussstatus, Versionierung und das
// tatsächliche Anlegen der Startinhalte in der DB.

import { describe, it, expect, beforeEach, vi } from "vitest";
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { isSetupCompleted, markSetupCompleted, resetSetup, SETUP_VERSION } from "@/services/setup/state";
import { createSampleProject } from "@/services/setup/sampleProject";
import { seedDefaultPrompts } from "@/services/prompt/seed";
import { listProjects } from "@/services/project";
import { listCharacters, listNotes } from "@/services/knowledge/profiles";

// --- localStorage-Ersatz für Node -----------------------------------------
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  get length() { return this.m.size; }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
}

let store: MemoryStorage;

beforeEach(async () => {
  store = new MemoryStorage();
  vi.stubGlobal("localStorage", store);

  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;
});

describe("Setup-Status", () => {
  it("ist beim ersten Start nicht abgeschlossen", () => {
    expect(isSetupCompleted()).toBe(false);
  });

  it("merkt sich den Abschluss", () => {
    markSetupCompleted();
    expect(isSetupCompleted()).toBe(true);
  });

  it("erscheint erneut, wenn die Assistentenversion steigt", () => {
    markSetupCompleted();
    // Simuliert einen älteren Abschluss als die aktuelle Version.
    localStorage.setItem("aiws.setup.version", String(SETUP_VERSION - 1));
    expect(isSetupCompleted()).toBe(false);
  });

  it("kann zurückgesetzt werden", () => {
    markSetupCompleted();
    resetSetup();
    expect(isSetupCompleted()).toBe(false);
  });
});

describe("Beispielprojekt", () => {
  it("legt Projekt, Kapitel, Figuren und Notizen an", async () => {
    const id = await createSampleProject();
    expect(id).toBeTruthy();

    const projects = listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toContain("Novemberbrief");

    const chars = listCharacters(id);
    expect(chars.map((c) => c.name)).toContain("Marta Reineke");
    expect(chars.map((c) => c.name)).toContain("Kessler");

    const notes = listNotes(id);
    expect(notes.map((n) => n.title)).toContain("Zeitlinie");
    expect(notes.map((n) => n.title)).toContain("Ton und Stil");
  });

  it("legt Kapitel mit gültigem TipTap-Inhalt an", async () => {
    const id = await createSampleProject();
    const db = (globalThis as any).__aws_db;
    const res = db.exec("SELECT content FROM chapters WHERE project_id = ? ORDER BY order_index", [id]);
    const contents: string[] = res[0].values.map((r: unknown[]) => String(r[0]));

    expect(contents).toHaveLength(3);
    for (const c of contents) {
      const parsed = JSON.parse(c);
      expect(parsed.type).toBe("doc");
      expect(Array.isArray(parsed.content)).toBe(true);
      // Jedes Kapitel beginnt mit einer Überschrift.
      expect(parsed.content[0].type).toBe("heading");
    }
  });

  it("gibt der Figur Marta ein Alter, das zur Zeitlinie passt", async () => {
    // Inhaltliche Probe: Die Notiz nennt 65 Jahre zwischen Brief und Fund.
    // Martas Alter muss dazu widerspruchsfrei sein, sonst würde das
    // Beispielprojekt die Konsistenzprüfung selbst verletzen.
    const id = await createSampleProject();
    const marta = listCharacters(id).find((c) => c.name === "Marta Reineke");
    expect(marta?.age).toBe("48");
  });
});

describe("Prompt-Vorlagen", () => {
  it("legt Vorlagen an", async () => {
    const n = await seedDefaultPrompts();
    expect(n).toBeGreaterThan(0);
  });

  it("erzeugt bei zweitem Aufruf keine Dubletten", async () => {
    const first = await seedDefaultPrompts();
    const second = await seedDefaultPrompts();
    expect(second).toBe(0);

    const db = (globalThis as any).__aws_db;
    const total = db.exec("SELECT COUNT(*) FROM writing_prompts")[0].values[0][0];
    expect(total).toBe(first);
  });
});
