// Unit-Tests: Buch-Titelei & Print-Layout-Preflight (WP 8.1).
//
// Kernaussage: Der Service ist lokal, deterministisch und defensiv.
// Er findet typografische Fehler, mögliche Schusterjungen/Hurenkinder und
// erzeugt rechtssichere Titelei-Bausteine — alles ohne LLM.

import { describe, it, expect } from "vitest";
import {
  checkTypography,
  checkWidowsAndOrphans,
  generateImpressum,
  generateTitlePage,
} from "./printPreflight";
import type { TypographyIssue } from "./printPreflight";

/** Hilfsfunktion: nur die Typen der Befunde. */
function types(issues: TypographyIssue[]): string[] {
  return issues.map((i) => i.type);
}

describe("checkTypography", () => {
  it("findet gerade Anführungszeichen und schlägt deutsche vor", () => {
    const text = 'Er sagte "Hallo" und ging.';
    const issues = checkTypography(text).filter((i) => i.type === "quotation_mark");
    expect(issues).toHaveLength(2);
    expect(issues[0].position).toBe(text.indexOf('"'));
    expect(issues[0].suggestion).toContain("„"); // öffnend
    expect(issues[1].suggestion).toContain("“"); // schließend
  });

  it("lässt korrekte deutsche Anführungszeichen unbeanstandet", () => {
    const issues = checkTypography("Er sagte „Hallo“ und ging.");
    expect(issues).toHaveLength(0);
  });

  it("findet Bindestrich mit Leerzeichen als falschen Gedankenstrich", () => {
    const text = "Das Haus - alt und grau - steht noch.";
    const dashes = checkTypography(text).filter((i) => i.type === "dash");
    expect(dashes).toHaveLength(2);
    expect(dashes[0].suggestion).toContain("–");
  });

  it("findet doppelten Bindestrich als Gedankenstrich-Kandidat", () => {
    const issues = checkTypography("Er kam -- und ging.");
    expect(issues.some((i) => i.type === "dash" && i.message.includes("Doppelter"))).toBe(true);
  });

  it("lässt korrekte Gedankenstriche unbeanstandet", () => {
    expect(checkTypography("Er kam – und ging — wieder.")).toHaveLength(0);
  });

  it("findet sonstige Satzfehler (doppelte Leerzeichen, Leerzeichen vor Komma, drei Punkte)", () => {
    const issues = checkTypography("Hallo  Welt , und dann...");
    expect(types(issues)).toEqual(["other", "other", "other"]);
  });

  it("liefert Befunde aufsteigend nach Position (deterministisch)", () => {
    const issues = checkTypography('"A" - B  C...');
    const positions = issues.map((i) => i.position);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("ist defensiv gegen leeren und fehlenden Text", () => {
    expect(checkTypography("")).toEqual([]);
    // @ts-expect-error defensiver Laufzeit-Test mit ungültigem Typ
    expect(checkTypography(null)).toEqual([]);
  });
});

describe("checkWidowsAndOrphans", () => {
  it("findet einen Schusterjungen (letzte Zeile eines Absatzes mit einem Wort)", () => {
    const text = "Dies ist ein langer erster Satz mit vielen Worten.\nNur";
    const issues = checkWidowsAndOrphans(text);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("widow");
    expect(issues[0].lineNumber).toBe(2);
    expect(issues[0].text).toBe("Nur");
  });

  it("findet ein Hurenkind (erste Zeile eines Absatzes mit einem Wort)", () => {
    const text = "Nur\nDies ist ein langer erster Satz mit vielen Worten.";
    const issues = checkWidowsAndOrphans(text);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("orphan");
    expect(issues[0].lineNumber).toBe(1);
  });

  it("meldet Hurenkind und Schusterjunge im selben Absatz", () => {
    const text = "Nur\nDies ist ein langer mittlerer Satz.\nDoch";
    const issues = checkWidowsAndOrphans(text);
    expect(issues.map((i) => i.type)).toEqual(["orphan", "widow"]);
  });

  it("wertet einzeilige Absätze nicht (kein Umbruch erkennbar)", () => {
    const text = "Kurz.\n\nNoch ein kurzer Absatz.";
    expect(checkWidowsAndOrphans(text)).toEqual([]);
  });

  it("trennt Absätze an Leerzeilen und zählt Zeilennummern korrekt", () => {
    const text = [
      "Erster Absatz, ausreichend lang.", // Zeile 1
      "Zweiter Absatz, ausreichend lang.", // Zeile 2
      "", // Zeile 3
      "Neuer Absatz, ausreichend lang.", // Zeile 4
      "Nur", // Zeile 5
    ].join("\n");
    const issues = checkWidowsAndOrphans(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ type: "widow", lineNumber: 5 });
  });

  it("ist defensiv gegen leeren Text und nur Leerzeilen", () => {
    expect(checkWidowsAndOrphans("")).toEqual([]);
    expect(checkWidowsAndOrphans("\n\n   \n")).toEqual([]);
  });
});

describe("generateImpressum", () => {
  it("enthält alle vier Pflichtbausteine", () => {
    const imp = generateImpressum("Max Mustermann", "Mein Buch", 2026);
    expect(imp).toContain("Impressum");
    expect(imp).toContain("Urheberrecht");
    expect(imp).toContain("© 2026 Max Mustermann");
    expect(imp).toContain("Haftungsausschluss");
    expect(imp).toContain("EU-Richtlinien-Hinweis");
    expect(imp).toContain("§ 5 DDG");
    expect(imp).toContain("Selbstverleger");
  });

  it("nutzt das aktuelle Jahr als Default und enthält keinen LLM-Text", () => {
    const year = new Date().getFullYear();
    const imp = generateImpressum("Max Mustermann", "Mein Buch");
    expect(imp).toContain(`© ${year} Max Mustermann`);
  });

  it("ist deterministisch (zweifacher Aufruf liefert identischen Text)", () => {
    expect(generateImpressum("A", "B", 2020)).toBe(generateImpressum("A", "B", 2020));
  });

  it("ist defensiv bei leeren Angaben", () => {
    const imp = generateImpressum("", "", 2020);
    expect(imp).toContain("Unbekannter Autor");
    expect(imp).toContain("Ohne Titel");
    expect(imp).toContain("© 2020 Unbekannter Autor");
  });
});

describe("generateTitlePage", () => {
  it("erzeugt Titel und Autor", () => {
    const page = generateTitlePage("Mein Buch", "Max Mustermann");
    expect(page).toBe("Mein Buch\n\nvon Max Mustermann");
  });

  it("nimmt den Untertitel zwischen Titel und Autor auf", () => {
    const page = generateTitlePage("Mein Buch", "Max Mustermann", "Ein Untertitel");
    expect(page).toBe("Mein Buch\n\nEin Untertitel\n\nvon Max Mustermann");
  });

  it("ist defensiv bei leeren Angaben", () => {
    const page = generateTitlePage("", "");
    expect(page).toBe("Ohne Titel\n\nvon Unbekannter Autor");
  });
});
