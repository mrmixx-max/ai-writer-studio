// @vitest-environment happy-dom
// Unit-Tests für das KDP-Package (Ordnerstruktur im Speicher) und den
// Download-Stapel (downloadKdpPackage, mit gefangenem createObjectURL).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import JSZip from "jszip";
import { buildKdpPackage, downloadKdpPackage } from "./packaging";
import type { ChapterData } from "../bookwriter/workflow";
import type { KdpMetadata } from "@/types/bookwriter";

const metadata: KdpMetadata = {
  title: "Mein KDP-Buch",
  subtitle: "Ein Untertitel",
  blurbVariants: ["Ein Klappentext."],
  shortDescription: "Kurz.",
  keywords: ["fantasy"],
  categories: ["Fiction > Fantasy"],
  authorBio: "Autorin.",
  seriesIdea: null,
  marketingNotes: null,
  coverImage: null,
};

function chapter(title: string, text: string): ChapterData {
  return {
    id: `ch-${title}`,
    title,
    content: JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    }),
    wordCount: text.split(/\s+/).length,
  };
}

const pngBase64 = Buffer.from("PNGDATA").toString("base64");

describe("buildKdpPackage", () => {
  it("erstellt DOCX, PDF, EPUB und Metadaten-JSON", async () => {
    const files = await buildKdpPackage(
      [chapter("Kapitel Eins", "Erster Text."), chapter("Kapitel Zwei", "Zweiter Text.")],
      metadata,
      "Projektname",
      "Erika Muster",
    );

    const names = files.map((f) => f.name);
    expect(names).toEqual([
      "Mein KDP-Buch.docx",
      "Mein KDP-Buch.pdf",
      "Mein KDP-Buch.epub",
      "kdp-metadata.json",
    ]);

    // DOCX/EPUB sind ZIPs, PDF beginnt mit %PDF-
    const docx = await JSZip.loadAsync(await files[0].blob.arrayBuffer());
    expect(await docx.file("word/document.xml")!.async("string")).toContain("Kapitel Eins");

    const pdf = new Uint8Array(await files[1].blob.arrayBuffer());
    expect(String.fromCharCode(...pdf.slice(0, 5))).toBe("%PDF-");

    const epub = await JSZip.loadAsync(await files[2].blob.arrayBuffer());
    const opf = await epub.file("OEBPS/content.opf")!.async("string");
    expect(opf).toContain("<dc:title>Mein KDP-Buch</dc:title>");
    expect(opf).toContain("<dc:creator>Erika Muster</dc:creator>");

    const meta = JSON.parse(await files[3].blob.text());
    expect(meta.title).toBe("Mein KDP-Buch");
    expect(files.every((f) => f.blob.size > 0)).toBe(true);
  });

  it("bindet ein vorhandenes Cover als PNG ein", async () => {
    const files = await buildKdpPackage(
      [chapter("K1", "Text")],
      { ...metadata, coverImage: `data:image/png;base64,${pngBase64}` },
      "P",
    );
    const cover = files.find((f) => f.name === "cover.png");
    expect(cover).toBeDefined();
    expect(new Uint8Array(await cover!.blob.arrayBuffer())[0]).toBe("P".charCodeAt(0));
  });

  it("ignoriert ungültige Cover-Daten stillschweigend", async () => {
    const files = await buildKdpPackage(
      [chapter("K1", "Text")],
      { ...metadata, coverImage: "gar-keine-data-url" },
      "P",
    );
    expect(files.some((f) => f.name.startsWith("cover"))).toBe(false);
    expect(files.map((f) => f.name)).toContain("kdp-metadata.json");
  });

  it("sanitisert Dateinamen (ungültige Zeichen → Unterstrich)", async () => {
    const files = await buildKdpPackage([chapter("K1", "T")], { ...metadata, title: 'Buch: "Tests"/2026?' }, "P");
    expect(files[0].name).toBe('Buch_ _Tests__2026_.docx');
  });

  it("fällt auf den Projektnamen zurück, wenn der Titel leer ist", async () => {
    const files = await buildKdpPackage([chapter("K1", "T")], { ...metadata, title: "" }, "Fallback-Projekt");
    expect(files[0].name).toBe("Fallback-Projekt.docx");
  });

  it("meldet Fortschritt in aufsteigender Reihenfolge", async () => {
    const calls: [number, string][] = [];
    await buildKdpPackage([chapter("K1", "T")], metadata, "P", "A", (p, label) => calls.push([p, label]));
    const percents = calls.map((c) => c[0]);
    expect(percents[0]).toBe(5);
    expect(percents[percents.length - 1]).toBe(100);
    expect(percents).toEqual([...percents].sort((a, b) => a - b));
    expect(calls.length).toBeGreaterThanOrEqual(6);
  });
});

describe("downloadKdpPackage", () => {
  beforeEach(() => {
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:fake-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("liefert Ordnername, Dateiliste und Gesamtgröße; lädt jede Datei einzeln", async () => {
    const clicks = vi.spyOn(HTMLAnchorElement.prototype, "click");
    const result = await downloadKdpPackage([chapter("K1", "Text")], metadata, "Mein KDP-Buch", "Erika");
    expect(result.folderName).toBe("Mein KDP-Buch_kdp");
    expect(result.files).toEqual([
      "Mein KDP-Buch.docx",
      "Mein KDP-Buch.pdf",
      "Mein KDP-Buch.epub",
      "kdp-metadata.json",
    ]);
    expect(result.totalSizeBytes).toBeGreaterThan(0);
    expect(clicks).toHaveBeenCalledTimes(result.files.length);
  });

  it("übernimmt ein gültiges Cover in das Paket", async () => {
    const result = await downloadKdpPackage(
      [chapter("K1", "T")],
      { ...metadata, coverImage: `data:image/png;base64,${pngBase64}` },
      "P",
    );
    expect(result.files).toContain("cover.png");
  });
});
