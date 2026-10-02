// @vitest-environment happy-dom
// Tests: Distribution-Pipeline-Service (WP 21.2, ONIX 3.0).
//
// Deckt ONIX-3.0-Erzeugung (Wohlgeformtheit, Escaping, Determinismus,
// defensive Fallbacks), die 15 Compliance-Prüfungen und die vier
// Distributor-Profile ab. Rein lokal — 0 Netzwerk-, 0 LLM-Aufrufe.
import { describe, it, expect } from "vitest";
import {
  ONIX_REFERENCE_NS,
  ONIX_RELEASE,
  DISTRIBUTOR_PROFILES,
  generateOnixMetadata,
  checkCompliance,
  getDistributorProfile,
  isValidIsbn,
  isValidPublicationDate,
  normalizePublicationDate,
  escapeXml,
  type BookMetadata,
  type Distributor,
} from "./distributionPipeline";

// --- Helfer ---------------------------------------------------------------

/** true, wenn das Dokument ohne XML-Fehler geparst wird (happy-dom). */
function isWellFormedXml(xml: string): boolean {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return doc.querySelector("parsererror") === null;
}

/** Vollständig gültiges Buch als Basis für die Compliance-Tests. */
function validBook(overrides: Partial<BookMetadata> = {}): BookMetadata {
  return {
    title: "Der Schatten über Berlin",
    author: "Anna Beispiel",
    isbn: "9780306406157",
    price: 12.99,
    currency: "EUR",
    language: "de",
    publisher: "Beispielverlag",
    publicationDate: "2026-03-15",
    pages: 320,
    format: "EPUB",
    subjects: ["Krimi", "Historisch"],
    ...overrides,
  };
}

// --- ONIX 3.0: Grundgerüst -------------------------------------------------

describe("generateOnixMetadata: ONIX 3.0 Grundgerüst", () => {
  it("erzeugt wohlgeformtes XML mit korrektem Root-Element und Namespace", () => {
    const xml = generateOnixMetadata(validBook());
    expect(isWellFormedXml(xml)).toBe(true);
    expect(xml).toContain(`<ONIXMessage release="${ONIX_RELEASE}"`);
    expect(xml).toContain(`xmlns="${ONIX_REFERENCE_NS}"`);
    expect(xml).toContain("<Product>");
  });

  it("schreibt Titel, Autor, ISBN, Verlag und Preis in die Ausgabe", () => {
    const xml = generateOnixMetadata(validBook());
    expect(xml).toContain("<TitleText>Der Schatten über Berlin</TitleText>");
    expect(xml).toContain("<PersonName>Anna Beispiel</PersonName>");
    expect(xml).toContain("<IDValue>9780306406157</IDValue>");
    expect(xml).toContain("<PublisherName>Beispielverlag</PublisherName>");
    expect(xml).toContain("<PriceAmount>12.99</PriceAmount>");
    expect(xml).toContain("<CurrencyCode>EUR</CurrencyCode>");
  });

  it("mappt Sprach- und Formatcode auf ONIX-Codes", () => {
    const xml = generateOnixMetadata(validBook({ language: "de", format: "EPUB" }));
    expect(xml).toContain("<LanguageCode>ger</LanguageCode>");
    expect(xml).toContain("<ProductForm>EB</ProductForm>");
  });

  it("ist deterministisch: gleiche Eingabe → gleiche Ausgabe", () => {
    const a = generateOnixMetadata(validBook());
    const b = generateOnixMetadata(validBook());
    expect(a).toBe(b);
  });

  it("nimmt gesendeten Zeitstempel nur auf, wenn angegeben", () => {
    const without = generateOnixMetadata(validBook());
    const withDate = generateOnixMetadata(validBook(), { sentDate: "2026-10-02T10:00:00Z" });
    expect(without).not.toContain("<SentDateTime>");
    expect(withDate).toContain("<SentDateTime>2026-10-02T10:00:00Z</SentDateTime>");
  });
});

// --- ONIX 3.0: Escaping & defensive Fallbacks ------------------------------

describe("generateOnixMetadata: Escaping und Robustheit", () => {
  it("escaped XML-Sonderzeichen in Freitextfeldern", () => {
    const xml = generateOnixMetadata(
      validBook({ title: 'Fisch & <Käse> "Zitat"', author: "A & B <C>" }),
    );
    expect(isWellFormedXml(xml)).toBe(true);
    expect(xml).toContain("Fisch &amp; &lt;Käse&gt; &quot;Zitat&quot;");
    expect(xml).not.toContain("<Käse>");
  });

  it("liefert auch bei komplett leerem Buch wohlgeformtes XML (Fallbacks)", () => {
    const xml = generateOnixMetadata({} as BookMetadata);
    expect(isWellFormedXml(xml)).toBe(true);
    expect(xml).toContain("<TitleText>Ohne Titel</TitleText>");
    expect(xml).toContain("<PersonName>Unbekannter Autor</PersonName>");
    expect(xml).toContain("<CurrencyCode>EUR</CurrencyCode>");
    expect(xml).toContain("<PriceAmount>0.00</PriceAmount>");
  });

  it("behandelt negative/ungültige Zahlen defensiv", () => {
    const xml = generateOnixMetadata(
      validBook({ price: -5, pages: Number.NaN }),
    );
    expect(isWellFormedXml(xml)).toBe(true);
    expect(xml).toContain("<PriceAmount>0.00</PriceAmount>");
    // Kein Extent-Block ohne gültige Seitenzahl
    expect(xml).not.toContain("<ExtentValue>");
  });

  it("entfernt unzulässige Steuerzeichen aus Feldern", () => {
    const xml = generateOnixMetadata(validBook({ title: "Bad\u0007Title" }));
    expect(isWellFormedXml(xml)).toBe(true);
    expect(xml).toContain("<TitleText>BadTitle</TitleText>");
  });

  it("escapeXml maskiert alle fünf XML-Entitäten", () => {
    expect(escapeXml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&apos;");
  });
});

// --- Distributor-Profile ---------------------------------------------------

describe("getDistributorProfile", () => {
  it("liefert die vier bekannten Profile mit den Kernfeldern", () => {
    const kdp = getDistributorProfile("kdp");
    expect(kdp.name).toBe("Amazon KDP");
    expect(kdp.colorModel).toBe("RGB");
    expect(kdp.requiresIsbn).toBe(false);

    const ingram = getDistributorProfile("ingramspark");
    expect(ingram.name).toBe("IngramSpark");
    expect(ingram.colorModel).toBe("CMYK");
    expect(ingram.requiresIsbn).toBe(true);

    expect(getDistributorProfile("tolino").name).toBe("Tolino");
    expect(getDistributorProfile("apple").name).toBe("Apple Books");
  });

  it("jedes Profil hat Formate, eine positive Dateigröße und ein gültiges Farbmodell", () => {
    for (const distributor of Object.keys(DISTRIBUTOR_PROFILES) as Distributor[]) {
      const p = getDistributorProfile(distributor);
      expect(p.requiredFormats.length).toBeGreaterThan(0);
      expect(p.maxFileSizeMB).toBeGreaterThan(0);
      expect(["RGB", "CMYK"]).toContain(p.colorModel);
    }
  });

  it("liefert eine defensive Kopie (Mutation verändert das Registry nicht)", () => {
    const p = getDistributorProfile("kdp");
    p.requiredFormats.push("MUTIERT");
    expect(getDistributorProfile("kdp").requiredFormats).not.toContain("MUTIERT");
  });

  it("wirft bei unbekanntem Distributor", () => {
    expect(() => getDistributorProfile("gibtsnicht" as never)).toThrow(/Unbekannter Distributor/);
  });
});

// --- Compliance: Happy Path ------------------------------------------------

describe("checkCompliance: gültiges Buch", () => {
  it("liefert für ein vollständiges Buch keine Probleme", () => {
    for (const distributor of ["kdp", "ingramspark", "tolino", "apple"] as Distributor[]) {
      const issues = checkCompliance(validBook(), distributor);
      expect(issues).toEqual([]);
    }
  });
});

// --- Compliance: die einzelnen Ablehnungsgründe ----------------------------

describe("checkCompliance: Ablehnungsgründe", () => {
  it("MISSING_ISBN ist Fehler, wenn der Kanal eine ISBN verlangt (IngramSpark)", () => {
    const issues = checkCompliance(validBook({ isbn: "" }), "ingramspark");
    const issue = issues.find((i) => i.code === "MISSING_ISBN");
    expect(issue?.severity).toBe("error");
  });

  it("MISSING_ISBN ist nur Warnung, wenn der Kanal keine ISBN verlangt (KDP)", () => {
    const issues = checkCompliance(validBook({ isbn: "" }), "kdp");
    expect(issues.find((i) => i.code === "MISSING_ISBN")?.severity).toBe("warning");
  });

  it("INVALID_ISBN bei falscher Prüfziffer", () => {
    const issues = checkCompliance(validBook({ isbn: "9780306406158" }), "kdp");
    expect(issues.find((i) => i.code === "INVALID_ISBN")?.severity).toBe("error");
  });

  it("MISSING_TITLE und TITLE_TOO_LONG", () => {
    expect(checkCompliance(validBook({ title: "" }), "kdp").some((i) => i.code === "MISSING_TITLE")).toBe(true);
    const long = checkCompliance(validBook({ title: "x".repeat(201) }), "kdp");
    expect(long.find((i) => i.code === "TITLE_TOO_LONG")?.severity).toBe("warning");
  });

  it("MISSING_AUTHOR", () => {
    expect(checkCompliance(validBook({ author: "" }), "kdp").some((i) => i.code === "MISSING_AUTHOR")).toBe(true);
  });

  it("MISSING_PRICE bei fehlendem oder ungültigem Preis", () => {
    expect(checkCompliance(validBook({ price: 0 }), "kdp").some((i) => i.code === "MISSING_PRICE")).toBe(true);
    expect(checkCompliance(validBook({ price: Number.NaN }), "kdp").some((i) => i.code === "MISSING_PRICE")).toBe(true);
  });

  it("PRICE_BELOW_MIN und PRICE_ABOVE_MAX gegen den Kanal-Korridor", () => {
    expect(checkCompliance(validBook({ price: 0.5 }), "kdp").some((i) => i.code === "PRICE_BELOW_MIN")).toBe(true);
    expect(checkCompliance(validBook({ price: 500 }), "kdp").some((i) => i.code === "PRICE_ABOVE_MAX")).toBe(true);
  });

  it("INVALID_CURRENCY: fehlend oder kanalfremd (Tolino akzeptiert nur EUR)", () => {
    expect(checkCompliance(validBook({ currency: "" }), "kdp").some((i) => i.code === "INVALID_CURRENCY")).toBe(true);
    expect(checkCompliance(validBook({ currency: "USD" }), "tolino").some((i) => i.code === "INVALID_CURRENCY")).toBe(true);
    expect(checkCompliance(validBook({ currency: "eur" }), "tolino")).toEqual([]);
  });

  it("MISSING_LANGUAGE und MISSING_PUBLISHER sind Warnungen", () => {
    const lang = checkCompliance(validBook({ language: "" }), "kdp").find((i) => i.code === "MISSING_LANGUAGE");
    expect(lang?.severity).toBe("warning");
    const pub = checkCompliance(validBook({ publisher: "" }), "kdp").find((i) => i.code === "MISSING_PUBLISHER");
    expect(pub?.severity).toBe("warning");
  });

  it("INVALID_PUBLICATION_DATE bei leerem oder unsinnigem Datum", () => {
    expect(checkCompliance(validBook({ publicationDate: "" }), "kdp").some((i) => i.code === "INVALID_PUBLICATION_DATE")).toBe(true);
    expect(checkCompliance(validBook({ publicationDate: "2026-13-40" }), "kdp").some((i) => i.code === "INVALID_PUBLICATION_DATE")).toBe(true);
  });

  it("INVALID_PAGE_COUNT bei fehlender/ungültiger Seitenzahl", () => {
    expect(checkCompliance(validBook({ pages: 0 }), "kdp").some((i) => i.code === "INVALID_PAGE_COUNT")).toBe(true);
    expect(checkCompliance(validBook({ pages: 12.5 }), "kdp").some((i) => i.code === "INVALID_PAGE_COUNT")).toBe(true);
  });

  it("UNSUPPORTED_FORMAT, wenn das Format nicht im Profil steht", () => {
    // Tolino akzeptiert nur EPUB — ein PDF wird abgelehnt.
    expect(checkCompliance(validBook({ format: "PDF" }), "tolino").some((i) => i.code === "UNSUPPORTED_FORMAT")).toBe(true);
    // Leeres Format ebenso.
    expect(checkCompliance(validBook({ format: "" }), "kdp").some((i) => i.code === "UNSUPPORTED_FORMAT")).toBe(true);
  });

  it("MISSING_SUBJECTS ist eine Warnung", () => {
    const issue = checkCompliance(validBook({ subjects: [] }), "kdp").find((i) => i.code === "MISSING_SUBJECTS");
    expect(issue?.severity).toBe("warning");
  });

  it("sammelt mehrere Probleme gleichzeitig", () => {
    const issues = checkCompliance(
      { ...validBook(), isbn: "", author: "", price: 0, subjects: [] },
      "ingramspark",
    );
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("MISSING_ISBN");
    expect(codes).toContain("MISSING_AUTHOR");
    expect(codes).toContain("MISSING_PRICE");
    expect(codes).toContain("MISSING_SUBJECTS");
  });
});

// --- ISBN-/Datums-Helfer ---------------------------------------------------

describe("ISBN- und Datums-Helfer", () => {
  it("isValidIsbn akzeptiert gültige ISBN-10 und ISBN-13", () => {
    expect(isValidIsbn("9780306406157")).toBe(true);
    expect(isValidIsbn("978-0-306-40615-7")).toBe(true);
    expect(isValidIsbn("0306406152")).toBe(true);
  });

  it("isValidIsbn lehnt falsche Prüfziffern und Längen ab", () => {
    expect(isValidIsbn("9780306406158")).toBe(false);
    expect(isValidIsbn("1234567890")).toBe(false);
    expect(isValidIsbn("")).toBe(false);
  });

  it("normalizePublicationDate füllt Jahr/Monat auf und validiert Kalendertage", () => {
    expect(normalizePublicationDate("2026")).toBe("2026-01-01");
    expect(normalizePublicationDate("2026-03")).toBe("2026-03-01");
    expect(normalizePublicationDate("2026-03-15")).toBe("2026-03-15");
    expect(normalizePublicationDate("2026-02-30")).toBeNull();
    expect(normalizePublicationDate("kein-datum")).toBeNull();
    expect(isValidPublicationDate("2026-02-28")).toBe(true);
  });
});
