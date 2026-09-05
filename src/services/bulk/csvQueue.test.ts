// Unit-Tests: CSV-Job-Queue für den BulkOrchestrator (Sprint 5, Agent 2).
//
// Akzeptanz: CSV mit Spalten (Titel, Genre, Target-Wörterzahl, Spezial-Prompt,
// Sprache) wird korrekt eingelesen — inkl. Quoting, BOM, CRLF, Genre-/Sprach-
// Normalisierung und Zeilen-für-Zeilen-Fehlerberichte (kein Throw pro Zeile).

import { describe, it, expect } from "vitest";
import { parseBulkJobsCsv, BULK_CSV_HEADERS } from "./csvQueue";

const HEADER = "Titel,Genre,Target-Wörterzahl,Spezial-Prompt,Sprache";

describe("parseBulkJobsCsv", () => {
  it("liest eine reguläre CSV mit allen fünf Spalten korrekt ein", () => {
    const csv = [
      HEADER,
      "KI im Alltag,sachbuch,50000,Praxisnah und ohne Fachjargon,de",
      "Sturm über Haven,krimi,90000,Dunkler Nordsee-Krimi,en",
    ].join("\n");

    const res = parseBulkJobsCsv(csv);
    expect(res.invalid).toEqual([]);
    expect(res.jobs).toHaveLength(2);

    expect(res.jobs[0]).toMatchObject({
      title: "KI im Alltag",
      genre: "sachbuch",
      targetWords: 50000,
      specialPrompt: "Praxisnah und ohne Fachjargon",
      language: "de",
    });
    expect(res.jobs[1]).toMatchObject({
      title: "Sturm über Haven",
      genre: "krimi",
      targetWords: 90000,
      specialPrompt: "Dunkler Nordsee-Krimi",
      language: "en",
    });
    // Ids werden vergeben und sind eindeutig.
    expect(res.jobs[0].id).toBeTruthy();
    expect(res.jobs[1].id).not.toBe(res.jobs[0].id);
  });

  it("akzeptiert deutsche Genre-Labels und Sprachnamen (Normalisierung)", () => {
    const csv = [
      HEADER,
      "Buch A,Sachbuch,30000,,Deutsch",
      "Buch B,Fantasy / Science Fiction,120000,,englisch",
      "Buch C,Technisches Nonfiction,40000,,German",
    ].join("\n");

    const res = parseBulkJobsCsv(csv);
    expect(res.invalid).toEqual([]);
    expect(res.jobs.map((j) => j.genre)).toEqual(["sachbuch", "fantasy", "technik"]);
    expect(res.jobs.map((j) => j.language)).toEqual(["de", "en", "de"]);
  });

  it("ignoriert Groß-/Kleinschreibung und Whitespace in Genre/Sprache", () => {
    const csv = [HEADER, "Buch X,  ROMAN ,25000,, EN "].join("\n");
    const res = parseBulkJobsCsv(csv);
    expect(res.jobs[0].genre).toBe("roman");
    expect(res.jobs[0].language).toBe("en");
  });

  it("parst quoted Fields mit Kommas, Anführungszeichen und Zeilenumbrüchen", () => {
    const csv = [
      HEADER,
      `"Mein Buch, Teil 1",sachbuch,40000,"Schreibstil: klar, präzise; Thema: KI",de`,
      `"Buch ""Spezial""",roman,80000,"Prompt mit
Zeilenumbruch",en`,
    ].join("\n");

    const res = parseBulkJobsCsv(csv);
    expect(res.invalid).toEqual([]);
    expect(res.jobs[0].title).toBe("Mein Buch, Teil 1");
    expect(res.jobs[0].specialPrompt).toBe("Schreibstil: klar, präzise; Thema: KI");
    expect(res.jobs[1].title).toBe('Buch "Spezial"');
    expect(res.jobs[1].specialPrompt).toBe("Prompt mit\nZeilenumbruch");
  });

  it("verarbeitet BOM und CRLF-Zeilenenden", () => {
    const csv = "\uFEFF" + [HEADER, "Buch A,sachbuch,10000,,de"].join("\r\n") + "\r\n";
    const res = parseBulkJobsCsv(csv);
    expect(res.jobs).toHaveLength(1);
    expect(res.jobs[0].title).toBe("Buch A");
  });

  it("nutzt Default-Werte: Sprache=de, Target=0 (auto), leerer Spezial-Prompt", () => {
    const csv = "Titel,Genre\nNur Titel und Genre,ratgeber\n";
    const res = parseBulkJobsCsv(csv);
    expect(res.jobs[0]).toMatchObject({
      title: "Nur Titel und Genre",
      genre: "ratgeber",
      targetWords: 0,
      specialPrompt: "",
      language: "de",
    });
  });

  it("meldet invalide Zeilen (unbekanntes Genre, falsche Wortzahl) statt zu werfen", () => {
    const csv = [
      HEADER,
      "Gutes Buch,sachbuch,30000,,de",
      "Falsches Genre,drama,30000,,de",
      "Keine Zahl,sachbuch,viele,,de",
      "Negativ,sachbuch,-5,,de",
      "Ohne Titel,,30000,,de",
    ].join("\n");

    const res = parseBulkJobsCsv(csv);
    expect(res.jobs).toHaveLength(1);
    expect(res.jobs[0].title).toBe("Gutes Buch");
    expect(res.invalid).toHaveLength(4);
    expect(res.invalid.map((i) => i.row)).toEqual([3, 4, 5, 6]);
    expect(res.invalid.every((i) => i.error.length > 0)).toBe(true);
  });

  it("leere/Whitespace-Zeilen werden übersprungen", () => {
    const csv = [HEADER, "", "   ", "Buch A,sachbuch,10000,,de"].join("\n");
    const res = parseBulkJobsCsv(csv);
    expect(res.jobs).toHaveLength(1);
    expect(res.invalid).toHaveLength(0);
  });

  it("wirft bei fehlender Kopfzeile / unbekannten Headern", () => {
    expect(() => parseBulkJobsCsv("irgendein,text\n1,2")).toThrow(/Kopfzeile/i);
    expect(() => parseBulkJobsCsv("A,B\n1,2")).toThrow(/Kopfzeile/i);
  });

  it("wirft bei leerer Eingabe", () => {
    expect(() => parseBulkJobsCsv("")).toThrow(/leer/i);
  });

  it("unterstützt englische Header-Aliasse", () => {
    const csv = "Title,Genre,TargetWords,SpecialPrompt,Language\nBook,nonfiction-tech,15000,prompt text,en";
    const res = parseBulkJobsCsv(csv);
    expect(res.jobs[0]).toMatchObject({
      title: "Book",
      genre: "technik",
      targetWords: 15000,
      specialPrompt: "prompt text",
      language: "en",
    });
  });

  it("dokumentiert die erwarteten Header (für UI/File-Drop-Hinweis)", () => {
    expect(BULK_CSV_HEADERS).toEqual([
      "Titel", "Genre", "Target-Wörterzahl", "Spezial-Prompt", "Sprache",
    ]);
  });
});
