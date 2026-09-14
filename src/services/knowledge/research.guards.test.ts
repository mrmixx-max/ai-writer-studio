// Guards: Research-Update-Pfade mit unbekannter ID werfen verständliche Fehler.
import { describe, it, expect, beforeEach } from "vitest";
import { initDb } from "@/services/db";
import {
  upsertResearchSource,
  upsertResearchQuote,
  upsertResearchNote,
  updateResearchClip,
} from "./research";

describe("research update-guards", () => {
  beforeEach(async () => {
    await initDb();
    const db = (globalThis as any).__aws_db;
    for (const t of ["research_quotes", "research_sources", "research_notes", "research_clips"]) {
      db.run(`DELETE FROM ${t}`);
    }
  });

  it("upsertResearchSource mit unbekannter ID wirft statt null", async () => {
    await expect(
      upsertResearchSource({ projectId: "p1", kind: "book", title: "X" }, "rsrc-unknown"),
    ).rejects.toThrow(/nicht gefunden/);
  });

  it("upsertResearchQuote mit unbekannter ID wirft statt TypeError", async () => {
    await expect(
      upsertResearchQuote({ projectId: "p1", text: "Zitat" }, "rquote-unknown"),
    ).rejects.toThrow(/nicht gefunden/);
  });

  it("upsertResearchNote mit unbekannter ID wirft statt null", async () => {
    await expect(
      upsertResearchNote({ projectId: "p1", title: "T", content: "C" }, "rnote-unknown"),
    ).rejects.toThrow(/nicht gefunden/);
  });

  it("updateResearchClip mit unbekannter ID wirft statt TypeError", async () => {
    await expect(
      updateResearchClip("rclip-unknown", { title: "Neu" }),
    ).rejects.toThrow(/nicht gefunden/);
  });
});
