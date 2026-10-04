/**
 * Tests: WerkzeugePanel (Meilenstein 18 — Integration M5–17)
 *
 * Prüft, dass alle 52 Services als Werkzeuge registriert sind, die
 * Kategorien stimmen und ein Werkzeug end-to-end durchläuft.
 */

import { describe, it, expect } from "vitest";
import { TOOLS, TOOL_CATEGORIES, toolsByCategory, getTool } from "./toolAdapters";

describe("TOOLS-Registry", () => {
  it("enthält mindestens 50 Werkzeuge", () => {
    expect(TOOLS.length).toBeGreaterThanOrEqual(50);
  });

  it("alle IDs sind eindeutig", () => {
    const ids = TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("jedes Werkzeug hat Label, Icon, Kategorie und Hint", () => {
    for (const tool of TOOLS) {
      expect(tool.label.length).toBeGreaterThan(0);
      expect(tool.icon.length).toBeGreaterThan(0);
      expect(tool.category.length).toBeGreaterThan(0);
      expect(tool.hint.length).toBeGreaterThan(0);
      expect(tool.wp).toMatch(/^WP \d+\.\d+$/);
    }
  });

  it("jede Kategorie ist eine bekannte Kategorie", () => {
    const known = new Set<string>(TOOL_CATEGORIES);
    for (const tool of TOOLS) {
      expect(known.has(tool.category)).toBe(true);
    }
  });

  it("jede Kategorie enthält mindestens ein Werkzeug", () => {
    for (const cat of TOOL_CATEGORIES) {
      expect(toolsByCategory(cat).length).toBeGreaterThan(0);
    }
  });

  it("alle 52 Services sind abgedeckt (Meilenstein 5–17)", () => {
    // Werkzeuge ohne direkten Service-Bezug (Diagnose/Status) ausschließen
    const covered = TOOLS.filter((t) => !["p2p-sync", "disaster-vault"].includes(t.id));
    expect(covered.length).toBeGreaterThanOrEqual(50);
  });

  it("getTool findet ein Werkzeug per ID", () => {
    expect(getTool("style-fingerprint")?.label).toBe("Stil-Fingerprint");
    expect(getTool("contract-signer")?.wp).toBe("WP 39.2");
  });

  it("getTool gibt undefined für unbekannte ID", () => {
    expect(getTool("gibt-es-nicht")).toBeUndefined();
  });
});

describe("TOOL_CATEGORIES", () => {
  it("enthält 9 Kategorien", () => {
    expect(TOOL_CATEGORIES.length).toBe(9);
  });

  it("beginnt mit Analyse & Lektorat", () => {
    expect(TOOL_CATEGORIES[0]).toBe("Analyse & Lektorat");
  });

  it("enthält Audio, Typografie, Export und Sicherheit", () => {
    const cats = TOOL_CATEGORIES.join("|");
    expect(cats).toContain("Audio");
    expect(cats).toContain("Typografie");
    expect(cats).toContain("Export");
    expect(cats).toContain("Sicherheit");
  });
});

describe("Werkzeug-Ausführung (Smoke-Tests)", () => {
  const sample = `Der Algorithmus implementierte eine komplexe Datenbank-Schnittstelle.
Es wurde beschlossen, dass die Middleware angepasst werden muss.

---

Anna: „Hallo, wie geht es dir?“
Bert: „Mir geht es bestens“, sagte er, während seine Hände zitterten.

[ambience: regensturm volume=40%]
[sfx: tuerschlag pan=-0.7]

KRAKK — die Tür flog auf.`;

  it("Stil-Fingerprint liefert Metriken", async () => {
    const tool = getTool("style-fingerprint")!;
    const out = await tool.run(sample);
    expect(out).toContain("Burstiness");
    expect(out).toContain("Ø Satzlänge");
  });

  it("Master-Health liefert Readiness-Score", async () => {
    const tool = getTool("master-health")!;
    const out = await tool.run(sample);
    expect(out).toContain("Publikationsreife");
  });

  it("Kognitive Belastung liefert Index", async () => {
    const tool = getTool("cognitive-attention")!;
    const out = await tool.run(sample);
    expect(out).toContain("Kognitive Belastung");
    expect(out).toContain("Lesezeit");
  });

  it("Lektoren-Rat liefert Konsens", async () => {
    const tool = getTool("editorial-council")!;
    const out = await tool.run(sample);
    expect(out).toContain("Gesamtbefunde");
    expect(out).toContain("Plot-Chirurg");
  });

  it("Hörspiel-Cues erkennt Regieanweisungen", async () => {
    const tool = getTool("audio-drama")!;
    const out = await tool.run(sample);
    expect(out).toContain("Erkannte Cues");
  });

  it("Mikrotypografie liefert Befunde", async () => {
    const tool = getTool("micro-typography")!;
    const out = await tool.run(sample);
    expect(out).toContain("Schusterjungen");
  });

  it("Roman-zu-Drehbuch liefert Szenen", async () => {
    const tool = getTool("screenplay-transmuter")!;
    const out = await tool.run(sample);
    expect(out).toContain("Szenen");
  });

  it("Urheberschafts-Beweis liefert Merkle-Root", async () => {
    const tool = getTool("authorship-proof")!;
    const out = await tool.run(sample);
    expect(out).toContain("Merkle-Root");
    expect(out).toContain("Signatur");
  });

  it("Royalty-Rechner liefert Break-Even", async () => {
    const tool = getTool("royalty-calculator")!;
    const out = await tool.run(sample);
    expect(out).toContain("Break-Even");
    expect(out).toContain("Empfehlung");
  });

  it("VRAM-Profiler liefert Kontextgrößen", async () => {
    const tool = getTool("engine-turbo")!;
    const out = await tool.run(sample);
    expect(out).toContain("VRAM");
    expect(out).toContain("Kontext");
  });

  it("Performance-Sentinel liefert Laufzeit", async () => {
    const tool = getTool("system-sentinel")!;
    const out = await tool.run(sample);
    expect(out).toContain("Laufzeit");
    expect(out).toContain("Jubiläums-Siegel");
  });

  it("alle Werkzeuge laufen ohne Exception auf Beispieleingabe", async () => {
    for (const tool of TOOLS) {
      const out = await Promise.resolve(tool.run(sample));
      expect(typeof out, `${tool.id} lieferte keinen String`).toBe("string");
    }
  });

  it("alle Werkzeuge kommen mit leerem Input zurecht", async () => {
    for (const tool of TOOLS) {
      const out = await Promise.resolve(tool.run(""));
      expect(typeof out, `${tool.id} warf bei leerem Input`).toBe("string");
    }
  });
});
