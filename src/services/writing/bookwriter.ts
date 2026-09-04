// AutoBookWriter: vollautomatische Buchgenerierung via Ollama. Keine DB-Persistenz.
//
// B1 Rolling Context: Kapitel N bekommt Outline + Rolling Summaries (K1..N-1)
//    + letzten Absatz des Vorkapitels + Glossar — NICHT den Volltext aller
//    Vorkapitel. Kontextgröße bleibt dadurch konstant klein (~<4k Tokens).
// B2 Kohärenz-Glossar: Nach Kapitel 2 extrahiert ein Hilfs-Call zentrale
//    Entitäten (Personen/Fachbegriffe/Zahlen, max. 30) → outline.entities.
//    Das Glossar wächst kapitelweise (dedupliziert) und reist in jedem Prompt.
// B3 Harte Wortzahl-Steuerung: Ziel ±20% (deriveMinMax aus chapterPlan).
//    Bei Abweichung > 20% EIN gezielter Nachsteuer-Call; danach Status
//    needs_revision statt blind weiter.
// B4 Outline-Qualitätsgate: Nach generateOutline() automatischer Check
//    (Kapitelanzahl, eindeutige Titel, Summaries >= 20 Wörter, logischer
//    Bogen). Bei Verletzung EIN Reparatur-Call; danach Fehlerliste an den
//    Nutzer (manueller Eingriff).
import { OllamaProvider } from "@/services/llm/ollama";
import { countWords, deriveMinMax } from "./chapterPlan";
import { parseJsonLoose } from "./jsonExtract";
import { withRetry, isAbortError, createTimeoutController } from "./retry";

/** Schärferer Wiederholungs-Prompt bei wiederholtem JSON-Fehler (A2). */
const STRICT_JSON_SUFFIX =
  "\n\nWICHTIG: Antworte NUR mit validem JSON, kein Text davor oder danach. Keine Markdown-Codeblöcke, keine Erklärungen.";

/**
 * Sammelt alle Chunks aus dem Provider-Stream mit konfigurierbarem Timeout.
 * Bei Timeout/Abort wird der laufende Request über das kombinierte Signal
 * abgebrochen; der Aufrufer erhält einen klassifizierbaren Fehler.
 */
async function collectChat(
  provider: OllamaProvider,
  prompt: string,
  opts: { model: string; maxTokens: number; temperature: number; timeoutMs: number },
  signal?: AbortSignal,
): Promise<string> {
  const { controller, clear } = createTimeoutController(opts.timeoutMs, signal);
  const chunks: string[] = [];
  try {
    for await (const chunk of provider.chat(
      [{ role: "user", content: prompt }],
      { model: opts.model, maxTokens: opts.maxTokens, temperature: opts.temperature, timeoutMs: opts.timeoutMs },
      controller.signal,
    )) {
      chunks.push(chunk);
    }
    return chunks.join("");
  } finally {
    clear();
  }
}

/** Wirft einen sprechenden Fehler, wenn das geparste Objekt keinem Kapitel Schema entspricht. */
function validateChapterShape(chapters: unknown): void {
  if (!Array.isArray(chapters)) {
    throw new Error("Gliederung: 'chapters' ist kein Array.");
  }
  chapters.forEach((c, idx) => {
    const n = (c as { number?: unknown })?.number;
    if (typeof n !== "number" || !Number.isInteger(n)) {
      throw new Error(`Kapitel ${idx + 1}: 'number' fehlt oder ist keine ganze Zahl.`);
    }
    if (typeof (c as { title?: unknown })?.title !== "string" || !(c as { title: string }).title.trim()) {
      throw new Error(`Kapitel ${n} fehlt title`);
    }
    if (typeof (c as { summary?: unknown })?.summary !== "string" || !(c as { summary: string }).summary.trim()) {
      throw new Error(`Kapitel ${n} fehlt summary`);
    }
  });
}

// (A1) Das alte extractJson (reines Bracket-Counting) ist entfernt —
// stattdessen: parseJsonLoose aus ./jsonExtract (Parse → State-Machine → Repair).

export interface BookOutline {
  title: string;
  genre: string;
  targetAudience: string;
  chapters: { number: number; title: string; summary: string }[];
  /** INTERFACE-CHANGE: Rolling Summaries (150-250 Wörter) je Kapitel, kapitelweise befüllt. */
  chapterSummaries?: string[];
  /** INTERFACE-CHANGE: Kohärenz-Glossar (Personen/Fachbegriffe/Zahlen, max. 30 Einträge). */
  entities?: string[];
}

export interface BookChapter {
  number: number;
  title: string;
  content: string;
  /** INTERFACE-CHANGE: "needs_revision" wenn Wortzahl nach Nachsteuer weiterhin außerhalb ±20%. */
  status?: "draft" | "needs_revision";
}

export interface BookWriterConfig {
  topic: string;
  genre: string;
  targetAudience: string;
  chapterCount: number;
  model: string;
  baseUrl: string;
  language: string;
  /** INTERFACE-CHANGE: Zielwortzahl pro Kapitel (Default 1000). */
  wordsPerChapter?: number;
}

// --- B1/B3 Konstanten -------------------------------------------------------

/** Zielwortzahl pro Kapitel, wenn nichts anderes konfiguriert ist. */
export const DEFAULT_WORDS_PER_CHAPTER = 1000;
/** Toleranz gegenüber dem Zielwert in Prozent (B3). */
export const WORD_TOLERANCE_PERCENT = 20;
/** Rolling-Summary-Ziel: 150-250 Wörter (B1). */
export const SUMMARY_MIN_WORDS = 150;
export const SUMMARY_MAX_WORDS = 250;
/** Kontext-Budgets (Zeichen) für den Rolling Context (B1). */
export const OUTLINE_SUMMARY_CHARS = 120;
export const SUMMARY_CONTEXT_CHARS = 280;
export const LAST_PARAGRAPH_CHARS = 600;
/** Glossar-Obergrenze (B2). */
export const MAX_ENTITIES = 30;

/** Kürzt Text auf max. n Zeichen. */
function truncate(text: string, maxChars: number): string {
  const t = text.trim();
  return t.length > maxChars ? t.slice(0, maxChars).trimEnd() + "…" : t;
}

/** Liefert den letzten nicht-leeren Absatz eines Kapiteltexts (Übergangskontext, B1). */
export function lastParagraph(content: string): string {
  const paras = content
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);
  return paras.length > 0 ? paras[paras.length - 1] : "";
}

/**
 * Grobe Token-Schätzung: ~4 Zeichen pro Token (modellunabhängige Heuristik).
 * Dient zur Kontrolle des Kontextbudgets (Akzeptanzkriterium B1).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Zielwortzahl für Kapitel aus der Konfiguration. */
export function getTargetWords(config: Pick<BookWriterConfig, "wordsPerChapter">): number {
  return config.wordsPerChapter ?? DEFAULT_WORDS_PER_CHAPTER;
}

// --- B1: Rolling Context ----------------------------------------------------

/**
 * Baut den Rolling Context für Kapitel N:
 * (a) Outline (kompakt), (b) Summaries K1..N-1, (c) letzter Absatz des
 * Vorkapitels, (d) Kohärenz-Glossar.
 */
export function buildChapterContext(
  outline: BookOutline,
  chapterNumber: number,
  previousChapters: BookChapter[],
): string {
  const parts: string[] = [];

  // (a) Outline: Titel + gekürzte Summaries statt Volltext.
  const outlineList = outline.chapters
    .map((c) => `K${c.number}: ${c.title} — ${truncate(c.summary, OUTLINE_SUMMARY_CHARS)}`)
    .join("\n");
  parts.push(`Gliederung:\n${outlineList}`);

  if (chapterNumber > 1) {
    // (b) Rolling Summaries der Kapitel 1..N-1.
    const summaries = outline.chapterSummaries ?? [];
    const prevSummaries = summaries
      .slice(0, chapterNumber - 1)
      .map((s, i) => `K${i + 1}: ${truncate(s, SUMMARY_CONTEXT_CHARS)}`)
      .join("\n");
    if (prevSummaries) {
      parts.push(`Zusammenfassungen der bisherigen Kapitel:\n${prevSummaries}`);
    }

    // (c) Übergang: letzter Absatz des Vorkapitels.
    const prev = previousChapters.find((c) => c.number === chapterNumber - 1)
      ?? previousChapters[previousChapters.length - 1];
    if (prev) {
      const lastPara = truncate(lastParagraph(prev.content), LAST_PARAGRAPH_CHARS);
      if (lastPara) {
        parts.push(
          `Letzter Absatz von Kapitel ${chapterNumber - 1} (greife im Übergang darauf auf):\n${lastPara}`,
        );
      }
    }
  }

  // (d) Kohärenz-Glossar (B2) — verhindert Namensdrift.
  if (outline.entities && outline.entities.length > 0) {
    parts.push(
      "Kohärenz-Glossar (Personen, Fachbegriffe, Zahlenangaben). WICHTIG: Verwende EXAKT diese Bezeichnungen — keine Namensabweichungen:\n- " +
        outline.entities.join("\n- "),
    );
  }

  return parts.join("\n\n");
}

/**
 * Rolling Summary nach einem Kapitel: eigener LLM-Call (max_tokens 400),
 * Ziel 150-250 Wörter. Ergebnis landet in outline.chapterSummaries[].
 */
export async function summarizeChapter(
  config: BookWriterConfig,
  chapterTitle: string,
  content: string,
  signal?: AbortSignal,
): Promise<string> {
  const provider = new OllamaProvider(config.baseUrl);
  const prompt = `Erstelle eine Zusammenfassung des Kapitels "${chapterTitle}" aus dem Buch "${config.topic}".
Umfang: 150-250 Wörter. Sprache: ${config.language}. Erfasse Kernaussagen, zentrale Personen/Fachbegriffe und Ergebnisse.

Kapiteltext:
${truncate(content, 8000)}

Antworte NUR mit dem Zusammenfassungstext.`;

  const chunks: string[] = [];
  for await (const chunk of provider.chat(
    [{ role: "user", content: prompt }],
    { model: config.model, maxTokens: 400, temperature: 0.3, timeoutMs: 120000 },
    signal,
  )) {
    chunks.push(chunk);
  }
  return chunks.join("").trim();
}

// --- B2: Kohärenz-Glossar ---------------------------------------------------

/**
 * Extrahiert zentrale Entitäten (Personen, Fachbegriffe, Zahlenangaben)
 * aus den bislang generierten Kapiteln. Max. 30 Einträge.
 */
export async function extractEntities(
  config: BookWriterConfig,
  contents: string[],
  signal?: AbortSignal,
): Promise<string[]> {
  const provider = new OllamaProvider(config.baseUrl);
  const prompt = `Analysiere die folgenden Kapitel und extrahiere die zentralen Entitäten:
- Personen (Namen, Titel)
- Fachbegriffe
- Wichtige Zahlenangaben

Regeln: Maximal 30 Einträge. Jeder Eintrag ist eine kurze Bezeichnung (z.B. "Dr. Weber", "Quantencomputer", "1989"). Sprache: ${config.language}.

Antworte NUR als JSON-Objekt: {"entities": ["...", "..."]}

Kapiteltexte:
${contents.map((c, i) => `--- Kapitel ${i + 1} ---\n${truncate(c, 4000)}`).join("\n")}`;

  const chunks: string[] = [];
  for await (const chunk of provider.chat(
    [{ role: "user", content: prompt }],
    { model: config.model, maxTokens: 400, temperature: 0.2, timeoutMs: 120000 },
    signal,
  )) {
    chunks.push(chunk);
  }

  const raw = chunks.join("");
  const parsed = parseJsonLoose<{ entities?: unknown }>(raw, "Glossar-Extraktion");
  if (!Array.isArray(parsed.entities)) return [];
  return parsed.entities.filter((e): e is string => typeof e === "string");
}

/**
 * Fügt neue Entitäten ins Glossar ein: dedupliziert (case-insensitive),
 * kürzt Leerraum, cap auf MAX_ENTITIES.
 */
export function mergeEntities(existing: string[], extracted: string[], max = MAX_ENTITIES): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const push = (raw: string) => {
    const entity = raw.replace(/\s+/g, " ").trim();
    if (!entity) return;
    const key = entity.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(entity);
  };
  for (const e of existing) push(e);
  for (const e of extracted) push(e);
  return result.slice(0, max);
}

// --- B3: Harte Wortzahl-Steuerung -------------------------------------------

export interface WordCountEvaluation {
  wordCount: number;
  target: number;
  min: number;
  max: number;
  withinRange: boolean;
  deviationPercent: number;
}

/** Prüft die Wortzahl gegen Ziel ±20%. */
export function evaluateWordCount(content: string, target: number): WordCountEvaluation {
  const { min, max } = deriveMinMax(target, WORD_TOLERANCE_PERCENT);
  const wordCount = countWords(content);
  const deviationPercent = Math.round((Math.abs(wordCount - target) / target) * 100);
  return {
    wordCount,
    target,
    min,
    max,
    withinRange: wordCount >= min && wordCount <= max,
    deviationPercent,
  };
}

/**
 * EIN gezielter Nachsteuer-Call: zu kurz → Ergänzung (angehängt),
 * zu lang → Kürzung (ersetzt). Gibt den korrigierten Kapiteltext zurück.
 */
async function adjustChapterWordCount(
  config: BookWriterConfig,
  outline: BookOutline,
  chapterTitle: string,
  content: string,
  evaluation: WordCountEvaluation,
  signal?: AbortSignal,
): Promise<string> {
  const provider = new OllamaProvider(config.baseUrl);
  const { wordCount, min, max } = evaluation;

  const prompt = wordCount < min
    ? `Das Kapitel "${chapterTitle}" aus "${outline.title}" ist zu kurz: ${wordCount} Wörter (Ziel: ${evaluation.target}, Minimum: ${min}).
Ergänze den Kapiteltext um ca. ${evaluation.target - wordCount} Wörter. Füge substanzielle inhaltliche Ergänzungen hinzu — kein Fülltext.

Genre: ${outline.genre} | Sprache: ${config.language}

Bisheriges Kapitel (Ende):
${truncate(content.slice(-1500), 1500)}

Antworte NUR mit dem neuen Text, der an das Kapitel angehängt wird. Keine Überschriften.`
    : `Das Kapitel "${chapterTitle}" aus "${outline.title}" ist zu lang: ${wordCount} Wörter (Ziel: ${evaluation.target}, Maximum: ${max}).
Kürze das Kapitel auf ca. ${evaluation.target} Wörter. Entferne Redundanzen und Fülltext, behalte die Kernaussagen.

Genre: ${outline.genre} | Sprache: ${config.language}

Kapiteltext:
${truncate(content, 8000)}

Antworte NUR mit dem vollständigen gekürzten Kapiteltext. Keine Überschriften.`;

  const chunks: string[] = [];
  for await (const chunk of provider.chat(
    [{ role: "user", content: prompt }],
    { model: config.model, maxTokens: 8192, temperature: 0.6, timeoutMs: 180000 },
    signal,
  )) {
    chunks.push(chunk);
  }

  const adjustment = chunks.join("").trim();
  if (!adjustment) return content;
  return wordCount < min
    ? content + "\n\n" + adjustment
    : adjustment;
}

// --- B4: Outline-Qualitätsgate ---------------------------------------------

/** Titel, die als Fazit/Schluss interpretiert werden (max. 1 erlaubt, nie Kapitel 1). */
const CONCLUSION_TITLE_PATTERN = /fazit|zusammenfassung|schluss|conclusion|abschluss|resümee|resumee/i;

/**
 * Prüft die Gliederung: Kapitelanzahl, fortlaufende Nummern, eindeutige
 * Titel, Summaries >= 20 Wörter, logischer Bogen (Kapitel 1 kein Fazit,
 * höchstens ein Fazit). Gibt Liste von Fehlern zurück (leer = valide).
 */
export function validateOutline(
  outline: BookOutline,
  config?: Pick<BookWriterConfig, "chapterCount">,
): string[] {
  const errors: string[] = [];

  if (config && outline.chapters.length !== config.chapterCount) {
    errors.push(
      `Kapitelanzahl falsch: ${outline.chapters.length} statt ${config.chapterCount}.`,
    );
  }

  const seenNumbers = new Set<number>();
  for (const c of outline.chapters) {
    const n = Number(c.number);
    if (!Number.isInteger(n) || n < 1 || n > outline.chapters.length || seenNumbers.has(n)) {
      errors.push(`Kapitelnummer ungültig oder doppelt: ${String(c.number)}.`);
    } else {
      seenNumbers.add(n);
    }
  }

  const seenTitles = new Set<string>();
  for (const c of outline.chapters) {
    const key = (c.title ?? "").trim().toLowerCase();
    if (!key) {
      errors.push(`Kapitel ${String(c.number)} hat keinen Titel.`);
    } else if (seenTitles.has(key)) {
      errors.push(`Doppelter Kapiteltitel: "${c.title}".`);
    } else {
      seenTitles.add(key);
    }
  }

  for (const c of outline.chapters) {
    const words = countWords(c.summary ?? "");
    if (words < 20) {
      errors.push(
        `Zusammenfassung von Kapitel ${String(c.number)} hat nur ${words} Wörter (mindestens 20 erforderlich).`,
      );
    }
  }

  // Logischer Bogen: Kapitel 1 ist keine Schlussbetrachtung, höchstens ein Fazit.
  const conclusionChapters = outline.chapters.filter((c) =>
    CONCLUSION_TITLE_PATTERN.test(c.title ?? ""),
  );
  if (outline.chapters.length > 0 && CONCLUSION_TITLE_PATTERN.test(outline.chapters[0].title ?? "")) {
    errors.push(
      `Logischer Bogen: Kapitel 1 ("${outline.chapters[0].title}") ist bereits ein Fazit — Einleitung fehlt.`,
    );
  }
  if (conclusionChapters.length > 1) {
    errors.push(
      `Logischer Bogen: ${conclusionChapters.length} Fazit-Kapitel (${conclusionChapters
        .map((c) => `"${c.title}"`)
        .join(", ")}) — höchstens eines erlaubt.`,
    );
  }

  return errors;
}

/**
 * EIN gezielter Reparatur-Call für eine fehlerhafte Gliederung.
 * Wirft eine Fehlerliste, wenn die Antwort nicht parsebar ist — dann ist
 * manueller Eingriff durch den Nutzer erforderlich.
 */
async function repairOutline(
  config: BookWriterConfig,
  outline: BookOutline,
  issues: string[],
  signal?: AbortSignal,
): Promise<BookOutline> {
  const provider = new OllamaProvider(config.baseUrl);
  const prompt = `Repariere die folgende fehlerhafte Gliederung für ein Buch.

Gefundene Fehler:
${issues.map((i) => `- ${i}`).join("\n")}

Vorgaben:
- Thema: ${config.topic} | Genre: ${config.genre} | Zielgruppe: ${config.targetAudience}
- Genau ${config.chapterCount} Kapitel, fortlaufend nummeriert (1..${config.chapterCount})
- Jeder Kapiteltitel eindeutig
- Jede Zusammenfassung mindestens 20 Wörter
- Logischer Bogen: Kapitel 1 führt ein, höchstens ein Fazit-Kapitel am Ende
- Sprache: ${config.language}

Fehlerhafte Gliederung:
${JSON.stringify(outline)}

Antworte NUR als korrigiertes JSON-Objekt:
{"title": "Titel", "genre": "${config.genre}", "targetAudience": "${config.targetAudience}", "chapters": [{"number": 1, "title": "...", "summary": "..."}]}`;

  const chunks: string[] = [];
  for await (const chunk of provider.chat(
    [{ role: "user", content: prompt }],
    { model: config.model, maxTokens: 4096, temperature: 0.5, timeoutMs: 120000 },
    signal,
  )) {
    chunks.push(chunk);
  }

  const parsed = parseJsonLoose<BookOutline>(chunks.join(""), "Gliederungs-Reparatur");
  validateChapterShape(parsed.chapters);
  return parsed;
}

// --- Kernfunktionen ----------------------------------------------------------

export async function generateOutline(
  config: BookWriterConfig,
  signal?: AbortSignal,
  timeoutMs = 120000,
): Promise<BookOutline> {
  const provider = new OllamaProvider(config.baseUrl);
  const basePrompt = `Erstelle eine detaillierte Gliederung für ein Buch:
- Thema: ${config.topic}
- Genre: ${config.genre}
- Zielgruppe: ${config.targetAudience}
- Kapitel: ${config.chapterCount}
- Sprache: ${config.language}

Vorgaben: Jeder Kapiteltitel ist eindeutig, jede Zusammenfassung hat mindestens 20 Wörter. Kapitel 1 führt ein, höchstens ein Fazit-Kapitel am Ende.

Antwitte NUR als JSON-Objekt:
{"title": "Titel", "genre": "${config.genre}", "targetAudience": "${config.targetAudience}", "chapters": [{"number": 1, "title": "...", "summary": "..."}]}`;

  // A2: bis zu 3 Versuche; bei wiederholtem JSON-Fehler schärferer Prompt.
  const raw = await withRetry(
    async (_attempt, isJsonRetry) => {
      const prompt = isJsonRetry ? basePrompt + STRICT_JSON_SUFFIX : basePrompt;
      const text = await collectChat(
        provider,
        prompt,
        { model: config.model, maxTokens: 4096, temperature: 0.8, timeoutMs },
        signal,
      );
      // A1: zweistufige Extraktion (Parse → Bracket-State-Machine → Repair)
      const outline = parseJsonLoose<BookOutline>(text, "Gliederung");
      // A1: Schema-Validierung mit sprechenden Fehlern
      validateChapterShape(outline.chapters);
      return outline;
    },
    signal,
  );

  let outline = raw;

  // B4: Outline-Qualitätsgate — Validierung, EIN Reparatur-Call, sonst Fehler an den Nutzer.
  let issues = validateOutline(outline, config);
  if (issues.length > 0) {
    outline = await repairOutline(config, outline, issues, signal);
    issues = validateOutline(outline, config);
    if (issues.length > 0) {
      throw new Error(
        "Gliederung weiterhin fehlerhaft nach Reparaturversuch — manueller Eingriff erforderlich:\n- " +
          issues.join("\n- "),
      );
    }
  }
  return outline;
}

/**
 * Generiert Kapitel N mit Rolling Context (B1) und harter Wortzahl-Steuerung (B3).
 *
 * Kontext: Outline (kompakt), Summaries K1..N-1, letzter Absatz des
 * Vorkapitels, Glossar — statt Volltext aller Vorkapitel.
 */
export async function generateChapter(
  config: BookWriterConfig,
  outline: BookOutline,
  chapterNumber: number,
  previousChapters: BookChapter[],
  signal?: AbortSignal,
): Promise<BookChapter> {
  const provider = new OllamaProvider(config.baseUrl);
  const chapter = outline.chapters.find((c) => Number(c.number) === chapterNumber)
    ?? outline.chapters[chapterNumber - 1];
  if (!chapter) throw new Error(`Kapitel ${chapterNumber} nicht gefunden`);

  const targetWords = getTargetWords(config);
  const { min } = deriveMinMax(targetWords, WORD_TOLERANCE_PERCENT);

  const context = buildChapterContext(outline, chapterNumber, previousChapters);

  const prompt = `Schreibe Kapitel ${chapterNumber} von "${outline.title}".
Genre: ${outline.genre} | Zielgruppe: ${outline.targetAudience} | Sprache: ${config.language}

${context}

Kapitel-${chapterNumber}-Details: ${chapter.summary}

Schreibe nur den Kapiteltext (ca. ${targetWords} Wörter, mindestens ${min} Wörter). Keine Überschriften. WICHTIG: Nutze Absätze — füge zwischen Textblöcken eine Leerzeile ein (doppelter Zeilenumbruch).`;

  const chunks: string[] = [];
  for await (const chunk of provider.chat(
    [{ role: "user", content: prompt }],
    { model: config.model, maxTokens: 8192, temperature: 0.7, timeoutMs: 180000 },
    signal,
  )) {
    chunks.push(chunk);
  }

  let content = chunks.join("");

  // B3: Harte Wortzahl-Steuerung — bei Abweichung > 20% EIN Nachsteuer-Call.
  let evaluation = evaluateWordCount(content, targetWords);
  if (!evaluation.withinRange) {
    const adjusted = await adjustChapterWordCount(
      config, outline, chapter.title, content, evaluation, signal,
    );
    content = adjusted;
    evaluation = evaluateWordCount(content, targetWords);
  }

  const status: BookChapter["status"] = evaluation.withinRange ? "draft" : "needs_revision";
  return { number: chapterNumber, title: chapter.title, content, status };
}

export async function generateBook(
  config: BookWriterConfig,
  onProgress: (current: number, total: number, chapter: BookChapter | null) => void,
  signal?: AbortSignal,
): Promise<{ outline: BookOutline; chapters: BookChapter[] }> {
  try {
    const outline = await generateOutline(config, signal);
    outline.chapterSummaries = [];
    const chapters: BookChapter[] = [];

    for (let i = 1; i <= outline.chapters.length; i++) {
      if (signal?.aborted) break;
      onProgress(i, outline.chapters.length, null);
      let chapter: BookChapter;
      try {
        chapter = await generateChapter(config, outline, i, chapters, signal);
      } catch (e: unknown) {
        // A3: Abbruch → Status des laufenden Kapitels sauber zurücksetzen,
        // kein Ghost-State ("generating" hängen lassen).
        if (isAbortError(e)) {
          onProgress(i, outline.chapters.length, null);
          break;
        }
        throw e;
      }
      chapters.push(chapter);

      // B1: Rolling Summary nach jedem Kapitel (eigener Call, max_tokens 400).
      const summary = await summarizeChapter(config, chapter.title, chapter.content, signal);
      outline.chapterSummaries.push(summary);

      // B2: Glossar wächst kapitelweise — Initial-Extraktion nach Kapitel 2,
      // danach je Kapitel aus dem neuen Text (mergeEntities dedupliziert).
      if (i >= 2) {
        const source = i === 2
          ? chapters.map((c) => c.content)
          : [chapter.content];
        const extracted = await extractEntities(config, source, signal);
        outline.entities = mergeEntities(outline.entities ?? [], extracted);
      }

      onProgress(i, outline.chapters.length, chapter);
    }

    return { outline, chapters };
  } catch (e: unknown) {
    if (isAbortError(e)) {
      // A3: Abort ist kein Fehler — Aufrufer bekommt ein leeres Teilergebnis.
      return { outline: { title: "", genre: config.genre, targetAudience: config.targetAudience, chapters: [] }, chapters: [] };
    }
    throw e;
  }
}