// Story-Timeline: Ereignisse mit Kapitel-Referenz, Datum, Beteiligten.

import { getDb, persist } from "@/services/db";

export interface TimelineEvent {
  id: string;
  projectId: string;
  title: string;
  chapterRef: string;
  storyDate: string;
  participants: string;
  description: string;
  order: number;
  createdAt: number;
}

const EVENT_COLS =
  "id, project_id, title, chapter_ref, story_date, participants, description, order_num, created_at";

function rowToEvent(v: unknown[]): TimelineEvent {
  return {
    id: v[0] as string,
    projectId: v[1] as string,
    title: v[2] as string,
    chapterRef: (v[3] as string) || "",
    storyDate: (v[4] as string) || "",
    participants: (v[5] as string) || "",
    description: (v[6] as string) || "",
    order: Number(v[7]) || 0,
    createdAt: Number(v[8]),
  };
}

/** Listet alle Ereignisse eines Projekts sortiert. */
export function listEvents(projectId: string): TimelineEvent[] {
  const res = getDb().exec(
    `SELECT ${EVENT_COLS} FROM timeline_events WHERE project_id = ? ORDER BY order_num, created_at`,
    [projectId],
  );
  return res.length ? res[0].values.map(rowToEvent) : [];
}

/** Ereignis speichern. */
export async function saveEvent(event: Omit<TimelineEvent, "createdAt">): Promise<TimelineEvent> {
  const record: TimelineEvent = {
    ...event,
    createdAt: Date.now(),
  };

  getDb().exec(
    `INSERT OR REPLACE INTO timeline_events (${EVENT_COLS}) VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      record.id, record.projectId, record.title, record.chapterRef,
      record.storyDate, record.participants, record.description,
      record.order, record.createdAt,
    ],
  );
  await persist();
  return record;
}

/** Ereignis löschen. */
export async function deleteEvent(id: string): Promise<void> {
  getDb().run("DELETE FROM timeline_events WHERE id = ?", [id]);
  await persist();
}

export interface TimelineWarning {
  eventId: string;
  eventTitle: string;
  message: string;
}

/** Prüft auf Zeitparadoxien (Ereignisse in falscher Reihenfolge). */
export function checkTimelineConsistency(events: TimelineEvent[]): TimelineWarning[] {
  const warnings: TimelineWarning[] = [];

  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const curr = events[i];

    if (prev.storyDate && curr.storyDate) {
      if (prev.storyDate > curr.storyDate) {
        warnings.push({
          eventId: curr.id,
          eventTitle: curr.title,
          message: `"${curr.title}" (${curr.storyDate}) liegt vor "${prev.title}" (${prev.storyDate})`,
        });
      }
    }
  }

  return warnings;
}

/** Parst LLM-Ausgabe mit Ereignissen. */
export function parseEventSuggestions(llmText: string): Partial<TimelineEvent>[] {
  const suggestions: Partial<TimelineEvent>[] = [];
  const lines = llmText.split("\n").filter((l) => l.trim());

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split("|").map((p) => p.trim());
    if (parts.length >= 1 && parts[0]) {
      suggestions.push({
        title: parts[0],
        chapterRef: parts[1] || "",
        storyDate: parts[2] || "",
        participants: parts[3] || "",
        description: parts[4] || "",
        order: i,
      });
    }
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Sprint 23, Agent 4: In-Memory Plot-Timeline-Engine (CRUD + Auto-Detect + Export).
// Ergaenzt die DB-basierte Story-Timeline oben, ersetzt sie nicht.
// Hinweis: Der Name `TimelineEvent` ist oben bereits durch den DB-Typ belegt,
// daher heisst der Spec-Typ hier `PlotTimelineEvent` (identische Felder wie
// im Spec-`TimelineEvent`: id/title/description/timestamp/chapter/characters/
// location/type/color). `Timeline` sowie alle Spec-Funktionen tragen die
// exakten Spec-Namen.

/** Ereignistyp eines Plot-Timeline-Events (Spec: `TimelineEvent['type']`). */
export type TimelineEventType =
  | "action"
  | "revelation"
  | "conflict"
  | "decision"
  | "climax"
  | "resolution";

/** Plot-Event (Spec-`TimelineEvent`). */
export interface PlotTimelineEvent {
  id: string;
  title: string;
  description: string;
  /** Relativ (z.B. "Tag 3") oder Datum. */
  timestamp: string;
  chapter?: string;
  characters: string[];
  location?: string;
  type: TimelineEventType;
  color?: string;
}

/** Plot-Timeline (Spec-`Timeline`). */
export interface Timeline {
  id: string;
  title: string;
  events: PlotTimelineEvent[];
  createdAt: number;
  updatedAt: number;
}

/** Marker-Farben je Ereignistyp (Bloomberg-Terminal-Palette). */
export const TIMELINE_TYPE_COLORS: Record<TimelineEventType, string> = {
  action: "#ffb000",
  revelation: "#00ff41",
  conflict: "#ff3333",
  decision: "#3b82f6",
  climax: "#ff00ff",
  resolution: "#00e5ff",
};

const timelines = new Map<string, Timeline>();

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffff).toString(36)}`;
}

/**
 * Schreibt eine Timeline mit frischen Referenzen zurueck (neues Objekt +
 * neues Events-Array), damit React-Memos/Effects Aenderungen per
 * Referenzvergleich erkennen. Gibt das gespeicherte Objekt zurueck.
 */
function store(timeline: Timeline): Timeline {
  const next: Timeline = { ...timeline, events: [...timeline.events], updatedAt: Date.now() };
  timelines.set(next.id, next);
  return next;
}

/** Legt eine neue, leere Timeline an. */
export function createTimeline(title: string): Timeline {
  const now = Date.now();
  const timeline: Timeline = {
    id: newId("tl"),
    title,
    events: [],
    createdAt: now,
    updatedAt: now,
  };
  timelines.set(timeline.id, timeline);
  return timeline;
}

/** Fuegt ein Event an eine Timeline an. */
export async function addEvent(
  timelineId: string,
  event: Omit<PlotTimelineEvent, "id">,
): Promise<PlotTimelineEvent> {
  const timeline = timelines.get(timelineId);
  if (!timeline) throw new Error(`Timeline nicht gefunden: ${timelineId}`);
  const record: PlotTimelineEvent = {
    ...event,
    id: newId("ev"),
    color: event.color ?? TIMELINE_TYPE_COLORS[event.type],
  };
  timeline.events.push(record);
  // Neue Referenzen, damit React-Memos/Effects Aenderungen erkennen.
  store(timeline);
  return record;
}

/** Aktualisiert ein Event (fuer die Panel-Bearbeitung). */
export async function updateEvent(
  timelineId: string,
  eventId: string,
  patch: Partial<Omit<PlotTimelineEvent, "id">>,
): Promise<PlotTimelineEvent> {
  const timeline = timelines.get(timelineId);
  if (!timeline) throw new Error(`Timeline nicht gefunden: ${timelineId}`);
  const event = timeline.events.find((e) => e.id === eventId);
  if (!event) throw new Error(`Event nicht gefunden: ${eventId}`);
  Object.assign(event, patch);
  if (patch.type && !patch.color) event.color = TIMELINE_TYPE_COLORS[patch.type];
  store(timeline);
  return event;
}

/** Entfernt ein Event aus einer Timeline. */
export async function removeEvent(timelineId: string, eventId: string): Promise<void> {
  const timeline = timelines.get(timelineId);
  if (!timeline) throw new Error(`Timeline nicht gefunden: ${timelineId}`);
  timeline.events = timeline.events.filter((e) => e.id !== eventId);
  store(timeline);
}

/** Ruft eine Timeline ab (undefined, wenn unbekannt). */
export async function getTimeline(timelineId: string): Promise<Timeline | undefined> {
  return timelines.get(timelineId);
}

/** Listet alle Timelines auf. */
export async function getTimelines(): Promise<Timeline[]> {
  return [...timelines.values()];
}

/** Setzt den In-Memory-Store zurueck (nur fuer Tests). */
export function __resetTimelinesForTests(): void {
  timelines.clear();
}

interface TypeSignal {
  type: TimelineEventType;
  /** [deutsche Keywords, englische Keywords] */
  keywords: RegExp;
}

const TYPE_SIGNALS: TypeSignal[] = [
  { type: "climax", keywords: /h[oö]hepunkt|showdown|finale|finaler kampf|endkampf|entscheidungsschlacht|climax|final battle/i },
  { type: "conflict", keywords: /kampf|krieg|streit|konflikt|angriff|gefahr|bedrohung|verfolgung|flucht|fight|battle|conflict|attack|threat/i },
  { type: "revelation", keywords: /enth[üu]llung|geheimnis|wahrheit|offenbarung|entdeckt|erf[äa]hrt|lüge|verrat|revelation|secret|truth|discovers|betrayal/i },
  { type: "decision", keywords: /entscheidung|entschliesst|entschließt|beschliesst|beschließt|wahl|opfer|versprechen|schwur|decision|choice|sacrifice|promise|vow/i },
  { type: "resolution", keywords: /aufl[öo]sung|vers[öo]hnung|frieden|heimkehr|r[üu]ckkehr|neuanfang|hochzeit|abschied|resolution|peace|return|reunion|farewell/i },
  { type: "action", keywords: /aktion|mission|reise|aufbruch|reiseantritt|einbruch|rettung|jagd|verfolgungsjagd|reist|bricht auf|action|mission|journey|rescue|heist/i },
];

function inferType(text: string): TimelineEventType {
  for (const signal of TYPE_SIGNALS) {
    if (signal.keywords.test(text)) return signal.type;
  }
  return "action";
}

/**
 * Erkennt automatisch Timeline-Events aus Kapiteln.
 * Ein Event pro Kapitel mit inferiertem Typ (Keyword-Signale, Prioritaet:
 * climax > conflict > revelation > decision > resolution > action-Fallback).
 */
export async function autoDetectEvents(
  chapters: { title: string; content: string }[],
): Promise<PlotTimelineEvent[]> {
  return chapters.map((chapter, index) => {
    const haystack = `${chapter.title}\n${chapter.content}`;
    const type = inferType(haystack);
    const snippet = chapter.content.replace(/\s+/g, " ").trim().slice(0, 160);
    return {
      id: newId("ev"),
      title: chapter.title || `Kapitel ${index + 1}`,
      description: snippet || chapter.title || `Ereignis aus Kapitel ${index + 1}`,
      timestamp: `Kapitel ${index + 1}`,
      chapter: chapter.title || undefined,
      characters: [],
      location: undefined,
      type,
      color: TIMELINE_TYPE_COLORS[type],
    };
  });
}

/** Exportiert eine Timeline als formatiertes JSON. */
export function exportToJSON(timeline: Timeline): string {
  const { ...plain } = timeline;
  return JSON.stringify(
    {
      id: plain.id,
      title: plain.title,
      exportedAt: new Date().toISOString(),
      events: plain.events.map(({ id, title, description, timestamp, chapter, characters, location, type, color }) => ({
        id,
        title,
        description,
        timestamp,
        chapter,
        characters,
        location,
        type,
        color,
      })),
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt,
    },
    null,
    2,
  );
}
