// Tests: Summarizer Engine (Sprint 25, Agent 3).
import { describe, it, expect } from "vitest";
import {
  summarize,
  summarizeChapter,
  summarizeProject,
  compareVersions,
  localSummarize,
  buildSummaryPrompt,
  extractPlainText,
  type SummaryRequest,
} from "./summarizer";
import { useProjectStore } from "@/store/projectStore";
import type { Chapter } from "@/types/project";

const TEXT =
  "Es war einmal ein dunkler Wald. Er war tief und undurchdringlich. " +
  "Die Vögel schwiegen am helllichten Tag. Nur der Wind bewegte die Blätter. " +
  "Ein Wanderer betrat den Pfad. Er kannte den Weg nicht. " +
  "Die Nacht brach herein. Die Sterne erschienen über den Wipfeln.";

const REQ: SummaryRequest = { text: TEXT, length: "short", style: "paragraph", language: "de" };

function chapter(id: string, projectId: string, content: string): Chapter {
  return {
    id,
    projectId,
    title: `Kapitel ${id}`,
    content,
    orderIndex: 0,
    createdAt: 0,
    updatedAt: 0,
    status: "draft",
    targetWordCount: 1000,
    minimumWordCount: 0,
    maximumWordCount: 2000,
    currentWordCount: 10,
  };
}

describe("summarize", () => {
  it("mockt das LLM und liefert ein SummaryResult mit Ratio", async () => {
    const client = async () => "Ein Wanderer verirrt sich im dunklen Wald.";
    const res = await summarize(REQ, { client });
    expect(res.summary).toContain("Wanderer");
    expect(res.originalLength).toBeGreaterThan(0);
    expect(res.summaryLength).toBeGreaterThan(0);
    expect(res.compressionRatio).toBeGreaterThan(0);
    expect(res.compressionRatio).toBeLessThan(1);
    expect(res.compressionRatio).toBeCloseTo(res.summaryLength / res.originalLength, 3);
  });

  it("leerer Text ergibt leeres Ergebnis mit Ratio 0", async () => {
    const client = async () => {
      throw new Error("darf nicht aufgerufen werden");
    };
    const res = await summarize({ ...REQ, text: "   " }, { client });
    expect(res).toEqual({ summary: "", originalLength: 0, summaryLength: 0, compressionRatio: 0 });
  });

  it("fällt bei Provider-Fehler auf die lokale Heuristik zurück", async () => {
    const client = async () => {
      throw new Error("offline");
    };
    const res = await summarize(REQ, { client });
    expect(res.summary).toContain("dunkler Wald");
    expect(res.compressionRatio).toBeGreaterThan(0);
  });

  it("formatiert Bullet-Stil als Stichpunktliste (lokal)", () => {
    const res = localSummarize({ ...REQ, style: "bullet" });
    expect(res.summary.split("\n").every((l) => l.startsWith("- "))).toBe(true);
  });

  it("baut Prompt mit Längen- und Stil-Hinweis", () => {
    const prompt = buildSummaryPrompt({ ...REQ, length: "long", style: "key-points", language: "en" });
    expect(prompt).toContain("250");
    expect(prompt).toContain("numbered key points");
    expect(prompt).toContain(TEXT.slice(0, 20));
  });

  it("extrahiert Text aus Tiptap-JSON", () => {
    const json = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hallo Welt." }] }] });
    expect(extractPlainText(json)).toBe("Hallo Welt.");
  });
});

describe("summarizeChapter", () => {
  it("nutzt den Store und fasst das Kapitel zusammen", async () => {
    useProjectStore.setState({
      chapters: [chapter("ch1", "prj1", TEXT)],
      activeProjectId: "prj1",
      activeChapterId: "ch1",
      activeContent: TEXT,
    });
    const client = async () => "Kurze Kapitelzusammenfassung.";
    const res = await summarizeChapter("ch1", { length: "short" }, { client });
    expect(res.summary).toBe("Kurze Kapitelzusammenfassung.");
    expect(res.originalLength).toBeGreaterThan(0);
  });

  it("wirft bei unbekannter Kapitel-ID", async () => {
    useProjectStore.setState({ chapters: [], activeChapterId: null, activeContent: "" });
    await expect(summarizeChapter("fehlt", {}, { client: async () => "x" })).rejects.toThrow("Kapitel nicht gefunden");
  });
});

describe("summarizeProject", () => {
  it("fasst alle Kapitel eines Projekts zusammen", async () => {
    useProjectStore.setState({
      chapters: [chapter("c1", "p1", TEXT), chapter("c2", "p1", "Ein zweiter Text. Mit zwei Sätzen.")],
      activeProjectId: "p1",
      activeChapterId: null,
      activeContent: "",
    });
    let seenPrompt = "";
    const client = async (prompt: string) => {
      seenPrompt = prompt;
      return "Projektzusammenfassung.";
    };
    const res = await summarizeProject("p1", { length: "medium" }, { client });
    expect(res.summary).toBe("Projektzusammenfassung.");
    // Beide Kapiteltexte landen im Prompt
    expect(seenPrompt).toContain("dunkler Wald");
    expect(seenPrompt).toContain("zweiter Text");
  });

  it("wirft bei leerem Projekt", async () => {
    useProjectStore.setState({ chapters: [], activeChapterId: null, activeContent: "" });
    await expect(summarizeProject("leer", {}, { client: async () => "x" })).rejects.toThrow("Projekt nicht gefunden");
  });
});

describe("compareVersions", () => {
  it("erzeugt einen Vergleich über das LLM", async () => {
    const client = async () => "Geändert: Der Schluss wurde gekürzt. Hinzugefügt: nichts.";
    const res = await compareVersions("Alter Text mit langem Schluss.", "Neuer Text.", { client });
    expect(res).toContain("gekürzt");
  });

  it("fällt offline auf Kennzahlen mit Wort-Delta zurück", async () => {
    const client = async () => {
      throw new Error("offline");
    };
    const res = await compareVersions("Eins zwei drei vier.", "Eins zwei.", { client });
    expect(res).toContain("4 → 2");
    expect(res).toContain("Entfernt");
  });
});
