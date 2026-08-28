// Export für Figuren + Beziehungen: JSON, CSV, Markdown.
import type { Character } from "./characters";
import type { CharacterRelationship } from "./relationships";

export type ExportFormat = "json" | "csv" | "md";

export interface CharacterExportBundle {
  project: { id: string; exportedAt: string };
  characters: Character[];
  relationships: CharacterRelationship[];
}

export function buildCharacterBundle(
  projectId: string,
  characters: Character[],
  relationships: CharacterRelationship[],
): CharacterExportBundle {
  return {
    project: { id: projectId, exportedAt: new Date().toISOString() },
    characters,
    relationships,
  };
}

export function charactersToJson(bundle: CharacterExportBundle): string {
  return JSON.stringify(bundle, null, 2);
}

function csvEscape(v: string): string {
  return `"${(v ?? "").replace(/"/g, '""')}"`;
}

export function charactersToCsv(bundle: CharacterExportBundle): string {
  const charRows = bundle.characters.map((c) =>
    [c.id, c.name, c.age, c.role, c.traits, c.notes].map(csvEscape).join(","),
  );
  const relRows = bundle.relationships.map((r) => {
    const nameOf = (id: string) =>
      bundle.characters.find((c) => c.id === id)?.name ?? id;
    return [nameOf(r.fromCharId), r.relType, nameOf(r.toCharId), r.description]
      .map(csvEscape)
      .join(",");
  });
  return [
    "# Figuren",
    "id,name,alter,rolle,merkmale,notizen",
    ...charRows,
    "",
    "# Beziehungen",
    "von,typ,bis,beschreibung",
    ...relRows,
  ].join("\n");
}

export function charactersToMarkdown(bundle: CharacterExportBundle): string {
  const nameOf = (id: string) =>
    bundle.characters.find((c) => c.id === id)?.name ?? id;
  const lines: string[] = ["# Figuren & Beziehungen", ""];
  for (const c of bundle.characters) {
    lines.push(`## ${c.name || "(unbenannt)"}`);
    if (c.age) lines.push(`- **Alter:** ${c.age}`);
    if (c.role) lines.push(`- **Rolle:** ${c.role}`);
    if (c.traits) lines.push(`- **Merkmale:** ${c.traits}`);
    if (c.notes) lines.push(`- **Notizen:** ${c.notes}`);
    const rels = bundle.relationships.filter(
      (r) => r.fromCharId === c.id || r.toCharId === c.id,
    );
    if (rels.length) {
      lines.push("- **Beziehungen:**");
      for (const r of rels) {
        const other = r.fromCharId === c.id ? r.toCharId : r.fromCharId;
        const arrow = r.fromCharId === c.id ? "→" : "←";
        lines.push(`  - ${arrow} ${nameOf(other)}${r.relType ? ` (${r.relType})` : ""}${r.description ? `: ${r.description}` : ""}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Löst einen Download im Browser aus (Tauri-Webview-kompatibel). */
export function downloadData(content: string, filename: string, mime: string): void {
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
