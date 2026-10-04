// Master-Publishing-Service (WP 43.2): Preflight + verkaufsfertiges Bundle.
//
// Bündelt die bestehenden Publishing-Services zu EINEM Workflow:
//   1) runMasterPreflight   — Master-Health, Hurenkinder, Typografie, Farbmodell
//   2) buildPublishingBundle — Druck-PDF-Markup, EPUB, MP3-Teaser, ONIX 3.0, Exposé
//   3) describeBundle        — menschenlesbare Inhaltsbeschreibung
//
// Entwurfsregeln (analog zu den übrigen Services):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Rein funktional: Eingaben werden nie mutiert.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern sichere Defaults
//     statt zu werfen. `null`/`undefined`-Projekte sind zulässig.
//   - Deterministische Ausgabe: Ohne Option wird `generatedAt = Date.now()`
//     gesetzt; mit `options.now` ist das gesamte Bundle reproduzierbar.
//   - P0-Blocker erzwingen `passed === false`.

import {
  runMasterHealthScan,
  calculateReadinessScore,
} from "../analytics/manuscriptHealth";
import type { HealthScanResult, ManuscriptProject } from "../analytics/manuscriptHealth";
import {
  detectWidowsAndOrphans,
  insertNonBreakingSpaces,
  preventConsecutiveHyphens,
  applyHangingPunctuation,
} from "../typography/microTypography";
import {
  generateOnixMetadata,
  isValidIsbn,
  escapeXml,
} from "./distributionPipeline";
import type { BookMetadata } from "./distributionPipeline";
import {
  generateExposé,
  extractPlainText,
  countNormPages,
} from "../exporters/pitchDeckStudio";
import { extractEntities } from "./autoGlossary";
import { generateSmil } from "./mediaOverlay";

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Ein Kapitel des Publishing-Projekts (bewusst schlank). */
export interface PublishingChapter {
  id: string;
  title: string;
  content: string;
}

/** Das zu veröffentlichende Projekt. */
export interface PublishingProject {
  title: string;
  author: string;
  chapters: PublishingChapter[];
  isbn?: string;
  price?: number;
  language?: string;
  /**
   * Optionaler Farbraum der Druckvorlage. Default ist `"CMYK"` (für PDF/X-1a
   * korrekt); nur ein ausdrückliches `"RGB"` löst eine Warnung aus.
   */
  colorModel?: "CMYK" | "RGB";
}

/** Ein einzelner Preflight-Befund. */
export interface PreflightIssue {
  severity: "P0" | "P1" | "P2";
  /** Name des Checks, der den Befund erzeugt hat. */
  check: string;
  message: string;
}

/** Ergebnis des Master-Preflights. */
export interface PreflightResult {
  passed: boolean;
  blockers: PreflightIssue[];
  warnings: PreflightIssue[];
  checksRun: number;
  readinessScore: number;
}

/** Unterstützte Bundle-Dateitypen. */
export type BundleKind = "pdf" | "epub" | "mp3" | "xml" | "json" | "html";

/** Eine Datei im Publishing-Bundle. */
export interface BundleFile {
  name: string;
  kind: BundleKind;
  content: string;
  sizeBytes: number;
}

/** Das verkaufsfertige Bundle. */
export interface PublishingBundle {
  files: BundleFile[];
  totalSizeBytes: number;
  generatedAt: number;
}

/** Optionale Stellschrauben (für deterministische Tests). */
export interface BundleOptions {
  /** Fixiert `generatedAt`. Ohne Angabe: `Date.now()`. */
  now?: number;
}

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/** Die vier Kern-Checks des Preflights (Reihenfolge = Ausführungsreihenfolge). */
export const PREFLIGHT_CHECKS: readonly string[] = [
  "master-health",
  "hurenkinder",
  "typografie",
  "farbmodell",
] as const;

const SEVERITY_RANK: Record<"P0" | "P1" | "P2", number> = { P0: 0, P1: 1, P2: 2 };

/** Obergrenze der Befunde je Nicht-Health-Check (Speicherschutz). */
const MAX_ISSUES_PER_CHECK = 100;

/** Standarddauer der Hörprobe in Millisekunden. */
const TEASER_DURATION_MS = 45_000;

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** UTF-8-Byte-Länge eines Strings (defensiv, ohne externe Abhängigkeit). */
function byteLength(value: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).length;
  }
  // Fallback: grobe Schätzung, falls kein TextEncoder vorhanden ist.
  let bytes = 0;
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
}

/** Locale-unabhängiger, deterministischer String-Vergleich. */
function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Defensive String-Coercion mit Trim. */
function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Sätze an . ! ? … zerlegen (leere Fragmente verworfen). */
function splitSentences(text: string): string[] {
  return text
    .split(/[.!?…]+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Menschenlesbare Byte-Größe (deterministisch). */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

interface NormalizedProject {
  title: string;
  author: string;
  chapters: PublishingChapter[];
  isbn: string;
  price: number | null;
  language: string;
  colorModel: "CMYK" | "RGB";
}

/** Wandelt beliebige Eingaben in ein sicheres Projekt um (wirft nie). */
function normalizeProject(project: unknown): NormalizedProject {
  const raw: Record<string, unknown> =
    project && typeof project === "object" ? (project as Record<string, unknown>) : {};

  const chapters: PublishingChapter[] = [];
  if (Array.isArray(raw.chapters)) {
    for (const entry of raw.chapters) {
      if (!entry || typeof entry !== "object") continue;
      const c = entry as Record<string, unknown>;
      chapters.push({
        id: safeString(c.id),
        title: safeString(c.title),
        content: typeof c.content === "string" ? c.content : "",
      });
    }
  }

  const isbn = safeString(raw.isbn);
  const price =
    typeof raw.price === "number" && Number.isFinite(raw.price) ? raw.price : null;
  const language = safeString(raw.language) || "de";
  const colorModel = raw.colorModel === "RGB" ? "RGB" : "CMYK";

  return {
    title: safeString(raw.title) || "Ohne Titel",
    author: safeString(raw.author) || "Unbekannter Autor",
    chapters,
    isbn,
    price,
    language,
    colorModel,
  };
}

/** Kapitelnummer als 1-basierter Titel-Fallback. */
function chapterLabel(chapter: PublishingChapter, index: number): string {
  return chapter.title || chapter.id || `Kapitel ${index + 1}`;
}

/** Gesamttext aller Kapitel (für Entitäten, Umfang, Hörprobe). */
function fullText(project: NormalizedProject): string {
  return project.chapters
    .map((c) => extractPlainText(c.content))
    .filter((t) => t.length > 0)
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// 1) Master-Preflight
// ---------------------------------------------------------------------------

function sortIssues(issues: PreflightIssue[]): PreflightIssue[] {
  return [...issues].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      cmpStr(a.check, b.check) ||
      cmpStr(a.message, b.message),
  );
}

/**
 * Führt die wichtigsten Veröffentlichungs-Checks aus:
 *
 *   1. master-health — Gesamt-Diagnose über `runMasterHealthScan`
 *      (P0 → Blocker, P1/P2 → Warnungen). Die Kategorie `widow-orphan` wird
 *      ausgefiltert, da sie der dedizierte Hurenkinder-Check abdeckt.
 *   2. hurenkinder   — `detectWidowsAndOrphans` je Kapitel (P1-Warnungen).
 *   3. typografie    — fehlende geschützte Leerzeichen, mehrfache Trennstriche,
 *      gerade Anführungszeichen (P2-Warnungen).
 *   4. farbmodell    — RGB-Druckvorlage, ungültige/fehlende ISBN und fehlender
 *      Listenpreis. Eine ungültige ISBN ist ein P0-Blocker.
 *
 * `passed` ist genau dann `true`, wenn keine P0-Blocker vorliegen.
 */
export function runMasterPreflight(project: PublishingProject): PreflightResult {
  const p = normalizeProject(project);
  const issues: PreflightIssue[] = [];
  const perCheck = new Map<string, number>();

  const push = (issue: PreflightIssue): void => {
    const count = perCheck.get(issue.check) ?? 0;
    if (issue.check !== "master-health" && count >= MAX_ISSUES_PER_CHECK) return;
    perCheck.set(issue.check, count + 1);
    issues.push(issue);
  };

  let checksRun = 0;

  // --- 1) Master-Health ----------------------------------------------------
  checksRun += 1;
  const healthProject: ManuscriptProject = {
    chapters: p.chapters.map((c) => ({
      id: c.id,
      title: c.title,
      content: c.content,
      characters: [],
    })),
    characters: [],
    trackChanges: [],
  };
  const health = runMasterHealthScan(healthProject);
  for (const issue of health.issues) {
    if (issue.category === "widow-orphan") continue; // → dedizierter Check
    push({
      severity: issue.severity,
      check: "master-health",
      message: `${issue.category}: ${issue.message}`,
    });
  }

  // --- 2) Hurenkinder & Schusterjungen -------------------------------------
  checksRun += 1;
  for (const chapter of p.chapters) {
    const text = extractPlainText(chapter.content);
    if (!text) continue;
    const paragraphs = text.split(/\n\s*\n/);
    for (const wo of detectWidowsAndOrphans(paragraphs)) {
      const label = wo.type === "orphan" ? "Hurenkind" : "Schusterjunge";
      push({
        severity: "P1",
        check: "hurenkinder",
        message: `${label} in „${chapterLabel(chapter, p.chapters.indexOf(chapter))}“ ` +
          `Zeile ${wo.lineNumber}: „${wo.text}“.`,
      });
    }
  }

  // --- 3) Typografie -------------------------------------------------------
  checksRun += 1;
  for (const chapter of p.chapters) {
    const text = extractPlainText(chapter.content);
    if (!text) continue;
    const where = `„${chapterLabel(chapter, p.chapters.indexOf(chapter))}“`;
    if (insertNonBreakingSpaces(text) !== text) {
      push({
        severity: "P2",
        check: "typografie",
        message: `Geschützte Leerzeichen fehlen (Abkürzungen/Einheiten) in ${where}.`,
      });
    }
    if (preventConsecutiveHyphens(text) !== text) {
      push({
        severity: "P2",
        check: "typografie",
        message: `Mehrfache Trennstriche („----“) in ${where}.`,
      });
    }
    if (/"[^"]*"/.test(text) || /'[^']*'/.test(text)) {
      push({
        severity: "P2",
        check: "typografie",
        message: `Gerade Anführungszeichen in ${where} — typografische Zeichen („ “) verwenden.`,
      });
    }
  }

  // --- 4) Farbmodell & Druckvorstufe ---------------------------------------
  checksRun += 1;
  if (p.colorModel === "RGB") {
    push({
      severity: "P1",
      check: "farbmodell",
      message:
        "RGB-Farbraum in der Druckvorlage: Für PDF/X-1a ist eine CMYK-Konvertierung erforderlich.",
    });
  }
  if (!p.isbn) {
    push({
      severity: "P1",
      check: "farbmodell",
      message:
        "Keine ISBN: Für die CMYK-Druckdistribution (z. B. IngramSpark) ist eine ISBN-13 erforderlich.",
    });
  } else if (!isValidIsbn(p.isbn)) {
    push({
      severity: "P0",
      check: "farbmodell",
      message: `Ungültige ISBN „${p.isbn}“ (Prüfziffer fehlerhaft) — Distributoren lehnen das Werk ab.`,
    });
  }
  if (p.price == null || p.price <= 0) {
    push({
      severity: "P1",
      check: "farbmodell",
      message: "Kein gültiger Listenpreis — für die Auslieferung erforderlich.",
    });
  }

  // --- Auswertung ----------------------------------------------------------
  const blockers = sortIssues(issues.filter((i) => i.severity === "P0"));
  const warnings = sortIssues(issues.filter((i) => i.severity !== "P0"));

  const readinessInput: HealthScanResult = {
    issues: issues.map((i) => ({
      severity: i.severity,
      category: i.check,
      message: i.message,
    })),
    stats: {
      totalWords: health.stats.totalWords,
      totalChapters: p.chapters.length,
      openTrackChanges: 0,
      unresolvedPlots: 0,
    },
  };

  return {
    passed: blockers.length === 0,
    blockers,
    warnings,
    checksRun,
    readinessScore: calculateReadinessScore(readinessInput),
  };
}

// ---------------------------------------------------------------------------
// 2) Bundle-Aufbau
// ---------------------------------------------------------------------------

function makeFile(name: string, kind: BundleKind, content: string): BundleFile {
  return { name, kind, content, sizeBytes: byteLength(content) };
}

/** Wendet den Mikrotypografie-Feinsatz auf einen Klartext an. */
function polish(text: string): string {
  return applyHangingPunctuation(preventConsecutiveHyphens(insertNonBreakingSpaces(text)));
}

/** HTML-Absätze aus Klartext (leere Absätze verworfen). */
function toParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter((para) => para.length > 0);
}

/** Druck-PDF-Markup: HTML mit @page/CSS für PDF/X-1a (CMYK). */
function buildPrintPdfMarkup(project: NormalizedProject): string {
  const parts: string[] = [];
  parts.push('<!DOCTYPE html>');
  parts.push('<html lang="' + escapeXml(project.language) + '">');
  parts.push('<head>');
  parts.push('<meta charset="utf-8"/>');
  parts.push(`<title>${escapeXml(project.title)} — Druck-PDF (PDF/X-1a)</title>`);
  parts.push('<style>');
  parts.push('/* PDF/X-1a: CMYK-Farbraum, keine Transparenzen, Schriften eingebettet, Beschnitt 3 mm */');
  parts.push('@page {');
  parts.push('  size: 148mm 210mm; /* A5 */');
  parts.push('  margin: 18mm 16mm 20mm 16mm;');
  parts.push('  marks: crop cross;');
  parts.push('  bleed: 3mm;');
  parts.push('}');
  parts.push('@page :first { margin-top: 40mm; }');
  parts.push('html { color: #000000; background: #ffffff; }');
  parts.push('body { font-family: "Liberation Serif", Georgia, serif; font-size: 11pt; line-height: 1.45; }');
  parts.push('h1, h2 { page-break-after: avoid; break-after: avoid; }');
  parts.push('p { margin: 0 0 0.6em; widows: 2; orphans: 2; hyphens: auto; }');
  parts.push('.title-page { text-align: center; page-break-after: always; break-after: page; }');
  parts.push('.title-page .author { font-size: 13pt; margin-top: 1.5em; }');
  parts.push('.chapter { page-break-before: always; break-before: page; }');
  parts.push('.print-note { font-size: 8pt; color: #444; }');
  parts.push('</style>');
  parts.push('</head>');
  parts.push('<body>');
  parts.push('<section class="title-page">');
  parts.push(`<h1>${escapeXml(project.title)}</h1>`);
  parts.push(`<p class="author">${escapeXml(project.author)}</p>`);
  parts.push(
    `<p class="print-note">Druckvorlage: PDF/X-1a, CMYK, 300 dpi, Beschnitt 3 mm` +
      (project.isbn ? ` · ISBN ${escapeXml(project.isbn)}` : '') +
      '.</p>',
  );
  parts.push('</section>');

  project.chapters.forEach((chapter, index) => {
    const text = extractPlainText(chapter.content);
    parts.push(`<section class="chapter" id="kapitel-${index + 1}">`);
    parts.push(`<h2>${escapeXml(chapterLabel(chapter, index))}</h2>`);
    if (!text) {
      parts.push('<p class="print-note">(Kein Inhalt)</p>');
    } else {
      for (const para of toParagraphs(polish(text))) {
        parts.push(`<p>${escapeXml(para).replace(/\n/g, '<br/>')}</p>`);
      }
    }
    parts.push('</section>');
  });

  parts.push('</body>');
  parts.push('</html>');
  return parts.join('\n');
}

/** EPUB-Inhalt: XHTML-Dokument mit Kapiteln und Lore-Glossar. */
function buildEpubContent(project: NormalizedProject): string {
  const parts: string[] = [];
  parts.push('<?xml version="1.0" encoding="utf-8"?>');
  parts.push(
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" ' +
      `lang="${escapeXml(project.language)}">`,
  );
  parts.push('<head>');
  parts.push('<meta charset="utf-8"/>');
  parts.push(`<title>${escapeXml(project.title)}</title>`);
  parts.push('<style>body{font-family:serif;line-height:1.4;} .glossary dt{font-weight:bold;}</style>');
  parts.push('</head>');
  parts.push('<body>');
  parts.push('<nav epub:type="toc" id="toc"><h1>Inhalt</h1><ol>');
  project.chapters.forEach((chapter, index) => {
    parts.push(`<li><a href="#kapitel-${index + 1}">${escapeXml(chapterLabel(chapter, index))}</a></li>`);
  });
  parts.push('<li><a href="#glossar">Glossar</a></li>');
  parts.push('</ol></nav>');

  project.chapters.forEach((chapter, index) => {
    const text = extractPlainText(chapter.content);
    parts.push(`<section epub:type="chapter" id="kapitel-${index + 1}">`);
    parts.push(`<h1>${escapeXml(chapterLabel(chapter, index))}</h1>`);
    if (text) {
      for (const para of toParagraphs(text)) {
        parts.push(`<p>${escapeXml(para).replace(/\n/g, '<br/>')}</p>`);
      }
    }
    parts.push('</section>');
  });

  // Lore-Glossar aus den extrahierten Entitäten.
  const entities = extractEntities(fullText(project));
  parts.push('<section epub:type="glossary" id="glossar"><h1>Glossar</h1><dl class="glossary">');
  if (entities.length === 0) {
    parts.push('<dt>—</dt><dd>Keine Entitäten erkannt.</dd>');
  } else {
    for (const entry of entities) {
      parts.push(`<dt>${escapeXml(entry.term)} (${escapeXml(entry.type)})</dt>`);
      parts.push(`<dd>${escapeXml(entry.definition)}</dd>`);
    }
  }
  parts.push('</dl></section>');
  parts.push('</body>');
  parts.push('</html>');
  return parts.join('\n');
}

/** MP3-Teaser-Metadaten: JSON inkl. SMIL-Overlay (via mediaOverlay). */
function buildMp3Teaser(project: NormalizedProject): string {
  const text = fullText(project);
  const sentences = splitSentences(text).slice(0, 12);
  const smil = generateSmil(sentences, TEASER_DURATION_MS);
  const teaser = {
    kind: "audio-teaser",
    codec: "mp3",
    sampleRateHz: 44_100,
    channels: 1,
    title: project.title,
    author: project.author,
    durationMs: smil.totalDurationMs,
    sentenceCount: smil.sentenceCount,
    smil: smil.xml,
  };
  return JSON.stringify(teaser, null, 2);
}

/** ONIX-3.0-XML aus den Projekt-Metadaten (deterministisch). */
function buildOnix(project: NormalizedProject): string {
  const text = fullText(project);
  let pages = 0;
  for (const chapter of project.chapters) {
    pages += countNormPages(extractPlainText(chapter.content));
  }
  const subjects = extractEntities(text)
    .map((e) => e.term)
    .slice(0, 5);

  const book: BookMetadata = {
    title: project.title,
    author: project.author,
    isbn: project.isbn,
    price: project.price ?? 0,
    currency: "EUR",
    language: project.language,
    publisher: "Unabhängig veröffentlicht",
    publicationDate: "",
    pages: Math.max(1, pages),
    format: "Paperback",
    subjects: subjects.length > 0 ? subjects : ["Belletristik"],
  };

  return generateOnixMetadata(book);
}

/** Exposé als HTML (via pitchDeckStudio.generateExposé). */
function buildExposeHtml(project: NormalizedProject): string {
  const expose = generateExposé({
    title: project.title,
    author: project.author,
    chapters: project.chapters.map((c) => ({ id: c.id, title: c.title, content: c.content })),
    characters: [],
  });

  const parts: string[] = [];
  parts.push('<!DOCTYPE html>');
  parts.push('<html lang="de">');
  parts.push('<head><meta charset="utf-8"/>');
  parts.push(`<title>Exposé — ${escapeXml(project.title)}</title>`);
  parts.push('<style>body{font-family:Georgia,serif;max-width:720px;margin:2em auto;line-height:1.5;} h1{margin-bottom:0;} .meta{color:#555;} section{margin-top:1.5em;}</style>');
  parts.push('</head>');
  parts.push('<body>');
  parts.push(`<h1>${escapeXml(project.title)}</h1>`);
  parts.push(`<p class="meta">${escapeXml(project.author)}</p>`);
  parts.push('<section><h2>Logline</h2><p>' + escapeXml(expose.logline) + '</p></section>');
  parts.push('<section><h2>Pitch</h2><p>' + escapeXml(expose.pitch) + '</p></section>');
  parts.push('<section><h2>Prämisse</h2><p>' + escapeXml(expose.premise) + '</p></section>');
  parts.push('<section><h2>Synopse</h2><p>' + escapeXml(expose.synopsis) + '</p></section>');
  if (expose.characters.length > 0) {
    parts.push('<section><h2>Figuren</h2><ul>');
    for (const c of expose.characters) {
      parts.push(`<li><strong>${escapeXml(c.name)}</strong> (${escapeXml(c.role)}): ${escapeXml(c.arc)}</li>`);
    }
    parts.push('</ul></section>');
  }
  parts.push('<section><h2>Handlungsübersicht</h2><ol>');
  for (const line of expose.actionOutline) {
    parts.push(`<li>${escapeXml(line)}</li>`);
  }
  parts.push('</ol></section>');
  parts.push('</body>');
  parts.push('</html>');
  return parts.join('\n');
}

/** Bundle-Manifest (JSON) — listet die Inhaltdateien und den Preflight-Status. */
function buildManifest(
  project: NormalizedProject,
  files: BundleFile[],
  preflight: PreflightResult | null | undefined,
  generatedAt: number,
): string {
  const manifest = {
    title: project.title,
    author: project.author,
    generatedAt,
    preflight: preflight
      ? {
          passed: preflight.passed === true,
          readinessScore: Number.isFinite(preflight.readinessScore)
            ? preflight.readinessScore
            : 0,
          checksRun: Number.isFinite(preflight.checksRun) ? preflight.checksRun : 0,
          blockers: Array.isArray(preflight.blockers) ? preflight.blockers.length : 0,
          warnings: Array.isArray(preflight.warnings) ? preflight.warnings.length : 0,
        }
      : null,
    fileCount: files.length,
    totalSizeBytes: files.reduce((sum, f) => sum + f.sizeBytes, 0),
    files: files.map((f) => ({ name: f.name, kind: f.kind, sizeBytes: f.sizeBytes })),
  };
  return JSON.stringify(manifest, null, 2);
}

/**
 * Schnürt das verkaufsfertige Publishing-Bundle.
 *
 * Enthaltene Dateien:
 *   - manuskript-druck.html  [pdf]  Druck-PDF-Markup (PDF/X-1a, CMYK)
 *   - buch.epub              [epub] EPUB-Inhalt (XHTML + Glossar)
 *   - hoerprobe.mp3.json     [mp3]  MP3-Teaser-Metadaten (inkl. SMIL)
 *   - onix-3.0.xml           [xml]  ONIX-3.0-Metadaten
 *   - expose.html            [html] Exposé
 *   - bundle-manifest.json   [json] Inhaltsverzeichnis + Preflight-Status
 *
 * Defensiv: `null`/`undefined`-Projekte und fehlende Preflight-Daten sind
 * zulässig und ergeben ein strukturell vollständiges Bundle.
 */
export function buildPublishingBundle(
  project: PublishingProject,
  preflight: PreflightResult,
  options: BundleOptions = {},
): PublishingBundle {
  const p = normalizeProject(project);
  const generatedAt =
    Number.isFinite(options.now) && options.now != null ? Math.trunc(options.now) : Date.now();

  const files: BundleFile[] = [];
  files.push(makeFile("manuskript-druck.html", "pdf", buildPrintPdfMarkup(p)));
  files.push(makeFile("buch.epub", "epub", buildEpubContent(p)));
  files.push(makeFile("hoerprobe.mp3.json", "mp3", buildMp3Teaser(p)));
  files.push(makeFile("onix-3.0.xml", "xml", buildOnix(p)));
  files.push(makeFile("expose.html", "html", buildExposeHtml(p)));
  files.push(
    makeFile("bundle-manifest.json", "json", buildManifest(p, files, preflight, generatedAt)),
  );

  const totalSizeBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);
  return { files, totalSizeBytes, generatedAt };
}

// ---------------------------------------------------------------------------
// 3) Bundle-Beschreibung
// ---------------------------------------------------------------------------

/**
 * Beschreibt den Bundle-Inhalt als Liste menschenlesbarer Zeilen:
 * Kopfzeile (Anzahl/Gesamtgröße) plus eine Zeile je Datei.
 * Defensiv: ein fehlendes/ungültiges Bundle ergibt eine einzelne Hinweiszeile.
 */
export function describeBundle(bundle: PublishingBundle): string[] {
  if (!bundle || !Array.isArray(bundle.files)) {
    return ["Kein Publishing-Bundle vorhanden."];
  }
  const out: string[] = [];
  const count = bundle.files.length;
  out.push(
    `Publishing-Bundle: ${count} Datei(en), ` +
      `${formatBytes(bundle.totalSizeBytes)} gesamt.`,
  );
  for (const file of bundle.files) {
    if (!file) continue;
    out.push(`• ${safeString(file.name) || "(unbenannt)"} [${file.kind}] — ${formatBytes(file.sizeBytes)}`);
  }
  return out;
}
