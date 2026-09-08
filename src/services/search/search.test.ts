// Unit-Tests: Volltextsuche über alle Projekte (Sprint 24, Agent 2).
import { describe, it, expect, beforeEach } from "vitest";
import { initDb } from "@/services/db";
import { createProject, createChapter, getChapter, listChapters } from "@/services/project";
import {
  search,
  replace,
  replaceAll,
  getRecentSearches,
  clearRecentSearches,
  type SearchQuery,
} from "./search";

const q = (text: string, extra?: Partial<SearchQuery>): SearchQuery => ({
  text,
  projects: [],
  caseSensitive: false,
  regex: false,
  wholeWord: false,
  scope: "all",
  ...extra,
});

describe("search engine", () => {
  beforeEach(async () => {
    await initDb();
    const db = (globalThis as unknown as { __aws_db: { run: (s: string) => void } }).__aws_db;
    db.run("DELETE FROM chapters");
    db.run("DELETE FROM projects");
    await clearRecentSearches();
  });

  it("findet Text in Projekt (Inhalt + Titel)", async () => {
    const p = await createProject("Krimi");
    await createChapter(p.id, "Kapitel Eins", "Der Kommissar betritt den dunklen Raum.\nZweite Zeile hier.");
    const { results, stats } = await search(q("kommissar"));
    expect(results.length).toBeGreaterThanOrEqual(1);
    const hit = results[0];
    expect(hit.projectId).toBe(p.id);
    expect(hit.projectTitle).toBe("Krimi");
    expect(hit.chapterTitle).toBe("Kapitel Eins");
    expect(hit.line).toBe(1);
    expect(hit.text).toContain("Kommissar");
    expect(hit.text.slice(hit.matchStart, hit.matchEnd).toLowerCase()).toBe("kommissar");
    expect(stats.totalResults).toBe(results.length);
    expect(stats.projectCount).toBe(1);
  });

  it("sucht über alle Projekte + Projekt-Filter", async () => {
    const a = await createProject("Alpha");
    const b = await createProject("Beta");
    await createChapter(a.id, "K1", "Ankerwort im ersten Buch");
    await createChapter(b.id, "K2", "Ankerwort im zweiten Buch");
    const all = await search(q("ankerwort"));
    expect(all.stats.projectCount).toBe(2);
    const filtered = await search(q("ankerwort", { projects: [a.id] }));
    expect(filtered.results.every((r) => r.projectId === a.id)).toBe(true);
    expect(filtered.stats.projectCount).toBe(1);
  });

  it("respektiert caseSensitive, wholeWord, regex und scope", async () => {
    const p = await createProject("P");
    await createChapter(p.id, "TitelTreffer", "Haus und Hausherr stehen da.");
    // caseSensitive: Kleinbuchstabe findet Großschreibung nicht
    expect((await search(q("haus", { caseSensitive: true }))).results).toHaveLength(0);
    expect((await search(q("Haus", { caseSensitive: true }))).results.length).toBeGreaterThanOrEqual(1);
    // wholeWord: "Haus" trifft nicht in "Hausherr"
    const ww = await search(q("Haus", { wholeWord: true }));
    expect(ww.results.every((r) => r.text.slice(r.matchStart, r.matchEnd) === "Haus")).toBe(true);
    // regex
    expect((await search(q("Haus.*da", { regex: true }))).results.length).toBeGreaterThanOrEqual(1);
    // scope title: Inhaltstreffer ausgeschlossen
    const titleOnly = await search(q("Hausherr", { scope: "title" }));
    expect(titleOnly.results.every((r) => r.chapterId === undefined || r.text === "TitelTreffer")).toBe(true);
    // scope content: Titeltreffer ausgeschlossen
    const contentOnly = await search(q("TitelTreffer", { scope: "content" }));
    expect(contentOnly.results).toHaveLength(0);
    expect(p.id).toBeTruthy();
  });

  it("replace() ersetzt nur das erste Vorkommen", async () => {
    const p = await createProject("P");
    const c = await createChapter(p.id, "K", "Apfel Apfel Apfel");
    const n = await replace(q("Apfel"), "Birne");
    expect(n).toBe(1);
    expect(getChapter(c.id)?.content).toBe("Birne Apfel Apfel");
    expect(listChapters(p.id)).toHaveLength(1);
  });

  it("replaceAll() ersetzt alles und meldet die Anzahl", async () => {
    const p = await createProject("P");
    const c1 = await createChapter(p.id, "K1", "rot rot rot");
    await createChapter(p.id, "K2", "rot und rot");
    const n = await replaceAll(q("rot"), "blau");
    expect(n).toBe(5);
    expect(getChapter(c1.id)?.content).toBe("blau blau blau");
  });

  it("getRecentSearches() gibt Verlauf zurück, clear löscht", async () => {
    const p = await createProject("P");
    await createChapter(p.id, "K", "irgendwas");
    await search(q("erste-suche"));
    await search(q("zweite-suche"));
    const recent = await getRecentSearches();
    expect(recent[0]).toBe("zweite-suche");
    expect(recent).toContain("erste-suche");
    await clearRecentSearches();
    expect(await getRecentSearches()).toHaveLength(0);
  });

  it("leerer Text und ungültiges Regex sind ungefährlich", async () => {
    const { results } = await search(q(""));
    expect(results).toHaveLength(0);
    expect(await replace(q(""), "x")).toBe(0);
    const bad = await search(q("([", { regex: true }));
    expect(bad.results).toHaveLength(0);
    expect(await replaceAll(q("([", { regex: true }), "x")).toBe(0);
  });
});
