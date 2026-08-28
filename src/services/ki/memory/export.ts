// KI-Gedächtnis: Export als JSON oder Markdown.
import { listMemory } from "./store";
import type { MemoryEntry, MemoryExportFormat, MemoryStats } from "./types";
import { memoryStats } from "./store";

export function exportMemoryJSON(entries?: MemoryEntry[]): string {
  const list = entries ?? listMemory();
  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    stats: memoryStats(),
    entries: list,
  };
  return JSON.stringify(payload, null, 2);
}

export function exportMemoryMarkdown(entries?: MemoryEntry[]): string {
  const list = entries ?? listMemory();
  const stats: MemoryStats = memoryStats();
  const lines: string[] = [
    `# KI-Gedächtnis — Export`,
    ``,
    `_Exportiert: ${new Date().toLocaleString("de-DE")} · ${stats.total} Einträge_`,
    ``,
  ];
  const groups = new Map<string, MemoryEntry[]>();
  for (const m of list) {
    if (!groups.has(m.kind)) groups.set(m.kind, []);
    groups.get(m.kind)!.push(m);
  }
  const order = ["charakter", "ort", "fakt", "gespraech", "stil"];
  for (const kind of order) {
    const group = groups.get(kind);
    if (!group?.length) continue;
    lines.push(`## ${kind.charAt(0).toUpperCase() + kind.slice(1)} (${group.length})`, ``);
    for (const m of group) {
      lines.push(`### ${m.title}`, ``);
      lines.push(m.content);
      lines.push(``, `_Quelle: ${m.source} · Wichtigkeit: ${m.importance}/5 · Aktualisiert: ${new Date(m.updatedAt).toLocaleDateString("de-DE")}_`, ``);
    }
  }
  return lines.join("\n");
}

/** Export-String im gewünschten Format + passender Dateiname. */
export function exportMemory(format: MemoryExportFormat, entries?: MemoryEntry[]): { content: string; filename: string } {
  const stamp = new Date().toISOString().slice(0, 10);
  return format === "json"
    ? { content: exportMemoryJSON(entries), filename: `ki-gedaechtnis-${stamp}.json` }
    : { content: exportMemoryMarkdown(entries), filename: `ki-gedaechtnis-${stamp}.md` };
}

/** Löst den Browser-Download aus (im Desktop-Studio als Datei speichern). */
export function downloadMemory(format: MemoryExportFormat, entries?: MemoryEntry[]): void {
  const { content, filename } = exportMemory(format, entries);
  const mime = format === "json" ? "application/json" : "text/markdown";
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
