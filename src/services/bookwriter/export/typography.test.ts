// Unit-Tests: Typografie-Normalisierung (C2).
import { describe, it, expect } from "vitest";
import { normalizeTypography } from "./typography";

describe("normalizeTypography", () => {
  it("wandelt gerade in deutsche Anführungszeichen", () => {
    expect(normalizeTypography('Er sagte "Hallo" und ging.')).toBe(
      "Er sagte „Hallo“ und ging.",
    );
  });

  it("wandelt ' - ' in einen Gedankenstrich", () => {
    expect(normalizeTypography("Das Haus - alt und grau - steht noch.")).toBe(
      "Das Haus – alt und grau – steht noch.",
    );
  });

  it("fasst doppelte Leerzeichen zusammen", () => {
    expect(normalizeTypography("Zu   viele    Leerzeichen")).toBe(
      "Zu viele Leerzeichen",
    );
  });

  it("entfernt Leerzeichen vor Satzzeichen", () => {
    expect(normalizeTypography("Hallo , Welt .")).toBe("Hallo, Welt.");
  });

  it("kombiniert alle Regeln", () => {
    const raw = 'Ein "Test" - mit  Fehlern , die verschwinden.';
    expect(normalizeTypography(raw)).toBe("Ein „Test“ – mit Fehlern, die verschwinden.");
  });

  it("belässt bereits typografische Zeichen unverändert", () => {
    const fine = "„Schon gut“ – sagte er — und ging.";
    expect(normalizeTypography(fine)).toBe(fine);
  });

  it("normalisiert Zeilenumbrüche (CRLF)", () => {
    expect(normalizeTypography("Zeile 1\r\nZeile  2")).toBe("Zeile 1\nZeile 2");
  });
});