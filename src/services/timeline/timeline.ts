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
