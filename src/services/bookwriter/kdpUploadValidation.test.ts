// Tests: KDP-Upload-Validierung (Pre-Upload-Check, Sprint 7, Agent 1).
//
// Akzeptanzkriterium: Pre-Upload-Check — Dateigröße, Format, Pflichtfelder.
// Ergänzt die Metadaten-Validierung aus src/services/kdp/validation.ts um die
// Artefakt-Prüfung (Datei vorhanden, Format DOCX/EPUB, Größenlimits, ISBN).
import { describe, it, expect } from "vitest";
import { validateUploadArtefact, KDP_MAX_FILE_BYTES, type UploadFile } from "./kdpUploadValidation";
import type { KdpMetadata } from "@/types/bookwriter";

function meta(overrides: Partial<KdpMetadata> = {}): KdpMetadata {
  return {
    title: "Der Testtitan",
    subtitle: "Ein Unit-Test-Roman",
    blurbVariants: ["Ein Buch über Tests.".repeat(4)],
    shortDescription: "Kurzbeschreibung",
    keywords: ["tests", "qualität"],
    categories: ["Fiction > Thriller"],
    authorBio: "Autorin stellt sich vor.",
    seriesIdea: null,
    marketingNotes: null,
    coverImage: "cover.jpg",
    priceUsd: 4.99,
    ...overrides,
  };
}

function file(overrides: Partial<UploadFile> = {}): UploadFile {
  return {
    name: "manuscript.epub",
    sizeBytes: 1_500_000,
    mimeType: "application/epub+zip",
    ...overrides,
  };
}

describe("validateUploadArtefact — Format", () => {
  it("EPUB und DOCX werden akzeptiert", () => {
    expect(validateUploadArtefact(file(), meta()).isValid).toBe(true);
    expect(validateUploadArtefact(file({ name: "manuscript.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), meta()).isValid).toBe(true);
  });

  it("PDF/Markdown/TXT ist ein Fehler (KDP-Upload-Vertrag: nur DOCX/EPUB)", () => {
    for (const name of ["manuscript.pdf", "manuscript.md", "manuscript.txt"]) {
      const r = validateUploadArtefact(file({ name }), meta());
      expect(r.isValid).toBe(false);
      expect(r.issues.some((i) => i.field === "file" && /format/i.test(i.message))).toBe(true);
    }
  });

  it("keine Datei angegeben ist ein Fehler", () => {
    const r = validateUploadArtefact(null, meta());
    expect(r.isValid).toBe(false);
    expect(r.issues.some((i) => i.field === "file")).toBe(true);
  });

  it("leerer Dateiname ist ein Fehler", () => {
    const r = validateUploadArtefact(file({ name: "" }), meta());
    expect(r.isValid).toBe(false);
  });
});

describe("validateUploadArtefact — Dateigröße", () => {
  it("leere Datei (0 Bytes) ist ein Fehler", () => {
    const r = validateUploadArtefact(file({ sizeBytes: 0 }), meta());
    expect(r.isValid).toBe(false);
    expect(r.issues.some((i) => i.field === "file" && /größe|leer/i.test(i.message))).toBe(true);
  });

  it("Datei unter dem Minimum wird mit Fehler markiert", () => {
    const r = validateUploadArtefact(file({ sizeBytes: 100 }), meta());
    expect(r.isValid).toBe(false);
  });

  it("Datei über KDP-Limit (650 MB) ist ein Fehler", () => {
    const r = validateUploadArtefact(file({ sizeBytes: KDP_MAX_FILE_BYTES + 1 }), meta());
    expect(r.isValid).toBe(false);
    expect(r.issues.some((i) => /größe|650/i.test(i.message))).toBe(true);
  });

  it("Export-Meldung enthält lesbare MB-Angabe", () => {
    const r = validateUploadArtefact(file({ sizeBytes: 700 * 1024 * 1024 }), meta());
    expect(r.issues.some((i) => i.message.includes("650 MB"))).toBe(true);
  });
});

describe("validateUploadArtefact — Pflichtfelder (KDP)", () => {
  it("gültiges Paket ohne ISBN (KDP vergibt eigene) ist valide", () => {
    expect(validateUploadArtefact(file(), meta()).isValid).toBe(true);
  });

  it("fehlender Titel / fehlender Klappentext / keine Keywords sind Fehler", () => {
    expect(validateUploadArtefact(file(), meta({ title: "" })).isValid).toBe(false);
    expect(validateUploadArtefact(file(), meta({ blurbVariants: [] })).isValid).toBe(false);
    expect(validateUploadArtefact(file(), meta({ keywords: [] })).isValid).toBe(false);
  });

  it("Preis außerhalb 0.99–200 USD ist ein Fehler", () => {
    expect(validateUploadArtefact(file(), meta({ priceUsd: 0.10 })).isValid).toBe(false);
    expect(validateUploadArtefact(file(), meta({ priceUsd: 500 })).isValid).toBe(false);
    // fehlender Preis = Warnung, kein Blocker
    const r = validateUploadArtefact(file(), meta({ priceUsd: null }));
    expect(r.isValid).toBe(true);
    expect(r.warningCount).toBeGreaterThanOrEqual(1);
  });

  it("ISBN: vorhanden + valide ISBN-13 → ok; vorhanden + invalide → Fehler", () => {
    expect(validateUploadArtefact(file(), meta(), { isbn: "978-3-16-148410-0" }).isValid).toBe(true);
    const r = validateUploadArtefact(file(), meta(), { isbn: "978-3-16-148410-9" });
    expect(r.isValid).toBe(false);
    expect(r.issues.some((i) => /isbn/i.test(i.message))).toBe(true);
  });

  it("Fehler zählen errorCount, Warnungen warningCount", () => {
    const r = validateUploadArtefact(null, meta({ title: "" }));
    expect(r.errorCount).toBeGreaterThanOrEqual(2);
    expect(r.isValid).toBe(false);
  });
});
