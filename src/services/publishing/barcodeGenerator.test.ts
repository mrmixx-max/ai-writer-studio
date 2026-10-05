// Tests: Vektor-ISBN- & Barcode-Generator-Service (WP 53.1)
//
// Deckt EAN-13-Prüfziffern-Validierung, K-Only-Barcode-SVG und
// deterministischen Vektor-QR-Code ab (inkl. defensiver Fallbacks).
import { describe, it, expect } from "vitest";
import {
  validateEan13,
  generateBarcodeSvg,
  generateQrSvg,
} from "./barcodeGenerator";

// ---------------------------------------------------------------------------
// Test-Helfer
// ---------------------------------------------------------------------------

/** Extrahiert alle Hex-Farben (#RRGGBB) aus einem SVG-String. */
function hexColors(svg: string): string[] {
  return (svg.match(/#[0-9A-Fa-f]{6}/g) ?? []).map((c) => c.toUpperCase());
}

/** Liest die Modulmatrix eines QR-SVG zurück (Default-Skalierung = 8). */
function qrMatrixFromSvg(svg: string): boolean[][] {
  const width = parseInt(svg.match(/width="(\d+)"/)?.[1] ?? "0", 10);
  const moduleCount = Math.round(width / 8);
  const matrix: boolean[][] = Array.from({ length: moduleCount }, () =>
    new Array<boolean>(moduleCount).fill(false),
  );
  const d = svg.match(/<path d="([^"]*)"/)?.[1] ?? "";
  const re = /M(\d+(?:\.\d+)?) (\d+(?:\.\d+)?)h(\d+(?:\.\d+)?)v(\d+(?:\.\d+)?)h-(\d+(?:\.\d+)?)z/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(d)) !== null) {
    const col = Math.round(parseFloat(match[1]) / 8);
    const row = Math.round(parseFloat(match[2]) / 8);
    matrix[row][col] = true;
  }
  return matrix;
}

/** Liest die 95-Bit-Modulfolge eines Barcode-SVG (Modulbreite 2, Rand 10). */
function eanModulesFromSvg(svg: string): string {
  const mods = new Array<number>(95).fill(0);
  const re = /<rect x="(\d+(?:\.\d+)?)" y="0" width="(\d+(?:\.\d+)?)" height="(\d+(?:\.\d+)?)"\/>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(svg)) !== null) {
    const start = Math.round((parseFloat(match[1]) - 10) / 2);
    const len = Math.round(parseFloat(match[2]) / 2);
    for (let k = 0; k < len; k++) mods[start + k] = 1;
  }
  return mods.join("");
}

// ---------------------------------------------------------------------------
// validateEan13
// ---------------------------------------------------------------------------

describe("validateEan13", () => {
  it("akzeptiert eine gültige EAN-13 (9783161484100)", () => {
    expect(validateEan13("9783161484100")).toBe(true);
  });

  it("akzeptiert ISBN-13 mit Bindestrichen (978-3-16-148410-0)", () => {
    expect(validateEan13("978-3-16-148410-0")).toBe(true);
  });

  it("akzeptiert eine weitere gültige EAN-13 (4006381333931)", () => {
    expect(validateEan13("4006381333931")).toBe(true);
  });

  it("toleriert führende/nachfolgende Leerzeichen", () => {
    expect(validateEan13("  5901234123457  ")).toBe(true);
  });

  it("lehnt eine falsche Prüfziffer ab", () => {
    // letzte Ziffer absichtlich falsch (richtig wäre 0)
    expect(validateEan13("9783161484109")).toBe(false);
  });

  it("lehnt zu kurze Eingaben ab (12 Ziffern)", () => {
    expect(validateEan13("978316148410")).toBe(false);
  });

  it("lehnt zu lange Eingaben ab (14 Ziffern)", () => {
    expect(validateEan13("97831614841000")).toBe(false);
  });

  it("lehnt nicht-numerische Zeichen ab", () => {
    expect(validateEan13("97831614841X0")).toBe(false);
  });

  it("lehnt leeren String ab", () => {
    expect(validateEan13("")).toBe(false);
  });

  it("lehnt null/undefined defensiv ab", () => {
    expect(validateEan13(null as unknown as string)).toBe(false);
    expect(validateEan13(undefined as unknown as string)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateBarcodeSvg
// ---------------------------------------------------------------------------

describe("generateBarcodeSvg", () => {
  const EAN = "9783161484100";

  it("liefert ein valides SVG-Dokument", () => {
    const svg = generateBarcodeSvg(EAN);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("ist 100 % K-Only (nur #000000 und #FFFFFF)", () => {
    const svg = generateBarcodeSvg(EAN, { height: 80 });
    const colors = new Set(hexColors(svg));
    for (const c of colors) {
      expect(["#000000", "#FFFFFF"]).toContain(c);
    }
    expect(colors.has("#000000")).toBe(true);
  });

  it("kodiert die bekannte EAN-13 in das korrekte 95-Bit-Muster", () => {
    const svg = generateBarcodeSvg("4006381333931");
    const modules = eanModulesFromSvg(svg);
    // Start-Guard / Center-Guard / End-Guard
    expect(modules.slice(0, 3)).toBe("101");
    expect(modules.slice(45, 50)).toBe("01010");
    expect(modules.slice(92, 95)).toBe("101");
    // erste Ziffer 4 → Parität LGLLGG
    const L: Record<string, string> = {
      "0": "0001101", "1": "0011001", "2": "0010011", "3": "0111101", "4": "0100011",
      "5": "0110001", "6": "0101111", "7": "0111011", "8": "0110111", "9": "0001011",
    };
    expect(modules.slice(3, 10)).toBe(L["0"]); // Position 2 = Ziffer 0 (L-Code)
  });

  it("rendert die erwartete Anzahl schwarzer Balken", () => {
    const svg = generateBarcodeSvg(EAN);
    const bars = svg.match(/<rect x="[\d.]+" y="0"/g) ?? [];
    // Der weiße Hintergrund besitzt ebenfalls y="0"; daher ≥ 1.
    expect(bars.length).toBeGreaterThan(20);
    expect(bars.length).toBeLessThan(50);
  });

  it("respektiert die height-Option", () => {
    const svg = generateBarcodeSvg(EAN, { height: 120 });
    expect(svg).toMatch(/height="120"/);
  });

  it("klemmt unsinnige Höhen defensiv", () => {
    const low = generateBarcodeSvg(EAN, { height: -50 });
    expect(low).toMatch(/height="10"/);
    const high = generateBarcodeSvg(EAN, { height: 99999 });
    expect(high).toMatch(/height="200"/);
  });

  it("gibt bei ungültiger EAN ein Fallback-SVG statt eines Fehlers zurück", () => {
    const svg = generateBarcodeSvg("123");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("EAN-13");
  });

  it("zeigt den Preis an, wenn showPrice und price gesetzt sind", () => {
    const svg = generateBarcodeSvg(EAN, { showPrice: true, price: "9,99 EUR" });
    expect(svg).toContain("9,99 EUR");
  });

  it("zeigt keinen Preis ohne price-Angabe", () => {
    const withPrice = generateBarcodeSvg(EAN, { showPrice: true, price: "9,99 EUR" });
    const withoutPrice = generateBarcodeSvg(EAN, { showPrice: true });
    expect(withoutPrice.length).toBeLessThan(withPrice.length);
    expect(withoutPrice).not.toContain("9,99 EUR");
  });

  it("escaped XML-Sonderzeichen im Preis (keine SVG-Injection)", () => {
    const svg = generateBarcodeSvg(EAN, { showPrice: true, price: "<script>&\"" });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).toContain("&amp;");
  });

  it("enthält die menschenlesbare Ziffernfolge", () => {
    const svg = generateBarcodeSvg(EAN);
    expect(svg).toContain(EAN);
  });

  it("ist deterministisch (gleiche Eingabe ⇒ identisches SVG)", () => {
    const a = generateBarcodeSvg(EAN, { height: 70, showPrice: true, price: "12,00" });
    const b = generateBarcodeSvg(EAN, { height: 70, showPrice: true, price: "12,00" });
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// generateQrSvg
// ---------------------------------------------------------------------------

describe("generateQrSvg", () => {
  it("liefert ein valides SVG-Dokument", () => {
    const svg = generateQrSvg("https://example.com");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain("<path");
  });

  it("ist K-Only (nur #000000 und #FFFFFF)", () => {
    const svg = generateQrSvg("Hallo Welt");
    const colors = new Set(hexColors(svg));
    for (const c of colors) {
      expect(["#000000", "#FFFFFF"]).toContain(c);
    }
  });

  it("erzeugt die Standard-Modulzahl (Version 1 = 21×21) für kurze Daten", () => {
    const svg = generateQrSvg("A");
    expect(svg).toMatch(/width="168"/); // 21 Module × 8
    const matrix = qrMatrixFromSvg(svg);
    expect(matrix.length).toBe(21);
  });

  it("enthält das Finder-Muster in der oberen linken Ecke", () => {
    const matrix = qrMatrixFromSvg(generateQrSvg("A"));
    // 7×7-Finder: Rand dunkel, Kern 3×3 dunkel, Ring hell.
    expect(matrix[0][0]).toBe(true);
    expect(matrix[0][6]).toBe(true);
    expect(matrix[6][0]).toBe(true);
    expect(matrix[1][1]).toBe(false); // heller Ring
    expect(matrix[3][3]).toBe(true); // dunkler Kern
  });

  it("wächst mit der Datenmenge (größere Matrix)", () => {
    const small = generateQrSvg("A");
    const large = generateQrSvg("X".repeat(120));
    const smallCount = qrMatrixFromSvg(small).length;
    const largeCount = qrMatrixFromSvg(large).length;
    expect(largeCount).toBeGreaterThan(smallCount);
  });

  it("berücksichtigt das errorCorrection-Level", () => {
    const data = "Datenmenge die je nach ECC-Level unterschiedlich kodiert wird 1234567890";
    const low = generateQrSvg(data, { errorCorrection: "L" });
    const high = generateQrSvg(data, { errorCorrection: "H" });
    expect(low).not.toBe(high);
    // H benötigt mehr Redundanz → mindestens so groß wie L.
    expect(qrMatrixFromSvg(high).length).toBeGreaterThanOrEqual(qrMatrixFromSvg(low).length);
  });

  it("respektiert die size-Option", () => {
    const svg = generateQrSvg("Test", { size: 400 });
    expect(svg).toMatch(/width="400"/);
    expect(svg).toMatch(/height="400"/);
  });

  it("kodiert leere Daten als gültige Version 1", () => {
    const svg = generateQrSvg("");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(qrMatrixFromSvg(svg).length).toBe(21);
  });

  it("gibt bei zu langen Daten ein Fallback-SVG statt eines Fehlers zurück", () => {
    const svg = generateQrSvg("Z".repeat(1000));
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("nicht kodierbar");
  });

  it("ist deterministisch (gleiche Eingabe ⇒ identisches SVG)", () => {
    const a = generateQrSvg("Determinismus-Test 123", { errorCorrection: "Q", size: 300 });
    const b = generateQrSvg("Determinismus-Test 123", { errorCorrection: "Q", size: 300 });
    expect(a).toBe(b);
  });

  it("unterscheidet unterschiedliche Daten (keine Kollision)", () => {
    const a = generateQrSvg("Inhalt A");
    const b = generateQrSvg("Inhalt B");
    expect(a).not.toBe(b);
  });

  it("behandelt ungültige errorCorrection defensiv als 'M'", () => {
    const invalid = generateQrSvg("Test", {
      errorCorrection: "X" as unknown as "L" | "M" | "Q" | "H",
    });
    const medium = generateQrSvg("Test", { errorCorrection: "M" });
    expect(invalid).toBe(medium);
  });
});
