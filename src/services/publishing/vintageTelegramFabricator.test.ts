// @vitest-environment jsdom
// Tests: Historischer Telegramm- & Telex-Fabrikator (Meilenstein 62.0, v7.4.0)
//
// Deckt FNV-1a-Hash, mulberry32-PRNG, Epochen-Katalog,
// Dringlichkeits-/Stempel-Generator, Telegramm-Fabrikation,
// 300-DPI-Export und Beispielfabriken ab.
//
// Meilenstein 62.0 (Vertiefung): systematische Abdeckung über ALLE vier
// Epochen (westernUnion, submarineCable, military, coldWarTelex),
// Grenzfälle, SVG-Struktur, Determinismus und Feldvalidierung.
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  TELEGRAM_ERAS,
  getTelegramEra,
  generateUrgencyStamp,
  fabricateTelegram,
  exportTelegramPdf,
  createSampleEra,
  createSampleTelegram,
} from "./vintageTelegramFabricator";

// ---------------------------------------------------------------------------
// Gemeinsame Testdaten
// ---------------------------------------------------------------------------

const BASE_MESSAGE =
  "Manuskript eingetroffen bitte umgehend Freigabe erteilen";

/** Baut eine Telegramm-Eingabe für eine Epoche (optional mit eigener Nachricht). */
function inputFor(eraId: string, message: string = BASE_MESSAGE) {
  return {
    recipient: "Herrn Dr. Arthur Conan Doyle, London",
    sender: "Redaktion, Strand Magazine",
    message,
    eraId,
  };
}

// ---------------------------------------------------------------------------
// hashString
// ---------------------------------------------------------------------------

describe("hashString", () => {
  it("ist deterministisch (gleiche Eingabe ⇒ gleicher Hash)", () => {
    expect(hashString("telegram")).toBe(hashString("telegram"));
    expect(hashString("westernUnion")).toBe(hashString("westernUnion"));
  });

  it("unterscheidet unterschiedliche Eingaben (keine Kollision)", () => {
    const hashes = new Set([
      hashString("a"),
      hashString("b"),
      hashString("c"),
      hashString("telegram"),
      hashString("westernUnion"),
      hashString("submarineCable"),
      hashString("military"),
      hashString("coldWarTelex"),
    ]);
    expect(hashes.size).toBe(8);
  });

  it("liefert einen unsigned 32-Bit-Wert (0 ≤ hash < 2^32)", () => {
    const inputs = ["", "a", "telegram", "westernUnion", "x".repeat(1000)];
    for (const input of inputs) {
      const h = hashString(input);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(2 ** 32);
    }
  });

  it("berücksichtigt die Zeichenposition (Anagramme ≠ gleich)", () => {
    expect(hashString("abc")).not.toBe(hashString("cba"));
  });
});

describe("hashString – Randfälle", () => {
  it("liefert für die leere Zeichenkette den FNV-Offset-Basiswert", () => {
    expect(hashString("")).toBe(2166136261);
  });

  it("ist stabil für sehr große Eingaben (10.000 Zeichen)", () => {
    const big = "x".repeat(10000);
    expect(hashString(big)).toBe(hashString(big));
    expect(hashString(big)).toBeLessThan(2 ** 32);
  });

  it("reagiert empfindlich auf ein einzelnes zusätzliches Zeichen", () => {
    expect(hashString("telegram")).not.toBe(hashString("telegramm"));
  });
});

// ---------------------------------------------------------------------------
// createSeededRandom
// ---------------------------------------------------------------------------

describe("createSeededRandom", () => {
  it("ist deterministisch (gleicher Seed ⇒ gleiche Sequenz)", () => {
    const rngA = createSeededRandom(42);
    const rngB = createSeededRandom(42);
    for (let i = 0; i < 100; i++) {
      expect(rngA()).toBe(rngB());
    }
  });

  it("unterscheidet verschiedene Seeds", () => {
    const rngA = createSeededRandom(1);
    const rngB = createSeededRandom(2);
    const seqA = Array.from({ length: 10 }, () => rngA());
    const seqB = Array.from({ length: 10 }, () => rngB());
    expect(seqA).not.toEqual(seqB);
  });

  it("liefert über 500 Ziehungen ausschließlich Werte in [0, 1)", () => {
    const rng = createSeededRandom(12345);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("erzeugt eine gleichmäßige Verteilung (Mittelwert ≈ 0,5)", () => {
    const rng = createSeededRandom(999);
    const N = 5000;
    let sum = 0;
    for (let i = 0; i < N; i++) sum += rng();
    const mean = sum / N;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });
});

describe("createSeededRandom – weitere Eigenschaften", () => {
  it("erzeugt für Seed 0 eine deterministische Sequenz", () => {
    const a = createSeededRandom(0);
    const b = createSeededRandom(0);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("unterscheidet benachbarte Seeds", () => {
    const a = createSeededRandom(1000);
    const b = createSeededRandom(1001);
    expect(a()).not.toBe(b());
  });
});

// ---------------------------------------------------------------------------
// TELEGRAM_ERAS
// ---------------------------------------------------------------------------

describe("TELEGRAM_ERAS", () => {
  it("enthält genau 4 Epochen", () => {
    expect(TELEGRAM_ERAS).toHaveLength(4);
  });

  it("besitzt die erwarteten IDs in Reihenfolge", () => {
    expect(TELEGRAM_ERAS.map((e) => e.id)).toEqual([
      "westernUnion",
      "submarineCable",
      "military",
      "coldWarTelex",
    ]);
  });

  it("besitzt die erwarteten Jahre in Reihenfolge", () => {
    expect(TELEGRAM_ERAS.map((e) => e.year)).toEqual([1890, 1914, 1944, 1975]);
  });

  it("hat für jede Epoche gültige Felder", () => {
    for (const era of TELEGRAM_ERAS) {
      expect(typeof era.name).toBe("string");
      expect(era.name.length).toBeGreaterThan(0);
      expect(typeof era.description).toBe("string");
      expect(era.description.length).toBeGreaterThan(0);
      expect(typeof era.headerText).toBe("string");
      expect(era.headerText.length).toBeGreaterThan(0);
      expect(typeof era.paperTone).toBe("string");
      expect(era.paperTone).toMatch(/^var\(--/);
    }
  });
});

describe("TELEGRAM_ERAS – Feldvalidierung je Eintrag", () => {
  it("hat für jeden Eintrag eine nicht-leere String-ID", () => {
    for (const era of TELEGRAM_ERAS) {
      expect(typeof era.id).toBe("string");
      expect(era.id.length).toBeGreaterThan(0);
    }
  });

  it("hat für jeden Eintrag einen nicht-leeren Namen", () => {
    for (const era of TELEGRAM_ERAS) {
      expect(typeof era.name).toBe("string");
      expect(era.name.trim().length).toBeGreaterThan(0);
    }
  });

  it("hat für jeden Eintrag ein positives Ganzzahl-Jahr", () => {
    for (const era of TELEGRAM_ERAS) {
      expect(typeof era.year).toBe("number");
      expect(Number.isInteger(era.year)).toBe(true);
      expect(era.year).toBeGreaterThan(0);
    }
  });

  it("hat für jeden Eintrag eine nicht-leere Beschreibung", () => {
    for (const era of TELEGRAM_ERAS) {
      expect(typeof era.description).toBe("string");
      expect(era.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("hat für jeden Eintrag einen nicht-leeren Kopftext", () => {
    for (const era of TELEGRAM_ERAS) {
      expect(typeof era.headerText).toBe("string");
      expect(era.headerText.trim().length).toBeGreaterThan(0);
    }
  });

  it("hat für jeden Eintrag einen gültigen Papierton als Design-Token", () => {
    for (const era of TELEGRAM_ERAS) {
      expect(typeof era.paperTone).toBe("string");
      expect(era.paperTone).toMatch(/^var\(--[a-z-]+\)$/);
    }
  });

  it("verwendet genau die vier erwarteten Jahreszahlen", () => {
    expect(TELEGRAM_ERAS.map((e) => e.year)).toEqual([1890, 1914, 1944, 1975]);
  });

  it("hat eindeutige IDs", () => {
    const ids = TELEGRAM_ERAS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("hat eindeutige Namen", () => {
    const names = TELEGRAM_ERAS.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

// ---------------------------------------------------------------------------
// getTelegramEra
// ---------------------------------------------------------------------------

describe("getTelegramEra", () => {
  it("findet jede bekannte Epoche", () => {
    for (const era of TELEGRAM_ERAS) {
      expect(getTelegramEra(era.id)).toEqual(era);
    }
  });

  it("gibt undefined für eine unbekannte ID zurück", () => {
    expect(getTelegramEra("nonexistent")).toBeUndefined();
    expect(getTelegramEra("")).toBeUndefined();
  });
});

describe("getTelegramEra – je Epoche", () => {
  for (const era of TELEGRAM_ERAS) {
    it(`liefert die Epoche ${era.id}`, () => {
      const found = getTelegramEra(era.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(era.id);
      expect(found?.year).toBe(era.year);
      expect(found?.headerText).toBe(era.headerText);
    });
  }

  it("ist für jede ID dieselbe Referenz (Objekttreue)", () => {
    for (const era of TELEGRAM_ERAS) {
      expect(getTelegramEra(era.id)).toBe(era);
    }
  });

  it("ist groß-/kleinschreibungssensitiv", () => {
    expect(getTelegramEra("westernunion")).toBeUndefined();
    expect(getTelegramEra("WESTERNUNION")).toBeUndefined();
  });

  it("gibt undefined für unbekannte IDs zurück", () => {
    for (const bogus of ["telegram", "telex", "1890", "western-union"]) {
      expect(getTelegramEra(bogus)).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// generateUrgencyStamp
// ---------------------------------------------------------------------------

describe("generateUrgencyStamp", () => {
  it("liefert urgency, stamps und morseHeader", () => {
    const result = generateUrgencyStamp("westernUnion", 42);
    expect(typeof result.urgency).toBe("string");
    expect(result.urgency.length).toBeGreaterThan(0);
    expect(Array.isArray(result.stamps)).toBe(true);
    expect(typeof result.morseHeader).toBe("string");
    expect(result.morseHeader.length).toBeGreaterThan(0);
  });

  it("erzeugt 2 bis 4 Stempel", () => {
    for (const era of TELEGRAM_ERAS) {
      const result = generateUrgencyStamp(era.id, 7);
      expect(result.stamps.length).toBeGreaterThanOrEqual(2);
      expect(result.stamps.length).toBeLessThanOrEqual(4);
    }
  });

  it("ist deterministisch (gleiche Epoche + Seed ⇒ gleiches Ergebnis)", () => {
    const a = generateUrgencyStamp("military", 100);
    const b = generateUrgencyStamp("military", 100);
    expect(a).toEqual(b);
  });

  it("unterscheidet verschiedene Seeds", () => {
    const a = generateUrgencyStamp("military", 1);
    const b = generateUrgencyStamp("military", 2);
    expect(a).not.toEqual(b);
  });

  it("verwendet den epochenspezifischen Dringlichkeitspool", () => {
    const result = generateUrgencyStamp("westernUnion", 42);
    expect(result.urgency).toMatch(/URGENT|RUSH|EXPEDITE/);
  });
});

describe("generateUrgencyStamp – je Epoche", () => {
  for (const era of TELEGRAM_ERAS) {
    describe(`Epoche ${era.id}`, () => {
      it("liefert eine nicht-leere Dringlichkeit", () => {
        const r = generateUrgencyStamp(era.id, 42);
        expect(typeof r.urgency).toBe("string");
        expect(r.urgency.length).toBeGreaterThan(0);
      });

      it("erzeugt 2 bis 4 nicht-leere Stempel", () => {
        const r = generateUrgencyStamp(era.id, 11);
        expect(r.stamps.length).toBeGreaterThanOrEqual(2);
        expect(r.stamps.length).toBeLessThanOrEqual(4);
        for (const stamp of r.stamps) {
          expect(typeof stamp).toBe("string");
          expect(stamp.length).toBeGreaterThan(0);
        }
      });

      it("liefert einen nicht-leeren morseHeader", () => {
        const r = generateUrgencyStamp(era.id, 3);
        expect(r.morseHeader.length).toBeGreaterThan(0);
      });

      it("kodiert den morseHeader ausschließlich mit Morsezeichen", () => {
        const r = generateUrgencyStamp(era.id, 3);
        expect(r.morseHeader).toMatch(/^[.\-/ ]+$/);
      });
    });
  }

  it("liefert für eine unbekannte Epoche einen generischen Vermerk", () => {
    const r = generateUrgencyStamp("voelligUnbekannt", 5);
    expect(r.urgency.length).toBeGreaterThan(0);
    expect(r.stamps.length).toBeGreaterThanOrEqual(2);
    expect(r.stamps.length).toBeLessThanOrEqual(4);
    expect(r.morseHeader.length).toBeGreaterThan(0);
  });

  it("stempelt deterministisch für unbekannte Epochen", () => {
    const a = generateUrgencyStamp("voelligUnbekannt", 9);
    const b = generateUrgencyStamp("voelligUnbekannt", 9);
    expect(a).toEqual(b);
  });

  it("unterscheidet verschiedene Seeds über die Stempelmenge", () => {
    const seen = new Set<string>();
    for (let s = 0; s < 40; s++) {
      seen.add(JSON.stringify(generateUrgencyStamp("coldWarTelex", s).stamps));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// fabricateTelegram
// ---------------------------------------------------------------------------

describe("fabricateTelegram", () => {
  const input = {
    recipient: "Herrn Dr. Arthur Conan Doyle, London",
    sender: "Redaktion, Strand Magazine",
    message: "Manuskript eingetroffen bitte umgehend Freigabe erteilen",
    eraId: "westernUnion" as const,
  };

  it("liefert alle erwarteten Felder", () => {
    const t = fabricateTelegram(input, 42);
    expect(typeof t.era).toBe("string");
    expect(typeof t.header).toBe("string");
    expect(typeof t.body).toBe("string");
    expect(Array.isArray(t.strips)).toBe(true);
    expect(typeof t.urgency).toBe("string");
    expect(Array.isArray(t.stamps)).toBe(true);
    expect(typeof t.morsecode).toBe("string");
    expect(typeof t.svg).toBe("string");
  });

  it("setzt era auf die angeforderte Epoche", () => {
    const t = fabricateTelegram(input, 42);
    expect(t.era).toBe("westernUnion");
    expect(t.header).toBe("WESTERN UNION TELEGRAPH COMPANY");
  });

  it("zerlegt die Nachricht in Wort-Streifen", () => {
    const t = fabricateTelegram(input, 42);
    expect(t.strips).toEqual([
      "Manuskript",
      "eingetroffen",
      "bitte",
      "umgehend",
      "Freigabe",
      "erteilen",
    ]);
    expect(t.body).toBe(input.message);
  });

  it("enthält ein valides SVG mit svg-Tag", () => {
    const t = fabricateTelegram(input, 42);
    expect(t.svg).toContain("<svg");
    expect(t.svg).toContain("</svg>");
    expect(t.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("ist deterministisch (gleiche Eingabe + Seed ⇒ identisches Ergebnis)", () => {
    const a = fabricateTelegram(input, 42);
    const b = fabricateTelegram(input, 42);
    expect(a).toEqual(b);
  });

  it("unterscheidet verschiedene Seeds", () => {
    const a = fabricateTelegram(input, 1);
    const b = fabricateTelegram(input, 2);
    expect(a).not.toEqual(b);
  });

  it("verwendet die erste Epoche als Fallback bei unbekannter ID", () => {
    const t = fabricateTelegram({ ...input, eraId: "unknown" }, 42);
    expect(t.era).toBe("westernUnion");
  });

  it("behandelt leere Felder defensiv mit Platzhaltern", () => {
    const t = fabricateTelegram(
      { recipient: "", sender: "", message: "", eraId: "military" },
      42,
    );
    expect(t.body).toBe("KEIN TEXT");
    expect(t.strips).toEqual(["KEIN", "TEXT"]);
  });

  it("unterscheidet verschiedene Nachrichten", () => {
    const a = fabricateTelegram(input, 42);
    const b = fabricateTelegram({ ...input, message: "Andere Nachricht" }, 42);
    expect(a.strips).not.toEqual(b.strips);
  });
});

describe("fabricateTelegram – je Epoche", () => {
  for (const era of TELEGRAM_ERAS) {
    describe(`Epoche ${era.id}`, () => {
      const input = inputFor(era.id);

      it("setzt era auf die Epochen-ID", () => {
        expect(fabricateTelegram(input, 42).era).toBe(era.id);
      });

      it("setzt header auf den Epochen-Kopftext", () => {
        expect(fabricateTelegram(input, 42).header).toBe(era.headerText);
      });

      it("bettet den Kopftext in das SVG ein", () => {
        expect(fabricateTelegram(input, 42).svg).toContain(era.headerText);
      });

      it("zerlegt die Nachricht in die Wort-Streifen", () => {
        const t = fabricateTelegram(input, 42);
        expect(t.strips).toEqual(BASE_MESSAGE.split(/\s+/));
        expect(t.body).toBe(BASE_MESSAGE);
      });

      it("liefert eine nicht-leere Dringlichkeit", () => {
        const t = fabricateTelegram(input, 42);
        expect(typeof t.urgency).toBe("string");
        expect(t.urgency.length).toBeGreaterThan(0);
      });

      it("erzeugt 2 bis 4 Stempel", () => {
        const t = fabricateTelegram(input, 42);
        expect(t.stamps.length).toBeGreaterThanOrEqual(2);
        expect(t.stamps.length).toBeLessThanOrEqual(4);
      });

      it("liefert nicht-leeren Morsecode nur aus Morsezeichen", () => {
        const t = fabricateTelegram(input, 42);
        expect(t.morsecode.length).toBeGreaterThan(0);
        expect(t.morsecode).toMatch(/^[.\-/ ]+$/);
      });

      it("liefert ein SVG, das mit <svg beginnt und </svg> endet", () => {
        const t = fabricateTelegram(input, 42);
        expect(t.svg.startsWith("<svg")).toBe(true);
        expect(t.svg.endsWith("</svg>")).toBe(true);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// SVG-Struktur
// ---------------------------------------------------------------------------

describe("SVG-Struktur – je Epoche", () => {
  for (const era of TELEGRAM_ERAS) {
    describe(`Epoche ${era.id}`, () => {
      const svg = fabricateTelegram(inputFor(era.id), 42).svg;

      it("enthält öffnendes und schließendes svg-Tag", () => {
        expect(svg).toContain("<svg");
        expect(svg).toContain("</svg>");
        expect(svg.startsWith("<svg")).toBe(true);
        expect(svg.endsWith("</svg>")).toBe(true);
      });

      it("enthält keine Hex-Farben", () => {
        expect(svg).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      });

      it("enthält keine rgba()-Farben", () => {
        expect(svg).not.toContain("rgba(");
      });

      it("verwendet Design-Tokens oder currentColor", () => {
        expect(svg.includes("currentColor") || svg.includes("var(--")).toBe(
          true,
        );
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Morse-Kodierung
// ---------------------------------------------------------------------------

describe("Morse-Kodierung", () => {
  it("übersetzt SOS in ... --- ...", () => {
    const t = fabricateTelegram(inputFor("military", "SOS"), 1);
    expect(t.morsecode).toBe("... --- ...");
  });

  it("trennt Wörter mit einem Schrägstrich", () => {
    const t = fabricateTelegram(inputFor("military", "AB CD"), 1);
    expect(t.morsecode).toBe(".- -... / -.-. -..");
  });

  it("ignoriert nicht kodierbare Zeichen (nur Umlaute)", () => {
    const t = fabricateTelegram(inputFor("military", "ÄÖÜ"), 1);
    expect(t.morsecode).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Grenzfälle
// ---------------------------------------------------------------------------

describe("Grenzfälle", () => {
  it("behandelt eine leere Nachricht mit Platzhalter", () => {
    const t = fabricateTelegram(inputFor("military", ""), 42);
    expect(t.body).toBe("KEIN TEXT");
    expect(t.strips).toEqual(["KEIN", "TEXT"]);
    expect(t.svg).toContain("<svg");
  });

  it("behandelt eine Nachricht aus einem einzigen Wort", () => {
    const t = fabricateTelegram(inputFor("military", "Halt"), 42);
    expect(t.strips).toEqual(["Halt"]);
    expect(t.body).toBe("Halt");
  });

  it("verarbeitet eine sehr lange Nachricht (100 Wörter)", () => {
    const words = Array.from({ length: 100 }, (_, i) => `Wort${i + 1}`);
    const message = words.join(" ");
    const t = fabricateTelegram(inputFor("military", message), 42);
    expect(t.strips).toHaveLength(100);
    expect(t.strips).toEqual(words);
    expect(t.body).toBe(message);
    expect(t.svg.endsWith("</svg>")).toBe(true);
  });

  it("behandelt Umlaute ohne Bruch der Ausgabe", () => {
    const t = fabricateTelegram(
      inputFor("military", "Überprüfung der Güte"),
      42,
    );
    expect(t.strips).toEqual(["Überprüfung", "der", "Güte"]);
    expect(t.morsecode).toMatch(/^[.\-/ ]+$/);
  });

  it("behandelt Satzzeichen ohne Bruch der Ausgabe", () => {
    const t = fabricateTelegram(inputFor("military", "Achtung, sofort!"), 42);
    expect(t.strips).toEqual(["Achtung,", "sofort!"]);
    expect(t.morsecode).toMatch(/^[.\-/ ]+$/);
  });

  it("behandelt deutsche Anführungszeichen als eigenes Wort", () => {
    const t = fabricateTelegram(
      inputFor("military", "Prüfung „Manuskript“ bestanden"),
      42,
    );
    expect(t.strips).toEqual(["Prüfung", "„Manuskript“", "bestanden"]);
    expect(t.svg).toContain("<svg");
  });

  it("behandelt eine Nachricht aus ausschließlich Leerzeichen", () => {
    const t = fabricateTelegram(inputFor("military", "   "), 42);
    expect(t.body).toBe("KEIN TEXT");
    expect(t.strips).toEqual(["KEIN", "TEXT"]);
  });

  it("fällt bei unbekannter Epochen-ID auf westernUnion zurück", () => {
    const t = fabricateTelegram(inputFor("unbekannt"), 42);
    expect(t.era).toBe("westernUnion");
    expect(t.header).toBe("WESTERN UNION TELEGRAPH COMPANY");
  });

  it("verwendet einen Platzhalter bei leerem Empfänger", () => {
    const t = fabricateTelegram(
      {
        recipient: "",
        sender: "Redaktion",
        message: BASE_MESSAGE,
        eraId: "military",
      },
      42,
    );
    expect(t.svg).toContain("UNBEKANNT");
  });

  it("verwendet einen Platzhalter bei leerem Absender", () => {
    const t = fabricateTelegram(
      {
        recipient: "Herrn Direktor",
        sender: "   ",
        message: BASE_MESSAGE,
        eraId: "military",
      },
      42,
    );
    expect(t.svg).toContain("UNBEKANNT");
  });

  it("kombiniert leere Felder mit unbekannter Epoche", () => {
    const t = fabricateTelegram(
      { recipient: "", sender: "", message: "", eraId: "" },
      42,
    );
    expect(t.era).toBe("westernUnion");
    expect(t.body).toBe("KEIN TEXT");
    expect(t.svg).toContain("UNBEKANNT");
    expect(t.svg.endsWith("</svg>")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Determinismus über alle Funktionen
// ---------------------------------------------------------------------------

describe("Determinismus über alle Funktionen", () => {
  it("hashString: gleicher Input ⇒ gleicher Wert", () => {
    expect(hashString("depesche")).toBe(hashString("depesche"));
  });

  it("createSeededRandom: gleicher Seed ⇒ gleiche Sequenz", () => {
    const a = createSeededRandom(2024);
    const b = createSeededRandom(2024);
    expect(Array.from({ length: 50 }, () => a())).toEqual(
      Array.from({ length: 50 }, () => b()),
    );
  });

  it("getTelegramEra: liefert für jede ID dieselbe Referenz", () => {
    for (const era of TELEGRAM_ERAS) {
      expect(getTelegramEra(era.id)).toBe(getTelegramEra(era.id));
    }
  });

  it("generateUrgencyStamp: gleiche Epoche + Seed ⇒ gleiches Ergebnis", () => {
    for (const era of TELEGRAM_ERAS) {
      expect(generateUrgencyStamp(era.id, 55)).toEqual(
        generateUrgencyStamp(era.id, 55),
      );
    }
  });

  it("fabricateTelegram: gleiche Eingabe + Seed ⇒ identisches Ergebnis", () => {
    for (const era of TELEGRAM_ERAS) {
      expect(fabricateTelegram(inputFor(era.id), 42)).toEqual(
        fabricateTelegram(inputFor(era.id), 42),
      );
    }
  });

  it("exportTelegramPdf: gleiche Eingabe + Seed ⇒ identisches Ergebnis", () => {
    for (const era of TELEGRAM_ERAS) {
      expect(exportTelegramPdf(inputFor(era.id), 42)).toEqual(
        exportTelegramPdf(inputFor(era.id), 42),
      );
    }
  });

  it("createSampleEra: identisch bei wiederholtem Aufruf", () => {
    expect(createSampleEra()).toEqual(createSampleEra());
  });

  it("createSampleTelegram: identisch bei wiederholtem Aufruf", () => {
    expect(createSampleTelegram()).toEqual(createSampleTelegram());
  });

  it("generateUrgencyStamp: verschiedene Seeds erzeugen manchmal unterschiedliche Dringlichkeiten", () => {
    const seen = new Set<string>();
    for (let s = 0; s < 40; s++) {
      seen.add(generateUrgencyStamp("westernUnion", s).urgency);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("generateUrgencyStamp: verschiedene Seeds erzeugen manchmal unterschiedliche Stempel", () => {
    const seen = new Set<string>();
    for (let s = 0; s < 40; s++) {
      seen.add(JSON.stringify(generateUrgencyStamp("westernUnion", s).stamps));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("fabricateTelegram: verschiedene Seeds erzeugen manchmal unterschiedliche SVGs", () => {
    const seen = new Set<string>();
    for (let s = 0; s < 20; s++) {
      seen.add(fabricateTelegram(inputFor("military"), s).svg);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// exportTelegramPdf
// ---------------------------------------------------------------------------

describe("exportTelegramPdf", () => {
  const input = {
    recipient: "Herrn Dr. Arthur Conan Doyle, London",
    sender: "Redaktion, Strand Magazine",
    message: "Manuskript eingetroffen bitte umgehend Freigabe erteilen",
    eraId: "westernUnion" as const,
  };

  it("liefert dpi=300 und printReady=true", () => {
    const result = exportTelegramPdf(input, 42);
    expect(result.dpi).toBe(300);
    expect(result.printReady).toBe(true);
  });

  it("enthält das SVG und positive Maße", () => {
    const result = exportTelegramPdf(input, 42);
    expect(result.svg).toContain("<svg");
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it("ist deterministisch (gleiche Eingabe + Seed ⇒ identisches Ergebnis)", () => {
    const a = exportTelegramPdf(input, 42);
    const b = exportTelegramPdf(input, 42);
    expect(a).toEqual(b);
  });
});

describe("exportTelegramPdf – je Epoche", () => {
  for (const era of TELEGRAM_ERAS) {
    describe(`Epoche ${era.id}`, () => {
      const result = exportTelegramPdf(inputFor(era.id), 42);

      it("liefert dpi=300", () => {
        expect(result.dpi).toBe(300);
      });

      it("ist printReady", () => {
        expect(result.printReady).toBe(true);
      });

      it("hat positive Breite und Höhe", () => {
        expect(result.width).toBeGreaterThan(0);
        expect(result.height).toBeGreaterThan(0);
        expect(result.width).toBe(620);
      });

      it("enthält ein valides SVG", () => {
        expect(result.svg.startsWith("<svg")).toBe(true);
        expect(result.svg.endsWith("</svg>")).toBe(true);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Beispielfabriken
// ---------------------------------------------------------------------------

describe("createSampleEra", () => {
  it("liefert eine gültige Epoche", () => {
    const era = createSampleEra();
    expect(era).toBeDefined();
    expect(typeof era.id).toBe("string");
    expect(typeof era.name).toBe("string");
    expect(typeof era.year).toBe("number");
    expect(typeof era.description).toBe("string");
    expect(typeof era.headerText).toBe("string");
    expect(typeof era.paperTone).toBe("string");
  });

  it("entspricht der ersten Epoche (westernUnion)", () => {
    expect(createSampleEra()).toEqual(TELEGRAM_ERAS[0]);
  });

  it("liefert dieselbe Referenz wie die erste Epoche", () => {
    expect(createSampleEra()).toBe(TELEGRAM_ERAS[0]);
  });
});

describe("createSampleTelegram", () => {
  it("liefert ein vollständiges Telegramm mit allen Feldern", () => {
    const t = createSampleTelegram();
    expect(typeof t.era).toBe("string");
    expect(typeof t.header).toBe("string");
    expect(typeof t.body).toBe("string");
    expect(Array.isArray(t.strips)).toBe(true);
    expect(t.strips.length).toBeGreaterThan(0);
    expect(typeof t.urgency).toBe("string");
    expect(Array.isArray(t.stamps)).toBe(true);
    expect(typeof t.morsecode).toBe("string");
    expect(t.svg).toContain("<svg");
  });

  it("ist deterministisch (zwei Aufrufe ⇒ identisches Ergebnis)", () => {
    const a = createSampleTelegram();
    const b = createSampleTelegram();
    expect(a).toEqual(b);
  });

  it("verwendet die westernUnion-Epoche", () => {
    const t = createSampleTelegram();
    expect(t.era).toBe("westernUnion");
  });

  it("erzeugt ein SVG mit gültigem Rahmen", () => {
    const t = createSampleTelegram();
    expect(t.svg.startsWith("<svg")).toBe(true);
    expect(t.svg.endsWith("</svg>")).toBe(true);
    expect(t.stamps.length).toBeGreaterThanOrEqual(2);
    expect(t.stamps.length).toBeLessThanOrEqual(4);
  });
});
