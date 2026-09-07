// Tests: KDP-Cover-Validierung (Sprint 13, Agent 5).
//
// Alle Bild-Buffer werden per Hand gebaut (Minimal-Header, keine Fixtures):
// PNG = Signatur + IHDR, JPEG = SOI + APP0 + SOF0 + EOI. 0 echte API-Calls.
import { describe, it, expect } from "vitest";
import {
  KDP_COVER_ALLOWED_EXTENSIONS,
  KDP_COVER_IDEAL_HEIGHT,
  KDP_COVER_IDEAL_WIDTH,
  KDP_COVER_MAX_FILE_BYTES,
  KDP_COVER_MIN_SHORT_EDGE,
  detectImageFormat,
  mergeCoverIntoValidation,
  parseImageDimensions,
  parseJpegDimensions,
  parsePngDimensions,
  toUploadValidationIssues,
  validateKdpCover,
  type KdpCoverValidationResult,
} from "./kdpCover";
import type { UploadValidationResult } from "./kdpUploadValidation";

/** Minimal-PNG (Signatur + IHDR, ohne CRC/IEND — der Parser braucht nur 24 Bytes). */
function makePng(width: number, height: number): Uint8Array {
  const out = new Uint8Array(29);
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  out.set([0x00, 0x00, 0x00, 0x0d], 8); // IHDR-Laenge
  out.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  out[16] = (width >>> 24) & 0xff;
  out[17] = (width >>> 16) & 0xff;
  out[18] = (width >>> 8) & 0xff;
  out[19] = width & 0xff;
  out[20] = (height >>> 24) & 0xff;
  out[21] = (height >>> 16) & 0xff;
  out[22] = (height >>> 8) & 0xff;
  out[23] = height & 0xff;
  out.set([0x08, 0x02, 0x00, 0x00, 0x00], 24); // Bit-Tiefe/Farbtyp/usw.
  return out;
}

/** Minimal-JPEG (SOI + APP0-JFIF + SOF0 + EOI). */
function makeJpeg(width: number, height: number): Uint8Array {
  const bytes: number[] = [0xff, 0xd8];
  bytes.push(0xff, 0xe0, 0x00, 0x10); // APP0, Laenge 16
  bytes.push(0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00);
  bytes.push(0xff, 0xc0, 0x00, 0x0b, 0x08); // SOF0, Laenge 11, Precision 8
  bytes.push((height >>> 8) & 0xff, height & 0xff, (width >>> 8) & 0xff, width & 0xff);
  bytes.push(0x01, 0x01, 0x11, 0x00); // 1 Komponente
  bytes.push(0xff, 0xd9); // EOI
  return new Uint8Array(bytes);
}

/** Großer Buffer ohne 50 MB zu allokieren: Header vorne, Rest Nullen via sizeBytes-Override. */
function jpegWithSizeOverride(width: number, height: number, sizeBytes: number): { bytes: Uint8Array; sizeBytes: number } {
  return { bytes: makeJpeg(width, height), sizeBytes };
}

function baseValidation(): UploadValidationResult {
  return { issues: [], isValid: true, errorCount: 0, warningCount: 0 };
}

describe("KDP-Cover-Konstanten", () => {
  it("kodiert die KDP-Vorgaben (Idealmaß, Mindestkante, Formate)", () => {
    expect(KDP_COVER_IDEAL_WIDTH).toBe(1600);
    expect(KDP_COVER_IDEAL_HEIGHT).toBe(2560);
    expect(KDP_COVER_MIN_SHORT_EDGE).toBe(1000);
    expect(KDP_COVER_MAX_FILE_BYTES).toBe(50 * 1024 * 1024);
    expect([...KDP_COVER_ALLOWED_EXTENSIONS]).toEqual(
      expect.arrayContaining([".jpg", ".jpeg", ".tif", ".tiff"]),
    );
  });
});

describe("detectImageFormat", () => {
  it("erkennt JPEG, PNG, TIFF (LE+BE) und Unbekannt", () => {
    expect(detectImageFormat(makeJpeg(100, 100))).toBe("jpeg");
    expect(detectImageFormat(makePng(100, 100))).toBe("png");
    expect(detectImageFormat(new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0x08]))).toBe("tiff");
    expect(detectImageFormat(new Uint8Array([0x4d, 0x4d, 0x00, 0x2a, 0x00]))).toBe("tiff");
    expect(detectImageFormat(new TextEncoder().encode("fake-cover-bytes"))).toBe("unknown");
    expect(detectImageFormat(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBe("unknown"); // GIF
  });
});

describe("Header-Parser", () => {
  it("parsePngDimensions liest Breite/Hoehe aus IHDR", () => {
    expect(parsePngDimensions(makePng(1600, 2560))).toEqual({ width: 1600, height: 2560 });
  });

  it("parseJpegDimensions ueberspringt APP0 und liest SOF0", () => {
    expect(parseJpegDimensions(makeJpeg(1600, 2560))).toEqual({ width: 1600, height: 2560 });
  });

  it("parseImageDimensions dispatched per Magie, TIFF ergibt null", () => {
    expect(parseImageDimensions(makePng(10, 20))).toEqual({ width: 10, height: 20 });
    expect(parseImageDimensions(makeJpeg(30, 40))).toEqual({ width: 30, height: 40 });
    expect(parseImageDimensions(new Uint8Array([0x49, 0x49, 0x2a, 0x00]))).toBeNull();
    expect(parseImageDimensions(new TextEncoder().encode("kein-bild"))).toBeNull();
  });

  it("weist korrupte Header ab (falsche PNG-Signatur, JPEG ohne SOF)", () => {
    const broken = makePng(10, 10);
    broken[0] = 0x00;
    expect(parsePngDimensions(broken)).toBeNull();
    expect(parseJpegDimensions(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBeNull();
  });
});

describe("validateKdpCover", () => {
  it("Idealmaß-JPEG (1600×2560) ist fehler- und warnungsfrei", () => {
    const big = new Uint8Array(6000);
    big.set(makeJpeg(1600, 2560));
    const r = validateKdpCover(big, { name: "cover.jpg", mimeType: "image/jpeg", sizeBytes: 6000 });
    expect(r.isValid).toBe(true);
    expect(r.issues).toHaveLength(0);
    expect(r.dimensions).toEqual({ width: 1600, height: 2560 });
    expect(r.format).toBe("jpeg");
  });

  it("zu kleines Cover (800×600) ist ein Fehler mit Fix-Hinweis", () => {
    const r = validateKdpCover(makeJpeg(800, 600), { name: "cover.jpg", sizeBytes: 6000 });
    expect(r.isValid).toBe(false);
    const err = r.issues.find((i) => i.code === "too-small");
    expect(err?.severity).toBe("error");
    expect(err?.message).toContain("800×600");
    expect(err?.fix.length).toBeGreaterThan(0);
  });

  it("unter Idealmaß, aber ≥ Mindestkante (1200×1920) gibt Warnung statt Fehler", () => {
    const r = validateKdpCover(makeJpeg(1200, 1920), { name: "cover.jpg", sizeBytes: 6000 });
    expect(r.isValid).toBe(true);
    expect(r.issues.some((i) => i.code === "below-ideal" && i.severity === "warning")).toBe(true);
  });

  it("Querformat (2560×1600) ist ein Fehler", () => {
    const r = validateKdpCover(makeJpeg(2560, 1600), { name: "cover.jpg", sizeBytes: 6000 });
    expect(r.isValid).toBe(false);
    expect(r.issues.some((i) => i.code === "landscape" && i.severity === "error")).toBe(true);
  });

  it("falsches Seitenverhaeltnis (1000×2000, Ratio 2:1) warnt", () => {
    const r = validateKdpCover(makeJpeg(1000, 2000), { name: "cover.jpg", sizeBytes: 6000 });
    expect(r.isValid).toBe(true); // kurze Kante exakt 1000 → kein Fehler
    expect(r.issues.some((i) => i.code === "ratio" && i.severity === "warning")).toBe(true);
  });

  it("leere Datei ist ein Fehler", () => {
    const r = validateKdpCover(new Uint8Array(0), { name: "cover.jpg", sizeBytes: 0 });
    expect(r.isValid).toBe(false);
    expect(r.issues.some((i) => i.code === "empty")).toBe(true);
  });

  it("fremdes Format (GIF-Bytes + .gif) ist ein Fehler", () => {
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, ...new Array(6000).fill(0)]);
    const r = validateKdpCover(gif, { name: "cover.gif", sizeBytes: gif.length });
    expect(r.isValid).toBe(false);
    expect(r.issues.some((i) => i.code === "unsupported-format")).toBe(true);
  });

  it("PNG wird mit Warnung (nicht Fehler) durchgewinkt", () => {
    const png = new Uint8Array(6000);
    png.set(makePng(1600, 2560));
    const r = validateKdpCover(png, { name: "cover.png", sizeBytes: 6000 });
    expect(r.isValid).toBe(true);
    expect(r.issues.some((i) => i.code === "png-format" && i.severity === "warning")).toBe(true);
  });

  it("unlesbare Bytes mit erlaubter Endung warnen nur (additiv, bricht Bundle nicht)", () => {
    const fake = new TextEncoder().encode("fake-cover-bytes");
    const r = validateKdpCover(fake, { name: "cover.jpg", mimeType: "image/jpeg", sizeBytes: fake.length });
    expect(r.isValid).toBe(true);
    expect(r.issues.some((i) => i.code === "undecodable")).toBe(true);
  });

  it("TIFF wird akzeptiert, Maße per Warnung an den Autor delegiert", () => {
    const tiff = new Uint8Array(6000);
    tiff.set([0x49, 0x49, 0x2a, 0x00]);
    const r = validateKdpCover(tiff, { name: "cover.tif", sizeBytes: 6000 });
    expect(r.isValid).toBe(true);
    expect(r.format).toBe("tiff");
    expect(r.issues.some((i) => i.code === "tiff-unchecked")).toBe(true);
  });

  it("Datei > 50 MB ist ein Fehler (ohne 50 MB zu allokieren)", () => {
    const { bytes, sizeBytes } = jpegWithSizeOverride(1600, 2560, 51 * 1024 * 1024);
    const r = validateKdpCover(bytes, { name: "cover.jpg", sizeBytes });
    expect(r.isValid).toBe(false);
    expect(r.issues.some((i) => i.code === "too-large")).toBe(true);
  });

  it("Endung passt nicht zu den Bytes (.jpg mit PNG-Inhalt) warnt", () => {
    const png = new Uint8Array(6000);
    png.set(makePng(1600, 2560));
    const r = validateKdpCover(png, { name: "cover.jpg", sizeBytes: 6000 });
    // PNG-Warnung greift (Bytes schlagen Endung), kein Fehler.
    expect(r.isValid).toBe(true);
    expect(r.issues.some((i) => i.code === "png-format")).toBe(true);
  });
});

describe("Nahtstelle zu kdpPackage (additiv)", () => {
  it("toUploadValidationIssues mappt auf field 'file' inkl. Fix", () => {
    const check: KdpCoverValidationResult = validateKdpCover(makeJpeg(800, 600), {
      name: "cover.jpg",
      sizeBytes: 6000,
    });
    const mapped = toUploadValidationIssues(check);
    expect(mapped.length).toBeGreaterThan(0);
    expect(mapped.every((m) => m.field === "file")).toBe(true);
    expect(mapped.some((m) => m.message.includes("Fix:"))).toBe(true);
  });

  it("mergeCoverIntoValidation kippt isValid nur bei Fehlern", () => {
    const okBase = baseValidation();
    const warnCheck = validateKdpCover(makeJpeg(1200, 1920), { name: "cover.jpg", sizeBytes: 6000 });
    mergeCoverIntoValidation(okBase, warnCheck);
    expect(okBase.isValid).toBe(true);
    expect(okBase.warningCount).toBeGreaterThan(0);

    const errBase = baseValidation();
    const errCheck = validateKdpCover(makeJpeg(800, 600), { name: "cover.jpg", sizeBytes: 6000 });
    mergeCoverIntoValidation(errBase, errCheck);
    expect(errBase.isValid).toBe(false);
    expect(errBase.errorCount).toBeGreaterThan(0);
  });

  it("merge mit null ist ein No-Op (kein Cover → kein Check)", () => {
    const base = baseValidation();
    mergeCoverIntoValidation(base, null);
    expect(base).toEqual({ issues: [], isValid: true, errorCount: 0, warningCount: 0 });
  });
});
