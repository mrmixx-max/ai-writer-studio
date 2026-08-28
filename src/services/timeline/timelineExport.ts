// Export für Story-Timeline + Plot-Struktur: JSON, CSV, Markdown.
import type { TimelineEvent } from "./timeline";
import { buildPlotStructure, structureStats, type ActAssignment } from "./plotStructure";

export type ExportFormat = "json" | "csv" | "md";

export function timelineToJson(projectId: string, events: TimelineEvent[]): string {
  const structure: ActAssignment[] = buildPlotStructure(events);
  return JSON.stringify(
    {
      project: { id: projectId, exportedAt: new Date().toISOString() },
      events,
      plotStructure: structure,
      stats: structureStats(events),
    },
    null,
    2,
  );
}

function csvEscape(v: string): string {
  return `"${(v ?? "").replace(/"/g, '""')}"`;
}

export function timelineToCsv(_projectId: string, events: TimelineEvent[]): string {
  const structure = buildPlotStructure(events);
  const actOf = (id: string) => structure.find((s) => s.eventId === id)?.act ?? "";
  const journeyOf = (id: string) => structure.find((s) => s.eventId === id)?.journeyStage ?? "";
  const rows = events.map((e) =>
    [e.order, e.title, e.chapterRef, e.storyDate, e.participants, e.description, actOf(e.id), journeyOf(e.id)]
      .map((v) => csvEscape(String(v)))
      .join(","),
  );
  return ["# Story-Timeline", "ordnung,titel,kapitel,story_datum,beteiligte,beschreibung,akt,heldenreise_stufe", ...rows].join("\n");
}

export function timelineToMarkdown(_projectId: string, events: TimelineEvent[]): string {
  const structure = buildPlotStructure(events);
  const stats = structureStats(events);
  const actOf = (id: string) => structure.find((s) => s.eventId === id)?.act ?? "—";
  const journeyOf = (id: string) => structure.find((s) => s.eventId === id)?.journeyStage ?? "—";
  const lines: string[] = ["# Story-Timeline", "", `**Ereignisse:** ${stats.total}`, `**Verteilung:** Akt I: ${stats.perAct.act1} · Akt II: ${stats.perAct.act2} · Akt III: ${stats.perAct.act3}`, `**Heldenreise-Abdeckung:** ${(stats.journeyCoverage * 100).toFixed(0)}%`, ""];
  for (const e of events) {
    lines.push(`## ${e.order + 1}. ${e.title}`);
    if (e.storyDate) lines.push(`- **Story-Datum:** ${e.storyDate}`);
    if (e.chapterRef) lines.push(`- **Kapitel:** ${e.chapterRef}`);
    if (e.participants) lines.push(`- **Beteiligte:** ${e.participants}`);
    if (e.description) lines.push(`- **Beschreibung:** ${e.description}`);
    lines.push(`- **Akt:** ${actOf(e.id)} · **Heldenreise:** ${journeyOf(e.id)}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function exportTimeline(
  projectId: string,
  events: TimelineEvent[],
  format: ExportFormat,
  download: (content: string, filename: string, mime: string) => void,
): string {
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "json") {
    const content = timelineToJson(projectId, events);
    download(content, `timeline-${stamp}.json`, "application/json");
    return content;
  }
  if (format === "csv") {
    const content = timelineToCsv(projectId, events);
    download(content, `timeline-${stamp}.csv`, "text/csv");
    return content;
  }
  const content = timelineToMarkdown(projectId, events);
  download(content, `timeline-${stamp}.md`, "text/markdown");
  return content;
}
