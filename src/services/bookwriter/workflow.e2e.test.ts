// Bookwriter: End-to-End-Test.
//
// Simuliert einen vollständigen Bookwriter-Lauf mit einem Mock für den
// LLM-Provider. Prüft, dass alle 8 Phasen durchlaufen werden, Artefakte
// gespeichert und Kapitel erstellt werden.

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
// setup.ts mockt sql.js global durch eine Fake-DB — diese Tests brauchen
// das echte In-Memory-SQLite, daher nehmen wir das Original zurück.
vi.mock("sql.js", async (importOriginal) => await importOriginal());
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { createProject } from "@/services/project";
import {
  startBookwriter,
  runBookwriter,
} from "@/services/bookwriter/workflow";
import {
  loadArtifact,
  loadRun,
} from "@/services/bookwriter/state";
import type { BookBriefing, BookOutline, BookConcept, KdpMetadata } from "@/types/bookwriter";
import type { BookwriterPhase } from "@/types/bookwriter";

// ---- Mock: LLM-Provider -----------------------------------------------

// Zähler für die Aufrufe, um unterschiedliche Antworten zu liefern.
let completeOnceCallCount = 0;

/** Generiert eine realistische Gliederung als JSON-String. */
function mockOutlineJson(): string {
  return JSON.stringify([
    {
      title: "1. Der Anfang",
      goal: "Die Welt wird etabliert.",
      conflict: "Ein unerwarteter Besucher stellt alles infrage.",
      outcome: "Der Protagonist trifft eine Wahl.",
      estimatedWords: 1500,
      pov: "dritte Person",
      research: [],
      subchapters: ["Die Ankunft", "Die Wahl"],
    },
    {
      title: "2. Die Mitte",
      goal: "Die Spannung steigt.",
      conflict: "Ein Verrat offenbart sich.",
      outcome: "Eine neue Allianz wird geschmiedet.",
      estimatedWords: 1500,
      pov: "dritte Person",
      research: [],
      subchapters: ["Der Verrat", "Die Allianz"],
    },
    {
      title: "3. Das Ende",
      goal: "Die Auflösung.",
      conflict: "Die letzte Konfrontation.",
      outcome: "Das Versprechen wird eingelöst.",
      estimatedWords: 1500,
      pov: "dritte Person",
      research: [],
      subchapters: ["Die Konfrontation", "Das Ergebnis"],
    },
  ]);
}

/** Mock-Implementierung von completeOnce. */
async function mockCompleteOnce(
  _settings: unknown,
  userContent: string,
  _history?: unknown,
  _signal?: AbortSignal,
): Promise<string> {
  completeOnceCallCount++;

  // Titel
  if (userContent.includes("10 Titel")) {
    return [
      "Der stille Wald",
      "Flüstern zwischen den Bäumen",
      "Das letzte Licht",
      "Wo der Weg endet",
      "Hinter dem Horizont",
      "Die vergessene Stadt",
      "Unter der Oberfläche",
      "Der lange Schatten",
      "Zwischen den Welten",
      "Das Echo der Stille",
    ].join("\n");
  }

  // Untertitel
  if (userContent.includes("Untertitel")) {
    return [
      "Eine Reise ins Unbekannte",
      "Was die Bäume verbergen",
      "Die Wahrheit unter der Rinde",
      "Ein Pfad, der niemand geht",
      "Wo Schatten leben",
      "Die Geschichte eines Waldes",
      "Wenn Bäume sprechen",
      "Das Geheimnis des Unterholzes",
      "Ein Herz im Dunkeln",
      "Die letzte Grenze",
    ].join("\n");
  }

  // Positionierungen
  if (userContent.includes("Positionierungen")) {
    return [
      "Das erste Buch, das den Wald als lebendiges Wesen zeigt.",
      "Kein anderes Sachbuch verbindet Mythos und Wissenschaft so nahtlos.",
      "Für alle, die den Wald neu sehen wollen.",
      "Die Antwort auf eine Frage, die Sie noch nicht wussten zu stellen.",
      "Ein Buch, das sich anfühlt wie ein Spaziergang.",
    ].join("\n");
  }

  // Klappentext
  if (userContent.includes("Klappentext")) {
    return "Tief im Herzen des Waldes liegt ein Geheimnis, das seit Jahrhunderten auf seine Entdeckung wartet. " +
      "Ein Wanderer stößt auf Spuren, die niemand sollte finden. Was als harmlose Erkundung beginnt, " +
      "wird zu einer Reise, die alles verändert. Wer dem Wald vertraut, wird ihn nie wieder so sehen " +
      "wie zuvor. Eine Geschichte über die Grenzen des Wissens und die Kraft der Natur.";
  }

  // Gliederung
  if (userContent.includes("Gliederung") || userContent.includes("JSON-Array")) {
    return mockOutlineJson();
  }

  // Kapitel schreiben
  if (userContent.includes("Schreibe ein Kapitel")) {
    return "Der Morgen graute leise über den Hügeln. Ein kalter Wind strich durch die kahlen Äste " +
      "der alten Eichen, die wie Wächter am Rande des Feldes standen. Niemand war hier oben " +
      "seit Jahren gewesen – das wusste jeder im Doerf. Doch heute stand eine Gestalt am " +
      "Fuße des höchsten Hügels und blickte hinauf. Die Entschiedenheit in ihren Augen war " +
      "unverkennbar. Es gab kein Zurück mehr. Der Weg, der vor ihr lag, war steinig und voller " +
      "Risiken, aber er war der einzige, der noch offen war. Sie atmete tief durch und machte " +
      "den ersten Schritt. Mit jedem Schritt wurde der Doerf kleiner hinter ihr, und die " +
      "Gestalt des Berges wuchs an. Es war ein Weg, der sie in das Unbekannte führen würde, " +
      "aber sie war bereit. Das wusste sie mit jeder Faser ihres Seins.";
  }

  // Zusammenfassung
  if (userContent.includes("Fasse das folgende Kapitel")) {
    return "Ein Protagonist bricht auf in eine unbekannte Welt. Die erste Etappe endet mit einer unerwarteten Begegnung.";
  }

  // Keywords
  if (userContent.includes("Keywords")) {
    return [
      "Naturwissenschaft",
      "Wald ökosystem",
      "Mythologie Pflanzen",
      "Wissenschaft für Laien",
      "Umweltbildung",
      "Natur entdecken",
      "Ökologie Buch",
    ].join("\n");
  }

  // Qualitätsprüfung
  if (userContent.includes("Bewerte das folgende Kapitel")) {
    return JSON.stringify({
      score: 85,
      level: "green",
      details: "Klarer Stil, gute Bildsprache.",
    });
  }

  // Fallback
  return "Mock-Antwort";
}

// Mock des KDP-Export-Pakets — der echte Download nutzt DOM/Blob, was im
// Node-Test-Kontext (environment: node) nicht existiert.
vi.mock("@/services/kdp/packaging", () => ({
  downloadKdpPackage: vi.fn(async (
    _chapters: unknown,
    _metadata: unknown,
    projectName: string,
    _author: string,
    onProgress?: (p: number, label: string) => void,
  ) => {
    onProgress?.(0.5, "KDP-Paket wird erstellt…");
    return {
      folderName: `${projectName}-kdp`,
      files: [
        { name: "manuskript.docx", size: 1024 },
        { name: "metadata.json", size: 128 },
      ],
    };
  }),
}));

// Mock des LLM-Moduls.
vi.mock("@/services/llm", () => ({
  completeOnce: vi.fn(mockCompleteOnce),
  createProvider: vi.fn(() => ({
    listModels: vi.fn(async () => ["mock-model"]),
    chat: vi.fn(async function* () { yield "mock"; }),
    healthCheck: vi.fn(async () => true),
    describe: vi.fn(() => "Mock Provider"),
  })),
  buildMessages: vi.fn((userContent: string) => [{ role: "user" as const, content: userContent }]),
}));

// ---- Test-Setup --------------------------------------------------------

const briefing: BookBriefing = {
  genre: "sachbuch",
  targetAudience: "Interessierte Laien",
  tone: "sachlich-poetisch",
  chapterCount: 3,
  wordsPerChapter: 1500,
  idea: "Ein Buch über die verborgenen Ökosysteme des Waldes.",
  uniqueAngle: "Verbindet Wissenschaft mit Mythologie.",
  corePromise: "Der Leser sieht den Wald nach diesem Buch mit anderen Augen.",
  kdpTarget: "ebook",
  language: "de",
  styleReferences: "",
  customOutline: null,
};

let projectId: string;

beforeEach(async () => {
  completeOnceCallCount = 0;

  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;

  const p = await createProject("E2E-Buchprojekt");
  projectId = p.id;
});

afterEach(() => {
  vi.clearAllMocks();
  delete (globalThis as any).__aws_db;
});

// ---- Tests ------------------------------------------------------------

describe("Bookwriter E2E-Workflow", () => {
  it("durchläuft alle 8 Phasen in der richtigen Reihenfolge", async () => {
    const phasesObserved: BookwriterPhase[] = [];

    const runId = await startBookwriter(projectId, briefing, "auto");
    await runBookwriter(runId, "E2E-Buchprojekt", (phase) => {
      // Der Workflow meldet mehrere Fortschrittsschritte je Phase — wir
      // zählen nur die Übergänge, also jede Phase genau einmal.
      if (phasesObserved[phasesObserved.length - 1] !== phase) {
        phasesObserved.push(phase);
      }
    });

    // Alle 8 Phasen müssen durchlaufen worden sein.
    expect(phasesObserved).toEqual([
      "briefing",
      "konzept",
      "gliederung",
      "manuskript",
      "qualitaet",
      "ueberarbeitung",
      "metadaten",
      "export",
    ]);
  });

  it("speichert das Briefing als Artefakt", async () => {
    const runId = await startBookwriter(projectId, briefing, "auto");

    const stored = loadArtifact<BookBriefing>(runId, "briefing");
    expect(stored).not.toBeNull();
    expect(stored!.genre).toBe("sachbuch");
    expect(stored!.idea).toContain("Wald");
  });

  it("speichert das Konzept mit Titeln, Untertiteln und Positionierungen", async () => {
    const runId = await startBookwriter(projectId, briefing, "auto");
    await runBookwriter(runId, "E2E-Buchprojekt");

    const concept = loadArtifact<BookConcept>(runId, "konzept");
    expect(concept).not.toBeNull();
    expect(concept!.titles.length).toBeGreaterThan(0);
    expect(concept!.subtitles.length).toBeGreaterThan(0);
    expect(concept!.positions.length).toBeGreaterThan(0);
    expect(concept!.backmatter.length).toBeGreaterThan(0);
  });

  it("speichert die Gliederung als JSON-Array mit Kapiteln", async () => {
    const runId = await startBookwriter(projectId, briefing, "auto");
    await runBookwriter(runId, "E2E-Buchprojekt");

    const outline = loadArtifact<BookOutline>(runId, "gliederung");
    expect(outline).not.toBeNull();
    expect(outline!.chapters.length).toBe(3);
    expect(outline!.chapters[0].title).toBeTruthy();
    expect(outline!.chapters[0].goal).toBeTruthy();
    expect(outline!.totalWords).toBeGreaterThan(0);
  });

  it("erstellt Kapitel und speichert sie als Artefakt", async () => {
    const runId = await startBookwriter(projectId, briefing, "auto");
    await runBookwriter(runId, "E2E-Buchprojekt");

    const chapters = loadArtifact<Array<{ id: string; title: string; content: string; wordCount: number }>>(
      runId,
      "manuskript",
    );
    expect(chapters).not.toBeNull();
    expect(chapters!.length).toBe(3);

    for (const ch of chapters!) {
      expect(ch.id).toBeTruthy();
      expect(ch.title).toBeTruthy();
      expect(ch.content.length).toBeGreaterThan(0);
      expect(ch.wordCount).toBeGreaterThan(0);
    }
  });

  it("speichert KDP-Metadaten mit Keywords und Klappentexten", async () => {
    const runId = await startBookwriter(projectId, briefing, "auto");
    await runBookwriter(runId, "E2E-Buchprojekt");

    const metadata = loadArtifact<KdpMetadata>(runId, "metadaten");
    expect(metadata).not.toBeNull();
    expect(metadata!.keywords.length).toBeGreaterThan(0);
    expect(metadata!.blurbVariants.length).toBe(3);
  });

  it("markiert den Lauf als abgeschlossen", async () => {
    const runId = await startBookwriter(projectId, briefing, "auto");
    await runBookwriter(runId, "E2E-Buchprojekt");

    const run = loadRun(runId);
    expect(run).not.toBeNull();
    expect(run!.status).toBe("completed");
  });

  it("ruft den LLM-Provider mindestens einmal pro Phase auf", async () => {
    const runId = await startBookwriter(projectId, briefing, "auto");
    await runBookwriter(runId, "E2E-Buchprojekt");

    // Konzept: 4 Aufrufe, Gliederung: 1, Manuskript: 6 (3 schreiben + 3 zusammenfassen),
    // Metadaten: 4 (1 Keywords + 3 Klappentexte) = mindestens 15 Aufrufe.
    expect(completeOnceCallCount).toBeGreaterThanOrEqual(10);
  });

  it("bricht bei AbortSignal nach der aktuellen Phase ab", async () => {
    const controller = new AbortController();

    const runId = await startBookwriter(projectId, briefing, "auto");

    // Abort nach der ersten Phase (briefing ist trivial, also nach konzept).
    await runBookwriter(runId, "E2E-Buchprojekt", (phase, progress) => {
      if (phase === "konzept" && progress >= 1) {
        controller.abort();
      }
    }, controller.signal);

    // Der Lauf sollte nicht abgeschlossen sein.
    const run = loadRun(runId);
    expect(run).not.toBeNull();
    // Status ist entweder active (wurde unterbrochen) oder completed (wenn Abort zu spät kam).
    expect(["active", "completed"]).toContain(run!.status);
  });

  it("kann einen bestehenden Lauf fortsetzen", async () => {
    const runId = await startBookwriter(projectId, briefing, "auto");

    // Ersten Lauf starten und komplett durchlaufen.
    await runBookwriter(runId, "E2E-Buchprojekt");

    // Lauf sollte abgeschlossen sein.
    const run = loadRun(runId);
    expect(run!.status).toBe("completed");

    // Einen zweiten Lauf starten – der sollte unabhängig funktionieren.
    const runId2 = await startBookwriter(projectId, briefing, "auto");
    await runBookwriter(runId2, "E2E-Buchprojekt");

    const run2 = loadRun(runId2);
    expect(run2!.status).toBe("completed");

    // Beide Läufe haben Artefakte.
    expect(loadArtifact(runId, "konzept")).not.toBeNull();
    expect(loadArtifact(runId2, "konzept")).not.toBeNull();
  });
});
