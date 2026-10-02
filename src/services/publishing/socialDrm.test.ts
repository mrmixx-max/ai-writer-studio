// @vitest-environment happy-dom
// Tests: Social-DRM-Service (WP 19.1, Direct-to-Reader Bundler).
//
// Deckt sichtbares/unsichtbares Wasserzeichen, XML-Verträglichkeit und das
// Bundle-ZIP ab. Alles läuft lokal (JSZip + DOM) — 0 Netzwerk-, 0 LLM-Aufrufe.
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  SOCIAL_DRM_MANIFEST_NAME,
  SOCIAL_DRM_VERSION,
  SOCIAL_DRM_ANONYMOUS_READER,
  SOCIAL_DRM_UNKNOWN_ORDER,
  generateVisibleWatermark,
  visibleWatermarkText,
  embedInvisibleWatermark,
  buildInvisibleWatermarkCss,
  buildInvisibleWatermarkComment,
  parseWatermarkComment,
  extractWatermarkFromEpub,
  watermarkSignature,
  normalizeReaderName,
  normalizeOrderId,
  bundleDirectToReader,
} from "./socialDrm";

// --- Helfer ---------------------------------------------------------------

/** true, wenn das Dokument ohne XML-Fehler geparst wird (happy-dom). */
function isWellFormedXml(xml: string): boolean {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return doc.querySelector("parsererror") === null;
}

const XHTML = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Kapitel</title></head><body><p>Text</p></body></html>`;

async function readZip(blob: Blob): Promise<JSZip> {
  return JSZip.loadAsync(await blob.arrayBuffer());
}

/** Kleines EPUB-ZIP mit einem wasserzeichen-markierten XHTML-Kapitel. */
async function makeEpub(reader: string, order: string): Promise<Blob> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file("OEBPS/kapitel-1.xhtml", embedInvisibleWatermark(XHTML, reader, order));
  const bytes = await zip.generateAsync({ type: "uint8array" });
  return new Blob([bytes as BlobPart], { type: "application/epub+zip" });
}

function blobFrom(bytes: number[], type = "application/octet-stream"): Blob {
  return new Blob([new Uint8Array(bytes) as BlobPart], { type });
}

// --- 1) Sichtbares Wasserzeichen ------------------------------------------

describe("generateVisibleWatermark", () => {
  it("liefert ein SVG mit Ex-Libris-Text und ist deterministisch", () => {
    const a = generateVisibleWatermark("Anna Muster", "AB-123");
    const b = generateVisibleWatermark("Anna Muster", "AB-123");
    expect(a).toBe(b);
    expect(a).toContain("<svg");
    expect(a).toContain("xmlns=\"http://www.w3.org/2000/svg\"");
    expect(a).toContain("Anna Muster");
    expect(a).toContain("AB-123");
    expect(isWellFormedXml(a)).toBe(true);
  });

  it("escaped XML-Sonderzeichen im Lesernamen (bleibt well-formed)", () => {
    const svg = generateVisibleWatermark("A & B <Team>", "X\"1");
    expect(svg).toContain("A &amp; B &lt;Team&gt;");
    expect(svg).not.toMatch(/<Team>/);
    expect(isWellFormedXml(svg)).toBe(true);
  });

  it("fällt bei fehlenden Daten auf neutrale Fallbacks zurück", () => {
    const svg = generateVisibleWatermark("", "");
    expect(svg).toContain(SOCIAL_DRM_ANONYMOUS_READER);
    expect(svg).toContain(SOCIAL_DRM_UNKNOWN_ORDER);
    expect(visibleWatermarkText("   ", "  ")).toContain(SOCIAL_DRM_ANONYMOUS_READER);
  });
});

// --- 2) Unsichtbares Wasserzeichen ----------------------------------------

describe("embedInvisibleWatermark (CSS)", () => {
  it("stellt bei CSS ohne :root einen neuen :root-Block voran", () => {
    const css = "body { color: #222; }\n";
    const out = embedInvisibleWatermark(css, "Anna Muster", "AB-123");
    expect(out).toContain("aiws-social-drm");
    expect(out).toContain(":root {");
    expect(out).toContain("--aiws-wm-reader");
    expect(out).toContain("body { color: #222; }");
    // Balancierte Klammern → weiterhin gültiges CSS.
    expect((out.match(/\{/g) ?? []).length).toBe((out.match(/\}/g) ?? []).length);
  });

  it("erweitert einen vorhandenen :root-Block statt einen zweiten anzulegen", () => {
    const css = ":root { --brand: red; }\nbody { margin: 0; }";
    const out = embedInvisibleWatermark(css, "Anna", "O-1");
    expect((out.match(/:root/g) ?? []).length).toBe(1);
    expect(out).toContain("--brand: red;");
    expect(out).toContain("--aiws-wm-order");
  });

  it("kodiert Leerzeichen und entfernt Anführungszeichen in CSS-Werten", () => {
    const css = buildInvisibleWatermarkCss("Anna \"Muster\"", "AB 12");
    expect(css).toContain('--aiws-wm-reader: "Anna_Muster"');
    // Bestellnummer wird zuvor defensiv normalisiert (Leerzeichen → Bindestrich).
    expect(css).toContain('--aiws-wm-order: "AB-12"');
    expect(css).not.toContain('Anna "Muster"');
  });
});

describe("embedInvisibleWatermark (XHTML)", () => {
  it("fügt <style> + Kommentar in den <head> ein und bleibt well-formed", () => {
    const out = embedInvisibleWatermark(XHTML, "Anna Muster", "AB-123");
    expect(out).toContain("aiws-social-drm");
    expect(out).toContain("--aiws-wm-signature");
    expect(isWellFormedXml(out)).toBe(true);
  });

  it("erweitert ein vorhandenes <style>-Element", () => {
    const html = `<html xmlns="http://www.w3.org/1999/xhtml"><head><style>p { color: red; }</style></head><body><p>x</p></body></html>`;
    const out = embedInvisibleWatermark(html, "Anna", "O-9");
    expect(out).toContain("p { color: red; }");
    expect(out).toContain("--aiws-wm-reader");
    expect((out.match(/<style/g) ?? []).length).toBe(1);
    expect(isWellFormedXml(out)).toBe(true);
  });

  it("bleibt auch bei Lesernamen mit Sonderzeichen XML-valid (&, <)", () => {
    const out = embedInvisibleWatermark(XHTML, "A & B <script>", "O-1");
    expect(isWellFormedXml(out)).toBe(true);
    // Der <style>-Inhalt ist XML-escaped → kein vorzeitiges Markup im Style-Block.
    const styleBlock = /<style\b[^>]*>([\s\S]*?)<\/style>/i.exec(out)?.[1] ?? "";
    expect(styleBlock).not.toContain("<script>");
    expect(styleBlock).toContain("&lt;script&gt;");
    expect(styleBlock).toContain("&amp;");
  });

  it("gibt unbekanntes Format unverändert und leeren Inhalt als '' zurück", () => {
    const prose = "Nur Fliesstext, kein Markup.";
    expect(embedInvisibleWatermark(prose, "Anna", "O-1")).toBe(prose);
    expect(embedInvisibleWatermark("", "Anna", "O-1")).toBe("");
  });
});

// --- Signatur & Roundtrip -------------------------------------------------

describe("Wasserzeichen-Signatur und Roundtrip", () => {
  it("ist deterministisch, unterscheidet Leser und ist 8-stellig hex", () => {
    const a = watermarkSignature("Anna", "O-1");
    const b = watermarkSignature("Anna", "O-1");
    const c = watermarkSignature("Bernd", "O-1");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });

  it("liest Leser und Bestellnummer aus dem Kommentar zurück", () => {
    const comment = buildInvisibleWatermarkComment("Anna Muster", "AB-123");
    const parsed = parseWatermarkComment(comment);
    expect(parsed).toEqual({ readerName: "Anna Muster", orderId: "AB-123" });
    expect(parseWatermarkComment("<p>kein Marker</p>")).toBeNull();
  });

  it("normalisiert Leser/Bestellnummer defensiv", () => {
    expect(normalizeReaderName(null)).toBe(SOCIAL_DRM_ANONYMOUS_READER);
    expect(normalizeOrderId("  ")).toBe(SOCIAL_DRM_UNKNOWN_ORDER);
    expect(normalizeOrderId("AB 12/34")).toBe("AB-12-34");
  });
});

// --- 3) Direct-to-Reader Bundle -------------------------------------------

describe("bundleDirectToReader", () => {
  it("schnürt ein vollständiges ZIP mit allen Bestandteilen", async () => {
    const epub = await makeEpub("Anna Muster", "AB-123");
    const pdf = blobFrom([1, 2, 3, 4], "application/pdf");
    const wallpaper = "data:image/png;base64,iVBORw0=";
    const result = await bundleDirectToReader(epub, pdf, "# Bonus\n\nText", wallpaper);

    const zip = await readZip(result.blob);
    const names = Object.keys(zip.files);
    expect(names).toContain("epub/buch.epub");
    expect(names).toContain("print/buch.pdf");
    expect(names).toContain("bonus/bonus-kapitel.md");
    expect(names).toContain("wallpaper/cover.png");
    expect(names).toContain(SOCIAL_DRM_MANIFEST_NAME);
    expect(result.entries.map((e) => e.role).sort()).toEqual(
      ["bonus", "epub", "print-pdf", "wallpaper"].sort(),
    );
    expect(result.manifest.sellable).toBe(true);
    expect(result.manifest.kind).toBe("social-drm");
    expect(result.manifest.version).toBe(SOCIAL_DRM_VERSION);
    expect(result.manifest.warnings).toEqual([]);
  });

  it("übernimmt das Wasserzeichen aus dem EPUB (personalisiert)", async () => {
    const epub = await makeEpub("Anna Muster", "AB-123");
    const pdf = blobFrom([9, 9], "application/pdf");
    const result = await bundleDirectToReader(epub, pdf, "Bonus", "");

    expect(result.personalized).toBe(true);
    expect(result.manifest.watermark.placeholder).toBe(false);
    expect(result.manifest.watermark.readerName).toBe("Anna Muster");
    expect(result.manifest.watermark.orderId).toBe("AB-123");
    expect(result.filename).toBe("direct-to-reader_ab-123-anna-muster.zip");
  });

  it("nutzt Platzhalter-Wasserzeichen, wenn das EPUB keinen Marker hat", async () => {
    const zip = new JSZip();
    zip.file("OEBPS/kapitel-1.xhtml", XHTML);
    const epub = new Blob([(await zip.generateAsync({ type: "uint8array" })) as BlobPart], {
      type: "application/epub+zip",
    });
    const result = await bundleDirectToReader(epub, blobFrom([1]), "Bonus", "");
    expect(result.personalized).toBe(false);
    expect(result.manifest.watermark.placeholder).toBe(true);
    expect(result.manifest.watermark.readerName).toBe(SOCIAL_DRM_ANONYMOUS_READER);
    expect(result.filename).toBe("direct-to-reader_buch.zip");
  });

  it("ist defensiv bei fehlenden Eingaben (kein Throw, Warnungen, sellable=false)", async () => {
    const result = await bundleDirectToReader(
      null as unknown as Blob,
      undefined as unknown as Blob,
      "",
      "",
    );
    expect(result.manifest.sellable).toBe(false);
    expect(result.personalized).toBe(false);
    expect(result.entries).toHaveLength(0);
    expect(result.manifest.warnings.length).toBeGreaterThanOrEqual(4);

    const zip = await readZip(result.blob);
    expect(Object.keys(zip.files)).toContain(SOCIAL_DRM_MANIFEST_NAME);
  });

  it("verwirft ein ungültiges Wallpaper mit Warnung", async () => {
    const epub = await makeEpub("Anna", "O-1");
    const result = await bundleDirectToReader(epub, blobFrom([1], "application/pdf"), "Bonus", "cover.jpg");
    expect(result.entries.some((e) => e.role === "wallpaper")).toBe(false);
    expect(result.manifest.warnings.some((w) => w.includes("Wallpaper"))).toBe(true);
    // EPUB + PDF bleiben → weiterhin verkaufsfertig.
    expect(result.manifest.sellable).toBe(true);
  });

  it("liefert bei gleicher Eingabe identische ZIP-Bytes (deterministisch)", async () => {
    const epub = await makeEpub("Anna", "O-1");
    const a = await bundleDirectToReader(epub, blobFrom([1, 2], "application/pdf"), "Bonus", "");
    const b = await bundleDirectToReader(epub, blobFrom([1, 2], "application/pdf"), "Bonus", "");
    const ba = new Uint8Array(await a.blob.arrayBuffer());
    const bb = new Uint8Array(await b.blob.arrayBuffer());
    expect(ba).toEqual(bb);
  });

  it("legt ein lesbares Manifest mit passender Dateiliste ins ZIP", async () => {
    const epub = await makeEpub("Anna", "O-1");
    const result = await bundleDirectToReader(epub, blobFrom([1], "application/pdf"), "Bonus", "");
    const zip = await readZip(result.blob);
    const raw = await zip.file(SOCIAL_DRM_MANIFEST_NAME)!.async("string");
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe(SOCIAL_DRM_VERSION);
    expect(parsed.files.map((f: { path: string }) => f.path)).toEqual(result.entries.map((e) => e.path));
  });
});

// --- Defensive Extraktion -------------------------------------------------

describe("extractWatermarkFromEpub", () => {
  it("liefert null bei Nicht-ZIP-Bytes statt zu werfen", async () => {
    const junk = blobFrom([0, 1, 2, 3, 4, 5]);
    await expect(extractWatermarkFromEpub(junk)).resolves.toBeNull();
  });

  it("liefert null ohne Blob und liest den Marker aus einem echten EPUB", async () => {
    await expect(extractWatermarkFromEpub(null)).resolves.toBeNull();
    const epub = await makeEpub("Anna Muster", "AB-123");
    await expect(extractWatermarkFromEpub(epub)).resolves.toEqual({
      readerName: "Anna Muster",
      orderId: "AB-123",
    });
  });
});
