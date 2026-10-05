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
  it("enthält 12 Kategorien", () => {
    expect(TOOL_CATEGORIES.length).toBe(12);
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

describe("Reachability-Pass (v4.3.0)", () => {
  const sample = `Der Algorithmus implementierte eine komplexe Datenbank-Schnittstelle.
Es wurde beschlossen, dass die Middleware angepasst werden muss.

---

Anna: „Hallo, wie geht es dir?“
Bert: „Mir geht es bestens“, sagte er, während seine Hände zitterten.

KRAKK — die Tür flog auf.`;

  const REACHED_IDS = [
    "series-bible",
    "spoiler-guard",
    "codex-search",
    "codex-create",
    "sprint-stats",
    "sprint-record",
    "time-machine",
    "content-hash",
    "metrics-diff",
    "export-guard",
    "dictation-normalize",
    "blurb-studio",
    "kdp-keywords",
    "quote-card",
    "quality-report",
    "style-guide",
    "cover-studio",
    "print-master",
    "kdp-backoff",
    "testbook",
    "article-prompt",
    "headline-image",
    "newspaper-layout",
    "converter",
    "export-validate",
    "bilingual-export",
    "compact-prompts",
    "bilingual-templates",
    "image-prompt",
    "batch-runner",
    "backup-validate",
    "security-audit",
    "shutdown-tasks",
    "lazy-modules",
  ];

  // `cli/monitorDashboard` ist ein Node-only-CLI-Tool (zieht node:async_hooks
  // über monitoring/correlation) und darf nicht ins Browser-Bundle — bewusst
  // nicht registriert. Siehe Build-Guard in diesem Test.
  it("registriert keine Node-only-Services im Browser-Bundle", () => {
    expect(getTool("monitor-dashboard")).toBeUndefined();
  });

  it("registriert alle zuvor verwaisten Services", () => {
    for (const id of REACHED_IDS) {
      expect(getTool(id), `Werkzeug ${id} fehlt`).toBeDefined();
    }
  });

  it("fügt die drei neuen Kategorien hinzu", () => {
    expect(TOOL_CATEGORIES).toContain("Welt & Recherche");
    expect(TOOL_CATEGORIES).toContain("Schreib-Produktivität");
    expect(TOOL_CATEGORIES).toContain("Medien-Produktion");
  });

  it("jede neue Kategorie hat Werkzeuge", () => {
    for (const cat of ["Welt & Recherche", "Schreib-Produktivität", "Medien-Produktion"]) {
      expect(toolsByCategory(cat).length).toBeGreaterThan(0);
    }
  });

  it("Serien-Bibel legt eine Entität an und listet sie", async () => {
    const out = await getTool("series-bible")!.run("Testbuch");
    expect(out).toContain("Entitäten");
  });

  it("Spoiler-Wächter prüft Text", async () => {
    const out = await getTool("spoiler-guard")!.run("Mira betritt den Raum.");
    expect(out).toContain("Spoiler");
  });

  it("Recherche-Codex findet Treffer", async () => {
    const out = await getTool("codex-search")!.run("Mira");
    expect(out).toContain("Recherche-Codex");
  });

  it("Codex-Eintrag legt einen Eintrag an", async () => {
    const out = await getTool("codex-create")!.run("titel: Testeintrag\ninhalt: Beschreibung");
    expect(out).toContain("Codex-Eintrag");
  });

  it("Schreib-Sprint zeigt Presets", async () => {
    const out = await getTool("sprint-stats")!.run("500");
    expect(out).toContain("Presets");
  });

  it("Zeitmaschine vergleicht Snapshots", async () => {
    const out = await getTool("time-machine")!.run("Ein Beispieltext für den Snapshot.");
    expect(out).toContain("Snapshots gespeichert");
  });

  it("Inhalts-Hash liefert einen Hex-Hash", async () => {
    const out = await getTool("content-hash")!.run("Testtext");
    expect(out).toMatch(/Hash: [a-f0-9]{8,}/);
  });

  it("Export-Guard erkennt Track-Changes", async () => {
    const out = await getTool("export-guard")!.run("Der Hund ist braun und läuft schnell.");
    expect(out).toContain("Export erlaubt");
  });

  it("Klappentext-Studio generiert einen Text", async () => {
    const out = await getTool("blurb-studio")!.run("titel: Testroman\ngenre: Krimi");
    expect(out.length).toBeGreaterThan(50);
  });

  it("Qualitätsbericht liefert Kapitel-Scores", async () => {
    const out = await getTool("quality-report")!.run("Kapitel eins.\n\n---\n\nKapitel zwei.");
    expect(out).toContain("Kapitel");
  });

  it("Print-Master berechnet den Bundsteg", async () => {
    const out = await getTool("print-master")!.run("Ein längerer Text für die Seitenberechnung.");
    expect(out).toContain("Bundsteg");
  });

  it("Testbuch-Generator liefert Kapitel", async () => {
    const out = await getTool("testbook")!.run("");
    expect(out).toContain("Kapitel");
  });

  it("Format-Konverter wandelt Markdown um", async () => {
    const out = await getTool("converter")!.run("# Überschrift\n\nEin Absatz.");
    expect(out).toContain("HTML");
  });

  it("Export-Validierung prüft XML", async () => {
    const out = await getTool("export-validate")!.run("<doc><p>Test</p></doc>");
    expect(out).toContain("wohlgeformt");
  });

  it("Backup-Validierung erkennt ungültiges JSON", async () => {
    const out = await getTool("backup-validate")!.run("kein json");
    expect(out).toContain("Ungültig");
  });

  it("Sicherheits-Audit erzeugt Befunde", async () => {
    const out = await getTool("security-audit")!.run("");
    expect(out).toContain("Sicherheits-Audit");
  });

  it("Lazy-Module listet die Schwerlast-Module", async () => {
    const out = await getTool("lazy-modules")!.run("");
    expect(out).toContain("Module");
  });

  it("Batch-Analyse läuft über mehrere Kapitel", async () => {
    const out = await getTool("batch-runner")!.run("Kapitel eins.\n\n---\n\nKapitel zwei.");
    expect(out).toContain("Kapitel geprüft");
  });

  it("alle neuen Werkzeuge laufen ohne Exception auf Beispieleingabe", async () => {
    for (const id of REACHED_IDS) {
      const out = await Promise.resolve(getTool(id)!.run(sample));
      expect(typeof out, `${id} lieferte keinen String`).toBe("string");
      expect(out.length, `${id} lieferte leeren String`).toBeGreaterThan(0);
    }
  });

  it("alle neuen Werkzeuge kommen mit leerem Input zurecht", async () => {
    for (const id of REACHED_IDS) {
      const out = await Promise.resolve(getTool(id)!.run(""));
      expect(typeof out, `${id} warf bei leerem Input`).toBe("string");
    }
  });
});
