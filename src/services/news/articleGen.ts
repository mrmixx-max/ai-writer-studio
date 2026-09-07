// Sprint 16, Agent 2: Artikel-Generator (NEUE Datei).
//
// Generiert Zeitungsartikel aus Suchergebnissen ueber eine injizierbare
// Complete-Funktion (Dependency Injection, kein Provider-Import).
// Muster: src/services/prompts/templates.ts (CompleteFn / runTemplateTask)
// + kompakte Ollama-Prompts (kurz, ASCII, Deutsch).
//
// Ablauf: generateArticle(searchResults, style?, complete)
//   1. Prompt aus Suchergebnissen bauen (buildArticlePrompt, pure).
//   2. An `complete` delegieren (einzige Stelle mit Aussenwirkung).
//   3. Antwort parsen (parseArticleResponse, pure).

/** Ein einzelnes Suchergebnis als Artikel-Quelle. */
export interface SearchResult {
  title: string;
  /** Kurztext / Snippet des Treffers (optional, eines von beiden reicht). */
  snippet?: string;
  text?: string;
  url?: string;
  source?: string;
}

/** Erzaehlstil des Artikels. */
export type ArticleStyle = "neutral" | "sensational" | "analytical";

/** Alle unterstuetzten Stile. */
export const ARTICLE_STYLES: ArticleStyle[] = ["neutral", "sensational", "analytical"];

/** Injizierbare Vervollstaendigungs-Funktion (z. B. Ollama-Call des Callers). */
export type CompleteFn = (prompt: string) => Promise<string>;

/** Fertig generierter Artikel. */
export interface GeneratedArticle {
  title: string;
  body: string;
  summary: string;
  imagePrompt: string;
}

/** Maschinenlesbare Fehlerarten des Artikel-Generators. */
export type ArticleGenErrorKind = "empty" | "malformed" | "complete" | "args";

/** Typisierter Fehler des Artikel-Generators. */
export class ArticleGenError extends Error {
  readonly kind: ArticleGenErrorKind;
  readonly cause?: unknown;
  constructor(kind: ArticleGenErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = "ArticleGenError";
    this.kind = kind;
    this.cause = cause;
  }
}

/** Stil-Anweisungen (kurz, ein Satz je Stil). */
const STYLE_GUIDE: Record<ArticleStyle, string> = {
  neutral: "Stil: neutral und sachlich, neutraler Nachrichtenton, keine Wertung.",
  sensational: "Stil: Boulevard, reisserisch und emotional, starke Headline.",
  analytical: "Stil: analytisch und einordnend, Hintergruende und Zusammenhaenge.",
};

/** Antwortformat, das das Modell einhalten soll. */
const FORMAT_HINT = [
  "Antwortformat (exakt diese vier Zeilen-Marker verwenden):",
  "TITEL: <Schlagzeile>",
  "ARTIKEL: <Fliesstext, mindestens 3 Saetze>",
  "ZUSAMMENFASSUNG: <ein Satz>",
  "BILDPROMPT: <kurze Bildbeschreibung auf Englisch>",
].join("\n");

/** Lesbarer Text eines Suchergebnisses (snippet bevorzugt, dann text). */
export function resultText(r: SearchResult): string {
  return (r.snippet ?? r.text ?? "").trim();
}

/**
 * Baut den Generierungs-Prompt aus Suchergebnissen (pure, kein LLM-Call).
 * @throws ArticleGenError (kind "empty" bei leeren Ergebnissen,
 *         kind "args" bei unbekanntem Stil).
 */
export function buildArticlePrompt(
  searchResults: SearchResult[],
  style: ArticleStyle = "neutral",
): string {
  if (!Array.isArray(searchResults) || searchResults.length === 0) {
    throw new ArticleGenError("empty", "Keine Suchergebnisse: Artikel braucht mindestens eine Quelle.");
  }
  if (!(style in STYLE_GUIDE)) {
    throw new ArticleGenError("args", `Unbekannter Artikel-Stil: "${style}".`);
  }
  const sources = searchResults
    .map((r, i) => {
      const bits = [`Quelle ${i + 1}: ${r.title}`];
      const text = resultText(r);
      if (text) bits.push(text);
      const from = r.source ?? r.url;
      if (from) bits.push(`(${from})`);
      return bits.join(" ");
    })
    .join("\n");
  return [
    "Schreibe einen Zeitungsartikel aus diesen Suchergebnissen.",
    STYLE_GUIDE[style],
    "Quellen:",
    sources,
    FORMAT_HINT,
  ].join("\n");
}

/**
 * Parst eine Modell-Antwort in einen GeneratedArticle (pure).
 * Versteht JSON ({title, body, summary, imagePrompt} bzw. deutsche Keys)
 * und das Marker-Format (TITEL:/ARTIKEL:/ZUSAMMENFASSUNG:/BILDPROMPT:).
 * Fallbacks: Titel <- erste Quelle/"""Ohne Titel""", Summary <- erste
 * 200 Zeichen des Bodys, Bildprompt <- "News illustration: <Titel>".
 * Reiner Fliesstext ab 50 Zeichen wird als Body akzeptiert.
 * @throws ArticleGenError (kind "empty" bei Leerantwort,
 *         kind "malformed" ohne verwertbaren Body).
 */
export function parseArticleResponse(raw: string, fallbackTitle = ""): GeneratedArticle {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new ArticleGenError("empty", "Leere Modell-Antwort: kein Artikel ableitbar.");
  }
  // 1) JSON-Versuch (englische oder deutsche Keys).
  const asJson = tryParseJson(raw);
  if (asJson) return withFallbacks(asJson, fallbackTitle);
  // 2) Marker-Format.
  const sections = splitMarkers(raw);
  if (sections) return withFallbacks(sections, fallbackTitle);
  // 3) Reiner Fliesstext (ab 50 Zeichen als Body).
  const text = raw.trim();
  if (text.length >= 50) {
    return withFallbacks({ body: text }, fallbackTitle);
  }
  throw new ArticleGenError(
    "malformed",
    "Unverstaendliche Modell-Antwort: weder Marker-Format noch JSON noch Fliesstext.",
  );
}

/** Versucht JSON zu parsen; null wenn kein JSON oder ohne Body. */
function tryParseJson(raw: string): Partial<GeneratedArticle> | null {
  const t = raw.trim();
  if (!t.startsWith("{")) return null;
  try {
    const o = JSON.parse(t) as Record<string, unknown>;
    const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
    const out: Partial<GeneratedArticle> = {
      title: str(o.title ?? o.Titel ?? o.TITEL),
      body: str(o.body ?? o.Text ?? o.ARTIKEL ?? o.Artikel ?? o.artikel),
      summary: str(o.summary ?? o.Zusammenfassung ?? o.ZUSAMMENFASSUNG),
      imagePrompt: str(o.imagePrompt ?? o.Bildprompt ?? o.BILDPROMPT),
    };
    if (!out.body) return null;
    return out;
  } catch {
    return null;
  }
}

/** Teilt Marker-Text in Felder; null wenn kein ARTIKEL-Marker vorhanden. */
function splitMarkers(raw: string): Partial<GeneratedArticle> | null {
  const lines = raw.split("\n");
  const found: Record<string, string[]> = {};
  let current: string | null = null;
  const headRe = /^\s*(TITEL|TITLE|HEADLINE|ARTIKEL|TEXT|BODY|ZUSAMMENFASSUNG|SUMMARY|BILDPROMPT|IMAGE[_ ]?PROMPT)\s*:/i;
  for (const line of lines) {
    const m = headRe.exec(line);
    if (m) {
      current = normMarker(m[1]);
      found[current] = [line.slice(m[0].length).trim()];
    } else if (current) {
      found[current].push(line.trim());
    }
  }
  if (!found.ARTIKEL || found.ARTIKEL.join(" ").trim() === "") return null;
  const join = (k: string): string => (found[k] ?? []).join(" ").replace(/\s+/g, " ").trim();
  return {
    title: join("TITEL"),
    body: join("ARTIKEL"),
    summary: join("ZUSAMMENFASSUNG"),
    imagePrompt: join("BILDPROMPT"),
  };
}

/** Normalisiert Marker-Aliase auf die vier Kanal-Namen. */
function normMarker(m: string): string {
  const u = m.toUpperCase().replace(/[\s_]+/g, "");
  if (u === "TITLE" || u === "HEADLINE") return "TITEL";
  if (u === "TEXT" || u === "BODY") return "ARTIKEL";
  if (u === "SUMMARY") return "ZUSAMMENFASSUNG";
  if (u === "IMAGEPROMPT") return "BILDPROMPT";
  return u;
}

/** Fuellt fehlende Felder mit Fallbacks; wirft bei leerem Body. */
function withFallbacks(p: Partial<GeneratedArticle>, fallbackTitle: string): GeneratedArticle {
  const body = (p.body ?? "").trim();
  if (!body) {
    throw new ArticleGenError("malformed", "Modell-Antwort ohne Artikeltext.");
  }
  const title = (p.title ?? "").trim() || fallbackTitle || "Ohne Titel";
  const summary = (p.summary ?? "").trim() || body.slice(0, 200);
  const imagePrompt = (p.imagePrompt ?? "").trim() || `News illustration: ${title}`;
  return { title, body, summary, imagePrompt };
}

/**
 * Generiert einen Artikel aus Suchergebnissen via injizierter Complete-Funktion.
 * Einzige Stelle mit Aussenwirkung; macht selbst KEINEN Netzwerk-Call.
 */
export async function generateArticle(
  searchResults: SearchResult[],
  style: ArticleStyle = "neutral",
  complete: CompleteFn,
): Promise<GeneratedArticle> {
  if (typeof complete !== "function") {
    throw new ArticleGenError("args", "Keine Complete-Funktion uebergeben.");
  }
  const prompt = buildArticlePrompt(searchResults, style);
  const fallbackTitle = searchResults[0]?.title ?? "";
  let raw: string;
  try {
    raw = await complete(prompt);
  } catch (e) {
    throw new ArticleGenError("complete", "Complete-Funktion ist fehlgeschlagen.", e);
  }
  return parseArticleResponse(raw, fallbackTitle);
}
