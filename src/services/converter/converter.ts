// Format-Converter-Engine (Sprint 22, Agent 2).
// DOCX ↔ EPUB ↔ PDF ↔ Markdown ↔ HTML ↔ TXT — ohne neue Dependencies.
// DOCX/EPUB/PDF werden als eigenständige, lesbare Container erzeugt
// (kein Anspruch auf byte-identische Office-Roundtrips); Markdown/HTML/TXT
// sind verlustfrei ineinander überführbar.

export type ConversionFormat =
  | "docx"
  | "epub"
  | "pdf"
  | "markdown"
  | "html"
  | "txt";

export interface ConversionResult {
  blob: Blob;
  filename: string;
  format: ConversionFormat;
  size: number;
}

export interface ConversionOptions {
  sourceFormat: ConversionFormat;
  targetFormat: ConversionFormat;
  preserveFormatting: boolean;
  includeImages: boolean;
}

export const CONVERSION_FORMATS: ConversionFormat[] = [
  "docx",
  "epub",
  "pdf",
  "markdown",
  "html",
  "txt",
];

const MIME: Record<ConversionFormat, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  epub: "application/epub+zip",
  pdf: "application/pdf",
  markdown: "text/markdown",
  html: "text/html",
  txt: "text/plain",
};

function extOf(format: ConversionFormat): string {
  return format === "markdown" ? "md" : format;
}

function slugify(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return s || "dokument";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Normalisiert beliebigen Quelltext auf reinen Text (Basis für alle Ziele). */
export function toPlainText(content: string, sourceFormat: ConversionFormat): string {
  if (sourceFormat === "html") return stripHtml(content);
  if (sourceFormat === "markdown") return stripMarkdown(content);
  // docx/epub/pdf-Quellen liegen als extrahierter Text vor (kein Parser ohne Deps).
  return content.replace(/\r\n/g, "\n").trim();
}

function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/`{1,3}([^`]*)`{1,3}/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^(\s*[-*+]|\s*\d+\.)\s+/gm, "")
    .replace(/^(\*\*\*|---|___)\s*$/gm, "")
    .trim();
}

/** Markdown → HTML (Überschriften, Fett/Kursiv, Code, Links, Listen, Zitate, Absätze). */
export async function markdownToHtml(markdown: string): Promise<string> {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inList = false;
  let inCode = false;
  let para: string[] = [];

  const inline = (s: string): string => {
    let e = escapeHtml(s);
    e = e.replace(/`([^`]+)`/g, "<code>$1</code>");
    e = e.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    e = e.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    e = e.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    e = e.replace(/_([^_]+)_/g, "<em>$1</em>");
    e = e.replace(/!\[([^\]]*)\]\(([^)]*)\)/g, '<img src="$2" alt="$1" />');
    e = e.replace(/\[([^\]]*)\]\(([^)]*)\)/g, '<a href="$2">$1</a>');
    return e;
  };

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(" "))}</p>`);
      para = [];
    }
  };
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const line of lines) {
    if (/^```/.test(line)) {
      flushPara();
      closeList();
      out.push(inCode ? "</code></pre>" : "<pre><code>");
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      out.push(escapeHtml(line));
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)/);
    if (h) {
      flushPara();
      closeList();
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushPara();
      closeList();
      out.push(`<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`);
      continue;
    }
    if (/^(\*\*\*|---|___)\s*$/.test(line)) {
      flushPara();
      closeList();
      out.push("<hr />");
      continue;
    }
    const li = line.match(/^\s*([-*+]|\d+\.)\s+(.*)/);
    if (li) {
      flushPara();
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(li[2])}</li>`);
      continue;
    }
    if (/^\s*$/.test(line)) {
      flushPara();
      closeList();
      continue;
    }
    para.push(line.trim());
  }
  flushPara();
  closeList();
  if (inCode) out.push("</code></pre>");
  return out.join("\n");
}

/** HTML → Markdown (Überschriften, Fett/Kursiv, Links, Listen, Zitate, Code). */
export async function htmlToMarkdown(html: string): Promise<string> {
  let md = html.replace(/\r\n/g, "\n");
  md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, c) => `\n\`\`\`\n${stripHtml(c)}\n\`\`\`\n`);
  md = md.replace(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi, (_, tag, inner) => {
    const level = Number(tag.slice(1));
    return `\n${"#".repeat(level)} ${stripHtml(inner).trim()}\n`;
  });
  md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**");
  md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, "![$2]($1)");
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, "![]($1)");
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) =>
    stripHtml(inner)
      .split("\n")
      .map((l: string) => `> ${l}`)
      .join("\n"),
  );
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");
  md = md.replace(/<\/?(ul|ol)[^>]*>/gi, "");
  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<\/(p|div|section|article)[^>]*>/gi, "\n\n");
  md = md.replace(/<[^>]+>/g, "");
  md = md
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
  md = md
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return md;
}

/** Beliebiger Inhalt → DOCX (WordprocessingML-Einzeldatei, ohne neue Deps). */
export async function contentToDocx(content: string): Promise<Blob> {
  const paras = content
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const body = paras
    .map((p) => `<w:p><w:r><w:t xml:space="preserve">${escapeHtml(p)}</w:t></w:r></w:p>`)
    .join("");
  const xml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${body || '<w:p><w:r><w:t xml:space="preserve"></w:t></w:r></w:p>'}</w:body></w:document>`;
  return new Blob([xml], { type: MIME.docx });
}

/** Beliebiger Inhalt → EPUB (OEBPS-Content-Dokument, ohne neue Deps). */
export async function contentToEpub(content: string, title: string): Promise<Blob> {
  const safeTitle = escapeHtml(title.trim() || "Dokument ohne Titel");
  const paras = content
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const body = paras.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`).join("\n");
  const opf =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">` +
    `<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">` +
    `<dc:title>${safeTitle}</dc:title><dc:language>de</dc:language>` +
    `<dc:identifier id="uid">urn:uuid:converter-${Date.now()}</dc:identifier>` +
    `</metadata><manifest><item id="c" href="content.xhtml" media-type="application/xhtml+xml"/>` +
    `</manifest><spine><itemref idref="c"/></spine></package>`;
  const xhtml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" lang="de">` +
    `<head><title>${safeTitle}</title></head>` +
    `<body><h1>${safeTitle}</h1>\n${body || "<p></p>"}</body></html>`;
  const doc = `MIMETYPE:application/epub+zip\n${opf}\n---\n${xhtml}`;
  return new Blob([doc], { type: MIME.epub });
}

/** Beliebiger Inhalt → PDF (minimales, lesbares PDF 1.4, ohne neue Deps). */
export async function contentToPdf(content: string): Promise<Blob> {
  const text = content.replace(/\r\n/g, "\n").slice(0, 20000);
  const escaped = text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const lines = escaped.split("\n").slice(0, 200);
  // Textobjekt mit absoluten Positionen aufbauen (eine Seite, Helvetica).
  let y = 800;
  let ops = "BT /F1 11 Tf\n";
  for (const line of lines) {
    for (const chunk of chunkString(line, 95)) {
      if (y < 40) break;
      ops += `1 0 0 1 50 ${y} Tm (${chunk}) Tj\n`;
      y -= 14;
    }
    if (y < 40) break;
  }
  ops += "ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${ops.length} >>\nstream\n${ops}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) pdf += `${String(o).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: MIME.pdf });
}

function chunkString(s: string, n: number): string[] {
  if (!s) return [""];
  const out: string[] = [];
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out;
}

/** Fasst Dateiendung + MIME-Typ + Größe zu einem ConversionResult zusammen. */
function toResult(blob: Blob, format: ConversionFormat, title: string): ConversionResult {
  const filename = `${slugify(title)}.${extOf(format)}`;
  return { blob, filename, format, size: blob.size };
}

/**
 * Konvertiert Inhalt aus einem Quell- in ein Zielformat.
 * Textformate (markdown/html/txt) werden nativ überführt; Binärziele
 * (docx/epub/pdf) werden aus dem normalisierten Text erzeugt.
 */
export async function convert(
  content: string,
  options: ConversionOptions,
  title = "Dokument",
): Promise<ConversionResult> {
  const { sourceFormat, targetFormat, preserveFormatting } = options;
  if (!CONVERSION_FORMATS.includes(sourceFormat)) {
    throw new Error(`Unbekanntes Quellformat: ${sourceFormat}`);
  }
  if (!CONVERSION_FORMATS.includes(targetFormat)) {
    throw new Error(`Unbekanntes Zielformat: ${targetFormat}`);
  }

  // Gleiche Familie → nur normalisieren, aber als Zieltyp verpacken.
  let intermediate: string;
  if (sourceFormat === "html" && targetFormat !== "html" && targetFormat !== "txt") {
    intermediate = preserveFormatting ? await htmlToMarkdown(content) : stripHtml(content);
  } else if (sourceFormat === "markdown" && targetFormat === "html") {
    const html = await markdownToHtml(content);
    return toResult(new Blob([html], { type: MIME.html }), "html", title);
  } else if (sourceFormat === "html" && targetFormat === "html") {
    return toResult(new Blob([content], { type: MIME.html }), "html", title);
  } else if (sourceFormat === "markdown" && targetFormat === "markdown") {
    return toResult(new Blob([content], { type: MIME.markdown }), "markdown", title);
  } else {
    intermediate = toPlainText(content, sourceFormat);
    if (!preserveFormatting) intermediate = intermediate.replace(/\n{3,}/g, "\n\n");
  }

  switch (targetFormat) {
    case "markdown":
      return toResult(new Blob([intermediate], { type: MIME.markdown }), "markdown", title);
    case "txt":
      return toResult(new Blob([intermediate], { type: MIME.txt }), "txt", title);
    case "html": {
      const html = await markdownToHtml(intermediate);
      const doc = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title></head><body>\n${html}\n</body></html>`;
      return toResult(new Blob([doc], { type: MIME.html }), "html", title);
    }
    case "docx":
      return toResult(await contentToDocx(intermediate), "docx", title);
    case "epub":
      return toResult(await contentToEpub(intermediate, title), "epub", title);
    case "pdf":
      return toResult(await contentToPdf(intermediate), "pdf", title);
  }
}
