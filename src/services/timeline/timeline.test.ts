// Sprint 23, Agent 4: Tests fuer die In-Memory Plot-Timeline-Engine.
import { describe, it, expect, beforeEach } from "vitest";
import {
  createTimeline,
  addEvent,
  removeEvent,
  getTimeline,
  getTimelines,
  autoDetectEvents,
  exportToJSON,
  __resetTimelinesForTests,
} from "./timeline";

beforeEach(() => {
  __resetTimelinesForTests();
});

describe("Plot-Timeline-Engine", () => {
  it("createTimeline() erzeugt eine leere Timeline mit Titel", () => {
    const tl = createTimeline("Mein Plot");
    expect(tl.title).toBe("Mein Plot");
    expect(tl.events).toEqual([]);
    expect(tl.id).toBeTruthy();
    expect(tl.createdAt).toBeLessThanOrEqual(Date.now());
  });

  it("addEvent() fuegt ein Event mit generierter id ein", async () => {
    const tl = createTimeline("Plot");
    const ev = await addEvent(tl.id, {
      title: "Aufbruch",
      description: "Die Heldin verlaesst das Dorf.",
      timestamp: "Tag 1",
      characters: ["Aylin"],
      type: "action",
    });
    expect(ev.id).toBeTruthy();
    expect(ev.color).toBeTruthy();
    const reloaded = await getTimeline(tl.id);
    expect(reloaded?.events).toHaveLength(1);
    expect(reloaded?.events[0].title).toBe("Aufbruch");
  });

  it("removeEvent() entfernt das Event wieder", async () => {
    const tl = createTimeline("Plot");
    const ev = await addEvent(tl.id, {
      title: "Kampf",
      description: "Kampf an der Bruecke.",
      timestamp: "Tag 2",
      characters: [],
      type: "conflict",
    });
    await removeEvent(tl.id, ev.id);
    expect((await getTimeline(tl.id))?.events).toHaveLength(0);
  });

  it("getTimelines() listet alle Timelines, getTimeline() kennt Unbekannte nicht", async () => {
    createTimeline("A");
    createTimeline("B");
    expect((await getTimelines()).map((t) => t.title).sort()).toEqual(["A", "B"]);
    expect(await getTimeline("gibt-es-nicht")).toBeUndefined();
  });

  it("autoDetectEvents() erkennt Events mit inferiertem Typ aus Kapitel-Text", async () => {
    const events = await autoDetectEvents([
      { title: "Ankunft", content: "Sie reist in die Stadt und beginnt ihre Mission." },
      { title: "Verrat", content: "Das dunkle Geheimnis wird enthüllt: Ihr Bruder plante den Verrat." },
      { title: "Finale", content: "Im Showdown auf dem Turm faellt die Entscheidungsschlacht." },
    ]);
    expect(events).toHaveLength(3);
    expect(events[0].timestamp).toBe("Kapitel 1");
    expect(events[1].type).toBe("revelation");
    expect(events[2].type).toBe("climax");
    for (const e of events) expect(e.color).toBeTruthy();
  });

  it("exportToJSON() erzeugt valides JSON mit allen Events", async () => {
    const tl = createTimeline("Export-Plot");
    await addEvent(tl.id, {
      title: "Wende",
      description: "Die Wahrheit kommt ans Licht.",
      timestamp: "Tag 3",
      chapter: "Kapitel 3",
      characters: ["Aylin", "Bor"],
      location: "Turm",
      type: "revelation",
    });
    const json = exportToJSON(tl);
    const parsed = JSON.parse(json);
    expect(parsed.title).toBe("Export-Plot");
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0].type).toBe("revelation");
    expect(parsed.events[0].characters).toEqual(["Aylin", "Bor"]);
  });
});
