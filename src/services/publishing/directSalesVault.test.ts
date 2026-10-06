/**
 * Tests: DirectSalesVault (WP 75.2)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createWatermark,
  createLicenseCertificate,
  createProduct,
  verifyWatermark,
  verifyLicense,
  generateExLibrisFrontispiz,
  formatProduct,
  createSampleProduct,
} from "./directSalesVault";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    expect(r1()).toBe(r2());
  });
});

describe("createWatermark", () => {
  it("erstellt Wasserzeichen", () => {
    const wm = createWatermark("Erik", "TXN-001");
    expect(wm.ownerName).toBe("Erik");
    expect(wm.transactionId).toBe("TXN-001");
    expect(wm.signature).toContain("AIWS-");
  });

  it("ist deterministisch", () => {
    const w1 = createWatermark("Erik", "TXN-001");
    const w2 = createWatermark("Erik", "TXN-001");
    expect(w1).toEqual(w2);
  });

  it("ist unterschiedlich für verschiedene Transaktionen", () => {
    const w1 = createWatermark("Erik", "TXN-001");
    const w2 = createWatermark("Erik", "TXN-002");
    expect(w1.signature).not.toBe(w2.signature);
  });
});

describe("createLicenseCertificate", () => {
  it("erstellt Zertifikat", () => {
    const lic = createLicenseCertificate("Titel", "Erik", "Standard");
    expect(lic.title).toBe("Titel");
    expect(lic.owner).toBe("Erik");
    expect(lic.edition).toBe("Standard");
    expect(lic.authenticityHash).toContain("AIWS-");
  });

  it("ist deterministisch", () => {
    const l1 = createLicenseCertificate("Titel", "Erik", "Standard");
    const l2 = createLicenseCertificate("Titel", "Erik", "Standard");
    expect(l1).toEqual(l2);
  });
});

describe("createProduct", () => {
  it("erstellt Produkt", () => {
    const product = createProduct("Titel", "epub", 9.99, "Erik", "TXN-001");
    expect(product.title).toBe("Titel");
    expect(product.format).toBe("epub");
    expect(product.price).toBe(9.99);
  });

  it("hat Wasserzeichen", () => {
    const product = createProduct("Titel", "epub", 9.99, "Erik", "TXN-001");
    expect(product.watermark).toBeTruthy();
  });

  it("hat Lizenz", () => {
    const product = createProduct("Titel", "epub", 9.99, "Erik", "TXN-001");
    expect(product.license).toBeTruthy();
  });
});

describe("verifyWatermark", () => {
  it("verifiziert gültiges Wasserzeichen", () => {
    const wm = createWatermark("Erik", "TXN-001");
    expect(verifyWatermark(wm)).toBe(true);
  });

  it("erkennt ungültiges Wasserzeichen", () => {
    const wm = createWatermark("Erik", "TXN-001");
    wm.signature = "AIWS-INVALID";
    expect(verifyWatermark(wm)).toBe(false);
  });
});

describe("verifyLicense", () => {
  it("verifiziert gültige Lizenz", () => {
    const lic = createLicenseCertificate("Titel", "Erik", "Standard");
    expect(verifyLicense(lic)).toBe(true);
  });

  it("erkennt ungültige Lizenz", () => {
    const lic = createLicenseCertificate("Titel", "Erik", "Standard");
    lic.authenticityHash = "AIWS-INVALID";
    expect(verifyLicense(lic)).toBe(false);
  });
});

describe("generateExLibrisFrontispiz", () => {
  it("generiert SVG", () => {
    const svg = generateExLibrisFrontispiz("Erik");
    expect(svg).toContain("<svg");
    expect(svg).toContain("Erik");
  });

  it("escaped HTML-Sonderzeichen", () => {
    const svg = generateExLibrisFrontispiz("<script>");
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).not.toContain("<script>");
  });
});

describe("formatProduct", () => {
  it("formatiert Produkt als Text", () => {
    const product = createSampleProduct();
    const text = formatProduct(product);
    expect(text).toContain("DIREKTVERTRIEB-PRODUKT");
    expect(text).toContain("WASSERZEICHEN");
    expect(text).toContain("LIZENZ");
  });
});

describe("createSampleProduct", () => {
  it("erstellt Beispiel-Produkt", () => {
    const product = createSampleProduct();
    expect(product.title).toBeTruthy();
    expect(product.watermark).toBeTruthy();
    expect(product.license).toBeTruthy();
  });

  it("hat gültiges Wasserzeichen", () => {
    const product = createSampleProduct();
    expect(verifyWatermark(product.watermark)).toBe(true);
  });

  it("hat gültige Lizenz", () => {
    const product = createSampleProduct();
    expect(verifyLicense(product.license)).toBe(true);
  });
});
