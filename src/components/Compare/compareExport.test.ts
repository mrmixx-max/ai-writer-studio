// Test: Vergleichs-Export erzeugt ein valides PDF mit Markup.
import { describe, it, expect } from "vitest";
import { buildComparePdf } from "./compareExport";
import { PDFDocument } from "pdf-lib";

describe("buildComparePdf", () => {
  it("erzeugt ein ladbares PDF mit einer Seite pro Header+Inhalt", async () => {
    const bytes = await buildComparePdf(
      "Entwurf 1",
      "Entwurf 2",
      "Der alte Mann stand am Fenster.\nEs regnete.",
      "Der junge Mann stand am Fenster und wartete.\nEs schneite.",
      "Kapitel 1: Ankunft",
    );
    expect(bytes.length).toBeGreaterThan(500);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("funktioniert auch bei langen Texten (mehraseitig, kein Absturz)", async () => {
    const a = Array.from({ length: 300 }, (_, i) => `Zeile ${i} mit etwas Inhalt für den Vergleich`).join("\n");
    const b = Array.from({ length: 320 }, (_, i) => `Zeile ${i} mit geändertem Inhalt für den Vergleich ${i}`).join("\n");
    const bytes = await buildComparePdf("A", "B", a, b, "Langes Kapitel");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });
});
