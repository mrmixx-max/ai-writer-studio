// Unit-Tests: Research-Service — Quellen, Zitate, Notizen, Clips (In-Memory-DB).
import { describe, it, expect, beforeEach } from "vitest";
import { initDb } from "@/services/db";
import {
  upsertResearchSource,
  listResearchSources,
  deleteResearchSource,
  formatCitation,
  upsertResearchQuote,
  listResearchQuotes,
  formatQuoteWithSource,
  upsertResearchNote,
  listResearchNotes,
  saveResearchClip,
  listResearchClips,
} from "./research";

describe("research service", () => {
  beforeEach(async () => {
    await initDb();
    const db = (globalThis as any).__aws_db;
    for (const t of ["research_quotes", "research_sources", "research_notes", "research_clips"]) {
      db.run(`DELETE FROM ${t}`);
    }
  });

  it("legt Quellen an, listet, formatiert und löscht sie", async () => {
    const s = await upsertResearchSource({
      projectId: "p1",
      kind: "book",
      title: "Der Romanbau",
      author: "E. M. Forster",
      year: "1927",
      publisher: "Klett",
    });
    expect(listResearchSources("p1")).toHaveLength(1);
    expect(formatCitation(s)).toContain("Forster (1927) Der Romanbau.");

    await upsertResearchSource(
      { projectId: "p1", kind: "website", title: "Research-Blog", url: "https://example.com" },
      s.id,
    );
    const updated = listResearchSources("p1");
    expect(updated).toHaveLength(1);
    expect(updated[0].kind).toBe("website");

    await deleteResearchSource(s.id);
    expect(listResearchSources("p1")).toHaveLength(0);
  });

  it("verwaltet Zitate mit Quellenangabe", async () => {
    const s = await upsertResearchSource({ projectId: "p1", kind: "book", title: "Stilkunde", author: "Wolf Schneider", year: "1988" });
    const q = await upsertResearchQuote({ projectId: "p1", sourceId: s.id, text: "Schreibe so, dass es keiner merkt.", page: "42" });
    const quotes = listResearchQuotes("p1");
    expect(quotes).toHaveLength(1);
    expect(quotes[0].sourceId).toBe(s.id);
    expect(formatQuoteWithSource(quotes[0], s)).toContain("Wolf Schneider 1988");
    expect(q.id).toBeTruthy();

    // Filter nach Quelle
    expect(listResearchQuotes("p1", s.id)).toHaveLength(1);
    expect(listResearchQuotes("p1", "anders")).toHaveLength(0);
  });

  it("verwaltet Forschungsnotizen", async () => {
    const n = await upsertResearchNote({ projectId: "p1", title: "Ideen Kapitel 3", content: "Spannungsbogen…" });
    expect(listResearchNotes("p1")).toHaveLength(1);
    await upsertResearchNote({ projectId: "p1", title: "Ideen Kapitel 3 (überarbeitet)", content: "neu" }, n.id);
    const notes = listResearchNotes("p1");
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toContain("überarbeitet");
  });

  it("speichert Web-Clips ohne Extraktion, wenn das Netzwerk scheitert", async () => {
    const clip = await saveResearchClip({ projectId: "p1", url: "http://localhost:1/verboten" });
    const clips = listResearchClips("p1");
    expect(clips).toHaveLength(1);
    expect(clips[0].url).toBe("http://localhost:1/verboten");
    expect(clip.id).toBeTruthy();
  });
});
