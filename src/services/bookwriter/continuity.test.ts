// Tests: Bookwriter Continuity-Ledger (Sprint 10, Agent 1).
//
// TDD, hermetisch: continuity.ts ist seitenffektfrei (kein DB-, kein
// Netzwerk-Import zur Ladezeit). Die LLM-Hook-Funktion bekommt eine
// gemockte `complete`-Funktion — zero network.

import { describe, it, expect, vi } from "vitest";
import {
  buildChapterBrief,
  buildEnrichmentPrompt,
  buildLedger,
  continuityNamesLikelySame,
  createOllamaComplete,
  detectContradictions,
  enrichLedgerWithLlm,
  extractEntities,
  extractYearsOrdered,
  normalizeContinuityName,
  DEFAULT_BRIEF_BUDGET_CHARS,
  type ChapterInput,
  type CompleteFn,
  type Ledger,
} from "./continuity";

const CH1: ChapterInput = {
  title: "Kapitel 1",
  content:
    "Anna Weber betrat den Hamburger Hafen. Es war Herbst 1987. " +
    "Ben Roth wartete am Kai auf Anna. Die \"Zeitmaschine\" brummte leise.",
};

const CH2: ChapterInput = {
  title: "Kapitel 2",
  content:
    "Ann Weber traf Ben Roth in der Taverne Zum Anker. " +
    "Anna Weber war 34 Jahre alt. Im Jahr 1987 blieb alles ruhig.",
};

function emptyLedger(): Ledger {
  return { entities: [], chapterCount: 0, createdAt: 1 };
}

describe("normalizeContinuityName / continuityNamesLikelySame", () => {
  it("normalisiert Groß/Klein und Umlaute", () => {
    expect(normalizeContinuityName("Müller")).toBe(normalizeContinuityName("Mueller"));
    expect(normalizeContinuityName("Anna Weber")).toBe(normalizeContinuityName("anna WEBER"));
  });

  it("erkennt Drift-Varianten, unterscheidet fremde Namen", () => {
    expect(continuityNamesLikelySame("Anna Weber", "Ann Weber")).toBe(true);
    expect(continuityNamesLikelySame("Weber", "Anna Weber")).toBe(true);
    expect(continuityNamesLikelySame("Anna Weber", "Klaus-Dieter")).toBe(false);
  });
});

describe("extractEntities", () => {
  it("findet Charaktere, Orte und Zeitmarken", () => {
    const ents = extractEntities(CH1.content, 0);
    const kinds = new Map(ents.map((e) => [e.name, e.kind]));
    expect(kinds.get("Anna Weber")).toBe("character");
    expect(kinds.get("Ben Roth")).toBe("character");
    expect(kinds.get("1987")).toBe("timeline");
  });

  it("leerer Text ergibt keine Entitäten", () => {
    expect(extractEntities("", 0)).toEqual([]);
    expect(extractEntities("   ", 2)).toEqual([]);
  });

  it("zitierte Begriffe werden terms", () => {
    const ents = extractEntities(CH1.content, 0);
    const term = ents.find((e) => e.name === "Zeitmaschine");
    expect(term?.kind).toBe("term");
  });

  it("erfasst den Kapitel-Index", () => {
    const ents = extractEntities(CH1.content, 3);
    expect(ents.every((e) => e.chapters.includes(3))).toBe(true);
    expect(ents.every((e) => e.firstSeenChapter === 3)).toBe(true);
  });
});

describe("extractYearsOrdered", () => {
  it("extrahiert Jahre in Reihenfolge", () => {
    expect(extractYearsOrdered("1987 und dann 2020, zurück 1999")).toEqual([1987, 2020, 1999]);
    expect(extractYearsOrdered("kein Jahr hier")).toEqual([]);
  });
});

describe("buildLedger", () => {
  it("führt Drift-Varianten unter dem kanonischen Namen zusammen", () => {
    const ledger = buildLedger([CH1, CH2]);
    const anna = ledger.entities.find((e) => e.name === "Anna Weber");
    expect(anna).toBeDefined();
    expect(anna!.aliases).toContain("Ann Weber");
    expect(anna!.chapters).toEqual([0, 1]);
    expect(ledger.chapterCount).toBe(2);
  });

  it("leere Kapitel ergeben ein leeres Ledger", () => {
    const ledger = buildLedger([]);
    expect(ledger.entities).toEqual([]);
    expect(ledger.chapterCount).toBe(0);
  });
});

describe("detectContradictions", () => {
  it("meldet Namensvarianten als warning", () => {
    const ledger = buildLedger([CH1, CH2]);
    const found = detectContradictions(ledger, [CH1, CH2]).filter(
      (c) => c.type === "name_variant",
    );
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].severity).toBe("warning");
    expect(found[0].expected).toBe("Anna Weber");
  });

  it("meldet Zeitrücksprung als error", () => {
    const chapters: ChapterInput[] = [
      { title: "K1", content: "Anna Weber schloss den Fall im Jahr 2020." },
      { title: "K2", content: "Anna Weber begann alles im Jahr 1987." },
    ];
    const ledger = buildLedger(chapters);
    const found = detectContradictions(ledger, chapters).filter(
      (c) => c.type === "timeline_order",
    );
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("error");
    expect(found[0].chapterIndex).toBe(1);
  });

  it("monotone Zeitlinie erzeugt keinen timeline_order-Befund", () => {
    const chapters: ChapterInput[] = [
      { title: "K1", content: "Anna Weber startete im Jahr 1987." },
      { title: "K2", content: "Anna Weber endete im Jahr 2020." },
    ];
    const ledger = buildLedger(chapters);
    expect(
      detectContradictions(ledger, chapters).filter((c) => c.type === "timeline_order"),
    ).toHaveLength(0);
  });

  it("meldet Alterswiderspruch als error", () => {
    const chapters: ChapterInput[] = [
      { title: "K1", content: "Anna Weber war 34 Jahre alt." },
      { title: "K2", content: "Anna Weber war 58 Jahre alt und müde." },
    ];
    const ledger = buildLedger(chapters);
    const found = detectContradictions(ledger, chapters).filter(
      (c) => c.type === "attribute_conflict",
    );
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("error");
  });

  it("meldet fehlende Entitäten in den Schlusskapiteln", () => {
    const chapters: ChapterInput[] = [
      { title: "K1", content: "Anna Weber und Ben Roth treffen sich am Hafen." },
      { title: "K2", content: "Anna Weber und Ben Roth ermitteln weiter." },
      { title: "K3", content: "Anna Weber ermittelt allein im Regen." },
      { title: "K4", content: "Anna Weber schließt den Fall allein." },
    ];
    const ledger = buildLedger(chapters);
    const found = detectContradictions(ledger, chapters).filter(
      (c) => c.type === "missing_entity" && c.expected === "Ben Roth",
    );
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("warning");
  });

  it("kohärente Kapitel erzeugen keine Befunde", () => {
    const chapters: ChapterInput[] = [
      { title: "K1", content: "Anna Weber betrat den Hafen. Es war Herbst 1987." },
    ];
    const ledger = buildLedger(chapters);
    expect(detectContradictions(ledger, chapters)).toHaveLength(0);
  });
});

describe("buildChapterBrief", () => {
  it("enthält Titel, Entitäten und Prompt-Baustein", () => {
    const ledger = buildLedger([CH1, CH2]);
    const contradictions = detectContradictions(ledger, [CH1, CH2]);
    const brief = buildChapterBrief(
      ledger,
      contradictions,
      { title: "Kapitel 3", goal: "Anna löst den Fall." },
      ["Anna fand eine Spur."],
    );
    expect(brief.forChapter).toBe(2);
    expect(brief.nextTitle).toBe("Kapitel 3");
    expect(brief.promptBlock).toContain("Kapitel 3");
    expect(brief.promptBlock).toContain("Anna Weber");
    expect(brief.activeEntities.length).toBeGreaterThan(0);
  });

  it("hält das Zeichen-Budget ein", () => {
    const ledger = buildLedger([CH1, CH2]);
    const longSummaries = Array.from({ length: 10 }, (_, i) => `Zusammenfassung ${i} `.repeat(50));
    const brief = buildChapterBrief(
      ledger,
      [],
      { title: "Kapitel 3" },
      longSummaries,
      500,
    );
    expect(brief.promptBlock.length).toBeLessThanOrEqual(500);
  });

  it("Standard-Budget ist 2000 Zeichen", () => {
    expect(DEFAULT_BRIEF_BUDGET_CHARS).toBe(2000);
  });
});

describe("enrichLedgerWithLlm (gemockte complete-Funktion, zero network)", () => {
  const llmAnswer =
    '[{"name":"Clara Mond","kind":"character","note":"Informantin"},' +
    ' {"name":"Speicherstadt","kind":"place"}]';
  const mockComplete: CompleteFn = vi.fn(async (_prompt: string) => llmAnswer);

  it("nimmt gültige LLM-Vorschläge ins Ledger auf", async () => {
    const result = await enrichLedgerWithLlm(emptyLedger(), CH1.content, 0, mockComplete);
    expect(result.added).toBe(2);
    expect(result.ledger.entities.map((e) => e.name)).toContain("Clara Mond");
    expect(result.ledger.entities.map((e) => e.name)).toContain("Speicherstadt");
    expect(mockComplete).toHaveBeenCalledOnce();
  });

  it("ungültiges JSON ist kein Fehler (added = 0)", async () => {
    const bad: CompleteFn = vi.fn(async () => "kein json hier");
    const result = await enrichLedgerWithLlm(emptyLedger(), CH1.content, 0, bad);
    expect(result.added).toBe(0);
    expect(result.ledger.entities).toHaveLength(0);
  });

  it("unbekannte kind-Werte werden ignoriert", async () => {
    const odd: CompleteFn = vi.fn(
      async () => '[{"name":"X","kind":"raumschiff"},{"name":"Y","kind":"place"}]',
    );
    const result = await enrichLedgerWithLlm(emptyLedger(), CH1.content, 0, odd);
    expect(result.added).toBe(1);
    expect(result.ledger.entities[0].name).toBe("Y");
  });

  it("bekannte Entitäten bekommen Notizen statt Duplikate", async () => {
    const ledger = buildLedger([CH1]);
    const note: CompleteFn = vi.fn(
      async () => '[{"name":"Anna Weber","kind":"character","note":"Detektivin"}]',
    );
    const result = await enrichLedgerWithLlm(ledger, CH1.content, 0, note);
    const anna = result.ledger.entities.filter((e) => e.name === "Anna Weber");
    expect(anna).toHaveLength(1);
    expect(anna[0].note).toBe("Detektivin");
  });

  it("Enrichment-Prompt verlangt JSON-Array", () => {
    expect(buildEnrichmentPrompt("Text")).toContain("JSON-Array");
  });

  it("createOllamaComplete liefert eine Funktion ohne Netzwerk beim Bau", () => {
    expect(typeof createOllamaComplete()).toBe("function");
  });
});
