// Release-Package-Tests (Sprint 4, Agent 3).
//
// ExportPackager: bündelt Manuscript (DOCX/EPUB), Metadata (JSON, KDP-Keywords,
// Klappentexte) und Marketing (Midjourney-Prompts, Social Teaser) in ein
// ZIP-Archiv + maschinenlesbaren Projekt-Report (Wörterzahl, Flesch-Reading-Ease,
// Modelle, Produktionszeit).

import { describe, it, expect, vi, beforeEach } from "vitest";
import JSZip from "jszip";
import { logger } from "@/services/logger";
import {
  buildReleasePackage,
  buildProjectReportMarkdown,
  type ReleasePackageInput,
} from "./releasePackage";

function chapter(title: string, paragraphs: string[]): { title: string; content: string } {
  return {
    title,
    content: JSON.stringify({
      type: "doc",
      content: paragraphs.map((t) => ({
        type: "paragraph",
        content: [{ type: "text", text: t }],
      })),
    }),
  };
}

const SUMMARY =
  "Lena Brandt erbt ein altes Leuchtturmhaus an der Ostsee. Doch im Keller findet sie ein Tagebuch, das ein dunkles Familiengeheimnis verrät. Je tiefer sie gräbt, desto mehr verschwimmt die Grenze zwischen Vergangenheit und Gegenwart.";

function makeInput(overrides: Partial<ReleasePackageInput> = {}): ReleasePackageInput {
  return {
    title: "Das Leuchtturmhaus",
    author: "Testautorin",
    language: "de",
    year: 2026,
    summary: SUMMARY,
    genre: "Mystery",
    targetAudience: "Erwachsene",
    chapters: [
      chapter("Ankunft", [
        "Lena Brandt stieg aus dem Bus und sah das Leuchtturmhaus zum ersten Mal. Der Wind trug den Geruch von Salz und Tang herüber.",
        "Sie hatte das Haus nie gekannt, das ihrer Familie gehört hatte. Jetzt gehörte es ihr.",
      ]),
      chapter("Das Tagebuch", [
        "Im Keller stand eine alte Truhe. In der Truhe lag ein Tagebuch mit verblassten Zeilen.",
        "Die Schrift war klein und ordentlich. Wer hatte sie geschrieben? Und warum wurde jede zweite Seite herausgerissen?",
      ]),
      chapter("Das Geheimnis", [
        "Am dritten Abend fand Lena den Brief hinter dem Spiegel. Er war fünfzig Jahre alt und doch als wäre er gestern geschrieben worden.",
        "Sie las ihn zweimal. Dann begann sie zu verstehen.",
      ]),
    ],
    modelsUsed: ["ollama:llama3.1:8b", "openrouter:mistral-small"],
    productionStartedAt: "2026-09-05T10:00:00.000Z",
    productionEndedAt: "2026-09-05T12:00:00.000Z",
    ...overrides,
  };
}

async function zipEntries(blob: Blob): Promise<Map<string, Uint8Array>> {
  const buf = await blob.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const out = new Map<string, Uint8Array>();
  for (const path of Object.keys(zip.files)) {
    if (zip.files[path].dir) continue;
    out.set(path, await zip.files[path].async("uint8array"));
  }
  return out;
}

describe("buildReleasePackage — ZIP-Struktur", () => {
  it("erzeugt ein gültiges ZIP mit /manuscript, /metadata, /marketing", async () => {
    const result = await buildReleasePackage(makeInput());
    expect(result.filename).toBe("Das_Leuchtturmhaus-Release.zip");
    expect(result.blob.size).toBeGreaterThan(0);

    const entries = await zipEntries(result.blob);
    const paths = [...entries.keys()];
    expect(paths.some((p) => p.startsWith("manuscript/"))).toBe(true);
    expect(paths.some((p) => p.startsWith("metadata/"))).toBe(true);
    expect(paths.some((p) => p.startsWith("marketing/"))).toBe(true);
    expect(paths).toContain("project-report.md");
    expect(paths).toContain("manifest.json");
  });

  it("legt DOCX und EPUB unter /manuscript ab", async () => {
    const result = await buildReleasePackage(makeInput());
    const paths = [...(await zipEntries(result.blob)).keys()];
    expect(paths).toContain("manuscript/Das_Leuchtturmhaus.docx");
    expect(paths).toContain("manuscript/Das_Leuchtturmhaus.epub");
 const docx = result.entries.find((e) => e.path === "manuscript/Das_Leuchtturmhaus.docx");
    expect(docx?.bytes).toBeGreaterThan(0);
  });

  it("manifest.json ist maschinenlesbar und deckt alle ZIP-Einträge", async () => {
    const result = await buildReleasePackage(makeInput());
    const entries = await zipEntries(result.blob);
    const manifest = JSON.parse(new TextDecoder().decode(entries.get("manifest.json")));
    expect(manifest.formatVersion).toBe(1);
    expect(manifest.title).toBe("Das Leuchtturmhaus");
    expect(Array.isArray(manifest.entries)).toBe(true);
    const manifestPaths = manifest.entries.map((e: { path: string }) => e.path).sort();
    expect(manifestPaths).toEqual([...entries.keys()].sort());
    for (const e of manifest.entries) expect(typeof e.bytes).toBe("number");
  });
});

describe("buildReleasePackage — /metadata", () => {
  it("book.json enthält Titel, Autor, Sprache, Wortzahl", async () => {
    const result = await buildReleasePackage(makeInput());
    const entries = await zipEntries(result.blob);
    const book = JSON.parse(new TextDecoder().decode(entries.get("metadata/book.json")));
    expect(book.title).toBe("Das Leuchtturmhaus");
    expect(book.author).toBe("Testautorin");
    expect(book.language).toBe("de");
    expect(book.year).toBe(2026);
    expect(book.wordCount).toBeGreaterThan(0);
  });

  it("kdp-keywords.json: genau 7 Keywords, je max. 50 Zeichen", async () => {
    const result = await buildReleasePackage(makeInput());
    const entries = await zipEntries(result.blob);
    const kw = JSON.parse(new TextDecoder().decode(entries.get("metadata/kdp-keywords.json")));
    expect(kw.keywords).toHaveLength(7);
    for (const k of kw.keywords) {
      expect(typeof k).toBe("string");
      expect(k.length).toBeLessThanOrEqual(50);
    }
  });

  it("blurbs.json enthält Kurz- und Lang-Klappentext", async () => {
    const result = await buildReleasePackage(makeInput());
    const entries = await zipEntries(result.blob);
    const blurbs = JSON.parse(new TextDecoder().decode(entries.get("metadata/blurbs.json")));
    expect(blurbs.shortBlurb.length).toBeGreaterThan(0);
    expect(blurbs.standardBlurb.length).toBeGreaterThan(0);
    expect(blurbs.amazonDescription.length).toBeGreaterThan(0);
  });
});

describe("buildReleasePackage — /marketing", () => {
  it("midjourney-prompts.json: 3-5 Varianten mit Prompts", async () => {
    const result = await buildReleasePackage(makeInput());
    const entries = await zipEntries(result.blob);
    const prompts = JSON.parse(new TextDecoder().decode(entries.get("marketing/midjourney-prompts.json")));
    expect(prompts.length).toBeGreaterThanOrEqual(3);
    expect(prompts.length).toBeLessThanOrEqual(5);
    for (const p of prompts) {
      expect(p.fullPrompt.length).toBeGreaterThan(20);
    }
  });

  it("social-teasers.md enthält Teaser-Texte", async () => {
    const result = await buildReleasePackage(makeInput());
    const entries = await zipEntries(result.blob);
    const md = new TextDecoder().decode(entries.get("marketing/social-teasers.md"));
    expect(md).toContain("Das Leuchtturmhaus");
    expect(md.length).toBeGreaterThan(50);
  });
});

describe("buildReleasePackage — Report", () => {
  it("project-report.md enthält Wörterzahl, FRE, Modelle, Produktionszeit", async () => {
    const result = await buildReleasePackage(makeInput());
    const entries = await zipEntries(result.blob);
    const md = new TextDecoder().decode(entries.get("project-report.md"));
    expect(md).toContain("Wörterzahl");
    expect(md).toContain("Flesch");
    expect(md).toContain("ollama:llama3.1:8b");
    expect(md).toContain("Produktionszeit");
    // Maschinenlesbarer JSON-Block
    const m = md.match(/```json\n([\s\S]*?)```/);
    expect(m).not.toBeNull();
    const report = JSON.parse(m![1]);
    expect(report.words).toBeGreaterThan(0);
    expect(typeof report.fleschReadingEase).toBe("number");
    expect(report.modelsUsed).toEqual(["ollama:llama3.1:8b", "openrouter:mistral-small"]);
    expect(report.productionTime.durationMs).toBe(7200000);
  });

  it("Statistik ist konsistent mit dem Text (Wörterzahl deterministisch)", async () => {
    const input = makeInput();
    const a = await buildReleasePackage(input);
    const b = await buildReleasePackage(input);
    expect(a.report.words).toBe(b.report.words);
    expect(a.report.fleschReadingEase).toBe(b.report.fleschReadingEase);
    expect(a.report.chapters).toBe(3);
  });
});

describe("buildProjectReportMarkdown", () => {
  it("enthält alle Pflichtfelder auch ohne Modelle/Zeiten", () => {
    const input = makeInput({ modelsUsed: undefined, productionStartedAt: undefined, productionEndedAt: undefined });
    const md = buildProjectReportMarkdown(input, { words: 42000, chapters: 12, fleschReadingEase: 61.4 });
    expect(md).toContain("42000");
    expect(md).toContain("61.4");
    expect(md).toContain("–"); // leerer Modell-/Zeit-Eintrag wird markiert
  });
});

describe("buildReleasePackage — Log", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("schreibt genau einen eigenen Log-Eintrag (logger.info, Tag buildReleasePackage)", async () => {
    const spy = vi.spyOn(logger, "info").mockImplementation(() => {});
    const result = await buildReleasePackage(makeInput());
    // exportBook loggt intern ebenfalls — gefiltert wird auf den eigenen Tag.
    const own = spy.mock.calls.filter(([, tag]) => tag === "buildReleasePackage");
    expect(own).toHaveLength(1);
    const [msg] = own[0] as [string, string];
    expect(msg).toContain("Release");
    expect(result.entries.length).toBeGreaterThan(5);
  });
});
