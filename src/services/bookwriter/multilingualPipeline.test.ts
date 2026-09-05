// Multilingual Pipeline (Sprint 6, Agent 3): übersetzt fertige Bücher in
// mehrere Zielsprachen (EN/ES/FR) und lokalisiert KDP-Metadaten.
//
// Strategie: baut auf translatorService (Markup-Erhaltung via markupGuard)
// und kdp/uploadSheet (RFC-4180-CSV) auf. Alle LLM-Calls laufen über die
// LLMChatFn-Abstraktion — Tests nutzen Fake-Provider (0 echte API-Calls).

import { describe, it, expect } from "vitest";

import {
  TRANSLATION_TARGETS,
  translateBookToLanguages,
  translateKdpMetadata,
  translateKdpMetadataToLanguages,
  buildLocalizedUploadSheet,
  estimateTranslationApiCalls,
  buildMetadataTranslationPrompt,
  type LocalizedKdpMetadata,
} from "./multilingualPipeline";
import type { TranslationChapter } from "./translatorService";
import type { UploadSheetRowInput } from "@/services/kdp/uploadSheet";
import type { KdpMetadata } from "@/types/bookwriter";

/** Fake-Chat: erkennt Kapitel- vs. Metadaten-Prompt, liefert passende Antwort. */
function makeFakeChat(overrides: {
  chapter?: (body: string, target: string) => string;
  metadata?: (target: string) => string;
} = {}) {
  return async function fakeChat(msgs: { role: string; content: string }[]): Promise<string> {
    const prompt = msgs.map((m) => m.content).find((c) => c.includes("KAPITELTEXT:"));
    if (prompt) {
      const target = prompt.match(/nach (\S+?)\./)?.[1] ?? "Unbekannt";
      const body = prompt.split("KAPITELTEXT:\n")[1] ?? "";
      return overrides.chapter
        ? overrides.chapter(body, target)
        : body + ` [${target}]`;
    }
    const metaPrompt = msgs.map((m) => m.content).find((c) => c.includes("METADATEN:"));
    if (metaPrompt) {
      const target = metaPrompt.match(/nach (\S+?)\./)?.[1] ?? "Unbekannt";
      if (overrides.metadata) return overrides.metadata(target);
      return JSON.stringify({
        title: `Titel-${target}`,
        subtitle: `Untertitel-${target}`,
        blurb: `Klappentext-${target}`,
        shortDescription: `Kurz-${target}`,
        keywords: [`keyword-${target}`],
      });
    }
    throw new Error("Unbekannter Prompt-Typ im Fake-Chat.");
  };
}

const chapter = (over: Partial<TranslationChapter> = {}): TranslationChapter => ({
  id: "ch1",
  title: "Kapitel 1 — Der Anfang",
  content: "# Der Anfang\n\nEin **mutiger** Schritt beginnt die Reise.\n\n- Punkt eins\n- Punkt zwei",
  ...over,
});

const metadata = (over: Partial<KdpMetadata> = {}): KdpMetadata => ({
  title: "Der Wanderer",
  subtitle: "Ein Roman",
  blurbVariants: ["Ein spannender Roman über einen Wanderer."],
  shortDescription: "Kurzbeschreibung des Buchs.",
  keywords: ["Fantasy Roman", "Magie Abenteuer"],
  categories: ["Fiction > Fantasy"],
  authorBio: "Ein Autor.",
  seriesIdea: null,
  marketingNotes: null,
  coverImage: null,
  ...over,
});

describe("TRANSLATION_TARGETS", () => {
  it("enthält genau EN, ES, FR mit deutschen Sprach-Labels", () => {
    expect(TRANSLATION_TARGETS.map((t) => t.code)).toEqual(["en", "es", "fr"]);
    expect(TRANSLATION_TARGETS.map((t) => t.label)).toEqual(["Englisch", "Spanisch", "Französisch"]);
  });
});

describe("translateBookToLanguages", () => {
  it("übersetzt ein fertiges Buch in alle Zielsprachen (EN/ES/FR)", async () => {
    const chapters = [
      chapter({ id: "c1", title: "Der Anfang" }),
      chapter({ id: "c2", title: "Das Ende", content: "## Das Ende\n\nText." }),
    ];
    const results = await translateBookToLanguages(chapters, makeFakeChat(), {});
    expect(results.map((r) => r.language)).toEqual(["en", "es", "fr"]);
    for (const r of results) {
      expect(r.chapters).toHaveLength(2);
      // Markup bleibt erhalten (Heading + Liste restauriert):
      expect(r.chapters[0].content).toContain("# Der Anfang");
      expect(r.chapters[0].content).toContain("- Punkt eins");
      expect(r.chapters[0].content).toContain("**mutiger**");
      expect(r.chapters[0].markupIntact).toBe(true);
      // Sprach-Suffix des Fake-Providers beweist, dass JEDE Sprache übersetzt hat:
      expect(r.chapters[0].content).toContain(
        `[${r.language === "en" ? "Englisch" : r.language === "es" ? "Spanisch" : "Französisch"}]`,
      );
    }
  });

  it("meldet Gesamt-Fortschritt über alle Sprachen hinweg", async () => {
    const chapters = [chapter({ id: "c1" }), chapter({ id: "c2" })];
    const progress: number[] = [];
    await translateBookToLanguages(chapters, makeFakeChat(), {}, (c, t) => progress.push(c / t));
    expect(progress).toEqual([1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 6 / 6]);
  });

  it("respektiert eine Ziel-Sprach-Teilmenge via options.targets", async () => {
    const results = await translateBookToLanguages([chapter()], makeFakeChat(), {
      targets: [{ code: "es", label: "Spanisch" }],
    });
    expect(results).toHaveLength(1);
    expect(results[0].language).toBe("es");
  });

  it("bricht bei vorzeitigem Abort ab und liefert den Teilstand", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const results = await translateBookToLanguages([chapter()], makeFakeChat(), {}, undefined, ctrl.signal);
    expect(results).toEqual([]);
  });

  it("übergibt Glossar und Quellsprache an den Kapitel-Prompt", async () => {
    const prompts: string[] = [];
    const chat = async (msgs: { role: string; content: string }[]) => {
      const p = msgs.map((m) => m.content).find((c) => c.includes("KAPITELTEXT:")) ?? "";
      prompts.push(p);
      return p.split("KAPITELTEXT:\n")[1] ?? "";
    };
    await translateBookToLanguages(
      [chapter()],
      chat,
      { sourceLanguage: "Deutsch", glossary: { "Der Wanderer": "The Wanderer" } },
    );
    expect(prompts).toHaveLength(3); // 3 Zielsprachen
    expect(prompts[0]).toContain("von Deutsch nach Englisch");
    expect(prompts[0]).toContain("Der Wanderer = The Wanderer");
  });
});

describe("buildMetadataTranslationPrompt", () => {
  it("enthält Titel, Klappentext, Keywords und JSON-Vertrag", () => {
    const prompt = buildMetadataTranslationPrompt(metadata(), { code: "en", label: "Englisch" });
    expect(prompt).toContain("von Deutsch nach Englisch");
    expect(prompt).toContain("Der Wanderer");
    expect(prompt).toContain("Ein spannender Roman über einen Wanderer.");
    expect(prompt).toContain("Fantasy Roman");
    expect(prompt).toContain('"keywords"');
    expect(prompt).toContain("maximal 7");
    expect(prompt).toContain("METADATEN:");
  });
});

describe("translateKdpMetadata", () => {
  it("lokalisiert Klappentext und Keywords (JSON-Antwort)", async () => {
    const result = await translateKdpMetadata(metadata(), makeFakeChat(), { code: "en", label: "Englisch" });
    expect(result.language).toBe("en");
    expect(result.viaLlm).toBe(true);
    expect(result.title).toBe("Titel-Englisch");
    expect(result.blurb).toBe("Klappentext-Englisch");
    expect(result.keywords).toEqual(["keyword-Englisch"]);
  });

  it("liest JSON auch aus Markdown-Fences", async () => {
    const chat = async () => "```json\n" + JSON.stringify({
      title: "Fenced", subtitle: "", blurb: "B", shortDescription: "S", keywords: ["a", "b"],
    }) + "\n```";
    const result = await translateKdpMetadata(metadata(), chat, { code: "fr", label: "Französisch" });
    expect(result.viaLlm).toBe(true);
    expect(result.title).toBe("Fenced");
    expect(result.blurb).toBe("B");
  });

  it("kappt >7 Keywords auf 7 und verwirft >50-Zeichen-Keywords mit Warning", async () => {
    const chat = async () => JSON.stringify({
      title: "T", subtitle: "", blurb: "B", shortDescription: "",
      keywords: [
        "x".repeat(51), // zu lang → verworfen
        ...Array.from({ length: 8 }, (_, i) => `kw${i + 1}`), // 8 → 7 behalten
      ],
    });
    const result = await translateKdpMetadata(metadata(), chat, { code: "en", label: "Englisch" });
    expect(result.keywords).toHaveLength(7);
    expect(result.keywords.every((k) => k.length <= 50)).toBe(true);
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
  });

  it("Fallback bei ungültiger Antwort: Original unverändert, viaLlm=false", async () => {
    const chat = async () => "Kein JSON hier.";
    const result = await translateKdpMetadata(metadata(), chat, { code: "es", label: "Spanisch" });
    expect(result.viaLlm).toBe(false);
    expect(result.title).toBe("Der Wanderer");
    expect(result.blurb).toBe("Ein spannender Roman über einen Wanderer.");
    expect(result.keywords).toEqual(["Fantasy Roman", "Magie Abenteuer"]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("bricht bei AbortSignal sauber ab", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(
      translateKdpMetadata(metadata(), makeFakeChat(), { code: "en", label: "Englisch" }, ctrl.signal),
    ).rejects.toThrow(/abgebrochen/i);
  });
});

describe("translateKdpMetadataToLanguages", () => {
  it("lokalisiert die Metadaten für alle Zielsprachen", async () => {
    const results = await translateKdpMetadataToLanguages(metadata(), makeFakeChat(), {});
    expect(results.map((r) => r.language)).toEqual(["en", "es", "fr"]);
    expect(results.every((r) => r.viaLlm)).toBe(true);
    expect(results.map((r) => r.title)).toEqual(["Titel-Englisch", "Titel-Spanisch", "Titel-Französisch"]);
  });
});

describe("buildLocalizedUploadSheet", () => {
  const row: UploadSheetRowInput = {
    title: "Der Wanderer",
    subtitle: "Ein Roman",
    author: "Erika Muster",
    description: "Ein spannender Roman über einen Wanderer.",
    keywords: ["Fantasy Roman", "Magie Abenteuer"],
    primaryCategory: "Fiction > Fantasy",
    language: "de",
    isbns: [{ format: "ebook", isbn: "9783123456789" }],
    pricing: { strategy: "standard", prices: { USD: 4.99, EUR: 4.99, GBP: 3.99 } },
  };

  const translations: LocalizedKdpMetadata[] = [
    {
      language: "en", title: "The Wanderer", subtitle: "A Novel",
      blurb: "A thrilling novel about a wanderer.", shortDescription: "Short.",
      keywords: ["fantasy novel"], viaLlm: true, warnings: [],
    },
    {
      language: "es", title: "El Caminante", subtitle: "Una novela",
      blurb: "Una novela emocionante.", shortDescription: "Corto.",
      keywords: ["novela fantasia"], viaLlm: true, warnings: [],
    },
  ];

  it("erzeugt eine Sheet-Zeile pro Sprache (Quelle + Lokalisierungen)", () => {
    const result = buildLocalizedUploadSheet(row, translations);
    expect(result.rowCount).toBe(3); // de + en + es
    const lines = result.csv.split("\n");
    expect(lines[0]).toContain("Title");
    expect(lines[1]).toContain("Der Wanderer");
    expect(lines[2]).toContain("The Wanderer");
    expect(lines[2]).toContain("fantasy novel");
    expect(lines[2]).toMatch(/,en$/); // Language = letzte Spalte
    expect(lines[3]).toContain("El Caminante");
    expect(lines[3]).toContain("novela fantasia");
    expect(lines[3]).toMatch(/,es$/);
  });

  it("übernimmt HTML-Klappentext und ISBN/Preise unverändert in jede Zeile", () => {
    const result = buildLocalizedUploadSheet(row, translations);
    const lines = result.csv.split("\n");
    for (const line of lines.slice(1)) {
      expect(line).toContain("<p>");
      expect(line).toContain("9783123456789");
      expect(line).toContain("4.99");
    }
    expect(lines[2]).toContain("A thrilling novel about a wanderer.");
    expect(lines[3]).toContain("Una novela emocionante.");
  });

  it("wirft bei fehlender Quellzeile", () => {
    expect(() =>
      buildLocalizedUploadSheet({ ...row, title: "  " }, []),
    ).toThrow(/Titel/);
  });

  it("ist deterministisch", () => {
    const a = buildLocalizedUploadSheet(row, translations);
    const b = buildLocalizedUploadSheet(row, translations);
    expect(a.csv).toBe(b.csv);
  });
});

describe("estimateTranslationApiCalls", () => {
  it("schätzt Kapitel-Calls + Metadaten-Calls über alle Sprachen", () => {
    // 10 Kapitel × 3 Sprachen + 3 Metadaten-Calls
    expect(estimateTranslationApiCalls(10)).toBe(33);
    expect(estimateTranslationApiCalls(10, [{ code: "en", label: "Englisch" }])).toBe(11);
    expect(estimateTranslationApiCalls(0)).toBe(3); // nur Metadaten
  });
});