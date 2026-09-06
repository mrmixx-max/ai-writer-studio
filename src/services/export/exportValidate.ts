// Export-Validatoren (Sprint 10, Agent 2): Roundtrip-Prüfung generierter
// Dateien — `generate → validate → assert`. Deckt DOCX (ZIP-Integrität +
// document.xml wohlgeformt), EPUB (Container + OPF-Manifest-Abgleich) und PDF
// (Header + Seitenzahl) ab. Nur bereits installierte Dependencies (jszip,
// pdf-lib) — keine neuen Pakete.

import JSZip from "jszip";

export type ExportValidateFormat = "docx" | "epub" | "pdf";

export interface ExportValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface ExportValidationResult {
  ok: boolean;
  format: ExportValidateFormat;
  issues: ExportValidationIssue[];
  details: {
    files?: number;
    pageCount?: number;
    title?: string;
    manifestItems?: number;
  };
}

export interface ValidateOptions {
  /** Mindestzahl erwarteter Kapitel (DOCX-Bookmarks / EPUB-Manifest). */
  minChapters?: number;
  /** Erwartete DOCX-TOC-Anker (z. B. ["_kapitel_1", …]). */
  expectTocAnchors?: string[];
  /** Erwarteter PDF-Titel (Info-Dict). */
  expectTitle?: string;
}

function err(code: string, message: string): ExportValidationIssue {
  return { code, message, severity: "error" };
}

function warn(code: string, message: string): ExportValidationIssue {
  return { code, message, severity: "warning" };
}

function toResult(
  format: ExportValidateFormat,
  issues: ExportValidationIssue[],
  details: ExportValidationResult["details"] = {},
): ExportValidationResult {
  return { ok: !issues.some((i) => i.severity === "error"), format, issues, details };
}

async function loadZip(bytes: Uint8Array): Promise<JSZip> {
  return JSZip.loadAsync(bytes);
}

// --- Minimale XML-Wohlgeformtheitsprüfung (ohne neue Dependencies) ----------

/**
 * Prüft, ob ein XML-String wohlgeformt ist (Tag-Balance, schließende Tags,
 * keine unescapten `&`). Kein validierender Parser — bewusst klein, aber
 * streng genug, um gebrochene Export-Metadaten (Umlaute sind ok, rohe
 * `&`/`<` in Titeln nicht) zu erkennen.
 */
export function checkXmlWellFormed(xml: string): { ok: boolean; error?: string } {
  let s = xml.trim();
  // XML-Deklaration + DOCTYPE (inkl. internem Subset [...]) überspringen.
  s = s.replace(/^<\?xml[\s\S]*?\?>\s*/, "");
  s = s.replace(/^<!DOCTYPE[\s\S]*?(\[[\s\S]*?\]\s*)?>\s*/, "");
  // Kommentare, CDATA, PIs entfernen (Inhalt darf alles enthalten).
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  s = s.replace(/<\?[\s\S]*?\?>/g, "");

  const stack: string[] = [];
  let rootSeen = false;
  let rootClosed = false;
  let i = 0;
  const nameRe = /^[A-Za-z_][\w.:-]*/;

  while (i < s.length) {
    const ch = s[i];
    if (ch !== "<") {
      // Textknoten: rohes `&` muss eine Entity einleiten.
      if (ch === "&") {
        const m = /^&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/.exec(s.slice(i));
        if (!m) return { ok: false, error: `Unescaptes '&' an Position ${i}` };
        i += m[0].length;
        continue;
      }
      i++;
      continue;
    }
    // Tag-Span lesen (Quotes beachten, damit `>` in Attributen ok ist).
    let j = i + 1;
    let quote: string | null = null;
    while (j < s.length) {
      const c = s[j];
      if (quote) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'") {
        quote = c;
      } else if (c === ">") {
        break;
      }
      j++;
    }
    if (j >= s.length) return { ok: false, error: `Unterminiertes Tag an Position ${i}` };
    const raw = s.slice(i + 1, j).trim();
    i = j + 1;

    if (raw.startsWith("!") || raw.startsWith("?")) continue; // Rest-Deklarationen
    if (raw.startsWith("/")) {
      const name = raw.slice(1).trim().split(/\s+/)[0];
      const open = stack.pop();
      if (!open) return { ok: false, error: `Schließendes Tag ohne Öffnung: </${name}>` };
      if (open !== name) return { ok: false, error: `Tag-Mismatch: <${open}> vs. </${name}>` };
      if (stack.length === 0) rootClosed = true;
      continue;
    }
    if (rootClosed) return { ok: false, error: "Inhalt nach dem Wurzelelement" };
    const selfClosing = raw.endsWith("/");
    const body = selfClosing ? raw.slice(0, -1).trim() : raw;
    const m = nameRe.exec(body);
    if (!m) return { ok: false, error: `Ungültiger Tag-Name in <${raw}>` };
    // Attribut-Rest grob prüfen: muss aus name="…" Paaren bestehen.
    const rest = body.slice(m[0].length);
    if (rest.trim() && !/^(\s+[A-Za-z_:][\w.:-]*\s*=\s*("[^"]*"|'[^']*'))*\s*$/.test(rest)) {
      return { ok: false, error: `Ungültige Attribute in <${m[0]}…>` };
    }
    if (!selfClosing) {
      if (stack.length === 0 && rootSeen) return { ok: false, error: "Mehrere Wurzelelemente" };
      stack.push(m[0]);
      rootSeen = true;
    } else if (stack.length === 0 && !rootSeen) {
      rootSeen = true;
      rootClosed = true;
    }
  }
  if (stack.length > 0) return { ok: false, error: `Nicht geschlossen: <${stack[stack.length - 1]}>` };
  if (!rootSeen) return { ok: false, error: "Kein Wurzelelement" };
  return { ok: true };
}

// --- DOCX -------------------------------------------------------------------

/** Validiert eine DOCX-Datei (ZIP-Integrität + document.xml wohlgeformt). */
export async function validateDocxBlob(blob: Blob, options: ValidateOptions = {}): Promise<ExportValidationResult> {
  const issues: ExportValidationIssue[] = [];
  let zip: JSZip;
  try {
    zip = await loadZip(new Uint8Array(await blob.arrayBuffer()));
  } catch (e) {
    return toResult("docx", [err("DOCX_ZIP_INVALID", `ZIP-Integrität verletzt: ${(e as Error).message}`)]);
  }
  const files = Object.keys(zip.files).filter((f) => !zip.files[f].dir);
  if (!zip.file("[Content_Types].xml")) {
    issues.push(err("DOCX_NO_CONTENT_TYPES", "[Content_Types].xml fehlt"));
  }
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    issues.push(err("DOCX_NO_DOCUMENT", "word/document.xml fehlt"));
    return toResult("docx", issues, { files: files.length });
  }
  const docXml = await docFile.async("string");
  if (!docXml.includes("<?xml")) issues.push(warn("DOCX_NO_XML_DECL", "document.xml ohne XML-Deklaration"));
  const wf = checkXmlWellFormed(docXml);
  if (!wf.ok) issues.push(err("DOCX_XML_MALFORMED", `document.xml nicht wohlgeformt: ${wf.error}`));
  if (!/<w:body[\s>]/.test(docXml)) issues.push(err("DOCX_NO_BODY", "Kein w:body in document.xml"));

  if (options.expectTocAnchors) {
    for (const anchor of options.expectTocAnchors) {
      if (!docXml.includes(`w:name="${anchor}"`)) {
        issues.push(err("DOCX_ANCHOR_MISSING", `Bookmark fehlt: ${anchor}`));
      }
      if (!docXml.includes(`w:anchor="${anchor}"`)) {
        issues.push(err("DOCX_TOC_LINK_MISSING", `TOC-Hyperlink fehlt: ${anchor}`));
      }
    }
  }
  if (options.minChapters !== undefined) {
    const bookmarks = new Set(docXml.match(/w:name="_kapitel_\d+"/g) ?? []).size;
    if (bookmarks < options.minChapters) {
      issues.push(err("DOCX_CHAPTERS_MISSING", `Nur ${bookmarks} Kapitel-Bookmarks, erwartet ≥ ${options.minChapters}`));
    }
  }
  // Custom XML Part (VBA-Integration) — falls vorhanden, muss wohlgeformt sein.
  const customXml = zip.file("customXml/item1.xml");
  if (customXml) {
    const cx = await customXml.async("string");
    const cwf = checkXmlWellFormed(cx);
    if (!cwf.ok) issues.push(err("DOCX_CUSTOMXML_MALFORMED", `customXml/item1.xml nicht wohlgeformt: ${cwf.error}`));
  }
  return toResult("docx", issues, { files: files.length });
}

// --- EPUB -------------------------------------------------------------------

function resolveHref(baseDir: string, href: string): string {
  if (!href || /^[a-zA-Z][\w+.-]*:/.test(href) || href.startsWith("#")) return href;
  const [path] = href.split("#");
  if (path.startsWith("/")) return path.slice(1);
  const parts = `${baseDir}/${path}`.split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "" || p === ".") continue;
    if (p === "..") out.pop();
    else out.push(p);
  }
  return out.join("/");
}

function isExternal(href: string): boolean {
  return /^[a-zA-Z][\w+.-]*:/.test(href) || href.startsWith("#") || href === "";
}

/** Validiert eine EPUB-Datei (Container + OPF-Manifest-Abgleich). */
export async function validateEpubBlob(blob: Blob, options: ValidateOptions = {}): Promise<ExportValidationResult> {
  const issues: ExportValidationIssue[] = [];
  let zip: JSZip;
  try {
    zip = await loadZip(new Uint8Array(await blob.arrayBuffer()));
  } catch (e) {
    return toResult("epub", [err("EPUB_ZIP_INVALID", `ZIP-Integrität verletzt: ${(e as Error).message}`)]);
  }
  const names = Object.keys(zip.files);
  const files = names.filter((f) => !zip.files[f].dir);

  // mimetype: erster Eintrag, exakt, unkomprimiert.
  if (names[0] !== "mimetype") {
    issues.push(err("EPUB_MIMETYPE_ORDER", `Erster ZIP-Eintrag ist "${names[0] ?? "–"}", erwartet "mimetype"`));
  }
  const mimeFile = zip.file("mimetype");
  if (!mimeFile) {
    issues.push(err("EPUB_NO_MIMETYPE", "mimetype fehlt"));
  } else {
    const content = await mimeFile.async("string");
    if (content !== "application/epub+zip") {
      issues.push(err("EPUB_MIMETYPE_CONTENT", `mimetype-Inhalt falsch: "${content}"`));
    }
    // STORE-Prüfung über Größenvergleich (DEFLATE wäre bei 20 Bytes länger).
    const raw = mimeFile as unknown as { _data?: { compressedSize?: number; uncompressedSize?: number } };
    if (
      raw._data?.compressedSize !== undefined &&
      raw._data?.uncompressedSize !== undefined &&
      raw._data.compressedSize !== raw._data.uncompressedSize
    ) {
      issues.push(err("EPUB_MIMETYPE_COMPRESSED", "mimetype ist komprimiert, muss STORE sein"));
    }
  }

  const containerFile = zip.file("META-INF/container.xml");
  if (!containerFile) {
    issues.push(err("EPUB_NO_CONTAINER", "META-INF/container.xml fehlt"));
    return toResult("epub", issues, { files: files.length });
  }
  const container = await containerFile.async("string");
  const cwf = checkXmlWellFormed(container);
  if (!cwf.ok) issues.push(err("EPUB_CONTAINER_MALFORMED", `container.xml nicht wohlgeformt: ${cwf.error}`));
  const rootMatch = /<rootfile[^>]+full-path="([^"]+)"[^>]*>/.exec(container);
  if (!rootMatch) {
    issues.push(err("EPUB_NO_ROOTFILE", "Kein rootfile in container.xml"));
    return toResult("epub", issues, { files: files.length });
  }
  const opfPath = rootMatch[1];
  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    issues.push(err("EPUB_NO_OPF", `OPF fehlt: ${opfPath}`));
    return toResult("epub", issues, { files: files.length });
  }
  const opf = await opfFile.async("string");
  const owf = checkXmlWellFormed(opf);
  if (!owf.ok) issues.push(err("EPUB_OPF_MALFORMED", `content.opf nicht wohlgeformt: ${owf.error}`));

  const opfDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/")) : "";
  const manifestIds = new Set<string>();
  const manifestHrefs: { id: string; href: string }[] = [];
  const itemRe = /<item\b[^>]*>/g;
  let im: RegExpExecArray | null;
  while ((im = itemRe.exec(opf)) !== null) {
    const tag = im[0];
    const id = /id="([^"]+)"/.exec(tag)?.[1] ?? "";
    const href = /href="([^"]+)"/.exec(tag)?.[1] ?? "";
    if (id && manifestIds.has(id)) issues.push(err("EPUB_MANIFEST_DUP_ID", `Doppelte Manifest-Id: ${id}`));
    if (id) manifestIds.add(id);
    if (href) manifestHrefs.push({ id, href });
  }
  if (!/<dc:title>[\s\S]*<\/dc:title>/.test(opf)) issues.push(err("EPUB_NO_TITLE", "dc:title fehlt im OPF"));
  if (!/<dc:language>[\s\S]*<\/dc:language>/.test(opf)) issues.push(err("EPUB_NO_LANGUAGE", "dc:language fehlt im OPF"));
  if (!/dcterms:modified/.test(opf)) issues.push(warn("EPUB_NO_MODIFIED", "dcterms:modified fehlt im OPF"));

  // Manifest-Abgleich: jede referenzierte Datei muss im ZIP existieren.
  for (const { id, href } of manifestHrefs) {
    if (isExternal(href)) continue;
    const resolved = resolveHref(opfDir, href);
    if (!zip.file(resolved)) {
      issues.push(err("EPUB_MANIFEST_DANGLING", `Manifest "${id}" verweist auf fehlende Datei: ${href}`));
    }
  }
  // Spine-Abgleich: idrefs müssen Manifest-Ids sein.
  const spineRe = /<itemref\b[^>]*idref="([^"]+)"[^>]*>/g;
  let sm: RegExpExecArray | null;
  while ((sm = spineRe.exec(opf)) !== null) {
    if (!manifestIds.has(sm[1])) issues.push(err("EPUB_SPINE_DANGLING", `Spine verweist auf unbekannte Id: ${sm[1]}`));
  }
  // Cover-Check: cover-image-Property muss auf existierende Datei zeigen.
  const coverRe = /<item\b[^>]*properties="[^"]*cover-image[^"]*"[^>]*href="([^"]+)"[^>]*>/;
  const coverAlt = /<item\b[^>]*href="([^"]+)"[^>]*properties="[^"]*cover-image[^"]*"[^>]*>/;
  const coverHref = coverRe.exec(opf)?.[1] ?? coverAlt.exec(opf)?.[1];
  if (coverHref && !zip.file(resolveHref(opfDir, coverHref))) {
    issues.push(err("EPUB_COVER_MISSING", `Cover-Datei fehlt: ${coverHref}`));
  }

  // NCX: wohlgeformt + alle content-srcs vorhanden.
  const ncxCandidates = manifestHrefs.filter((m) => m.href.endsWith(".ncx"));
  for (const { href } of ncxCandidates) {
    const ncxPath = resolveHref(opfDir, href);
    const ncxFile = zip.file(ncxPath);
    if (!ncxFile) continue; // bereits als EPUB_MANIFEST_DANGLING gemeldet
    const ncx = await ncxFile.async("string");
    const nwf = checkXmlWellFormed(ncx);
    if (!nwf.ok) {
      issues.push(err("EPUB_NCX_MALFORMED", `NCX nicht wohlgeformt: ${nwf.error}`));
      continue;
    }
    const ncxDir = ncxPath.includes("/") ? ncxPath.slice(0, ncxPath.lastIndexOf("/")) : "";
    const srcRe = /<content\b[^>]*src="([^"]+)"[^>]*>/g;
    let cm: RegExpExecArray | null;
    let navPoints = 0;
    while ((cm = srcRe.exec(ncx)) !== null) {
      navPoints++;
      if (!isExternal(cm[1]) && !zip.file(resolveHref(ncxDir, cm[1]))) {
        issues.push(err("EPUB_NCX_DANGLING", `NCX verweist auf fehlende Datei: ${cm[1]}`));
      }
    }
    if (navPoints === 0) issues.push(warn("EPUB_NCX_EMPTY", "NCX ohne navPoints"));
  }

  // nav.xhtml: wohlgeformt (DOCTYPE-tolerant) + interne Links vorhanden.
  const navCandidates = manifestHrefs.filter((m) => /nav/i.test(m.id) && m.href.endsWith(".xhtml"));
  const opfXhtmlHrefs = new Set(manifestHrefs.filter((m) => m.href.endsWith(".xhtml")).map((m) => resolveHref(opfDir, m.href)));
  for (const { href } of navCandidates) {
    const navPath = resolveHref(opfDir, href);
    const navFile = zip.file(navPath);
    if (!navFile) continue;
    const nav = await navFile.async("string");
    const nwf = checkXmlWellFormed(nav);
    if (!nwf.ok) {
      issues.push(err("EPUB_NAV_MALFORMED", `nav.xhtml nicht wohlgeformt: ${nwf.error}`));
      continue;
    }
    if (!/epub:type="toc"/.test(nav)) issues.push(warn("EPUB_NAV_NO_TOC", "nav ohne epub:type=\"toc\""));
    const navDir = navPath.includes("/") ? navPath.slice(0, navPath.lastIndexOf("/")) : "";
    const aRe = /<a\b[^>]*href="([^"]+)"[^>]*>/g;
    let am: RegExpExecArray | null;
    while ((am = aRe.exec(nav)) !== null) {
      if (!isExternal(am[1]) && !zip.file(resolveHref(navDir, am[1]))) {
        issues.push(err("EPUB_NAV_DANGLING", `nav.xhtml verweist auf fehlende Datei: ${am[1]}`));
      }
    }
  }

  // Alle XHTML-Dateien im OPF-Manifest: wohlgeformt.
  for (const p of opfXhtmlHrefs) {
    const f = zip.file(p);
    if (!f) continue;
    const text = await f.async("string");
    const xwf = checkXmlWellFormed(text);
    if (!xwf.ok) issues.push(err("EPUB_XHTML_MALFORMED", `${p} nicht wohlgeformt: ${xwf.error}`));
  }

  if (options.minChapters !== undefined) {
    const chapterFiles = [...opfXhtmlHrefs].filter((h) => /kapitel-/.test(h)).length;
    if (chapterFiles < options.minChapters) {
      issues.push(err("EPUB_CHAPTERS_MISSING", `Nur ${chapterFiles} Kapitel-Dateien im Manifest, erwartet ≥ ${options.minChapters}`));
    }
  }

  return toResult("epub", issues, { files: files.length, manifestItems: manifestHrefs.length });
}

// --- PDF --------------------------------------------------------------------

/** Validiert eine PDF-Datei (Header + parsebar + Seitenzahl). */
export async function validatePdfBlob(blob: Blob, options: ValidateOptions = {}): Promise<ExportValidationResult> {
  const issues: ExportValidationIssue[] = [];
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length < 5) {
    return toResult("pdf", [err("PDF_TOO_SMALL", "PDF leer oder zu klein")]);
  }
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 8));
  if (!head.startsWith("%PDF-")) {
    return toResult("pdf", [err("PDF_BAD_HEADER", `Ungültiger PDF-Header: "${head.slice(0, 8)}"`)]);
  }
  const tail = new TextDecoder("latin1").decode(bytes.slice(Math.max(0, bytes.length - 1024)));
  if (!tail.includes("%%EOF")) issues.push(err("PDF_NO_EOF", "%%EOF-Marker fehlt"));

  try {
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pageCount = pdf.getPageCount();
    if (pageCount < 1) issues.push(err("PDF_NO_PAGES", "PDF enthält keine Seiten"));
    let title: string | undefined;
    try {
      title = pdf.getTitle();
    } catch {
      title = undefined;
    }
    if (options.expectTitle !== undefined && title !== options.expectTitle) {
      issues.push(err("PDF_TITLE_MISMATCH", `PDF-Titel "${title ?? "–"}" ≠ erwartet "${options.expectTitle}"`));
    }
    return toResult("pdf", issues, { pageCount, title });
  } catch (e) {
    return toResult("pdf", [err("PDF_UNPARSEABLE", `PDF nicht parsebar: ${(e as Error).message}`)]);
  }
}

// --- Kombiniert ---------------------------------------------------------------

/** Validiert einen Export-Blob anhand des Formats (DOCX/EPUB/PDF). */
export async function validateExportBlob(
  blob: Blob,
  format: ExportValidateFormat,
  options: ValidateOptions = {},
): Promise<ExportValidationResult> {
  switch (format) {
    case "docx":
      return validateDocxBlob(blob, options);
    case "epub":
      return validateEpubBlob(blob, options);
    case "pdf":
      return validatePdfBlob(blob, options);
  }
}
