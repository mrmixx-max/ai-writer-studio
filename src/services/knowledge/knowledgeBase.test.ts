// Tests: lokale Wissensdatenbank (CRUD + TF-IDF-Suche + Markdown-Im-/Export).
import { describe, it, expect, beforeEach } from "vitest";
import {
  addEntry,
  updateEntry,
  deleteEntry,
  search,
  getAllEntries,
  exportToMarkdown,
  importFromMarkdown,
  clearEntries,
} from "@/services/knowledge/knowledgeBase";

beforeEach(() => {
  clearEntries();
});

describe("addEntry", () => {
  it("erzeugt einen Eintrag mit ID und Zeitstempeln", async () => {
    const entry = await addEntry({
      title: "Testnotiz",
      content: "Inhalt zum Testen",
      tags: ["test"],
    });
    expect(entry.id).toBeTruthy();
    expect(entry.title).toBe("Testnotiz");
    expect(entry.createdAt).toBeGreaterThan(0);
    expect(entry.updatedAt).toBe(entry.createdAt);
    expect(await getAllEntries()).toHaveLength(1);
  });
});

describe("updateEntry / deleteEntry", () => {
  it("aktualisiert Titel und Tags", async () => {
    const entry = await addEntry({ title: "Alt", content: "Text", tags: [] });
    const updated = await updateEntry(entry.id, { title: "Neu", tags: ["a"] });
    expect(updated.title).toBe("Neu");
    expect(updated.tags).toEqual(["a"]);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(entry.updatedAt);
  });

  it("wirft bei unbekannter ID", async () => {
    await expect(updateEntry("gibts-nicht", { title: "x" })).rejects.toThrow();
    await expect(deleteEntry("gibts-nicht")).rejects.toThrow();
  });

  it("löscht einen Eintrag", async () => {
    const entry = await addEntry({ title: "Weg", content: "Text", tags: [] });
    await deleteEntry(entry.id);
    expect(await getAllEntries()).toHaveLength(0);
  });
});

describe("search", () => {
  it("findet Einträge nach Text und rankt nach TF-IDF", async () => {
    await addEntry({ title: "Unwichtig", content: "Belangloser Text", tags: [] });
    await addEntry({
      title: "Drachenburg",
      content: "Drachen Drachen Burg Festung Drachen",
      tags: [],
    });
    const results = await search({ text: "Drachen Burg", limit: 10 });
    expect(results).toHaveLength(1);
    expect(results[0].entry.title).toBe("Drachenburg");
    expect(results[0].score).toBeGreaterThan(0);
  });

  it("filtert nach Tags und respektiert das Limit", async () => {
    await addEntry({ title: "Eins", content: "Zauberwald Magie", tags: ["fantasy"] });
    await addEntry({ title: "Zwei", content: "Zauberwald Magie", tags: ["krimi"] });
    await addEntry({ title: "Drei", content: "Zauberwald Magie", tags: ["fantasy"] });
    const filtered = await search({ text: "Zauberwald", tags: ["fantasy"], limit: 10 });
    expect(filtered).toHaveLength(2);
    const limited = await search({ text: "Zauberwald", limit: 1 });
    expect(limited).toHaveLength(1);
  });

  it("liefert nichts bei leerer Anfrage", async () => {
    await addEntry({ title: "Eintrag", content: "Inhalt", tags: [] });
    expect(await search({ text: "   ", limit: 10 })).toEqual([]);
  });
});

describe("importFromMarkdown / exportToMarkdown", () => {
  it("parsed Markdown mit Meta-Zeile", async () => {
    const md = [
      "## Drachenburg",
      "",
      "*Quelle: Weltbuch · Tags: fantasy, ort*",
      "",
      "Eine alte Festung im Norden.",
      "",
      "---",
      "",
      "## Kommissar",
      "",
      "Ermittelt in Hamburg.",
    ].join("\n");
    const count = await importFromMarkdown(md);
    expect(count).toBe(2);
    const entries = await getAllEntries();
    const burg = entries.find((e) => e.title === "Drachenburg")!;
    expect(burg.source).toBe("Weltbuch");
    expect(burg.tags).toEqual(["fantasy", "ort"]);
    expect(burg.content).toContain("Festung");
  });

  it("Export/Import-Roundtrip erhält alle Einträge", async () => {
    await addEntry({
      title: "Notiz A",
      content: "Inhalt A",
      source: "Buch",
      tags: ["x"],
    });
    await addEntry({ title: "Notiz B", content: "Inhalt B", tags: [] });
    const md = await exportToMarkdown();
    expect(md).toContain("## Notiz A");
    clearEntries();
    const count = await importFromMarkdown(md);
    expect(count).toBe(2);
    expect(await getAllEntries()).toHaveLength(2);
  });
});
