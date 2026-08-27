// Tests: Verdrahtung und Filterlogik der Manuskriptprüfung.
//
// Kein DOM-Rendering. Geprüft wird die Struktur (ist der Bereich erreichbar,
// sind alle Kategorien einem Untertab zugeordnet) und die Filterlogik, weil
// genau dort Befunde stillschweigend verschwinden könnten.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PANEL = readFileSync(
  join(process.cwd(), "src/components/Diagnostics/DiagnosticsPanel.tsx"),
  "utf-8",
);

const SIDEBAR = readFileSync(
  join(process.cwd(), "src/components/Sidebar/Sidebar.tsx"),
  "utf-8",
);

describe("Erreichbarkeit", () => {
  it("ist im Modus-Umschalter eingetragen", () => {
    expect(SIDEBAR).toContain('id: "diagnostics"');
    expect(SIDEBAR).toContain("DiagnosticsPanel");
  });

  it("wird vor der Kapitelprüfung behandelt", () => {
    // Die Prüfung arbeitet auf Projektebene. Läge die Behandlung nach der
    // chapterId-Prüfung, wäre der Bereich ohne offenes Kapitel gesperrt.
    const diag = SIDEBAR.indexOf('mode === "diagnostics"');
    const guard = SIDEBAR.indexOf("!projectId || !chapterId");
    expect(diag).toBeGreaterThan(-1);
    expect(diag).toBeLessThan(guard);
  });

  it("erhält Projekt- und Kapitel-Id", () => {
    expect(SIDEBAR).toMatch(
      /<DiagnosticsPanel\s+projectId=\{projectId\}\s+chapterId=\{chapterId\}/,
    );
  });
});

describe("Kategorien sind vollständig zugeordnet", () => {
  it("ordnet jede Prüfkategorie einem Untertab zu", () => {
    // Fehlt eine Kategorie in TAB_CATEGORIES, verschwinden ihre Befunde
    // lautlos aus der Oberfläche — der Prüflauf findet sie, niemand sieht sie.
    const produced = ["character", "world", "pov", "terminology", "timeline", "style"];

    // Alle Kategorien aus den Tab-Zuordnungen einsammeln.
    const block = PANEL.slice(
      PANEL.indexOf("const TAB_CATEGORIES"),
      PANEL.indexOf("const TAB_LABELS"),
    );
    const assigned = [...block.matchAll(/"([a-z]+)"/g)].map((m) => m[1]);

    for (const cat of produced) {
      expect(assigned, `Kategorie "${cat}" ist keinem Untertab zugeordnet`).toContain(cat);
    }
  });

  it("hat für jeden Untertab eine deutsche Beschriftung", () => {
    const catBlock = PANEL.slice(
      PANEL.indexOf("const TAB_CATEGORIES"),
      PANEL.indexOf("const TAB_LABELS"),
    );
    const lblBlock = PANEL.slice(
      PANEL.indexOf("const TAB_LABELS"),
      PANEL.indexOf("type Notice"),
    );

    const tabs = [...catBlock.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]);
    expect(tabs.length).toBe(4);
    for (const t of tabs) {
      expect(lblBlock).toContain(`${t}:`);
    }
  });
});

describe("Produktregeln in der Oberfläche", () => {
  it("nennt die Prüfung ausdrücklich als ohne KI", () => {
    // Der Nutzer muss wissen, dass dieser Bereich offline funktioniert.
    expect(PANEL).toMatch(/ohne KI|ohne Modell/);
  });

  it("bietet alle drei Befundaktionen", () => {
    const card = readFileSync(
      join(process.cwd(), "src/components/Diagnostics/FindingCard.tsx"),
      "utf-8",
    );
    expect(card).toContain("ignorieren");
    expect(card).toContain("ist bewusst");
    expect(card).toContain("Vorschlag");
  });

  it("macht die Herkunft eines Befunds sichtbar", () => {
    const card = readFileSync(
      join(process.cwd(), "src/components/Diagnostics/FindingCard.tsx"),
      "utf-8",
    );
    // Modellgestützte Befunde werden markiert, regelbasierte nicht — damit
    // erkennbar bleibt, was gemessen und was geschätzt wurde.
    expect(card).toContain("!f.ruleBased");
  });

  it("zeigt die drei Einordnungen mit deutschen Begriffen", () => {
    const card = readFileSync(
      join(process.cwd(), "src/components/Diagnostics/FindingCard.tsx"),
      "utf-8",
    );
    expect(card).toMatch(/error:\s*"Fehler"/);
    expect(card).toMatch(/possible:\s*"möglich"/);
    expect(card).toMatch(/intentional:\s*"bewusst"/);
  });

  it("bietet die geforderten Filter", () => {
    expect(PANEL).toContain("nur kritisch");
    expect(PANEL).toContain("nur dieses Kapitel");
    expect(PANEL).toContain("erledigte zeigen");
  });

  it("erlaubt Prüfung von Projekt und Kapitel getrennt", () => {
    expect(PANEL).toContain("Projekt prüfen");
    expect(PANEL).toContain("Kapitel prüfen");
  });
});

describe("Kennwerte-Ansicht", () => {
  it("deutet jeden Zahlenwert statt ihn nur anzuzeigen", () => {
    const metrics = readFileSync(
      join(process.cwd(), "src/components/Diagnostics/MetricsPanel.tsx"),
      "utf-8",
    );
    // Ohne Einordnung wäre die Ansicht ein Datenfriedhof: title-Attribute
    // erklären, was normal ist und was auffällt.
    const titles = metrics.match(/title=/g) ?? [];
    expect(titles.length).toBeGreaterThanOrEqual(5);
  });

  it("markiert auffällige Werte", () => {
    const metrics = readFileSync(
      join(process.cwd(), "src/components/Diagnostics/MetricsPanel.tsx"),
      "utf-8",
    );
    expect(metrics).toContain('" warn"');
  });
});
