// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  redactText,
  generateOfficialStamp,
  buildDossierExport,
  createSampleRedactedText,
  createSampleDossierExport,
} from "./redactedDossierStudio";

const BLOCKS = "██████";

const SAMPLE_TEXT =
  "Der Informant Codename NACHTFALCON traf sich am vierzehnten März mit einem " +
  "unkontaktierten Offizier der regulären Streitkräfte in einem Parkhaus nahe " +
  "der Hauptverkehrsader. Übergeben wurde ein Mikrofilm der Aufnahmen von " +
  "Waffenlieferungen an eine nicht genannte Organisation enthielt.";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("dossier")).toBe(hashString("dossier"));
    expect(hashString("NACHTFALCON")).toBe(hashString("NACHTFALCON"));
  });

  it("liefert eine vorzeichenlose 32-Bit-Ganzzahl", () => {
    const h = hashString("Streng Geheim");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it("unterschiedliche Strings erzeugen unterschiedliche Hashes", () => {
    expect(hashString("alpha")).not.toBe(hashString("beta"));
    expect(hashString("TOP SECRET")).not.toBe(hashString("DECLASSIFIED"));
    expect(hashString("seed:1")).not.toBe(hashString("seed:2"));
  });

  it("leerer String liefert einen stabilen Wert", () => {
    expect(hashString("")).toBe(hashString(""));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(1337);
    const r2 = createSeededRandom(1337);
    for (let i = 0; i < 25; i++) {
      expect(r1()).toBe(r2());
    }
  });

  it("liefert Werte im Bereich [0,1)", () => {
    const rng = createSeededRandom(7);
    for (let i = 0; i < 200; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("unterschiedliche Seeds erzeugen unterschiedliche Folgen", () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);
    let gleich = 0;
    for (let i = 0; i < 10; i++) {
      if (a() === b()) gleich++;
    }
    expect(gleich).toBeLessThan(10);
  });
});

describe("redactText", () => {
  it("ersetzt Wörter durch ██████-Balken", () => {
    const result = redactText(SAMPLE_TEXT, 0.3, 42);
    expect(result.redactedText).toContain(BLOCKS);
  });

  it("liefert redactionCount größer null bei positivem Verhältnis", () => {
    const result = redactText(SAMPLE_TEXT, 0.3, 42);
    expect(result.redactionCount).toBeGreaterThan(0);
    expect(result.redactionCount).toBe(
      (result.redactedText.match(/██████/g) ?? []).length
    );
  });

  it("reicht das Redaktionsverhältnis unverändert durch", () => {
    const result = redactText(SAMPLE_TEXT, 0.35, 42);
    expect(result.redactionRatio).toBe(0.35);
  });

  it("ist deterministisch für gleichen Seed", () => {
    const a = redactText(SAMPLE_TEXT, 0.4, 99);
    const b = redactText(SAMPLE_TEXT, 0.4, 99);
    expect(a.redactedText).toBe(b.redactedText);
    expect(a.redactionCount).toBe(b.redactionCount);
  });

  it("unterschiedliche Seeds erzeugen unterschiedliche Schwärzungen", () => {
    const a = redactText(SAMPLE_TEXT, 0.5, 1);
    const b = redactText(SAMPLE_TEXT, 0.5, 2);
    expect(a.redactedText).not.toBe(b.redactedText);
  });

  it("Verhältnis 0 schwärzt nichts", () => {
    const result = redactText(SAMPLE_TEXT, 0, 42);
    expect(result.redactionCount).toBe(0);
    expect(result.redactedText).not.toContain(BLOCKS);
  });

  it("leitet die Klassifizierung aus dem Verhältnis ab", () => {
    expect(redactText(SAMPLE_TEXT, 0.1, 42).classification).toBe("DECLASSIFIED");
    expect(redactText(SAMPLE_TEXT, 0.3, 42).classification).toBe(
      "BND STRENG GEHEIM"
    );
    expect(redactText(SAMPLE_TEXT, 0.45, 42).classification).toBe(
      "TOP SECRET / EYES ONLY"
    );
    expect(redactText(SAMPLE_TEXT, 0.65, 42).classification).toBe(
      "KGB СОВЕРШЕННО СЕКРЕТНО"
    );
  });

  it("Standardverhältnis ist 0.3", () => {
    const result = redactText(SAMPLE_TEXT, undefined as unknown as number, 42);
    expect(result.redactionRatio).toBe(0.3);
  });
});

describe("generateOfficialStamp", () => {
  it("liefert einen SVG-String", () => {
    const stamp = generateOfficialStamp("TOP SECRET / EYES ONLY", 42);
    expect(typeof stamp.svg).toBe("string");
    expect(stamp.svg).toContain("<svg");
    expect(stamp.svg).toContain("</svg>");
  });

  it("reicht die Klassifizierung durch", () => {
    const stamp = generateOfficialStamp("DECLASSIFIED", 42);
    expect(stamp.classification).toBe("DECLASSIFIED");
    expect(stamp.svg).toContain("DECLASSIFIED");
  });

  it("ordnet die Behörde zur Klassifizierung zu", () => {
    expect(
      generateOfficialStamp("TOP SECRET / EYES ONLY", 42).agency
    ).toContain("CIA");
    expect(generateOfficialStamp("BND STRENG GEHEIM", 42).agency).toContain(
      "BND"
    );
    expect(generateOfficialStamp("KGB СОВЕРШЕННО СЕКРЕТНО", 42).agency).toContain(
      "KGB"
    );
    expect(generateOfficialStamp("DECLASSIFIED", 42).agency).toContain("FOIA");
  });

  it("unbekannte Klassifizierung erhält eine Ausweichbehörde", () => {
    const stamp = generateOfficialStamp("SONDERSTUFE", 42);
    expect(stamp.agency).toBe("Unbekannte Behörde");
  });

  it("liefert ein Datum im ISO-Format YYYY-MM-DD", () => {
    const stamp = generateOfficialStamp("BND STRENG GEHEIM", 42);
    expect(stamp.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("liefert eine beschreibende Beschreibung", () => {
    const stamp = generateOfficialStamp("BND STRENG GEHEIM", 42);
    expect(stamp.description).toContain("BND");
    expect(stamp.description).toContain("BND STRENG GEHEIM");
    expect(stamp.description).toContain(stamp.date);
  });

  it("ist deterministisch für gleichen Seed", () => {
    const a = generateOfficialStamp("DECLASSIFIED", 7);
    const b = generateOfficialStamp("DECLASSIFIED", 7);
    expect(a.svg).toBe(b.svg);
  });

  it("verwendet Design-Tokens statt Hex-Farben", () => {
    const stamp = generateOfficialStamp("DECLASSIFIED", 42);
    expect(stamp.svg).toContain("var(--color-text-primary)");
    expect(stamp.svg).toContain("var(--color-accent-danger)");
    expect(stamp.svg).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it("escapt XML-Sonderzeichen in der Klassifizierung", () => {
    const stamp = generateOfficialStamp("A & B <C>", 42);
    expect(stamp.svg).toContain("A &amp; B &lt;C&gt;");
  });
});

describe("buildDossierExport", () => {
  it("liefert Markdown mit Titel und Klassifizierung", () => {
    const dossier = buildDossierExport(
      "AKTE TEST",
      SAMPLE_TEXT,
      "BND STRENG GEHEIM",
      42
    );
    expect(typeof dossier.markdown).toBe("string");
    expect(dossier.markdown).toContain("# AKTE TEST");
    expect(dossier.markdown).toContain("KLASSIFIZIERUNG: BND STRENG GEHEIM");
  });

  it("liefert einen Stempel mit SVG und Klassifizierung", () => {
    const dossier = buildDossierExport(
      "AKTE TEST",
      SAMPLE_TEXT,
      "TOP SECRET / EYES ONLY",
      42
    );
    expect(dossier.stamp.svg).toContain("<svg");
    expect(dossier.stamp.classification).toBe("TOP SECRET / EYES ONLY");
    expect(dossier.markdown).toContain("<svg");
  });

  it("liefert Metadaten mit Seiten, Exemplaren und Datum", () => {
    const dossier = buildDossierExport(
      "AKTE TEST",
      SAMPLE_TEXT,
      "DECLASSIFIED",
      42
    );
    expect(dossier.metadata.pages).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(dossier.metadata.pages)).toBe(true);
    expect(dossier.metadata.copies).toBeGreaterThanOrEqual(3);
    expect(dossier.metadata.copies).toBeLessThanOrEqual(49);
    expect(dossier.metadata.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("liefert genau drei Begleitnotizen", () => {
    const dossier = buildDossierExport(
      "AKTE TEST",
      SAMPLE_TEXT,
      "BND STRENG GEHEIM",
      42
    );
    expect(Array.isArray(dossier.notes)).toBe(true);
    expect(dossier.notes).toHaveLength(3);
    expect(dossier.markdown).toContain("## Begleitnotizen");
    for (const note of dossier.notes) {
      expect(dossier.markdown).toContain(`- ${note}`);
    }
  });

  it("redigiert den Inhalt im Markdown", () => {
    const dossier = buildDossierExport(
      "AKTE TEST",
      SAMPLE_TEXT,
      "BND STRENG GEHEIM",
      42
    );
    expect(dossier.markdown).toContain(BLOCKS);
    expect(dossier.markdown).toContain("Schwärzungen");
  });

  it("ist deterministisch für gleichen Seed", () => {
    const a = buildDossierExport("AKTE TEST", SAMPLE_TEXT, "DECLASSIFIED", 123);
    const b = buildDossierExport("AKTE TEST", SAMPLE_TEXT, "DECLASSIFIED", 123);
    expect(a.markdown).toBe(b.markdown);
    expect(a.notes).toEqual(b.notes);
    expect(a.metadata).toEqual(b.metadata);
  });
});

describe("createSampleRedactedText", () => {
  it("liefert einen gültigen redigierten Text", () => {
    const sample = createSampleRedactedText();
    expect(typeof sample.redactedText).toBe("string");
    expect(sample.redactedText.length).toBeGreaterThan(0);
    expect(sample.redactedText).toContain(BLOCKS);
    expect(sample.redactionCount).toBeGreaterThan(0);
    expect(sample.redactionRatio).toBe(0.35);
    expect(typeof sample.classification).toBe("string");
    expect(sample.classification.length).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    expect(createSampleRedactedText().redactedText).toBe(
      createSampleRedactedText().redactedText
    );
  });
});

describe("createSampleDossierExport", () => {
  it("liefert ein vollständiges Dossier", () => {
    const dossier = createSampleDossierExport();
    expect(dossier.markdown).toContain("AKTE NACHTFALCON");
    expect(dossier.stamp.svg).toContain("<svg");
    expect(dossier.stamp.classification).toBe("BND STRENG GEHEIM");
    expect(dossier.metadata.pages).toBeGreaterThanOrEqual(1);
    expect(dossier.notes).toHaveLength(3);
  });

  it("ist deterministisch", () => {
    expect(createSampleDossierExport().markdown).toBe(
      createSampleDossierExport().markdown
    );
  });
});
