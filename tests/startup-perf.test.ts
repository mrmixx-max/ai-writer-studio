// Startup-Performance-Guard (Sprint 11, Agent 4).
//
// Deterministischer Quell-Check ohne Build: Die App-Shell (src/App.tsx) darf
// die schweren, nicht-kritischen Module KIPanel und ExportBar NICHT synchron
// importieren — sie müssen per React.lazy() in eigene Chunks wandern, damit
// das Main-Bundle zur ersten Darstellung klein bleibt.
//
// Scheitert der Test, hat jemand den Lazy-Import wieder auf einen statischen
// Import zurückgedreht (Startup-Regression) — dann Chunk-Aufteilung prüfen.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const APP = readFileSync(join(process.cwd(), "src/App.tsx"), "utf-8");
const SIDEBAR = readFileSync(
  join(process.cwd(), "src/components/Sidebar/Sidebar.tsx"),
  "utf-8",
);

// Kommentarzeilen entfernen, damit Erwähnungen in Kommentaren (z. B. "lädt
// X bei Bedarf") keine False Positives bei der Sync-Import-Suche liefern.
function codeOnly(src: string): string {
  return src
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

const APP_CODE = codeOnly(APP);

// Schwere, nicht-kritische Shell-Module: Seitenpanel + Header-Dialog, beide
// erst nach der ersten Darstellung relevant.
const LAZY_MODULES = [
  { name: "KIPanel", path: "@/components/KIPanel/KIPanel" },
  { name: "ExportBar", path: "@/components/Export/ExportBar" },
] as const;

describe("Startup-Performance: App-Shell importiert Schwermodule nur lazy", () => {
  for (const mod of LAZY_MODULES) {
    it(`${mod.name} hat keinen synchronen Import in src/App.tsx`, () => {
      // Erwischt: import { KIPanel } from "...", import KIPanel from "...",
      // import "@/components/KIPanel/KIPanel" (Side-Effect-Import).
      const syncImport = new RegExp(
        `^\\s*import\\s+(?:[^"']*?from\\s+)?["']${mod.path.replace(/[/]/g, "[/]")}["']`,
        "m",
      );
      expect(
        APP_CODE,
        `${mod.name} wird synchron importiert — Startup-Regression (lazy() erwartet)`,
      ).not.toMatch(syncImport);
    });

    it(`${mod.name} ist per React.lazy() verdrahtet`, () => {
      expect(APP_CODE).toMatch(
        new RegExp(
          `${mod.name} = lazy\\(\\(\\) =>\\s*import\\(["']${mod.path.replace(/[/]/g, "[/]")}["']\\)`,
        ),
      );
    });
  }

  it("lazy Panels hängen unter einer Suspense-Grenze", () => {
    const suspenseCount = (APP_CODE.match(/<Suspense/g) ?? []).length;
    // Header-Export, KI-Panel + vorbestehende Dialog-/Panel-Grenzen.
    expect(suspenseCount).toBeGreaterThanOrEqual(4);
  });
});

describe("Startup-Performance: BookWriter/KDP-Panels bleiben lazy", () => {
  it("Sidebar lädt KdpChecklistPanel + BookWriterDashboardPanel lazy", () => {
    const sidebarCode = codeOnly(SIDEBAR);
    expect(sidebarCode).toMatch(
      /KdpChecklistPanel = lazy\(\(\) =>\s*import\("/,
    );
    expect(sidebarCode).toMatch(
      /BookWriterDashboardPanel = lazy\(\(\) =>\s*import\("/,
    );
  });
});

describe("Startup-Performance: dist-Größenwächter (mit Marge, nur bei Build-Artefakt)", () => {
  it("Main-Einstiegs-Chunks bleiben unter der Decke", () => {
    const assetsDir = join(process.cwd(), "dist", "assets");
    if (!existsSync(assetsDir)) return; // kein Build in CI → Quell-Guards oben tragen
    // Vitest-CI baut ohne dist; der Wächter greift nur, wenn ein frischer
    // `npx vite build` gelaufen ist (lokal / Release-Pipeline).
    const entries = readdirSync(assetsDir)
      .map((f) => ({ f, bytes: statSync(join(assetsDir, f)).size }))
      .filter(({ f }) => /\.js$/.test(f));
    expect(entries.length).toBeGreaterThan(0);
    // Decke: 1,5 MB je Einzel-Chunk — großzügige Marge über dem gemessenen
    // Stand (Sprint 11: größter Chunk ~434 KB), fängt nur echte Regressionen
    // (z. B. versehentlich synchron gebündeltes tiptap/JSZip im Main-Chunk).
    const CEILING_BYTES = 1_500_000;
    for (const { f, bytes } of entries) {
      expect(bytes, `${f} über der Chunk-Decke`).toBeLessThan(CEILING_BYTES);
    }
  });
});
