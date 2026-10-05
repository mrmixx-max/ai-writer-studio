/**
 * Tests: interactiveGamePackager (WP 69.2)
 */

import { describe, it, expect } from "vitest";
import {
  scrambleGamebook,
  validateGamebook,
  buildDiceTables,
  buildCharacterSheet,
  buildGamebookPdf,
  buildWebgameHtml,
  buildWebgameZip,
  buildZip,
  crc32,
  shuffleDeterministic,
  hashString,
} from "./interactiveGamePackager";

const STORY = `# Der Wald
Du stehst am Rand des Waldes.
-> Fliehen | Lichtung
-> Kämpfen | Kampf

---

# Die Lichtung
Ein offener Platz.
-> Weiter | Ende

---

# Der Kampf
Ein Gegner tritt aus dem Schatten.
-> Angreifen | Ende

---

# Ende
Du hast überlebt.`;

describe("interactiveGamePackager", () => {
  describe("hashString", () => {
    it("ist deterministisch", () => {
      expect(hashString("abc")).toBe(hashString("abc"));
    });

    it("liefert unterschiedliche Werte", () => {
      expect(hashString("abc")).not.toBe(hashString("abd"));
    });
  });

  describe("shuffleDeterministic", () => {
    it("mischt deterministisch", () => {
      const a = shuffleDeterministic([1, 2, 3, 4, 5], 42);
      const b = shuffleDeterministic([1, 2, 3, 4, 5], 42);
      expect(a).toEqual(b);
    });

    it("liefert unterschiedliche Reihenfolgen bei unterschiedlichen Seeds", () => {
      const a = shuffleDeterministic([1, 2, 3, 4, 5, 6, 7, 8], 1);
      const b = shuffleDeterministic([1, 2, 3, 4, 5, 6, 7, 8], 2);
      expect(a).not.toEqual(b);
    });

    it("mutiert die Eingabe nicht", () => {
      const input = [1, 2, 3];
      shuffleDeterministic(input, 7);
      expect(input).toEqual([1, 2, 3]);
    });

    it("behält alle Elemente", () => {
      const out = shuffleDeterministic([1, 2, 3, 4, 5], 99);
      expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("crc32", () => {
    it("stimmt mit dem Referenzvektor überein", () => {
      // Bekannter CRC-32 von "123456789" ist 0xCBF43926.
      const bytes = new TextEncoder().encode("123456789");
      expect(crc32(bytes)).toBe(0xcbf43926);
    });

    it("liefert 0 für leere Eingabe", () => {
      expect(crc32(new Uint8Array(0))).toBe(0);
    });
  });

  describe("scrambleGamebook", () => {
    it("zerlegt die Geschichte in Abschnitte", () => {
      const b = scrambleGamebook(STORY, "Testspielbuch");
      expect(b.sectionCount).toBe(4);
      expect(b.title).toBe("Testspielbuch");
    });

    it("lässt den Einstieg auf Nummer 1", () => {
      const b = scrambleGamebook(STORY, "Test", 42);
      expect(b.sections[0].scrambledNumber).toBe(1);
      expect(b.sections[0].title).toBe("Der Wald");
    });

    it("vergibt lückenlose Nummern", () => {
      const b = scrambleGamebook(STORY, "Test", 42);
      const nums = b.sections.map((s) => s.scrambledNumber).sort((x, y) => x - y);
      expect(nums).toEqual([1, 2, 3, 4]);
    });

    it("ist bei gleichem Seed deterministisch", () => {
      const a = scrambleGamebook(STORY, "Test", 42);
      const b = scrambleGamebook(STORY, "Test", 42);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it("ist ohne Seed ebenfalls deterministisch", () => {
      const a = scrambleGamebook(STORY, "Test");
      const b = scrambleGamebook(STORY, "Test");
      expect(a.seed).toBe(b.seed);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it("mischt bei unterschiedlichen Seeds anders", () => {
      const a = scrambleGamebook(STORY, "Test", 1);
      const b = scrambleGamebook(STORY, "Test", 999);
      expect(a.sections.map((s) => s.title)).not.toEqual(b.sections.map((s) => s.title));
    });

    it("schreibt Verweise auf die neuen Nummern um", () => {
      const b = scrambleGamebook(STORY, "Test", 42);
      const wald = b.sections.find((s) => s.title === "Der Wald")!;
      const lichtung = b.sections.find((s) => s.title === "Die Lichtung")!;
      expect(wald.scrambledTargets).toContain(lichtung.scrambledNumber);
    });

    it("meldet kaputte Verweise", () => {
      const b = scrambleGamebook("# A\nText\n-> Weiter | Nirgendwo", "Test", 1);
      expect(b.brokenLinks.length).toBe(1);
    });

    it("zählt Verweise", () => {
      const b = scrambleGamebook(STORY, "Test", 42);
      expect(b.linkCount).toBe(4);
    });

    it("kommt mit leerem Input zurecht", () => {
      const b = scrambleGamebook("", "Leer");
      expect(b.sectionCount).toBe(0);
      expect(b.sections).toEqual([]);
    });

    it("kommt mit null zurecht", () => {
      const b = scrambleGamebook(null as unknown as string);
      expect(b.sectionCount).toBe(0);
    });

    it("liest Titel und Text", () => {
      const b = scrambleGamebook(STORY, "Test", 42);
      const wald = b.sections.find((s) => s.title === "Der Wald")!;
      expect(wald.body).toContain("Rand des Waldes");
    });

    it("liest Verweis-Beschriftungen", () => {
      const b = scrambleGamebook(STORY, "Test", 42);
      const wald = b.sections.find((s) => s.title === "Der Wald")!;
      expect(wald.links.map((l) => l.label)).toEqual(["Fliehen", "Kämpfen"]);
    });
  });

  describe("validateGamebook", () => {
    it("erkennt ein gültiges Spielbuch", () => {
      const b = scrambleGamebook(STORY, "Test", 42);
      const v = validateGamebook(b);
      expect(v.valid).toBe(true);
      expect(v.errors).toEqual([]);
    });

    it("erkennt kaputte Verweise als Fehler", () => {
      const b = scrambleGamebook("# A\nText\n-> Weiter | Nirgendwo", "Test", 1);
      const v = validateGamebook(b);
      expect(v.valid).toBe(false);
      expect(v.errors.length).toBeGreaterThan(0);
    });

    it("erkennt Sackgassen (Schleife ohne Ende)", () => {
      // A → B, B → A: erreichbar, aber kein Ende erreichbar.
      const b = scrambleGamebook("# A\nText\n-> Weiter | B\n---\n# B\nText\n-> Zurück | A", "Test", 1);
      const v = validateGamebook(b);
      expect(v.deadEnds.length).toBeGreaterThan(0);
      expect(v.valid).toBe(false);
    });

    it("erkennt ein unerreichbares Ende", () => {
      const b = scrambleGamebook("# A\nText\n-> Weiter | Ende\n---\n# Ende\nFertig.\n---\n# Einsam\nNiemand kommt hierher.", "Test", 1);
      const v = validateGamebook(b);
      expect(v.errors.some((e) => e.includes("nicht erreichbar"))).toBe(true);
    });

    it("akzeptiert ein Ende, das erreichbar ist", () => {
      const b = scrambleGamebook("# A\nText\n-> Weiter | Ende\n---\n# Ende\nFertig.", "Test", 1);
      const v = validateGamebook(b);
      expect(v.valid).toBe(true);
    });

    it("kommt mit null zurecht", () => {
      const v = validateGamebook(null);
      expect(v.valid).toBe(false);
    });

    it("ist deterministisch", () => {
      const b = scrambleGamebook(STORY, "Test", 42);
      expect(JSON.stringify(validateGamebook(b))).toBe(JSON.stringify(validateGamebook(b)));
    });
  });

  describe("buildDiceTables", () => {
    it("erzeugt Würfeltabellen", () => {
      const t = buildDiceTables();
      expect(t.length).toBeGreaterThanOrEqual(3);
      expect(t[0].rows.length).toBeGreaterThan(0);
    });

    it("ist deterministisch", () => {
      expect(JSON.stringify(buildDiceTables())).toBe(JSON.stringify(buildDiceTables()));
    });
  });

  describe("buildCharacterSheet", () => {
    it("erzeugt einen Charakterbogen", () => {
      const s = buildCharacterSheet();
      expect(s).toContain("CHARAKTERBOGEN");
      expect(s).toContain("Ausdauer");
    });
  });

  describe("buildGamebookPdf", () => {
    it("erzeugt ein valides PDF", () => {
      const b = scrambleGamebook(STORY, "Test", 42);
      const pdf = buildGamebookPdf(b);
      expect(pdf).toContain("%PDF-1.4");
      expect(pdf).toContain("%%EOF");
      expect(pdf).toContain("/Type/Catalog");
    });

    it("nutzt A5-Format", () => {
      const b = scrambleGamebook(STORY, "Test", 42);
      const pdf = buildGamebookPdf(b);
      expect(pdf).toContain("419.53");
      expect(pdf).toContain("595.28");
    });

    it("erzeugt eine Seite je Abschnitt", () => {
      const b = scrambleGamebook(STORY, "Test", 42);
      const pdf = buildGamebookPdf(b);
      expect(pdf).toContain("/Count 4");
    });

    it("transliteriert Umlaute", () => {
      const b = scrambleGamebook("# Tür\nDie Tür ist zu.", "Test", 1);
      const pdf = buildGamebookPdf(b);
      expect(pdf).not.toMatch(/[äöüßÄÖÜ]/);
    });

    it("ist deterministisch", () => {
      const b = scrambleGamebook(STORY, "Test", 42);
      expect(buildGamebookPdf(b)).toBe(buildGamebookPdf(b));
    });

    it("kommt mit null zurecht", () => {
      const pdf = buildGamebookPdf(null);
      expect(pdf).toContain("%PDF");
    });
  });

  describe("buildWebgameHtml", () => {
    it("erzeugt valides HTML", () => {
      const b = scrambleGamebook(STORY, "Test", 42);
      const html = buildWebgameHtml(b);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("</html>");
    });

    it("bettet die Abschnitte als JSON ein", () => {
      const b = scrambleGamebook(STORY, "Test", 42);
      const html = buildWebgameHtml(b);
      expect(html).toContain('type="application/json"');
      expect(html).toContain("Abschnitt");
    });

    it("hat keine externen Abhängigkeiten", () => {
      const b = scrambleGamebook(STORY, "Test", 42);
      const html = buildWebgameHtml(b);
      expect(html).not.toContain("http://");
      expect(html).not.toContain("https://");
      expect(html).not.toContain("<script src=");
    });

    it("escaped HTML-Sonderzeichen im JSON", () => {
      const b = scrambleGamebook("# A\n1 < 2 & 3 > 2", "Test", 1);
      const html = buildWebgameHtml(b);
      // Innerhalb des JSON-Blocks darf kein rohes </script> entstehen.
      expect(html).not.toContain("</script></script>");
    });

    it("ist deterministisch", () => {
      const b = scrambleGamebook(STORY, "Test", 42);
      expect(buildWebgameHtml(b)).toBe(buildWebgameHtml(b));
    });

    it("kommt mit null zurecht", () => {
      const html = buildWebgameHtml(null);
      expect(html).toContain("<!DOCTYPE html>");
    });
  });

  describe("buildZip", () => {
    it("erzeugt eine gültige ZIP-Struktur", () => {
      const zip = buildZip([{ name: "test.txt", content: "Hallo" }]);
      const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
      // Local file header Signatur
      expect(view.getUint32(0, true)).toBe(0x04034b50);
      // End of central directory am Ende
      const eocdOffset = zip.length - 22;
      expect(view.getUint32(eocdOffset, true)).toBe(0x06054b50);
    });

    it("nennt die Eintragszahl im EOCD", () => {
      const zip = buildZip([
        { name: "a.txt", content: "A" },
        { name: "b.txt", content: "B" },
      ]);
      const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
      expect(view.getUint16(zip.length - 22 + 8, true)).toBe(2);
    });

    it("ist deterministisch", () => {
      const a = buildZip([{ name: "x.txt", content: "Inhalt" }]);
      const b = buildZip([{ name: "x.txt", content: "Inhalt" }]);
      expect(Array.from(a)).toEqual(Array.from(b));
    });

    it("kommt mit leerer Liste zurecht", () => {
      const zip = buildZip([]);
      const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
      expect(view.getUint32(0, true)).toBe(0x06054b50);
    });
  });

  describe("buildWebgameZip", () => {
    it("erzeugt ein ZIP-Paket", () => {
      const b = scrambleGamebook(STORY, "Test", 42);
      const zip = buildWebgameZip(b);
      expect(zip.length).toBeGreaterThan(100);
      const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
      expect(view.getUint32(0, true)).toBe(0x04034b50);
    });

    it("enthält vier Einträge", () => {
      const b = scrambleGamebook(STORY, "Test", 42);
      const zip = buildWebgameZip(b);
      const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
      expect(view.getUint16(zip.length - 22 + 10, true)).toBe(4);
    });

    it("ist deterministisch", () => {
      const b = scrambleGamebook(STORY, "Test", 42);
      const a = buildWebgameZip(b);
      const c = buildWebgameZip(b);
      expect(Array.from(a)).toEqual(Array.from(c));
    });

    it("kommt mit null zurecht", () => {
      const zip = buildWebgameZip(null);
      expect(zip.length).toBeGreaterThan(0);
    });
  });
});
