// Worldbuilding-Export: World-Bible + Orte + Lore als Markdown/JSON, Karten-Export als SVG.
import type { WorldBible } from "./worldbible";
import type { Location } from "./locations";
import type { LoreEntry } from "./lore";
import type { ConsistencyReport } from "./consistency";
import { reportToMarkdown } from "./consistency";

export interface WorldbuildingBundle {
  project: { id: string; exportedAt: string };
  bible: WorldBible | null;
  locations: Location[];
  lore: LoreEntry[];
}

export function buildWorldbuildingBundle(
  projectId: string, bible: WorldBible | null,
  locations: Location[], lore: LoreEntry[],
): WorldbuildingBundle {
  return {
    project: { id: projectId, exportedAt: new Date().toISOString() },
    bible, locations, lore,
  };
}

export function worldbuildingToJson(bundle: WorldbuildingBundle): string {
  return JSON.stringify(bundle, null, 2);
}

export function worldbuildingToMarkdown(bundle: WorldbuildingBundle): string {
  const lines: string[] = ["# Welt-Bible", ""];
  const b = bundle.bible;
  if (b) {
    if (b.name) lines.push(`**Weltname:** ${b.name}`, "");
    if (b.premise) lines.push("## Prämisse", "", b.premise, "");
    if (b.rules.length) {
      lines.push("## Regeln", "");
      for (const r of b.rules) lines.push(`- **${r.category}:** ${r.text}`);
      lines.push("");
    }
    if (b.history.length) {
      lines.push("## Geschichte", "");
      for (const e of [...b.history].sort((a, c) => a.year.localeCompare(c.year))) {
        lines.push(`- **${e.year} — ${e.title}**${e.description ? `: ${e.description}` : ""}`);
      }
      lines.push("");
    }
    if (b.notes) lines.push("## Notizen", "", b.notes, "");
  }

  if (bundle.locations.length) {
    lines.push("## Orte", "");
    for (const l of bundle.locations) {
      lines.push(`### ${l.name}${l.type ? ` (${l.type})` : ""}`);
      if (l.description) lines.push(l.description);
      lines.push(`- Koordinaten: ${Math.round(l.x)}, ${Math.round(l.y)}`);
      if (l.notes) lines.push(`- Notizen: ${l.notes}`);
      lines.push("");
    }
  }

  if (bundle.lore.length) {
    lines.push("## Glossar & Lore", "");
    const byCat = new Map<string, LoreEntry[]>();
    for (const e of bundle.lore) {
      if (!byCat.has(e.category)) byCat.set(e.category, []);
      byCat.get(e.category)!.push(e);
    }
    for (const [cat, entries] of byCat) {
      lines.push(`### ${cat}`, "");
      for (const e of entries) {
        lines.push(`- **${e.name}**${e.aliases.length ? ` *(auch: ${e.aliases.join(", ")})*` : ""}${e.description ? ` — ${e.description}` : ""}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

export interface MapExportOptions {
  width?: number;
  height?: number;
  title?: string;
  background?: string;
}

/**
 * Exportiert Orte als SVG-Karte (SVG-Ebenen-Diagramm mit Positionen und Labels).
 * Koordinaten: x/y in 0..1000 Welt-Koordinaten, skaliert auf width/height.
 */
export function locationsToSvg(
  locations: Location[], opts: MapExportOptions = {},
): string {
  const width = opts.width ?? 1000;
  const height = opts.height ?? 700;
  const title = opts.title ?? "Karte";
  const bg = opts.background ?? "#1a2332";
  const typeColors: Record<string, string> = {
    Stadt: "#f59e0b", Dorf: "#84cc16", Landschaft: "#22c55e",
    Gebäude: "#60a5fa", Ruine: "#a78bfa", Sonstiges: "#94a3b8",
  };
  const dots = locations.map((l) => {
    const cx = Math.max(0, Math.min(width, (l.x / 1000) * width));
    const cy = Math.max(0, Math.min(height - 30, (l.y / 1000) * (height - 60)) + 30);
    const color = typeColors[l.type] ?? typeColors["Sonstiges"];
    const label = l.name.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    return `  <g class="loc" data-id="${l.id}">
    <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="8" fill="${color}" stroke="#0f172a" stroke-width="2"/>
    <text x="${(cx + 12).toFixed(1)}" y="${(cy + 4).toFixed(1)}" fill="#e2e8f0" font-size="14" font-family="sans-serif">${label}</text>
  </g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>${title}</title>
  <rect width="${width}" height="${height}" fill="${bg}"/>
  <text x="20" y="26" fill="#e2e8f0" font-size="20" font-weight="bold" font-family="sans-serif">${title}</text>
${dots.join("\n")}
</svg>`;
}

/** Konsistenz-Report exportieren (Markdown via reportToMarkdown, JSON). */
export function reportToJson(report: ConsistencyReport): string {
  return JSON.stringify(report, null, 2);
}
export { reportToMarkdown };

/** Download im Browser/Tauri-Webview auslösen. */
export function downloadWorldbuildingFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
