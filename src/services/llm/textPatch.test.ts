// Tests für den Text-Patch-Motor (WP1.1).
//
// Kernaussage: Ein Patch wird nur angewandt, wenn sein Suchtext GENAU EINMAL
// vorkommt. Bei mehreren Treffern wäre nicht entscheidbar, welche Stelle
// gemeint ist — ein falsch platziertes "verbessere" kann einen Absatz zerstören.

import { describe, it, expect } from "vitest";
import { canApply, applyPatches, renderDiff, sanityCheck } from "./textPatch";

const TEXT = [
  "Der Morgen graute über den Dächern.",
  "Anna trat an das Fenster und sah hinaus.",
  "Der Nebel lag tief über dem Fluss.",
].join("\n");

describe("canApply", () => {
  it("erlaubt einen eindeutigen Suchtext", () => {
    expect(canApply(TEXT, { search: "Anna trat an das Fenster", replace: "x" })).toEqual({ ok: true });
  });

  it("lehnt einen nicht gefundenen Suchtext ab", () => {
    const r = canApply(TEXT, { search: "kommt nicht vor", replace: "x" });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("nicht gefunden");
  });

  it("lehnt einen mehrdeutigen Suchtext ab", () => {
    const text = "Der Nebel lag tief.\nDer Nebel lag tief.";
    const r = canApply(text, { search: "Der Nebel lag tief.", replace: "x" });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("2×");
  });

  it("lehnt leeren Suchtext ab", () => {
    expect(canApply(TEXT, { search: "   ", replace: "x" }).ok).toBe(false);
  });

  it("ignoriert Zeilenenden-Unterschiede (CRLF)", () => {
    const crlf = TEXT.replace(/\n/g, "\r\n");
    expect(canApply(crlf, { search: "Anna trat an das Fenster", replace: "x" }).ok).toBe(true);
  });
});

describe("applyPatches", () => {
  it("ersetzt einen eindeutigen Ausschnitt", () => {
    const r = applyPatches(TEXT, [
      { search: "sah hinaus", replace: "blickte hinaus" },
    ]);
    expect(r.applied).toBe(1);
    expect(r.text).toContain("blickte hinaus");
    expect(r.text).not.toContain("sah hinaus");
    expect(r.rejected).toEqual([]);
  });

  it("wendet mehrere Patches nacheinander an", () => {
    const r = applyPatches(TEXT, [
      { search: "Der Morgen graute", replace: "Der Tag brach an" },
      { search: "lag tief", replace: "hing tief" },
    ]);
    expect(r.applied).toBe(2);
    expect(r.text).toContain("Der Tag brach an");
    expect(r.text).toContain("hing tief");
  });

  it("lehnt einen mehrdeutigen Patch ab und wendet den Rest an", () => {
    const text = "Nebel.\nNebel.\nKlarer Satz.";
    const r = applyPatches(text, [
      { search: "Nebel.", replace: "Dunst." },
      { search: "Klarer Satz.", replace: "Deutlicher Satz." },
    ]);
    expect(r.applied).toBe(1);
    expect(r.rejected).toHaveLength(1);
    expect(r.text).toContain("Deutlicher Satz.");
    // Die mehrdeutige Stelle bleibt unangetastet.
    expect(r.text.match(/Nebel\./g)).toHaveLength(2);
  });

  it("prüft jeden Patch gegen den AKTUELLEN Stand", () => {
    // Patch 2 sucht Text, der erst durch Patch 1 entsteht.
    const r = applyPatches("A", [
      { search: "A", replace: "B" },
      { search: "B", replace: "C" },
    ]);
    expect(r.applied).toBe(2);
    expect(r.text).toBe("C");
  });

  it("protokolliert den Ablehnungsgrund", () => {
    const r = applyPatches(TEXT, [{ search: "fehlt", replace: "x" }]);
    expect(r.rejected[0].reason).toContain("nicht gefunden");
    expect(r.rejected[0].patch.search).toBe("fehlt");
  });

  it("löscht einen Ausschnitt bei leerem replace", () => {
    const r = applyPatches(TEXT, [{ search: "Der Nebel lag tief über dem Fluss.\n", replace: "" }]);
    expect(r.applied).toBe(1);
    expect(r.text).not.toContain("Nebel");
  });

  it("verändert den Text nicht, wenn kein Patch anwendbar ist", () => {
    const r = applyPatches(TEXT, [{ search: "fehlt", replace: "x" }]);
    expect(r.text).toBe(TEXT);
    expect(r.applied).toBe(0);
  });

  it("liefert den Text unverändert bei leerer Patch-Liste", () => {
    expect(applyPatches(TEXT, []).text).toBe(TEXT);
  });
});

describe("renderDiff", () => {
  it("zeigt geänderte Zeilen mit - und +", () => {
    const after = TEXT.replace("sah hinaus", "blickte hinaus");
    const d = renderDiff(TEXT, after);
    expect(d).toContain("-Anna trat an das Fenster und sah hinaus.");
    expect(d).toContain("+Anna trat an das Fenster und blickte hinaus.");
  });

  it("zeigt unveränderte Nachbarzeilen als Kontext", () => {
    const after = TEXT.replace("sah hinaus", "blickte hinaus");
    const d = renderDiff(TEXT, after, 1);
    expect(d).toContain(" Der Morgen graute");
    expect(d).toContain(" Der Nebel lag tief");
  });

  it("liefert leeren Diff bei gleichem Text", () => {
    expect(renderDiff(TEXT, TEXT)).toBe("");
  });
});

describe("sanityCheck", () => {
  it("akzeptiert eine normale Verbesserung", () => {
    expect(sanityCheck("Ein kurzer Satz.", "Ein etwas besserer Satz.")).toBeNull();
  });

  it("lehnt eine leerende Ersetzung ab", () => {
    expect(sanityCheck("Ein Absatz mit Inhalt.", "   ")).toContain("leeren");
  });

  it("lehnt eine unverhältnismäßig lange Ersetzung ab", () => {
    // Der häufigste Modellfehler: eine "Verbesserung", die den Absatz aufbläht.
    const before = "Anna ging zum Fenster und sah hinaus. ".repeat(4);
    const after = before + "Zusätzlicher Text. ".repeat(50);
    expect(sanityCheck(before, after)).toContain("unverhältnismäßig");
  });

  it("erlaubt eine lange Ersetzung bei kurzem Original", () => {
    // Bei kurzen Ausschnitten ist Aufblähen legitim (z. B. "vertiefen").
    expect(sanityCheck("Kurz.", "Ein deutlich längerer neuer Absatz mit Inhalt.")).toBeNull();
  });
});
