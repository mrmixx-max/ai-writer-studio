// Tests: ContextManager-Erweiterung (Sprint 5, Agent 3, Teil 2) — ISBN & Pricing.
//
// Akzeptanzkriterien: ISBN-Platzhalter vorhanden, Preisstrategie konfigurierbar.
import { describe, it, expect, beforeEach, vi } from "vitest";
vi.mock("sql.js", async (importOriginal) => await importOriginal());
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import {
  upsertFact,
  getFact,
  listFacts,
  PUBLISHING_FACT_KINDS,
  buildPublishingContextBlock,
  resolveProjectIsbns,
  getProjectPricing,
  setProjectPricingStrategy,
} from "./contextManager";
import { isbnPlaceholder } from "@/services/kdp/uploadSheet";

let projectId: string;

beforeEach(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;
  db.exec("INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p1','Test',1,1)");
  projectId = "p1";
});

describe("ContextManager: Publishing-Fakten (isbn/pricing)", () => {
  it("neue Fact-Kinds sind registriert", () => {
    expect(PUBLISHING_FACT_KINDS).toContain("isbn");
    expect(PUBLISHING_FACT_KINDS).toContain("pricing");
  });

  it("speichert ISBN pro Format (key = paperback|ebook|hardcover)", async () => {
    const f = await upsertFact(projectId, { kind: "isbn", key: "paperback", value: "9783648155489" });
    expect(f.kind).toBe("isbn");
    expect(getFact(projectId, "isbn", "paperback")?.value).toBe("9783648155489");
    expect(listFacts(projectId, "isbn")).toHaveLength(1);
  });

  it("speichert Preisstrategie-Fakten (key = strategy|USD|EUR|GBP)", async () => {
    await upsertFact(projectId, { kind: "pricing", key: "strategy", value: "launch" });
    await upsertFact(projectId, { kind: "pricing", key: "USD", value: "2.99" });
    expect(listFacts(projectId, "pricing")).toHaveLength(2);
  });

  it("ungültiges ISBN-Format wirft", async () => {
    await expect(
      upsertFact(projectId, { kind: "isbn", key: "audiobook", value: "123" }),
    ).rejects.toThrow(/ISBN-Format/);
  });

  it("ungültige Preisstrategie wirft", async () => {
    await expect(
      upsertFact(projectId, { kind: "pricing", key: "strategy", value: "mega-deal" }),
    ).rejects.toThrow(/Preisstrategie/);
  });

  it("ungültiger Preiswert (nicht numerisch) wirft", async () => {
    await expect(
      upsertFact(projectId, { kind: "pricing", key: "USD", value: "vierneunzig" }),
    ).rejects.toThrow(/numerisch/);
  });

  it("Preis außerhalb der KDP-Grenzen wirft", async () => {
    await expect(
      upsertFact(projectId, { kind: "pricing", key: "USD", value: "0.10" }),
    ).rejects.toThrow(/KDP/);
  });
});

describe("ContextManager: resolveProjectIsbns", () => {
  it("liefert vergebene ISBNs und Platzhalter für offene Slots", async () => {
    await upsertFact(projectId, { kind: "isbn", key: "ebook", value: "9783648155489" });
    const isbns = resolveProjectIsbns(projectId);
    expect(isbns.ebook).toBe("9783648155489");
    expect(isbns.paperback).toBe(isbnPlaceholder("paperback"));
    expect(isbns.hardcover).toBe(isbnPlaceholder("hardcover"));
  });

  it("Projekt ohne ISBNs → alle Platzhalter", () => {
    const isbns = resolveProjectIsbns("p2");
    expect(isbns.paperback).toBe(isbnPlaceholder("paperback"));
    expect(isbns.ebook).toBe(isbnPlaceholder("ebook"));
  });
});

describe("ContextManager: Preisstrategie konfigurierbar", () => {
  it("getProjectPricing liest Strategie + Preise aus der Fakten-Base", async () => {
    await setProjectPricingStrategy(projectId, "premium");
    const pricing = getProjectPricing(projectId);
    expect(pricing.strategy).toBe("premium");
    expect(pricing.prices.USD).toBe(7.99);
  });

  it("getProjectPricing ohne Konfiguration → Standard-Strategie", () => {
    expect(getProjectPricing("p2").strategy).toBe("standard");
  });

  it("setProjectPricingStrategy mit Override-Preisen speichert alle Fakten", async () => {
    await setProjectPricingStrategy(projectId, "launch", { USD: 1.99 });
    const pricing = getProjectPricing(projectId);
    expect(pricing.strategy).toBe("launch");
    expect(pricing.prices.USD).toBe(1.99);
    expect(pricing.prices.EUR).toBe(2.99);
  });
});

describe("ContextManager: buildPublishingContextBlock", () => {
  it("enthält ISBN-Zeilen und Preiszeilen deterministisch", async () => {
    await upsertFact(projectId, { kind: "isbn", key: "ebook", value: "9783648155489" });
    await setProjectPricingStrategy(projectId, "launch");
    const block = buildPublishingContextBlock(projectId);
    expect(block).toContain("9783648155489");
    expect(block).toContain("launch");
    expect(buildPublishingContextBlock(projectId)).toBe(block);
  });

  it("leere Publishing-Base → leerer Block", () => {
    expect(buildPublishingContextBlock(projectId)).toBe("");
  });
});
