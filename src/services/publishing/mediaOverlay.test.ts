// Tests: Media-Overlay-Service (WP 37.2)
import { describe, it, expect } from "vitest";
import {
  generateSmil,
  wireManifest,
  formatTimecode,
} from "./mediaOverlay";

// ---------------------------------------------------------------------------
// formatTimecode
// ---------------------------------------------------------------------------

describe("formatTimecode", () => {
  it("0ms ergibt 00:00:00.000", () => {
    expect(formatTimecode(0)).toBe("00:00:00.000");
  });

  it("1000ms ergibt 00:00:01.000", () => {
    expect(formatTimecode(1000)).toBe("00:00:01.000");
  });

  it("60000ms ergibt 00:01:00.000", () => {
    expect(formatTimecode(60000)).toBe("00:01:00.000");
  });

  it("3661000ms ergibt 01:01:01.000", () => {
    expect(formatTimecode(3661000)).toBe("01:01:01.000");
  });

  it("83450ms ergibt 00:01:23.450", () => {
    expect(formatTimecode(83450)).toBe("00:01:23.450");
  });

  it("negative Werte werden zu 00:00:00.000", () => {
    expect(formatTimecode(-500)).toBe("00:00:00.000");
  });

  it("NaN wird zu 00:00:00.000", () => {
    expect(formatTimecode(NaN)).toBe("00:00:00.000");
  });

  it("Infinity wird zu 00:00:00.000", () => {
    expect(formatTimecode(Infinity)).toBe("00:00:00.000");
  });
});

// ---------------------------------------------------------------------------
// generateSmil
// ---------------------------------------------------------------------------

describe("generateSmil", () => {
  it("leeres Array ergibt leeres SMIL-Dokument", () => {
    const doc = generateSmil([], 10000);
    expect(doc.sentenceCount).toBe(0);
    expect(doc.totalDurationMs).toBe(0);
    expect(doc.xml).toContain("<smil");
    expect(doc.xml).toContain("</smil>");
  });

  it("null/undefined Array ergibt leeres SMIL-Dokument", () => {
    const doc = generateSmil(null as unknown as string[], 10000);
    expect(doc.sentenceCount).toBe(0);
    expect(doc.totalDurationMs).toBe(0);
  });

  it("einzelner Satz ergibt ein par-Element", () => {
    const doc = generateSmil(["Hallo Welt"], 5000);
    expect(doc.sentenceCount).toBe(1);
    expect(doc.totalDurationMs).toBe(5000);
    expect(doc.xml).toContain("<par");
    expect(doc.xml).toContain('id="s1"');
    expect(doc.xml).toContain('clipBegin="00:00:00.000"');
    expect(doc.xml).toContain('clipEnd="00:00:05.000"');
  });

  it("drei Sätze ergiben drei par-Elemente mit korrekten IDs", () => {
    const doc = generateSmil(["Eins", "Zwei", "Drei"], 9000);
    expect(doc.sentenceCount).toBe(3);
    expect(doc.xml).toContain('id="s1"');
    expect(doc.xml).toContain('id="s2"');
    expect(doc.xml).toContain('id="s3"');
  });

  it("Dauer wird gleichmäßig auf Sätze verteilt", () => {
    const doc = generateSmil(["A", "B", "C"], 9000);
    expect(doc.xml).toContain('clipBegin="00:00:00.000"');
    expect(doc.xml).toContain('clipEnd="00:00:03.000"');
    expect(doc.xml).toContain('clipBegin="00:00:03.000"');
    expect(doc.xml).toContain('clipEnd="00:00:06.000"');
    expect(doc.xml).toContain('clipBegin="00:00:06.000"');
    expect(doc.xml).toContain('clipEnd="00:00:09.000"');
  });

  it("SMIL-Dokument enthält W3C-Namespace", () => {
    const doc = generateSmil(["Test"], 1000);
    expect(doc.xml).toContain('xmlns="http://www.w3.org/ns/SMIL"');
    expect(doc.xml).toContain('version="3.0"');
  });

  it("SMIL-Dokument ist XML-valide (geschachtelte Struktur)", () => {
    const doc = generateSmil(["Eins", "Zwei"], 4000);
    expect(doc.xml).toContain("<body>");
    expect(doc.xml).toContain("</body>");
    expect(doc.xml).toContain("<seq>");
    expect(doc.xml).toContain("</seq>");
    expect(doc.xml).toContain("<text src=");
    expect(doc.xml).toContain("<audio ");
  });

  it("negative Dauer ergibt leeres Dokument", () => {
    const doc = generateSmil(["Test"], -1000);
    expect(doc.sentenceCount).toBe(0);
    expect(doc.totalDurationMs).toBe(0);
  });

  it("NaN Dauer ergibt leeres Dokument", () => {
    const doc = generateSmil(["Test"], NaN);
    expect(doc.sentenceCount).toBe(0);
    expect(doc.totalDurationMs).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// wireManifest
// ---------------------------------------------------------------------------

describe("wireManifest", () => {
  const BASE_OPF = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:test</dc:identifier>
    <dc:title>Test</dc:title>
  </metadata>
  <manifest>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
</package>`;

  it("fügt SMIL-Item vor </manifest> ein", () => {
    const result = wireManifest(BASE_OPF, "smil");
    expect(result).toContain('id="smil"');
    expect(result).toContain('href="smil.smil"');
    expect(result).toContain('media-type="application/smil+xml"');
    expect(result).toContain("</manifest>");
  });

  it("bestehende Items bleiben erhalten", () => {
    const result = wireManifest(BASE_OPF, "smil");
    expect(result).toContain('id="chapter1"');
    expect(result).toContain('href="chapter1.xhtml"');
  });

  it("leerer smilId verwendet Fallback 'smil'", () => {
    const result = wireManifest(BASE_OPF, "");
    expect(result).toContain('id="smil"');
  });

  it("OPF ohne </manifest> erhält neuen Manifest-Block", () => {
    const opf = `<?xml version="1.0"?><package></package>`;
    const result = wireManifest(opf, "overlay");
    expect(result).toContain("<manifest>");
    expect(result).toContain('id="overlay"');
    expect(result).toContain("</manifest>");
  });

  it("leerer OPF-String erhält Manifest-Block", () => {
    const result = wireManifest("", "smil");
    expect(result).toContain("<manifest>");
    expect(result).toContain('id="smil"');
  });
});
