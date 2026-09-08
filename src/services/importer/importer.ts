// Dokumenten-Importer (Sprint 22, Agent 1): DOCX/EPUB/PDF/TXT → Projekt.
// Nutzt nur Web-APIs + jszip (bereits Dependency). Keine neuen Pakete.

export interface ImportChapter {
  title: string;
  content: string;
}

export interface ImportResult {
  projectId: string;
  title: string;
  content: string;
  wordCount: number;
  chapters: ImportChapter[];
}

export interface ImportOptions {
  splitChapters: boolean;
  /** Regex für Kapitel-Titel (wird pro Zeile geprüft). Default: "^Kapitel \\d+". */
  chapterPattern: string;
  language: "de" | "en" | "auto";
}

export const DEFAULT_CHAPTER_PATTERN = "^Kapitel \\d+";

export class ImportError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "ImportError";
  }
}

function newProjectId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return `import_${c.randomUUID()}`;
  return `import_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Titel aus Dateiname ableiten (ohne Endung, _/- → Leerzeichen). */
export function titleFromFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const withoutExt = base.replace(/\.[^.]+$/, "");
  const cleaned = withoutExt.replace(/[_-]+/g, " ").trim();
  return cleaned || "Importiertes Dokument";
}

export function countWords(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return text.trim() ? words.length : 0;
}

/** TXT → Text. Versucht UTF-8, fällt auf Latin-1 zurück. */
export async function parseTxt(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  // BOM entfernen
  const start = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  const slice = bytes.slice(start);
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(slice);
    // Heuristik: viele U+FFFD → vermutlich Latin-1
    if (!decoded.includes("�")) return decoded;
  } catch {
    // fällt unten auf Latin-1 zurück
  }
  return new TextDecoder("latin1").decode(slice);
}

function parseXmlDocument(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new ImportError("XML konnte nicht geparst werden.");
  }
  return doc;
}

/** Namespace-agnostische Suche nach localName (robust in happy-dom/WebView). */
function byLocal(scope: Element | Document, name: string): Element[] {
  const out: Element[] = [];
  const root = scope instanceof Document ? scope.documentElement : scope;
  if (!root) return out;
  const visit = (el: Element) => {
    if (el.localName === name) out.push(el);
    for (const child of Array.from(el.children)) visit(child);
  };
  visit(root);
  return out;
}

/** DOCX → Text. Liest word/document.xml aus dem ZIP, Absätze + Tabellen. */
export async function parseDocx(buffer: ArrayBuffer): Promise<string> {
  const { default: JSZip } = await import("jszip");
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (e) {
    throw new ImportError("Ungültige DOCX-Datei (kein ZIP-Archiv).", e);
  }
  const entry = zip.file("word/document.xml");
  if (!entry) throw new ImportError("Ungültige DOCX-Datei: word/document.xml fehlt.");
  const xml = await entry.async("string");
  const doc = parseXmlDocument(xml);
  const body = byLocal(doc, "body")[0];
  if (!body) throw new ImportError("Ungültige DOCX-Datei: kein Dokument-Body gefunden.");

  const lines: string[] = [];
  for (const child of Array.from(body.children)) {
    if (child.localName === "p") {
      const texts = byLocal(child, "t").map((t) => t.textContent ?? "").join("");
      // w:tab → Leerzeichen, w:br → Zeilenumbruch
      const withBreaks = texts;
      lines.push(withBreaks);
    } else if (child.localName === "tbl") {
      for (const row of byLocal(child, "tr")) {
        const cells = byLocal(row, "tc").map((tc) =>
          byLocal(tc, "t").map((t) => t.textContent ?? "").join(""),
        );
        lines.push(cells.join(" | "));
      }
    }
  }
  return lines.join("\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** EPUB → Text. Folgt OPF-Manifest/Spine, extrahiert sichtbaren Text aus XHTML. */
export async function parseEpub(buffer: ArrayBuffer): Promise<string> {
  const { default: JSZip } = await import("jszip");
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (e) {
    throw new ImportError("Ungültige EPUB-Datei (kein ZIP-Archiv).", e);
  }
  // OPF-Pfad via container.xml
  let opfPath = "";
  const containerEntry = zip.file("META-INF/container.xml");
  if (containerEntry) {
    try {
      const containerXml = await containerEntry.async("string");
      const containerDoc = parseXmlDocument(containerXml);
      const rootfile = byLocal(containerDoc, "rootfile")[0];
      opfPath = rootfile?.getAttribute("full-path") ?? "";
    } catch {
      // ignorieren — Fallback unten
    }
  }
  if (!opfPath) {
    const candidates = Object.keys(zip.files).filter((k) => k.toLowerCase().endsWith(".opf"));
    if (candidates.length === 0) throw new ImportError("Ungültige EPUB-Datei: keine OPF-Datei gefunden.");
    opfPath = candidates[0];
  }
  const opfEntry = zip.file(opfPath);
  if (!opfEntry) throw new ImportError("Ungültige EPUB-Datei: OPF-Datei fehlt.");
  const opfXml = await opfEntry.async("string");
  const opfDoc = parseXmlDocument(opfXml);
  const base = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";

  const manifest: Record<string, string> = {};
  for (const item of byLocal(opfDoc, "item")) {
    const id = item.getAttribute("id") ?? "";
    const href = item.getAttribute("href") ?? "";
    if (id && href) manifest[id] = base + decodeURIComponent(href);
  }
  const spineRefs = byLocal(opfDoc, "itemref")
    .map((r) => r.getAttribute("idref") ?? "")
    .filter(Boolean);
  const orderedHrefs = (spineRefs.length > 0 ? spineRefs : Object.keys(manifest))
    .map((id) => manifest[id])
    .filter((h): h is string => Boolean(h) && /\.(x?html?|xml)$/i.test(h));

  if (orderedHrefs.length === 0) throw new ImportError("Ungültige EPUB-Datei: keine lesbaren Inhalte gefunden.");

  const parts: string[] = [];
  for (const href of orderedHrefs) {
    const entry = zip.file(href);
    if (!entry) continue;
    const html = await entry.async("string");
    parts.push(extractVisibleText(html));
  }
  const text = parts.filter(Boolean).join("\n\n");
  if (!text.trim()) throw new ImportError("EPUB enthält keinen extrahierbaren Text.");
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

/** Entfernt Tags/Skripte aus XHTML und gibt sichtbaren Text zurück. */
function extractVisibleText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, nav").forEach((el) => el.remove());
  const body = doc.body ?? doc.documentElement;
  const chunks: string[] = [];
  const BLOCKS = new Set([
    "p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "div", "section",
    "article", "blockquote", "br", "tr", "hr", "header", "title",
  ]);
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent ?? "").replace(/\s+/g, " ");
      if (t.trim()) chunks.push(t.trim());
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    if (BLOCKS.has(el.localName)) chunks.push("\n");
    for (const child of Array.from(node.childNodes)) walk(child);
    if (BLOCKS.has(el.localName)) chunks.push("\n");
  };
  walk(body);
  return chunks
    .join(" ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * PDF → Text (ohne neue Dependencies).
 * Extrahiert Text aus Tj/TJ-Operatoren (Literale + Hex-Strings).
 * Reicht für textbasierte PDFs; gescannte PDFs (nur Bilder) liefern "".
 */
export async function parsePdf(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const header = new TextDecoder("latin1").decode(bytes.slice(0, 5));
  if (!header.startsWith("%PDF")) throw new ImportError("Ungültige PDF-Datei (kein %PDF-Header).");
  const raw = new TextDecoder("latin1").decode(bytes);

  const decodePdfLiteral = (s: string): string =>
    s
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\");

  const decodeHex = (hex: string): string => {
    const clean = hex.replace(/\s+/g, "");
    let out = "";
    // UTF-16BE mit BOM erkennen
    if (/^feff/i.test(clean)) {
      for (let i = 4; i + 3 < clean.length + 1; i += 4) {
        const code = parseInt(clean.slice(i, i + 4), 16);
        if (!Number.isNaN(code)) out += String.fromCharCode(code);
      }
      return out;
    }
    for (let i = 0; i + 1 < clean.length; i += 2) {
      const code = parseInt(clean.slice(i, i + 2), 16);
      if (Number.isNaN(code)) continue;
      // Steuerzeichen außer Whitespace überspringen
      if (code < 32 && code !== 9 && code !== 10 && code !== 13) continue;
      out += String.fromCharCode(code);
    }
    return out;
  };

  const parts: string[] = [];
  // 1) Tj-Operatoren mit Literalen: (Text) Tj
  const tjRe = /\((?:\\.|[^\\()])*\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = tjRe.exec(raw)) !== null) {
    const lit = m[0].match(/\((?:\\.|[^\\()])*\)/);
    if (lit) parts.push(decodePdfLiteral(lit[0].slice(1, -1)));
  }
  // 2) Hex-Strings mit Tj: <0041...> Tj
  const hexTjRe = /<([0-9a-fA-F\s]+)>\s*Tj/g;
  while ((m = hexTjRe.exec(raw)) !== null) {
    parts.push(decodeHex(m[1]));
  }
  // 3) TJ-Arrays: [(Teil1) 20 (Teil2)] TJ — Literale und Hex gemischt
  const tjArrRe = /\[((?:\s*(?:\((?:\\.|[^\\()])*\)|<[0-9a-fA-F\s]+>|-?\d+(?:\.\d+)?)\s*)*)\]\s*TJ/g;
  while ((m = tjArrRe.exec(raw)) !== null) {
    const inner = m[1];
    const litRe = /\((?:\\.|[^\\()])*\)|<[0-9a-fA-F\s]+>/g;
    let sm: RegExpExecArray | null;
    let word = "";
    while ((sm = litRe.exec(inner)) !== null) {
      const tok = sm[0];
      word += tok.startsWith("(") ? decodePdfLiteral(tok.slice(1, -1)) : decodeHex(tok.slice(1, -1));
    }
    if (word) parts.push(word);
  }

  const text = parts.join(" ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
  return text;
}

/** Erkennt Kapitel anhand eines Regex (pro Zeile). Fallback: ein Kapitel. */
export function detectChapters(text: string, pattern: string): ImportChapter[] {
  let re: RegExp;
  try {
    re = new RegExp(pattern);
  } catch (e) {
    throw new ImportError(`Ungültiges Kapitel-Pattern: ${pattern}`, e);
  }
  const lines = text.split("\n");
  const hits: { index: number; title: string }[] = [];
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed && re.test(trimmed)) hits.push({ index, title: trimmed });
  });
  if (hits.length === 0) {
    return [{ title: "Kapitel 1", content: text.trim() }];
  }
  return hits.map((hit, i) => {
    const end = i + 1 < hits.length ? hits[i + 1].index : lines.length;
    const body = lines.slice(hit.index + 1, end).join("\n").trim();
    return { title: hit.title, content: body };
  });
}

function extOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

/** Importiert eine Datei (File/Blob) → ImportResult. */
export async function importFromFile(file: File | Blob, options: ImportOptions): Promise<ImportResult> {
  const name = file instanceof File ? file.name : "dokument.txt";
  const ext = extOf(name === "dokument.txt" && file instanceof File ? file.name : name);
  const buffer = await file.arrayBuffer();

  let content: string;
  switch (ext) {
    case "txt":
    case "md":
    case "markdown":
      content = await parseTxt(buffer);
      break;
    case "docx":
      content = await parseDocx(buffer);
      break;
    case "epub":
      content = await parseEpub(buffer);
      break;
    case "pdf":
      content = await parsePdf(buffer);
      break;
    default:
      throw new ImportError(
        `Format .${ext || "?"} wird nicht unterstützt (DOCX, EPUB, PDF, TXT).`,
      );
  }
  if (!content.trim()) {
    throw new ImportError("Die Datei enthält keinen extrahierbaren Text (evtl. gescanntes PDF?).");
  }
  const chapters = options.splitChapters
    ? detectChapters(content, options.chapterPattern || DEFAULT_CHAPTER_PATTERN)
    : [{ title: titleFromFileName(name), content: content.trim() }];
  return {
    projectId: newProjectId(),
    title: titleFromFileName(name),
    content: content.trim(),
    wordCount: countWords(content),
    chapters,
  };
}
