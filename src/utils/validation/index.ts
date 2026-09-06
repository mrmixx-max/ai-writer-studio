// Input-Validation: Produktionssicherheit gegen XSS, Injection, Path Traversal.
// Validiert User-Inputs (Prompts, Dateinamen, Projektnamen) vor der Verarbeitung.

/** Maximal erlaubte Länge für verschiedene Input-Typen */
export const LIMITS = {
  PROMPT_MAX_CHARS: 100_000,
  TITLE_MAX_CHARS: 500,
  FILENAME_MAX_CHARS: 255,
  PROJECT_NAME_MAX_CHARS: 200,
  KEYWORD_MAX_CHARS: 50,
  KEYWORDS_MAX_COUNT: 7,
} as const;

/** Fehlerhafte Zeichen in Dateinamen (Windows + Linux) */
const INVALID_FILENAME_CHARS = /[<>:"\\/|?*]/;

/** Prüft auf Kontrollzeichen (0x00-0x1f) */
function hasControlChars(s: string): boolean {
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code <= 0x1f) return true;
  }
  return false;
}

/** Pfad-Traversal-Muster */
const PATH_TRAVERSAL = /^\.\.|\/\.\.\//;

/** Einfache XSS-Muster */
const XSS_PATTERNS = [
  /<script\b[^>]*>/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /data:text\/html/i,
];

/**
 * Validiert einen LLM-Prompt.
 * - Nicht leer
 * - Maximal LENGTH Zeichen
 * - Kein Path Traversal
 * @throws Error bei ungültigem Input
 */
export function validatePrompt(prompt: string): string {
  if (!prompt || !prompt.trim()) {
    throw new Error("Prompt darf nicht leer sein");
  }
  if (prompt.length > LIMITS.PROMPT_MAX_CHARS) {
    throw new Error(
      `Prompt zu lang: ${prompt.length} > ${LIMITS.PROMPT_MAX_CHARS} Zeichen`,
    );
  }
  if (PATH_TRAVERSAL.test(prompt)) {
    throw new Error("Prompt enthält ungültige Pfad-Sequenzen");
  }
  return prompt.trim();
}

/**
 * Validiert einen Dateinamen.
 * - Keine illegalen Zeichen
 * - Kein Pfad-Traversal
 * - Nicht leer, nicht nur Punkte
 * @throws Error bei ungültigem Dateinamen
 */
export function validateFilename(name: string): string {
  if (!name || !name.trim()) {
    throw new Error("Dateiname darf nicht leer sein");
  }
  const trimmed = name.trim();
  if (/^\.+$/.test(trimmed)) {
    throw new Error("Dateiname darf nicht nur aus Punkten bestehen");
  }
  if (PATH_TRAVERSAL.test(trimmed)) {
    throw new Error("Dateiname enthält Pfad-Traversal-Sequenzen");
  }
  if (hasControlChars(trimmed)) {
    throw new Error("Dateiname enthält Kontrollzeichen");
  }
  if (INVALID_FILENAME_CHARS.test(trimmed)) {
    throw new Error(
      `Dateiname enthält ungültige Zeichen: ${trimmed.replace(INVALID_FILENAME_CHARS, (m) => `[${m}]`)}`,
    );
  }
  if (trimmed.length > LIMITS.FILENAME_MAX_CHARS) {
    throw new Error(
      `Dateiname zu lang: ${trimmed.length} > ${LIMITS.FILENAME_MAX_CHARS}`,
    );
  }
  return trimmed;
}

/**
 * Validiert einen Projektnamen.
 * @throws Error bei ungültigem Namen
 */
export function validateProjectName(name: string): string {
  if (!name || !name.trim()) {
    throw new Error("Projektname darf nicht leer sein");
  }
  const trimmed = name.trim();
  if (trimmed.length > LIMITS.PROJECT_NAME_MAX_CHARS) {
    throw new Error(
      `Projektname zu lang: ${trimmed.length} > ${LIMITS.PROJECT_NAME_MAX_CHARS}`,
    );
  }
  if (PATH_TRAVERSAL.test(trimmed)) {
    throw new Error("Projektname enthält ungültige Pfad-Sequenzen");
  }
  return trimmed;
}

/**
 * Bereinigt Markdown-Inhalte vor dem Rendering.
 * Entfernt potenziell gefährliche HTML-Tags.
 */
export function sanitizeMarkdown(content: string): string {
  // Entfernt script-Tags und Event-Handler
  return content
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "");
}

/**
 * Validiert eine Liste von KDP-Keywords.
 * - Max 7 Keywords
 * - Jedes max 50 Zeichen
 * - Keine Duplikate
 */
export function validateKeywords(keywords: string[]): string[] {
  const cleaned = keywords
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  if (cleaned.length > LIMITS.KEYWORDS_MAX_COUNT) {
    throw new Error(
      `Zu viele Keywords: ${cleaned.length} > ${LIMITS.KEYWORDS_MAX_COUNT}`,
    );
  }
  cleaned.forEach((k) => {
    if (k.length > LIMITS.KEYWORD_MAX_CHARS) {
      throw new Error(
        `Keyword zu lang: "${k.slice(0, 20)}..." (${k.length} > ${LIMITS.KEYWORD_MAX_CHARS})`,
      );
    }
  });
  const unique = [...new Set(cleaned.map((k) => k.toLowerCase()))];
  return unique.map((k) => cleaned.find((c) => c.toLowerCase() === k) ?? k);
}

/**
 * Prüft, ob ein Text XSS-Potenzial enthält.
 * true = verdächtig, false = ok
 */
export function containsXSS(text: string): boolean {
  return XSS_PATTERNS.some((pattern) => pattern.test(text));
}
