// Tests für den Mikrotypografie-Service (WP 20.2: Satzspiegel-Politur).
//
// Kernaussage: Alle Transformationen sind lokal, deterministisch, defensiv
// (werfen nie) und idempotent — mehrfaches Anwenden ändert das Ergebnis nicht.

import { describe, it, expect } from "vitest";
import {
  detectWidowsAndOrphans,
  applyHangingPunctuation,
  insertNonBreakingSpaces,
  preventConsecutiveHyphens,
  NBSP,
  THIN_SPACE,
} from "./microTypography";

// ---------------------------------------------------------------------------
// detectWidowsAndOrphans
// ---------------------------------------------------------------------------

describe("detectWidowsAndOrphans", () => {
  it("liefert bei leerer Eingabe ein leeres Ergebnis", () => {
    expect(detectWidowsAndOrphans([])).toEqual([]);
  });

  it("ist defensiv bei fehlender/falscher Eingabe", () => {
    expect(detectWidowsAndOrphans(null as unknown as string[])).toEqual([]);
    expect(detectWidowsAndOrphans(undefined as unknown as string[])).toEqual([]);
  });

  it("ignoriert einzeilige Absätze (kein Umbruch erkennbar)", () => {
    expect(detectWidowsAndOrphans(["Nur ein Wort"])).toEqual([]);
    expect(detectWidowsAndOrphans(["Ein ganzer Satz mit mehreren Wörtern."])).toEqual([]);
  });

  it("erkennt ein Hurenkind (orphan) am Absatzanfang", () => {
    const issues = detectWidowsAndOrphans(["Der\nAbsatz beginnt hier und läuft weiter."]);
    expect(issues).toEqual([{ type: "orphan", lineNumber: 1, text: "Der" }]);
  });

  it("erkennt einen Schusterjungen (widow) am Absatzende", () => {
    const issues = detectWidowsAndOrphans([
      "Ein langer Absatz\ngeht über mehrere\nZeilen und endet\nhier.",
    ]);
    expect(issues).toEqual([{ type: "widow", lineNumber: 4, text: "hier." }]);
  });

  it("erkennt Hurenkind und Schusterjunge im selben Absatz", () => {
    const issues = detectWidowsAndOrphans(["Kurz\nviel Text dazwischen\nEnde"]);
    expect(issues).toEqual([
      { type: "orphan", lineNumber: 1, text: "Kurz" },
      { type: "widow", lineNumber: 3, text: "Ende" },
    ]);
  });

  it("vergibt globale Zeilennummern über Absätze hinweg", () => {
    const issues = detectWidowsAndOrphans([
      "Erster Absatz\nzweite Zeile hier.",
      "Zweiter Absatz\nund dann\nEnde",
    ]);
    expect(issues).toEqual([{ type: "widow", lineNumber: 5, text: "Ende" }]);
  });

  it("filtert nicht-string Einträge defensiv", () => {
    const input = [null, "Nur ein Wort", 42] as unknown as string[];
    expect(detectWidowsAndOrphans(input)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// applyHangingPunctuation
// ---------------------------------------------------------------------------

describe("applyHangingPunctuation", () => {
  it("setzt öffnende Interpunktion am Zeilenanfang ab", () => {
    expect(applyHangingPunctuation("„Hallo")).toBe("„" + THIN_SPACE + "Hallo");
  });

  it("setzt terminale Interpunktion am Zeilenende ab", () => {
    expect(applyHangingPunctuation("Ende.")).toBe("Ende" + THIN_SPACE + ".");
  });

  it("behandelt beide Seiten einer Zeile", () => {
    expect(applyHangingPunctuation('"Zitat"')).toBe(
      '"' + THIN_SPACE + "Zitat" + THIN_SPACE + '"',
    );
  });

  it("arbeitet mehrzeilig, Zeile für Zeile", () => {
    expect(applyHangingPunctuation("„Eins\nZwei.")).toBe(
      "„" + THIN_SPACE + "Eins\nZwei" + THIN_SPACE + ".",
    );
  });

  it("lässt Text ohne Randinterpunktion unverändert", () => {
    expect(applyHangingPunctuation("schlichte Zeile")).toBe("schlichte Zeile");
  });

  it("ist idempotent", () => {
    const source = '„Hallo Welt" – und Ende.\n„Neue Zeile"';
    const once = applyHangingPunctuation(source);
    const twice = applyHangingPunctuation(once);
    expect(twice).toBe(once);
  });

  it("ist defensiv bei fehlender Eingabe", () => {
    expect(applyHangingPunctuation("")).toBe("");
    expect(applyHangingPunctuation(null as unknown as string)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// insertNonBreakingSpaces
// ---------------------------------------------------------------------------

describe("insertNonBreakingSpaces", () => {
  it("bindet Titel an den Namen", () => {
    expect(insertNonBreakingSpaces("Dr. Müller")).toBe("Dr." + NBSP + "Müller");
  });

  it("bindet mehrere aufeinanderfolgende Titel", () => {
    expect(insertNonBreakingSpaces("Prof. Dr. Schmidt")).toBe(
      "Prof." + NBSP + "Dr." + NBSP + "Schmidt",
    );
  });

  it("bindet das Paragraphenzeichen an die Zahl", () => {
    expect(insertNonBreakingSpaces("§ 5")).toBe("§" + NBSP + "5");
  });

  it("bindet Mengenangaben an die Zahl", () => {
    expect(insertNonBreakingSpaces("10 km")).toBe("10" + NBSP + "km");
    expect(insertNonBreakingSpaces("3,5 kg")).toBe("3,5" + NBSP + "kg");
  });

  it("bindet Initialen aneinander und an den Namen", () => {
    expect(insertNonBreakingSpaces("J. R. R. Tolkien")).toBe(
      "J." + NBSP + "R." + NBSP + "R." + NBSP + "Tolkien",
    );
  });

  it("ist idempotent", () => {
    const source = "Prof. Dr. Schmidt wog 10 kg und zitierte § 5 sowie J. R. R. Tolkien.";
    const once = insertNonBreakingSpaces(source);
    const twice = insertNonBreakingSpaces(once);
    expect(twice).toBe(once);
  });

  it("ist defensiv bei fehlender Eingabe", () => {
    expect(insertNonBreakingSpaces("")).toBe("");
    expect(insertNonBreakingSpaces(undefined as unknown as string)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// preventConsecutiveHyphens
// ---------------------------------------------------------------------------

describe("preventConsecutiveHyphens", () => {
  it("kürzt Läufe von mehr als drei Trennstrichen auf drei", () => {
    expect(preventConsecutiveHyphens("a-----b")).toBe("a---b");
    expect(preventConsecutiveHyphens("x--------y")).toBe("x---y");
  });

  it("lässt bis zu drei Trennstriche unverändert", () => {
    expect(preventConsecutiveHyphens("a---b")).toBe("a---b");
    expect(preventConsecutiveHyphens("a-b")).toBe("a-b");
  });

  it("ist idempotent", () => {
    const source = "Text ----- noch ---- mehr";
    const once = preventConsecutiveHyphens(source);
    const twice = preventConsecutiveHyphens(once);
    expect(twice).toBe(once);
  });

  it("ist defensiv bei fehlender Eingabe", () => {
    expect(preventConsecutiveHyphens("")).toBe("");
    expect(preventConsecutiveHyphens(null as unknown as string)).toBe("");
  });
});
