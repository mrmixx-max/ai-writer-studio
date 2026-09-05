// Tests: Upload-Spreadsheet (Sprint 5, Agent 3, Teil 1) — KDP-Bulk-Upload-CSV.
//
// Akzeptanzkriterium: CSV mit korrekten Spalten (Titel, Untertitel, Autor,
// HTML-Klappentext, 7 Keywords, Hauptkategorie), ISBN-Platzhaltern und
// konfigurierbaren Preisen.
import { describe, it, expect } from "vitest";
import {
  UPLOAD_SHEET_COLUMNS,
  escapeCsvField,
  toHtmlDescription,
  buildKdpUploadSheet,
  type UploadSheetRowInput,
} from "./uploadSheet";

const baseRow = (): UploadSheetRowInput => ({
  title: "Der Hafenmord",
  subtitle: "Ein Nordsee-Krimi",
  author: "Anna Weber",
  description:
    "Ein Mord im Nebel.\n\nKommissar Brandt ermittelt gegen die Zeit.",
  keywords: ["krimi nordsee", "nordseekrimi", "kriminalroman", "cozy crime", "brandt reihe", "spannend", "deutscher krimi"],
  primaryCategory: "Fiction > Mystery & Detective > General",
  language: "de",
});

function parseCsv(csv: string): string[][] {
  // Minimaler RFC-4180-Parser für die Tests (Quotes + Kommas + Newlines).
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (inQuotes) {
      if (c === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

describe("Upload-Spreadsheet: Spalten", () => {
  it("Header enthält genau die geforderten Spalten in KDP-Reihenfolge", () => {
    const { csv } = buildKdpUploadSheet({ rows: [baseRow()] });
    const header = parseCsv(csv)[0];
    expect(header).toEqual(UPLOAD_SHEET_COLUMNS);
    // Pflichtspalten laut Aufgabe:
    for (const col of [
      "Title",
      "Subtitle",
      "Author",
      "Description (HTML)",
      "Keyword 1",
      "Keyword 7",
      "Primary Category",
      "ISBN (Paperback)",
      "ISBN (eBook)",
      "List Price (USD)",
    ]) {
      expect(header).toContain(col);
    }
  });

  it("Datenzeile füllt Titel/Untertitel/Autor/Hauptkategorie korrekt", () => {
    const { csv } = buildKdpUploadSheet({ rows: [baseRow()] });
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    const idx = (c: string) => UPLOAD_SHEET_COLUMNS.indexOf(c as (typeof UPLOAD_SHEET_COLUMNS)[number]);
    expect(rows[1][idx("Title")]).toBe("Der Hafenmord");
    expect(rows[1][idx("Subtitle")]).toBe("Ein Nordsee-Krimi");
    expect(rows[1][idx("Author")]).toBe("Anna Weber");
    expect(rows[1][idx("Primary Category")]).toBe("Fiction > Mystery & Detective > General");
  });

  it("genau 7 Keyword-Spalten, darüber hinausgehende Keywords werden verworfen", () => {
    const row = baseRow();
    row.keywords = [...row.keywords, "achtes keyword"];
    const { csv, warnings } = buildKdpUploadSheet({ rows: [row] });
    const rows = parseCsv(csv);
    const idx = (c: string) => UPLOAD_SHEET_COLUMNS.indexOf(c as (typeof UPLOAD_SHEET_COLUMNS)[number]);
    expect(rows[1][idx("Keyword 7")]).toBe("deutscher krimi");
    expect(warnings.some((w) => w.includes("Keyword"))).toBe(true);
  });

  it("HTML-Klappentext: Absätze werden zu <p>, Zeilenumbrüche escaped", () => {
    const { csv } = buildKdpUploadSheet({ rows: [baseRow()] });
    const rows = parseCsv(csv);
    const idx = UPLOAD_SHEET_COLUMNS.indexOf("Description (HTML)");
    const html = rows[1][idx];
    expect(html).toContain("<p>Ein Mord im Nebel.</p>");
    expect(html).toContain("<p>Kommissar Brandt ermittelt gegen die Zeit.</p>");
  });
});

describe("Upload-Spreadsheet: ISBN & Preis", () => {
  it("unvergebene ISBN → Platzhalter-Token, vergebene ISBN → Wert", () => {
    const row = baseRow();
    row.isbns = [
      { format: "paperback", isbn: null },
      { format: "ebook", isbn: "9783648155489" },
    ];
    const { csv } = buildKdpUploadSheet({ rows: [row] });
    const rows = parseCsv(csv);
    const idx = (c: string) => UPLOAD_SHEET_COLUMNS.indexOf(c as (typeof UPLOAD_SHEET_COLUMNS)[number]);
    expect(rows[1][idx("ISBN (Paperback)")]).toBe("{{ISBN:PAPERBACK}}");
    expect(rows[1][idx("ISBN (eBook)")]).toBe("9783648155489");
    expect(rows[1][idx("ISBN (Hardcover)")]).toBe("{{ISBN:HARDCOVER}}");
  });

  it("Preisspalten aus konfigurierter Preisstrategie", () => {
    const row = baseRow();
    row.pricing = { strategy: "standard", prices: { USD: 4.99, EUR: 4.99, GBP: 3.99 } };
    const { csv } = buildKdpUploadSheet({ rows: [row] });
    const rows = parseCsv(csv);
    const idx = (c: string) => UPLOAD_SHEET_COLUMNS.indexOf(c as (typeof UPLOAD_SHEET_COLUMNS)[number]);
    expect(rows[1][idx("List Price (USD)")]).toBe("4.99");
    expect(rows[1][idx("List Price (EUR)")]).toBe("4.99");
    expect(rows[1][idx("List Price (GBP)")]).toBe("3.99");
    expect(rows[1][idx("Pricing Strategy")]).toBe("standard");
  });

  it("mehrere Bücher → mehrere Datenzeilen", () => {
    const second = { ...baseRow(), title: "Zweiter Fall" };
    const { csv, rowCount } = buildKdpUploadSheet({ rows: [baseRow(), second] });
    expect(parseCsv(csv)).toHaveLength(3);
    expect(rowCount).toBe(2);
  });

  it("deterministisch: gleicher Input → gleicher Output (BOM aus)", () => {
    const a = buildKdpUploadSheet({ rows: [baseRow()], bom: false });
    const b = buildKdpUploadSheet({ rows: [baseRow()], bom: false });
    expect(a.csv).toBe(b.csv);
    expect(a.csv).not.toContain("\uFEFF");
  });

  it("BOM-Option schreibt UTF-8-BOM (Excel-Kompatibilität)", () => {
    const { csv } = buildKdpUploadSheet({ rows: [baseRow()], bom: true });
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });

  it("Titel ohne Inhalt wirft", () => {
    expect(() => buildKdpUploadSheet({ rows: [{ title: "  ", description: "x", keywords: [], primaryCategory: "" }] })).toThrow(/Titel/);
  });
});

describe("Upload-Spreadsheet: Helpers", () => {
  it("escapeCsvField quotet Kommas, Quotes, Newlines", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"');
    expect(escapeCsvField('er sagte "los"')).toBe('"er sagte ""los"""');
    expect(escapeCsvField("zeile\nzwei")).toBe('"zeile\nzwei"');
    expect(escapeCsvField("plainer text")).toBe("plainer text");
  });

  it("toHtmlDescription wandelt Absätze in <p>-Tags", () => {
    expect(toHtmlDescription("A\n\nB")).toBe("<p>A</p>\n<p>B</p>");
  });

  it("toHtmlDescription escapet HTML-Sonderzeichen", () => {
    const html = toHtmlDescription("<Buch> & \"Mehr\"");
    expect(html).not.toContain("<Buch>");
    expect(html).toContain("&lt;Buch&gt;");
  });
});
