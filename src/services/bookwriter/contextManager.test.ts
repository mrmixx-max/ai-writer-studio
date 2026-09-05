// Tests: ContextManager (Sprint 3, Teil 1) — Long-Term Memory / Knowledge-Base.
//
// Akzeptanzkriterium: ContextManager speichert/liest projektbezogene Fakten
// und injiziert sie als Kontextblock in Prompts.
import { describe, it, expect, beforeEach, vi } from "vitest";
vi.mock("sql.js", async (importOriginal) => await importOriginal());
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import {
  upsertFact,
  upsertFacts,
  getFact,
  listFacts,
  deleteFact,
  clearFacts,
  buildContextBlock,
  extractFactKeys,
} from "./contextManager";

let projectId: string;

beforeEach(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;
  const res = db.exec("INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p1','Test',1,1)");
  void res;
  projectId = "p1";
});

describe("ContextManager: speichern/lesen", () => {
  it("speichert einen Fakt und liest ihn zurück", async () => {
    const f = await upsertFact(projectId, { kind: "character", key: "Anna Weber", value: "Detektivin, 34 Jahre, raucht Pfeife" });
    expect(f.key).toBe("Anna Weber");
    const loaded = getFact(projectId, "character", "Anna Weber");
    expect(loaded?.value).toContain("Detektivin");
  });

  it("Upsert: gleicher key aktualisiert statt zu duplizieren", async () => {
    await upsertFact(projectId, { kind: "character", key: "Ben", value: "jung" });
    await upsertFact(projectId, { kind: "character", key: "Ben", value: "jung, 19 Jahre" });
    expect(listFacts(projectId, "character")).toHaveLength(1);
    expect(getFact(projectId, "character", "Ben")?.value).toBe("jung, 19 Jahre");
  });

  it("Projekt-Trennung: Fakten eines anderen Projekts sind nicht sichtbar", async () => {
    await upsertFact(projectId, { kind: "place", key: "Hafen", value: "Nordsee" });
    expect(getFact("p2", "place", "Hafen")).toBeNull();
    expect(listFacts("p2")).toHaveLength(0);
  });

  it("Bulk-Upsert speichert mehrere Fakten aller Arten", async () => {
    const saved = await upsertFacts(projectId, [
      { kind: "character", key: "Anna", value: "34 Jahre" },
      { kind: "timeline", key: "Handlungszeitraum", value: "Herbst 1987" },
      { kind: "terminology", key: "Cold Case", value: "ungeklärter Fall" },
    ]);
    expect(saved).toHaveLength(3);
    expect(listFacts(projectId)).toHaveLength(3);
  });

  it("leerer key/value wirft", async () => {
    await expect(upsertFact(projectId, { kind: "entity", key: "  ", value: "x" })).rejects.toThrow(/key/);
    await expect(upsertFact(projectId, { kind: "entity", key: "X", value: "" })).rejects.toThrow(/value/);
  });

  it("deleteFact und clearFacts räumen auf", async () => {
    const a = await upsertFact(projectId, { kind: "entity", key: "A", value: "a" });
    await upsertFact(projectId, { kind: "entity", key: "B", value: "b" });
    await deleteFact(a.id);
    expect(listFacts(projectId)).toHaveLength(1);
    await clearFacts(projectId);
    expect(listFacts(projectId)).toHaveLength(0);
  });
});

describe("ContextManager: Kontext-Injektion", () => {
  it("buildContextBlock gruppiert nach Art mit verbindlichem Header", async () => {
    await upsertFacts(projectId, [
      { kind: "character", key: "Anna Weber", value: "Detektivin, 34" },
      { kind: "character", key: "Ben Roth", value: "Assistent, 26" },
      { kind: "timeline", key: "Handlungszeitraum", value: "Herbst 1987" },
    ]);
    const block = buildContextBlock(projectId);
    expect(block).toContain("Stabiler Kontext");
    expect(block).toContain("Charaktere:");
    expect(block).toContain("- Anna Weber: Detektivin, 34");
    expect(block).toContain("Zeitlinie:");
    // Deterministisch: zwei Aufrufe liefern denselben Block.
    expect(buildContextBlock(projectId)).toBe(block);
  });

  it("leere Base → leerer Block (kein Prompt-Müll)", () => {
    expect(buildContextBlock(projectId)).toBe("");
  });

  it("maxPerKind begrenzt die Zeilen je Art (Token-Budget)", async () => {
    const inputs = Array.from({ length: 15 }, (_, i) => ({
      kind: "entity" as const, key: `Begriff${String(i).padStart(2, "0")}`, value: `Definition ${i}`,
    }));
    await upsertFacts(projectId, inputs);
    const block = buildContextBlock(projectId, 5);
    expect(block.match(/Begriff\d\d:/g)).toHaveLength(5);
  });

  it("extractFactKeys findet Eigennamen und filtert Stopwörter", () => {
    const keys = extractFactKeys("Anna traf den Kaptän Weber. Der Dieb floh. Kapitel endet.");
    expect(keys).toContain("Anna");
    expect(keys).not.toContain("Der");
    expect(keys).not.toContain("Kapitel");
  });
});
