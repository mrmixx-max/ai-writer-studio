// Tests: Revisions-Pipeline (reviseChapter) mit Mock-Provider + In-Memory-DB.
//
// Abgedeckt:
// - straffen: −10 % Wortzahl-Ziel, Füllwort-Quote sinkt messbar
//   (Akzeptanzkriterium: 30 % Füllwörter → straffen senkt Quote)
// - vertiefen: +15 % Ziel
// - stil: Stilprofil fließt in den Prompt ein; ohne Profil → Fehler
// - Nach Revision: Status draft, Revisionshistorie committed
// - lokaler Fallback bei Provider-Fehler (nur straffen)
// - Abort wird durchgereicht
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("sql.js", async (importOriginal) => await importOriginal());
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { createProject, createChapter, getChapter, updateChapter, updateChapterFields } from "@/services/project";

// Mock-Provider für die LLM-Revision.
let mockResponses: string[] = [];
let failLLM = false;
const chatCalls: { messages: { role: string; content: string }[] }[] = [];

vi.mock("@/services/llm", () => ({
  createProvider: () => ({
    describe: () => "mock",
    chat: async function* (messages: { role: string; content: string }[]) {
      chatCalls.push({ messages: [...messages] });
      if (failLLM) throw new Error("Provider nicht erreichbar (network)");
      const response = mockResponses[chatCalls.length - 1] ?? mockResponses[mockResponses.length - 1] ?? "";
      yield response;
    },
  }),
  buildMessages: (user: string) => [{ role: "user", content: user }],
}));

vi.mock("@/services/settings", () => ({
  loadSettings: () => ({ model: "mock-model", provider: "ollama" }),
}));

import { reviseChapter, listRevisions, computeLocalTightening, fillerRatioOf } from "./revise";
import { createStyleProfile } from "./styleProfiles";

let projectId: string;
let chapterId: string;

beforeEach(async () => {
  mockResponses = [];
  chatCalls.length = 0;
  failLLM = false;
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;
  const p = await createProject("Revise-Projekt");
  projectId = p.id;
  const ch = await createChapter(projectId, "Kapitel 1", "");
  chapterId = ch.id;
});

afterEach(() => {
  delete (globalThis as any).__aws_db;
});

function fillerHeavyText(): string {
  // ~30 % Füllwörter
  const parts: string[] = [];
  for (let i = 0; i < 12; i++) {
    parts.push(
      `Also das Thema ${i} ist eigentlich irgendwie wichtig, halt wirklich, ` +
      `denn es zeigt deutlich, dass quasi jeder etwas damit zu tun hat. ` +
      `Sozusagen gewissermaßen übrigens bekanntlich bleibt es dabei.`,
    );
  }
  return parts.join(" ");
}

describe("reviseChapter: straffen", () => {
  it("senkt die Füllwort-Quote messbar (30 % → deutlich darunter)", async () => {
    const text = fillerHeavyText();
    await updateChapter(chapterId, text);
    await updateChapterFields(chapterId, { status: "needs_revision" });
    const before = fillerRatioOf(text);
    expect(before).toBeGreaterThanOrEqual(0.25);

    mockResponses = [computeLocalTightening(text)]; // LLM liefert gestraffte Fassung
    const result = await reviseChapter(chapterId, "straffen");

    expect(result.usedLLM).toBe(true);
    expect(result.afterFillerRatio).toBeLessThan(result.beforeFillerRatio);
    // Akzeptanzkriterium: messbare Senkung (≥ 10 % relativ)
    expect((result.beforeFillerRatio - result.afterFillerRatio) / result.beforeFillerRatio).toBeGreaterThanOrEqual(0.1);
    // Status → draft
    const ch = getChapter(chapterId)!;
    expect(ch.status).toBe("draft");
    // Historie committed
    const revs = listRevisions(chapterId);
    expect(revs).toHaveLength(1);
    expect(revs[0].mode).toBe("straffen");
    expect(revs[0].beforeWords).toBeGreaterThan(revs[0].afterWords);
  });

  it("lokaler Fallback bei Provider-Fehler: Quote sinkt trotzdem messbar", async () => {
    const text = fillerHeavyText();
    await updateChapter(chapterId, text);
    failLLM = true;
    const result = await reviseChapter(chapterId, "straffen");
    expect(result.usedLLM).toBe(false);
    expect(result.afterFillerRatio).toBeLessThan(result.beforeFillerRatio);
    expect(listRevisions(chapterId)[0].note).toContain("Lokale Straffung");
  });

  it("vertiefen: LLM-Antwort wird übernommen, Historie geführt", async () => {
    await updateChapter(chapterId, "Kurzer Text.");
    mockResponses = ["Kurzer Text. Hier folgt ein ausführliches Beispiel mit vielen Details und einer Szene."];
    const result = await reviseChapter(chapterId, "vertiefen");
    expect(result.afterWords).toBeGreaterThan(result.beforeWords);
    expect(result.usedLLM).toBe(true);
    expect(listRevisions(chapterId)[0].mode).toBe("vertiefen");
  });
});

describe("reviseChapter: stil", () => {
  it("Stilprofil fließt in den Prompt ein", async () => {
    await updateChapter(chapterId, "Ein Text zum Stilisieren.");
    const profile = createStyleProfile(projectId, "Sachbuch klar", "Klar und präzise", ["Kein Passiv", "Max. 18 Wörter"]);
    mockResponses = ["Ein klarer, präziser Text."];
    const result = await reviseChapter(chapterId, "stil", profile);
    expect(result.usedLLM).toBe(true);
    const sent = chatCalls[0].messages.map((m) => m.content).join("\n");
    expect(sent).toContain("Sachbuch klar");
    expect(sent).toContain("Kein Passiv");
    expect(sent).toContain("Klar und präzise");
    expect(listRevisions(chapterId)[0].mode).toBe("stil");
  });

  it("stil ohne Profil wirft", async () => {
    await updateChapter(chapterId, "Text.");
    await expect(reviseChapter(chapterId, "stil", null)).rejects.toThrow(/StyleProfile erforderlich/);
  });
});

describe("reviseChapter: Fehlerfälle", () => {
  it("wirft bei fehlendem Kapitel", async () => {
    await expect(reviseChapter("ch_gibtsnicht", "straffen")).rejects.toThrow(/nicht gefunden/);
  });

  it("wirft bei leerem Kapitel", async () => {
    await expect(reviseChapter(chapterId, "straffen")).rejects.toThrow(/keinen Inhalt/);
  });

  it("vertiefen mit Provider-Fehler wirft (kein Fallback)", async () => {
    await updateChapter(chapterId, "Text.");
    failLLM = true;
    await expect(reviseChapter(chapterId, "vertiefen")).rejects.toThrow(/Provider nicht erreichbar/);
  });
});

describe("Revisionshistorie", () => {
  it("mehrere Revisionen stapeln sich (neueste zuerst)", async () => {
    await updateChapter(chapterId, "Ein Text.");
    mockResponses = ["Ein gestraffter Text."];
    await reviseChapter(chapterId, "straffen");
    mockResponses = ["Ein vertiefter Text mit Beispiel."];
    await reviseChapter(chapterId, "vertiefen");
    const revs = listRevisions(chapterId);
    expect(revs).toHaveLength(2);
    expect(revs[0].createdAt).toBeGreaterThanOrEqual(revs[1].createdAt);
    expect(revs[0].mode).toBe("vertiefen");
  });
});
