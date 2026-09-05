// Release-Package (Sprint 4, Agent 3): ExportPackager.
//
// Bündelt alle Endprodukte eines BookWriter-Laufs in ein ZIP-Archiv:
//
//   /manuscript   DOCX (Word/Scrivener), EPUB (Jutoh)
//   /metadata     book.json, kdp-keywords.json, blurbs.json
//   /marketing    midjourney-prompts.json, social-teasers.md
//   project-report.md  (Wörterzahl, Flesch-Reading-Ease, Modelle, Produktionszeit)
//   manifest.json      (maschinenlesbares Inhaltsverzeichnis des Archivs)
//
// Komposition bestehender Sprint-3-Services — kein neues Verhalten, keine
// LLM-Calls, kein API-Budget:
//   - exportBook (docx/epub)          → Manuscript-Dateien
//   - generateMarketingAssets         → 7 KDP-Keywords + Klappentexte
//   - generateCoverPrompts            → Midjourney/SD-Prompts
//   - computeReadability              → FRE (deutsch, Amstad-Anpassung) + Statistik
//   - tiptapToText                    → TipTap-JSON → Plaintext für die Statistik

import JSZip from "jszip";
import { exportBook } from "./export";
import { generateMarketingAssets } from "./marketingAssets";
import { generateCoverPrompts, type CoverPrompt } from "./coverPrompts";
import { computeReadability } from "@/services/writing/readability";
import { tiptapToText } from "@/services/editor/count";
import { logger } from "@/services/logger";

// --- Types ---

/** Ein Kapitel des Release-Pakets (identisch zum Export-Input). */
export interface ReleaseChapterInput {
  title: string;
  /** TipTap-JSON (auch Klartext erlaubt). */
  content: string;
}

export interface ReleasePackageInput {
  title: string;
  author?: string;
  language?: string;
  /** Erscheinungsjahr (Default: aktuelles Jahr). */
  year?: number;
  /** Finale Buch-Zusammenfassung (Summarizer-Output) für Metadata + Marketing. */
  summary: string;
  genre: string;
  targetAudience?: string;
  chapters: ReleaseChapterInput[];
  /** Modell-IDs, die während der Produktion genutzt wurden (z.B. "ollama:llama3.1:8b"). */
  modelsUsed?: string[];
  /** Produktionszeitraum (ISO 8601). Beides zusammen → Dauer im Report. */
  productionStartedAt?: string;
  productionEndedAt?: string;
}

/** Eine Datei im ZIP (auch als JSON-Eintrag im manifest.json). */
export interface ReleasePackageEntry {
  /** Pfad im ZIP, z.B. "manuscript/Titel.docx". */
  path: string;
  bytes: number;
}

export interface ReleaseReport {
  words: number;
  characters: number;
  chapters: number;
  fleschReadingEase: number;
  modelsUsed: string[];
  productionTime: {
    startedAt: string | null;
    endedAt: string | null;
    durationMs: number | null;
  };
}

export interface ReleasePackageResult {
  filename: string;
  blob: Blob;
  /** Alle Dateien im Archiv (manifest-relevant). */
  entries: ReleasePackageEntry[];
  /** Aggregierte Statistik aus dem Report. */
  report: ReleaseReport;
}

export interface ProjectStats {
  words: number;
  characters: number;
  chapters: number;
  fleschReadingEase: number;
}

// --- Hilfsfunktionen ------------------------------------------------------------

/** Entfernt Dateisystem-gefährliche Zeichen und Whitespace aus Dateinamen. */
function sanitize(name: string): string {
  return name.replace(/[<>:"/\\|?*\s]/g, "_").replace(/_+/g, "_").trim();
}

/** Unicode-aware Wortzählung (deutsche Umlaute korrekt). */
function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}'’]+/gu) ?? []).length;
}

function parseDurationMs(input: ReleasePackageInput): number | null {
  if (!input.productionStartedAt || !input.productionEndedAt) return null;
  const s = Date.parse(input.productionStartedAt);
  const e = Date.parse(input.productionEndedAt);
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return null;
  return e - s;
}

// --- Statistik --------------------------------------------------------------------

/**
 * Aggregiert Wörter/Zeichen/Flesch-Reading-Ease über alle Kapitel.
 * FRE wird satzgewichtet gemittelt (deutsche Amstad-Anpassung, rein lokal).
 */
export function computeProjectStats(chapters: ReleaseChapterInput[]): ProjectStats {
  let words = 0;
  let characters = 0;
  let freSum = 0;
  let sentenceTotal = 0;

  for (const ch of chapters) {
    const text = tiptapToText(ch.content).trim();
    if (!text) continue;
    words += countWords(text);
    characters += text.length;
    const m = computeReadability(text);
    // FRE nur über Kapitel mit ≥1 Satz mitteln (leere Kapitel verfälschen).
    if (m.sentences > 0) {
      freSum += m.fleschReadingEase * m.sentences;
      sentenceTotal += m.sentences;
    }
  }

  return {
    words,
    characters,
    chapters: chapters.length,
    fleschReadingEase: sentenceTotal > 0 ? Math.round((freSum / sentenceTotal) * 10) / 10 : 0,
  };
}

// --- Report -------------------------------------------------------------------------

export function buildProjectReportMarkdown(
  input: ReleasePackageInput,
  stats: { words: number; chapters: number; fleschReadingEase: number },
): string {
  const models = input.modelsUsed ?? [];
  const start = input.productionStartedAt ?? null;
  const end = input.productionEndedAt ?? null;
  const durationMs = parseDurationMs(input);

  const machine: ReleaseReport = {
    words: stats.words,
    characters: 0,
    chapters: stats.chapters,
    fleschReadingEase: stats.fleschReadingEase,
    modelsUsed: models,
    productionTime: { startedAt: start, endedAt: end, durationMs },
  };

  const dur = durationMs !== null ? formatDuration(durationMs) : "–";

  return [
    "# Projekt-Report",
    "",
    `**Titel:** ${input.title}`,
    `**Autor:** ${input.author ?? "–"}`,
    "",
    "## Statistik",
    "",
    `- Wörterzahl: ${stats.words}`,
    `- Flesch Reading Ease (deutsch, Amstad-Anpassung): ${stats.fleschReadingEase}`,
    `- Kapitel: ${stats.chapters}`,
    "",
    "## Verwendete Modelle",
    "",
    models.length ? models.map((m) => `- ${m}`).join("\n") : "- –",
    "",
    "## Produktionszeit",
    "",
    `- Start: ${start ?? "–"}`,
    `- Ende: ${end ?? "–"}`,
    `- Dauer: ${dur}`,
    "",
    "## Maschinenlesbare Zusammenfassung",
    "",
    "```json",
    JSON.stringify(machine, null, 2),
    "```",
    "",
    "---",
    "",
    `Erstellt von AI Writer Studio v1.2.0 · ${new Date().toISOString()}`,
    "",
  ].join("\n");
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

// --- ExportPackager -------------------------------------------------------------------

/**
 * ExportPackager: bündelt Manuscript (DOCX/EPUB), Metadata (JSON, KDP-Keywords,
 * Klappentexte) und Marketing (Midjourney-Prompts, Social Teaser) in ein
 * ZIP-Archiv plus maschinenlesbaren Projekt-Report.
 */
export async function buildReleasePackage(
  input: ReleasePackageInput,
  onProgress?: (percent: number, label: string) => void,
): Promise<ReleasePackageResult> {
  onProgress?.(5, "Statistik wird berechnet…");
  const stats = computeProjectStats(input.chapters);

  onProgress?.(15, "DOCX wird erstellt…");
  const exportInput = {
    title: input.title,
    author: input.author,
    language: input.language,
    year: input.year,
    chapters: input.chapters,
  };
  const docx = await exportBook(exportInput, "docx");
  onProgress?.(35, "EPUB wird erstellt…");
  const epub = await exportBook(exportInput, "epub");

  onProgress?.(55, "Metadata & Marketing werden generiert…");
  const marketing = generateMarketingAssets({
    title: input.title,
    summary: input.summary,
    genre: input.genre,
    targetAudience: input.targetAudience,
    language: input.language,
  });
  const coverPrompts: CoverPrompt[] = generateCoverPrompts({
    title: input.title,
    summary: input.summary,
    genre: input.genre,
    targetAudience: input.targetAudience,
    language: input.language === "de" ? "de" : "en",
  });

  onProgress?.(70, "Report wird erstellt…");
  const reportMd = buildProjectReportMarkdown(input, {
    words: stats.words,
    chapters: stats.chapters,
    fleschReadingEase: stats.fleschReadingEase,
  });

  const title = sanitize(input.title);
  const zip = new JSZip();
  const entries: ReleasePackageEntry[] = [];
  const add = async (path: string, data: Blob | string): Promise<void> => {
    // Blobs als Uint8Array einfügen: JSZips Blob-Erkennung ([object Blob] via
    // FileReader) ist in Node-Umgebungen (Vitest) unzuverlässig, ArrayBuffers
    // funktionieren überall identisch.
    if (typeof data === "string") {
      zip.file(path, data);
      entries.push({ path, bytes: new Blob([data]).size });
    } else {
      const bytes = new Uint8Array(await data.arrayBuffer());
      zip.file(path, bytes);
      entries.push({ path, bytes: bytes.byteLength });
    }
  };

  await add(`manuscript/${title}.docx`, docx.blob);
  await add(`manuscript/${title}.epub`, epub.blob);
  // Sprint 4 (Agent 2): dediziertes VBA-Modul ("AI Text Refinement") je Buch.
  if (docx.vbaMacro?.content) {
    await add(`manuscript/${docx.vbaMacro.filename}`, docx.vbaMacro.content);
  }
  const opml = await exportBook(exportInput, "opml");
  await add(`manuscript/${opml.filename}`, await opml.blob.text());
  add(
    "metadata/book.json",
    JSON.stringify(
      {
        title: input.title,
        author: input.author ?? "Unbekannt",
        language: input.language ?? "de",
        year: input.year ?? new Date().getFullYear(),
        chapters: input.chapters.map((c) => ({ title: c.title })),
        wordCount: stats.words,
        characterCount: stats.characters,
        fleschReadingEase: stats.fleschReadingEase,
      },
      null,
      2,
    ),
  );
  add(
    "metadata/kdp-keywords.json",
    JSON.stringify({ keywords: marketing.keywords, source: marketing.source }, null, 2),
  );
  add(
    "metadata/blurbs.json",
    JSON.stringify(
      {
        shortBlurb: marketing.blurb.shortBlurb,
        standardBlurb: marketing.blurb.standardBlurb,
        amazonDescription: marketing.blurb.amazonDescription,
        taglines: marketing.blurb.taglineOptions,
        warnings: marketing.blurb.warnings,
      },
      null,
      2,
    ),
  );
  add("marketing/midjourney-prompts.json", JSON.stringify(coverPrompts, null, 2));
  add("marketing/social-teasers.md", buildSocialTeasers(input, marketing.blurb.shortHook));
  add("project-report.md", reportMd);

  onProgress?.(85, "manifest.json wird erstellt…");
  // manifest.json listet alle Einträge inklusive sich selbst — die Bytegröße
  // hängt vom Inhalt ab, konvergiert aber nach 2-3 Iterationen (nur Ziffern
  // der eigenen Größe ändern sich). Deterministisch, maschinenlesbar.
  const manifestBase = {
    formatVersion: 1,
    tool: "ai-writer-studio",
    toolVersion: "1.2.0",
    title: input.title,
    author: input.author ?? "Unbekannt",
    language: input.language ?? "de",
    generatedAt: new Date().toISOString(),
    entries: [] as ReleasePackageEntry[],
  };
  let manifestBytes = 0;
  for (let i = 0; i < 5; i++) {
    manifestBase.entries = [...entries, { path: "manifest.json", bytes: manifestBytes }];
    const json = JSON.stringify(manifestBase, null, 2);
    const bytes = new Blob([json]).size;
    const listed = manifestBase.entries.find((e) => e.path === "manifest.json");
    if (listed && listed.bytes === bytes) {
      manifestBytes = bytes;
      break;
    }
    manifestBytes = bytes;
  }
  manifestBase.entries = [...entries, { path: "manifest.json", bytes: manifestBytes }];
  const manifestJson = JSON.stringify(manifestBase, null, 2);
  zip.file("manifest.json", manifestJson);
  entries.push({ path: "manifest.json", bytes: manifestBytes });

  onProgress?.(95, "ZIP wird komprimiert…");
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });

  const report: ReleaseReport = {
    words: stats.words,
    characters: stats.characters,
    chapters: stats.chapters,
    fleschReadingEase: stats.fleschReadingEase,
    modelsUsed: input.modelsUsed ?? [],
    productionTime: {
      startedAt: input.productionStartedAt ?? null,
      endedAt: input.productionEndedAt ?? null,
      durationMs: parseDurationMs(input),
    },
  };

  const filename = `${title}-Release.zip`;
  logger.info(
    `Release-Paket erstellt: ${filename} (${blob.size} Bytes, ${entries.length} Dateien, ${report.words} Wörter, FRE ${report.fleschReadingEase})`,
    "buildReleasePackage",
  );
  onProgress?.(100, "Release-Paket fertig.");
  return { filename, blob, entries, report };
}

/** Social-Media-Teaser (X/Twitter, Instagram, Facebook) aus Hook + Titel. */
function buildSocialTeasers(input: ReleasePackageInput, shortHook: string): string {
  const title = input.title;
  const tag = `#${title.replace(/[^\p{L}\p{N}]/gu, "")}`;
  const genreTag = `#${input.genre.replace(/\s+/g, "")}`;
  return [
    "# Social-Media-Teaser",
    "",
    `> Auto-generiert aus der finalen Buch-Zusammenfassung — vor Verwendung kurz prüfen.`,
    "",
    "## X / Twitter (280 Zeichen)",
    "",
    `📚 NEU: „${title}“ — ${shortHook} ${tag}`,
    "",
    "## Instagram",
    "",
    `Heute ist es soweit: „${title}“ ist da! ${shortHook}`,
    "",
    `${genreTag} #Buchtipps #Neuerscheinung ${tag}`,
    "",
    "## Facebook",
    "",
    `Es ist endlich fertig: „${title}“. ${shortHook} Jetzt auf Amazon erhältlich!`,
    "",
  ].join("\n");
}
