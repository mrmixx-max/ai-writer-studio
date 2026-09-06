// Input-Validation: Produktionssicherheit gegen XSS, Injection, Path Traversal.
// Validiert User-Inputs (Prompts, Dateinamen, Projektnamen) vor der Verarbeitung.
// Agent1-Härtung (Sprint 8): allowlist-basierter HTML-Sanitizer ohne Dependencies,
// kodierte Traversal-Erkennung, Windows-reservierte Namen, Secret-Redaction für Logs.

/** Maximal erlaubte Länge für verschiedene Input-Typen */
export const LIMITS = {
  PROMPT_MAX_CHARS: 100_000,
  TITLE_MAX_CHARS: 500,
  FILENAME_MAX_CHARS: 255,
  PROJECT_NAME_MAX_CHARS: 200,
  KEYWORD_MAX_CHARS: 50,
  KEYWORDS_MAX_COUNT: 7,
  /** Harte Obergrenze für sanitizierten HTML-Output (DoS-Begrenzung) */
  SANITIZED_HTML_MAX_CHARS: 200_000,
} as const;

/** Fehlerhafte Zeichen in Dateinamen (Windows + Linux) */
const INVALID_FILENAME_CHARS = /[<>:"/|?*\\]/;

/** Windows-reservierte Gerätenamen (Stamm ohne Extension, case-insensitiv) */
const WINDOWS_RESERVED = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
]);

/** Prüft auf Kontrollzeichen (0x00-0x1f, inkl. Null-Byte) */
function hasControlChars(s: string): boolean {
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code <= 0x1f) return true;
  }
  return false;
}

/** Legacy: einfaches Pfad-Traversal-Muster (für validatePrompt-Kompatibilität) */
const PATH_TRAVERSAL = /^\.\.|\/\.\.\//;

/**
 * Erkennt Pfad-Traversal robust: plain, backslash, absolut, kodiert.
 * - `..`-Segmente an / oder \ gebunden (kein False-Positive auf "..." in Prosa)
 * - URL-kodiert (%2e, %2f, %c0%af-Overlong, doppelt-kodiert %25)
 * - absolute Pfade (/etc/…, C:\…, C:/…) und Null-Bytes
 * - UNC-Pfade (\\server\share)
 */
export function detectPathTraversal(input: string): boolean {
  if (!input) return false;
  if (input.includes("\0")) return true;

  // Dekodieren (max. 2 Runden gegen Doppelkodierung); Fehler → Original nutzen
  let decoded = input;
  for (let i = 0; i < 2; i++) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
    if (decoded.includes("\0")) return true;
  }
  // Overlong-UTF8 kodierter Slash (%c0%af) überlebt decodeURIComponent
  const low = ` ${input} ${decoded} `.toLowerCase();
  if (low.includes("%c0%af") || low.includes("%c1%9c")) return true;

  const norm = decoded.replace(/\\/g, "/");

  // UNC (//server/…) oder absoluter POSIX-Pfad
  if (norm.startsWith("//") || (norm.startsWith("/") && norm.length > 1)) return true;
  // Windows absolut: C:/…, C:\… (bereits normalisiert)
  if (/^[a-zA-Z]:\//.test(norm)) return true;
  // Windows-Laufwerk relativ mit Traversal: C:..\…
  if (/^[a-zA-Z]:\.\./.test(norm)) return true;

  // `..` als Pfadsegment (an / gebunden)
  const segments = norm.split("/");
  if (segments.some((seg) => seg === ".." || seg === "...")) return true;

  // Verbleibende kodierte Dots/Slashes nach Decode-Versuch (z. B. %2e bei fehlerhaftem Encoding)
  if (/%2e/i.test(decoded) && /\.\.|\/%2e|%2e\//i.test(decoded)) return true;

  return false;
}

/** Einfache XSS-Muster (Detektion, nicht Sanitization) */
const XSS_PATTERNS = [
  /<script\b[^>]*>/i,
  /<(iframe|object|embed|frame|frameset|svg|math|form|style|link|meta|base|applet|bgsound)\b[^>]*>/i,
  /javascript:/i,
  /vbscript:/i,
  /on\w+\s*=/i,
  /data:text\/html/i,
];

/** Tags, deren kompletter Inhalt entfernt wird (inkl. verschachtelt, begrenzte Tiefe) */
const STRIP_WITH_CONTENT = ["script", "style", "iframe", "object", "frame", "frameset", "applet", "bgsound", "noembed", "noframes", "noscript"];

/** Tags, bei denen nur die Tags entfernt und der Text behalten wird */
const STRIP_TAG_ONLY = new Set([
  "svg", "math", "form", "embed", "link", "meta", "base",
  "animate", "animatetransform", "set", "circle", "path", "rect", "use", "foreignobject",
]);

/** Allowlist: Tags, die im Output überleben dürfen */
const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "h1", "h2", "h3", "h4",
  "blockquote", "ul", "ol", "li",
  "strong", "em", "b", "i", "u", "s",
  "code", "pre", "a", "span", "div",
  "table", "thead", "tbody", "tr", "td", "th",
]);

/** Sichere URL-Schemes für href */
function isSafeHref(href: string): boolean {
  const h = href.trim().toLowerCase();
  if (!h || h.startsWith("#")) return true;
  if (h.startsWith("http://") || h.startsWith("https://") || h.startsWith("mailto:")) return true;
  // Relative URLs ohne gefährliche Schemes
  if (/^(javascript|vbscript|data|file|blob):/i.test(h)) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(h)) return false;
  return true;
}

/**
 * Allowlist-basierter HTML-Sanitizer (dependency-frei).
 * - Entfernt script/iframe/object/style & Co. inkl. Inhalt
 * - Entfernt svg/math/form/embed/link/meta/base-Tags (Text bleibt)
 * - Entfernt alle Event-Handler (quoted/unquoted), style-Attribute, gefährliche URLs
 * - Lässt nur ALLOWED_TAGS stehen; <a href> nur mit sicherem Scheme
 * - Output auf SANITIZED_HTML_MAX_CHARS begrenzt (DoS-Schutz)
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return "";
  let html = dirty.length > LIMITS.SANITIZED_HTML_MAX_CHARS * 2
    ? dirty.slice(0, LIMITS.SANITIZED_HTML_MAX_CHARS * 2)
    : dirty;

  // 1. Elemente mit Inhalt entfernen (begrenzte Iterationen gegen Verschachtelung)
  for (const tag of STRIP_WITH_CONTENT) {
    const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi");
    for (let i = 0; i < 5 && re.test(html); i++) {
      html = html.replace(re, "");
      re.lastIndex = 0;
    }
    // Verwaiste Öffnungs-Tags ohne Close
    html = html.replace(new RegExp(`<${tag}\\b[^>]*>`, "gi"), "");
  }

  // 2. Event-Handler entfernen (quoted, single-quoted, unquoted)
  html = html.replace(/\s+on\w+\s*=\s*"[^"]*"/gi, "");
  html = html.replace(/\s+on\w+\s*=\s*'[^']*'/gi, "");
  html = html.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, "");

  // 3. Gefährliche URL-Schemes neutralisieren (auch mit Whitespace-Tarnung)
  html = html.replace(/javascript\s*:/gi, "#blocked:");
  html = html.replace(/vbscript\s*:/gi, "#blocked:");
  html = html.replace(/data\s*:\s*text\/html/gi, "#blocked:");

  // 4. Tag-Allowlist durchsetzen, Attribute filtern
  html = html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (full, rawTag: string, rawAttrs: string) => {
    const tag = rawTag.toLowerCase();
    const isClose = full.startsWith("</");
    if (STRIP_TAG_ONLY.has(tag)) return "";
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (isClose) return `</${tag}>`;
    // Void-Elemente
    if (tag === "br" || tag === "hr") return `<${tag}>`;
    // Nur <a href="…"> darf ein Attribut behalten
    if (tag === "a") {
      const m = rawAttrs.match(/\bhref\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i);
      if (m) {
        const href = m[1].replace(/^["']|["']$/g, "");
        if (isSafeHref(href)) {
          const escaped = href.replace(/"/g, "&quot;");
          return `<a href="${escaped}">`;
        }
      }
      return "<a>";
    }
    return `<${tag}>`;
  });

  // 5. Längen-Cap (DoS-Schutz)
  if (html.length > LIMITS.SANITIZED_HTML_MAX_CHARS) {
    html = html.slice(0, LIMITS.SANITIZED_HTML_MAX_CHARS);
  }
  return html;
}

/**
 * Bereinigt Markdown-Inhalte vor dem Rendering.
 * - Neutralisiert Markdown-Links mit gefährlichen Schemes (javascript:/vbscript:/data:text/html)
 * - Delegiert eingebettetes HTML an sanitizeHtml
 */
export function sanitizeMarkdown(content: string): string {
  if (!content) return "";
  const noEvilLinks = content.replace(
    /\[([^\]]*)\]\(\s*(javascript|vbscript|data\s*:\s*text\/html)[^)]*\)/gi,
    "$1",
  );
  return sanitizeHtml(noEvilLinks);
}

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
  if (PATH_TRAVERSAL.test(prompt) || detectPathTraversal(prompt)) {
    throw new Error("Prompt enthält ungültige Pfad-Sequenzen");
  }
  return prompt.trim();
}

/** Prüft Windows-reservierte Namen (Stamm ohne Extension) */
function assertNotReserved(name: string): void {
  const stem = name.split(".")[0].toUpperCase();
  if (WINDOWS_RESERVED.has(stem)) {
    throw new Error(`Dateiname verwendet reservierten Systemnamen: ${name}`);
  }
}

/**
 * Validiert einen Dateinamen.
 * - Keine illegalen Zeichen
 * - Kein Pfad-Traversal (plain, kodiert, absolut)
 * - Keine Windows-reservierten Namen
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
  if (PATH_TRAVERSAL.test(trimmed) || detectPathTraversal(trimmed)) {
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
  assertNotReserved(trimmed);
  if (trimmed.length > LIMITS.FILENAME_MAX_CHARS) {
    throw new Error(
      `Dateiname zu lang: ${trimmed.length} > ${LIMITS.FILENAME_MAX_CHARS}`,
    );
  }
  // Hinterhältige Ränder: kein führender Punkt+Slash-Rest, kein abschließender Punkt/Space (Windows)
  if (/[. ]$/.test(trimmed)) {
    throw new Error("Dateiname darf nicht mit Punkt oder Leerzeichen enden");
  }
  return trimmed;
}

/**
 * Macht einen Dateinamen sicher (nicht-validierend, für Downloads/UI).
 * Ersetzt illegale Zeichen durch "_", schneidet Traversal und Länge ab.
 */
export function sanitizeFilename(name: string, fallback = "dokument.md"): string {
  try {
    return validateFilename(name);
  } catch {
    const cleaned = (name || "")
      .replace(/\0/g, "")
      .replace(/\.\.+/g, "_")
      .replace(INVALID_FILENAME_CHARS, "_")
      .split("")
      .filter((ch) => ch.charCodeAt(0) >= 0x20)
      .join("")
      .replace(/[. ]+$/, "")
      .trim()
      .slice(0, LIMITS.FILENAME_MAX_CHARS);
    if (!cleaned || /^\.+$/.test(cleaned)) return fallback;
    try {
      assertNotReserved(cleaned);
      return cleaned;
    } catch {
      return `_${cleaned}`;
    }
  }
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
  if (PATH_TRAVERSAL.test(trimmed) || detectPathTraversal(trimmed)) {
    throw new Error("Projektname enthält ungültige Pfad-Sequenzen");
  }
  return trimmed;
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

const SECRET_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /sk-or-v1-[A-Za-z0-9\-_]{8,}/g, label: "openrouter-key" },
  { re: /sk-[A-Za-z0-9\-_]{8,}/g, label: "api-key" },
  { re: /ghp_[A-Za-z0-9]{8,}/g, label: "github-token" },
  { re: /gho_[A-Za-z0-9]{8,}/g, label: "github-token" },
  { re: /xox[bpas]-[A-Za-z0-9-]{8,}/g, label: "slack-token" },
  { re: /Bearer\s+[A-Za-z0-9._\-~+/=]{8,}/g, label: "bearer-token" },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, label: "private-key" },
];

/**
 * Maskiert Secrets in Log-/Fehlertexten (Credential-Leak-Prevention).
 * Ersetzt API-Keys, Bearer-Tokens, Private Keys durch [REDACTED:<typ>].
 */
export function redactSecrets(text: string): string {
  if (!text) return text;
  let out = text;
  for (const { re, label } of SECRET_PATTERNS) {
    re.lastIndex = 0;
    out = out.replace(re, `[REDACTED:${label}]`);
  }
  return out;
}
