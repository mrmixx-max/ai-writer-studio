// Tests: Sidebar-Navigation.
//
// Anlass: Der Modus-Switcher war nur in dem Zweig gerendert, den man erst NACH
// einem Moduswechsel erreicht. Dadurch waren alle acht Spezialbereiche
// (Projektwissen, Fragmente, Stimmen, Karte, Dialog, Versionen, Obstruktion,
// Traumlogik) unerreichbar — bei grüner Typprüfung und grünen Tests.
//
// Diese Tests prüfen die Navigationsstruktur, damit derselbe Fehler nicht
// unbemerkt zurückkommt. Kein DOM-Rendering: geprüft wird die Quelldatei,
// weil genau die Struktur das Problem war, nicht das Verhalten einer Funktion.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SIDEBAR = readFileSync(
  join(process.cwd(), "src/components/Sidebar/Sidebar.tsx"),
  "utf-8",
);

const MODE_TYPES = readFileSync(
  join(process.cwd(), "src/types/mode.ts"),
  "utf-8",
);

describe("Modus-Switcher ist erreichbar", () => {
  it("wird als gemeinsame Variable definiert, nicht je Zweig kopiert", () => {
    // Eine einzige Definition verhindert, dass Zweige auseinanderlaufen.
    const defs = SIDEBAR.match(/const switcher =/g) ?? [];
    expect(defs.length).toBe(1);
  });

  it("erscheint in jedem der drei Rückgabezweige", () => {
    // Jeder return-Zweig der Sidebar muss {switcher} enthalten, sonst ist der
    // Bereich, in dem man gerade steckt, eine Falle ohne Ausweg.
    const uses = SIDEBAR.match(/\{switcher\}/g) ?? [];
    expect(uses.length).toBe(3);
  });

  it("enthält jeden Modus aus dem Typ genau einmal in MODES", () => {
    // Verhindert, dass ein neuer Modus im Typ landet, aber nicht im Switcher —
    // dann wäre er wieder unerreichbar.
    const typeModes = [...MODE_TYPES.matchAll(/\|\s*"([a-z]+)"/g)].map((m) => m[1]);
    expect(typeModes.length).toBeGreaterThanOrEqual(10);

    for (const mode of typeModes) {
      const entries = SIDEBAR.match(new RegExp(`id:\\s*"${mode}"`, "g")) ?? [];
      expect(entries.length, `Modus "${mode}" fehlt in MODES`).toBe(1);
    }
  });

  it("führt knowledge im Modus-Typ", () => {
    expect(MODE_TYPES).toContain('"knowledge"');
  });
});

describe("Projektwissen braucht kein offenes Kapitel", () => {
  it("wird vor der Kapitelprüfung behandelt", () => {
    // Projektwissen arbeitet auf Projektebene. Läge die Behandlung nach der
    // Prüfung auf chapterId, wäre der Bereich bei leerem Projekt gesperrt —
    // also genau dann, wenn man ihn zum Aufbau am nötigsten braucht.
    const knowledgeCheck = SIDEBAR.indexOf('mode === "knowledge"');
    const chapterGuard = SIDEBAR.indexOf("!projectId || !chapterId");

    expect(knowledgeCheck).toBeGreaterThan(-1);
    expect(chapterGuard).toBeGreaterThan(-1);
    expect(knowledgeCheck).toBeLessThan(chapterGuard);
  });

  it("übergibt projectId an das Panel", () => {
    expect(SIDEBAR).toMatch(/<KnowledgePanel\s+projectId=\{projectId\}/);
  });
});

describe("Sidebar-Breite", () => {
  it("verbreitert sich in den textlastigen Modi", () => {
    // 320 px sind für Fließtext (Suchtreffer, KI-Antworten, Befundlisten)
    // unlesbar. Projektwissen, Manuskriptprüfung, Exportprüfung und Snapshots
    // brauchen mehr Platz.
    expect(SIDEBAR).toContain('" wide"');
    expect(SIDEBAR).toMatch(/mode === "knowledge"[\s\S]{0,80}" wide"/);
    expect(SIDEBAR).toMatch(/mode === "diagnostics"[\s\S]{0,80}" wide"/);
    expect(SIDEBAR).toMatch(/mode === "preflight"[\s\S]{0,80}" wide"/);
    expect(SIDEBAR).toMatch(/mode === "snapshots"[\s\S]{0,80}" wide"/);
  });

  it("hat die wide-Klasse im Stylesheet", () => {
    const css = readFileSync(
      join(process.cwd(), "src/components/Sidebar/sidebar.css"),
      "utf-8",
    );
    expect(css).toContain(".sidebar.wide");
    expect(css).toMatch(/\.sidebar\.wide\s*\{[^}]*width:\s*4\d\dpx/);
  });
});
