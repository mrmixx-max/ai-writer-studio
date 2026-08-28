// Tests für Plot-Struktur und Timeline-Export.
import { describe, it, expect } from "vitest";
import {
  THREE_ACT_STRUCTURE, HERO_JOURNEY_STAGES, buildPlotStructure, structureStats,
} from "./plotStructure";
import { timelineToJson, timelineToCsv, timelineToMarkdown } from "./timelineExport";
import type { TimelineEvent } from "./timeline";

function ev(i: number, title: string, desc = ""): TimelineEvent {
  return {
    id: "ev" + i, projectId: "p1", title, chapterRef: "K" + i, storyDate: "2026-01-0" + (i + 1),
    participants: "", description: desc, order: i, createdAt: Date.now() + i,
  };
}

describe("plotStructure", () => {
  it("verteilt Ereignisse auf die 3 Akte", () => {
    const events = Array.from({ length: 10 }, (_, i) => ev(i, "Ereignis " + i));
    const structure = buildPlotStructure(events);
    expect(structure).toHaveLength(10);
    const stats = structureStats(events);
    expect(stats.perAct.act1).toBeGreaterThan(0);
    expect(stats.perAct.act2).toBeGreaterThan(0);
    expect(stats.perAct.act3).toBeGreaterThan(0);
    expect(stats.perAct.act1 + stats.perAct.act2 + stats.perAct.act3).toBe(10);
  });

  it("erkennt Heldenreise-Stufen per Stichwort", () => {
    const events = [ev(0, "Der gewohnte Alltag"), ev(1, "Der Ruf"), ev(2, "Rückkehr mit dem Elixier")];
    const structure = buildPlotStructure(events);
    expect(structure[0].journeyStage).toBe("ordinary");
    expect(structure[1].journeyStage).toBe("call");
    expect(structure[2].journeyStage).toBe("return");
  });

  it("exportiert als JSON/CSV/MD", () => {
    const events = [ev(0, "Der Ruf", "Ein Brief"), ev(1, "Prüfung", "Kampf im Wald")];
    const json = timelineToJson("p1", events);
    expect(JSON.parse(json).events).toHaveLength(2);
    const csv = timelineToCsv("p1", events);
    expect(csv).toContain("Der Ruf");
    const md = timelineToMarkdown("p1", events);
    expect(md).toContain("# Story-Timeline");
    expect(THREE_ACT_STRUCTURE).toHaveLength(3);
    expect(HERO_JOURNEY_STAGES).toHaveLength(12);
  });
});
