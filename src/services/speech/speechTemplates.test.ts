// Tests: Redetext-Vorlagen (politische Musterreden).
import { describe, expect, it } from "vitest";
import {
  SPEECH_TEMPLATES,
  listSpeechTemplates,
  getSpeechTemplate,
  renderSpeechTemplate,
} from "./speechTemplates";

describe("speechTemplates", () => {
  it("enthält 8 politische + 8 private + 8 geschäftliche Vorlagen mit Pflichtfeldern", () => {
    expect(SPEECH_TEMPLATES.length).toBe(24);
    const byKat = (k: string) => SPEECH_TEMPLATES.filter((t) => t.kategorie === k);
    expect(byKat("politik")).toHaveLength(8);
    expect(byKat("privat")).toHaveLength(8);
    expect(byKat("geschaeftlich")).toHaveLength(8);
    for (const t of SPEECH_TEMPLATES) {
      expect(t.id).toMatch(/^[a-z0-9-]+$/);
      expect(t.titel.length).toBeGreaterThan(0);
      expect(t.anlass.length).toBeGreaterThan(0);
      expect(t.minuten).toBeGreaterThan(0);
      expect(t.text.length).toBeGreaterThan(200);
    }
  });

  it("alle Platzhalter im Text sind deklariert", () => {
    for (const t of SPEECH_TEMPLATES) {
      const used = new Set(
        [...t.text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]),
      );
      for (const key of used) {
        expect(
          t.platzhalter,
          `${t.id}: {{${key}}} nicht deklariert`,
        ).toContain(key);
      }
    }
  });

  it("listSpeechTemplates liefert Kurzform ohne Text", () => {
    const list = listSpeechTemplates();
    expect(list.length).toBe(SPEECH_TEMPLATES.length);
    expect(list[0]).toHaveProperty("id");
    expect(list[0]).toHaveProperty("titel");
    expect(list[0]).not.toHaveProperty("text");
  });

  it("listSpeechTemplatesByKategorie filtert korrekt", async () => {
    const { listSpeechTemplatesByKategorie } = await import("./speechTemplates");
    expect(listSpeechTemplatesByKategorie("privat")).toHaveLength(8);
    expect(listSpeechTemplatesByKategorie("geschaeftlich")).toHaveLength(8);
    expect(listSpeechTemplatesByKategorie("politik")).toHaveLength(8);
    expect(listSpeechTemplatesByKategorie("privat").every((t) => t.kategorie === "privat")).toBe(true);
  });

  it("getSpeechTemplate findet per ID, unbekannt → undefined", () => {
    expect(getSpeechTemplate("wahlkampf-auftakt")?.titel).toContain("Wahlkampf");
    expect(getSpeechTemplate("gibt-es-nicht")).toBeUndefined();
  });

  it("renderSpeechTemplate ersetzt bekannte, behält unbekannte", () => {
    const out = renderSpeechTemplate("Hallo {{Name}}, willkommen in {{Ort}}!", {
      Name: "Anna",
    });
    expect(out).toBe("Hallo Anna, willkommen in {{Ort}}!");
  });
});
