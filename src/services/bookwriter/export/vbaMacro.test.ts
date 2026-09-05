// Tests Sprint 4 / Agent 2: VBA-Macro-Generator ("AI Text Refinement").
//
// Der Service erzeugt je Buch ein dediziertes VBA-Modul (.bas), das in Word
// importiert wird und:
//   1. harte Zeilenumbrüche (^l) bereinigt
//   2. gerade Anführungszeichen in typografische „" ("“) umwandelt
//   3. doppelte Leerzeichen und Zero-Width-Artefakte entfernt
//   4. die Sprint-3-DOCX-Styles (Standard/StandardEingerückt/Einzug/Heading1/2)
//      in native Word-Formatvorlagen mappt
//   5. die versteckten Kapitel-Tags (U+200B, vba.ts) vor dem Zero-Width-Clean
//      entfernt, damit die Anker nicht zu Artefakt-Cleanup kollidieren

import { describe, it, expect } from "vitest";
import { buildAiwsVbaBas, buildAiwsBasFilename } from "./vbaMacro";
import { makeTestBook } from "../testbook";

const book = makeTestBook();

describe("buildAiwsVbaBas", () => {
  const bas = buildAiwsVbaBas(
    { title: "Testbuch: KI verstehen", author: "Testautor", language: "de" },
    book.chapters,
  );

  it("erzeugt ein gültiges VBA-Modul (Attribute VB_Name + Option Explicit)", () => {
    expect(bas).toMatch(/^Attribute VB_Name = "AIWSTextRefinement"/);
    expect(bas).toContain("Option Explicit");
    expect(bas).toContain("Sub AIWS_RefineAll()");
  });

  it("bettet die Buch-Metadaten als Konstanten ein", () => {
    expect(bas).toContain('Private Const AIWS_BOOK_TITLE As String = "Testbuch: KI verstehen"');
    expect(bas).toContain("Private Const AIWS_CHAPTER_COUNT As Long = 8");
    expect(bas).toContain('Private Const AIWS_LANGUAGE As String = "de"');
  });

  it("doppelt VBA-Strings, die Anführungszeichen enthalten", () => {
    const escaped = buildAiwsVbaBas(
      { title: 'Das "andere" Buch', author: "X", language: "de" },
      book.chapters,
    );
    expect(escaped).toContain('Private Const AIWS_BOOK_TITLE As String = "Das ""andere"" Buch"');
  });

  it("ist deterministisch (kein Zeitstempel im Output)", () => {
    const a = buildAiwsVbaBas(
      { title: "Buch", author: "A", language: "de" },
      book.chapters,
    );
    const b = buildAiwsVbaBas(
      { title: "Buch", author: "A", language: "de" },
      book.chapters,
    );
    expect(a).toBe(b);
  });

  // --- 1) Harte Zeilenumbrüche ----------------------------------------------

  it("bereinigt harte Zeilenumbrüche (^l → Leerzeichen)", () => {
    expect(bas).toContain("Sub AIWS_CleanHardLineBreaks(doc As Document)");
    expect(bas).toContain('.Text = "^l"');
  });

  // --- 2) Typografische Anführungszeichen ------------------------------------

  it("korrigiert Anführungszeichen über alternierende Ersetzung", () => {
    expect(bas).toContain("Sub AIWS_FixTypographicQuotes(doc As Document)");
    // Deutsch: „ … “
    expect(bas).toContain("ChrW(&H201E)");
    expect(bas).toContain("ChrW(&H201C)");
    // Englisch: “ … ”
    expect(bas).toContain("ChrW(&H201D)");
  });

  // --- 3) Doppelte Leerzeichen + Zero-Width ----------------------------------

  it("entfernt doppelte Leerzeichen und Zeilenende-Leerzeichen", () => {
    expect(bas).toContain("Sub AIWS_CleanSpacesAndZeroWidth(doc As Document)");
    expect(bas).toContain('.Text = "  "');
    expect(bas).toContain('.Replacement.Text = " "');
  });

  it("entfernt Zero-Width-Artefakte (U+200B/200C/200D, U+2060, BOM, Soft-Hyphen)", () => {
    for (const code of ["200B", "200C", "200D", "2060", "FEFF", "AD"]) {
      expect(bas).toContain(`&H${code}`);
      expect(bas).toContain("ChrW(CLng(c))");
    }
  });

  // --- 4) Style-Mapping --------------------------------------------------------

  it("mappt Sprint-3-DOCX-Styles auf native Word-Formatvorlagen", () => {
    expect(bas).toContain("Sub AIWS_ApplyNativeStyles(doc As Document)");
    // Heading1/Heading2 → native Überschriften
    expect(bas).toContain("wdStyleHeading1");
    expect(bas).toContain("wdStyleHeading2");
    // Standard → native Normal-Vorlage
    expect(bas).toContain("wdStyleNormal");
    // StandardEingerückt → Body Text
    expect(bas).toContain("wdStyleBodyText");
    // Einzug (Zitate/Listen) → native Zitat-Vorlage
    expect(bas).toContain("wdStyleQuote");
    // Alle Sprint-3-Style-Namen werden erkannt
    expect(bas).toContain('"Heading1"');
    expect(bas).toContain('"Heading2"');
    expect(bas).toContain('"Standard"');
    expect(bas).toContain('"StandardEingerückt"');
    expect(bas).toContain('"Standard Eingerückt"');
    expect(bas).toContain('"Einzug"');
  });

  // --- 5) Versteckte Kapitel-Tags vor dem Zero-Width-Clean ---------------------

  it("entfernt versteckte Kapitel-Tags (U+200B) bevor Zero-Width-Text bereinigt wird", () => {
    expect(bas).toContain("Sub AIWS_RemoveHiddenChapterTags(doc As Document)");
    // Reihenfolge im Orchestrator: Styles → Umbrüche → Anführungszeichen →
    // Tags entfernen → Leerzeichen/Zero-Width
    const refine = bas.slice(bas.indexOf("Sub AIWS_RefineAll()"));
    const order = [
      refine.indexOf("AIWS_ApplyNativeStyles"),
      refine.indexOf("AIWS_CleanHardLineBreaks"),
      refine.indexOf("AIWS_FixTypographicQuotes"),
      refine.indexOf("AIWS_RemoveHiddenChapterTags"),
      refine.indexOf("AIWS_CleanSpacesAndZeroWidth"),
    ];
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

describe("buildAiwsBasFilename", () => {
  it("erzeugt einen .bas-Dateinamen aus dem Buchtitel", () => {
    expect(buildAiwsBasFilename("Testbuch: KI verstehen")).toBe(
      "AIWSTextRefinement_Testbuch_ KI verstehen.bas",
    );
  });

  it("entschärft dateisystem-gefährliche Zeichen", () => {
    expect(buildAiwsBasFilename('Buch <>:"/\\|?*')).toBe("AIWSTextRefinement_Buch _________.bas");
  });
});
