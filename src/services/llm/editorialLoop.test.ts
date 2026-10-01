// Tests für die autonome Lektoratsschleife (WP1.1).
//
// Kernaussage: Die Schleife liefert PATCHES, keine Volltext-Neuschreibung.
// Sie übernimmt nichts ins Manuskript — das entscheidet der Aufrufer.

import { describe, it, expect, vi } from "vitest";
import {
  runEditorialReview,
  buildEditorialPrompt,
  editorialToolInstructions,
  TOOL_PROPOSE_PATCHES,
} from "./editorialLoop";

const CHAPTER = [
  "Der Morgen graute über den Dächern.",
  "Anna trat an das Fenster und sah hinaus.",
  "Der Nebel lag tief über dem Fluss.",
].join("\n");

/** Antwort des Modells, wie ein Hermes-Modell sie liefern würde. */
function modelReply(patches: Array<{ search: string; replace: string; reason?: string }>, analysis = "Analyse.") {
  return (
    `<scratchpad>Ich prüfe Pacing und Stimmen.</scratchpad>${analysis}` +
    `<tool_call>${JSON.stringify({ name: TOOL_PROPOSE_PATCHES, arguments: { patches } })}</tool_call>`
  );
}

describe("runEditorialReview — Normalfall", () => {
  it("wendet einen gültigen Patch an", async () => {
    const complete = vi.fn(async () =>
      modelReply([{ search: "sah hinaus", replace: "blickte hinaus", reason: "schärfer" }]),
    );
    const r = await runEditorialReview("Kapitel 1", CHAPTER, complete);

    expect(r.applied).toBe(1);
    expect(r.revisedText).toContain("blickte hinaus");
    expect(r.revisedText).not.toContain("sah hinaus");
    expect(r.patches).toHaveLength(1);
    expect(r.patches[0].reason).toBe("schärfer");
    expect(r.rejected).toEqual([]);
  });

  it("trennt Analyse, Scratchpad und Patches", async () => {
    const complete = vi.fn(async () => modelReply([{ search: "Nebel", replace: "Dunst" }], "Das Pacing ist gut."));
    const r = await runEditorialReview("K", CHAPTER, complete);
    expect(r.analysis).toBe("Das Pacing ist gut.");
    expect(r.scratchpad).toContain("Pacing und Stimmen");
  });

  it("wendet mehrere Patches an", async () => {
    const complete = vi.fn(async () =>
      modelReply([
        { search: "Der Morgen graute", replace: "Der Tag brach an" },
        { search: "lag tief", replace: "hing tief" },
      ]),
    );
    const r = await runEditorialReview("K", CHAPTER, complete);
    expect(r.applied).toBe(2);
    expect(r.revisedText).toContain("Der Tag brach an");
    expect(r.revisedText).toContain("hing tief");
  });
});

describe("runEditorialReview — Schutzmechanismen", () => {
  it("lehnt einen mehrdeutigen Patch ab, wendet den eindeutigen an", async () => {
    const text = "Nebel.\nNebel.\nKlarer Satz.";
    const complete = vi.fn(async () =>
      modelReply([
        { search: "Nebel.", replace: "Dunst." },
        { search: "Klarer Satz.", replace: "Deutlicher Satz." },
      ]),
    );
    const r = await runEditorialReview("K", text, complete);
    expect(r.applied).toBe(1);
    expect(r.rejected).toHaveLength(1);
    expect(r.rejected[0].reason).toContain("2×");
  });

  it("lehnt eine leerende Ersetzung ab", async () => {
    const complete = vi.fn(async () => modelReply([{ search: "Der Morgen graute über den Dächern.", replace: "  " }]));
    const r = await runEditorialReview("K", CHAPTER, complete);
    expect(r.applied).toBe(0);
    expect(r.rejected.some((x) => x.reason.includes("leeren"))).toBe(true);
    expect(r.revisedText).toBe(CHAPTER);
  });

  it("lehnt eine unverhältnismäßig lange Ersetzung ab", async () => {
    const before = "Anna trat an das Fenster und sah hinaus. ".repeat(4);
    const complete = vi.fn(async () =>
      modelReply([{ search: before.trim(), replace: before + "Zusatz. ".repeat(60) }]),
    );
    const r = await runEditorialReview("K", before, complete);
    expect(r.applied).toBe(0);
    expect(r.rejected.some((x) => x.reason.includes("unverhältnismäßig"))).toBe(true);
  });

  it("begrenzt die Zahl der Patches", async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ search: `Satz ${i}`, replace: `Neu ${i}` }));
    const text = Array.from({ length: 30 }, (_, i) => `Satz ${i}`).join("\n");
    const complete = vi.fn(async () => modelReply(many));
    const r = await runEditorialReview("K", text, complete, { maxPatches: 5 });
    expect(r.patches).toHaveLength(5);
  });

  it("lehnt ein erfundenes Werkzeug ab", async () => {
    const complete = vi.fn(
      async () => '<tool_call>{"name":"delete_everything","arguments":{}}</tool_call>',
    );
    const r = await runEditorialReview("K", CHAPTER, complete);
    expect(r.applied).toBe(0);
    expect(r.revisedText).toBe(CHAPTER);
  });

  it("übernimmt nichts, wenn das Modell nur analysiert", async () => {
    const complete = vi.fn(async () => "Der Text ist stimmig. Keine Änderungen nötig.");
    const r = await runEditorialReview("K", CHAPTER, complete);
    expect(r.applied).toBe(0);
    expect(r.patches).toEqual([]);
    expect(r.revisedText).toBe(CHAPTER);
    expect(r.analysis).toContain("stimmig");
  });

  it("übernimmt nichts bei ungültigen Patch-Argumenten", async () => {
    // search fehlt → Schema-Verstoß. Der Reparaturversuch liefert wieder nichts.
    const complete = vi.fn(
      async () =>
        '<tool_call>{"name":"propose_patches","arguments":{"patches":[{"replace":"x"}]}}</tool_call>',
    );
    const r = await runEditorialReview("K", CHAPTER, complete);
    expect(r.applied).toBe(0);
    expect(r.revisedText).toBe(CHAPTER);
  });

  it("erlaubt ein leeres Patch-Ergebnis als legitimes Resultat", async () => {
    const complete = vi.fn(async () =>
      modelReply([]),
    );
    const r = await runEditorialReview("K", CHAPTER, complete);
    // Leeres patches-Array verletzt .min(1) → kein Patch, Text unverändert.
    expect(r.applied).toBe(0);
    expect(r.revisedText).toBe(CHAPTER);
  });
});

describe("runEditorialReview — Reparaturversuch", () => {
  it("repariert ungültige Argumente mit einem weiteren Aufruf", async () => {
    let call = 0;
    const complete = vi.fn(async () => {
      call++;
      if (call === 1) {
        // search ist leer → Schema-Verstoß.
        return '<tool_call>{"name":"propose_patches","arguments":{"patches":[{"search":"","replace":"x"}]}}</tool_call>';
      }
      // Reparatur liefert gültige Argumente.
      return `<tool_call>${JSON.stringify({
        name: TOOL_PROPOSE_PATCHES,
        arguments: { patches: [{ search: "sah hinaus", replace: "blickte hinaus" }] },
      })}</tool_call>`;
    });

    const r = await runEditorialReview("K", CHAPTER, complete);
    expect(complete).toHaveBeenCalledTimes(2);
    expect(r.applied).toBe(1);
    expect(r.revisedText).toContain("blickte hinaus");
    expect(r.attempts).toBe(2);
  });
});

describe("buildEditorialPrompt / Instruktionen", () => {
  it("nennt Titel und Text", () => {
    const p = buildEditorialPrompt("Kapitel 7", CHAPTER);
    expect(p).toContain("Kapitel 7");
    expect(p).toContain("Der Morgen graute");
    expect(p).toContain(TOOL_PROPOSE_PATCHES);
  });

  it("nimmt einen Schwerpunkt auf", () => {
    expect(buildEditorialPrompt("K", "Text", "pacing")).toContain("Schwerpunkt");
  });

  it("erklärt dem Modell das Werkzeugformat", () => {
    const s = editorialToolInstructions();
    expect(s).toContain("<tool_call>");
    expect(s).toContain("<scratchpad>");
    expect(s).toContain(TOOL_PROPOSE_PATCHES);
  });
});
