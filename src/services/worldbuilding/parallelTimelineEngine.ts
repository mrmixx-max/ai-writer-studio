/**
 * Parallel-Timeline-Engine — WP 51.1 (Zeitreise- & Multiversum-Kausalitätswächter)
 *
 * Lokaler, deterministischer Service zur Verwaltung paralleler Zeitleisten,
 * Erkennung von Kausalitätsparadoxen und Gantt-Visualisierung.
 * Keine LLM-Aufrufe, keine Seiteneffekte.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TimelineEvent {
  id: string;
  name: string;
  year: number;
  characterIds: string[];
  description: string;
}

export interface Timeline {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
  events: TimelineEvent[];
}

export interface Paradox {
  id: string;
  kind: 'death' | 'timeline' | 'character';
  characterId: string;
  timelineA: string;
  timelineB: string;
  description: string;
}

export interface GanttBar {
  eventId: string;
  eventName: string;
  startYear: number;
  endYear: number;
  characterIds: string[];
}

export interface GanttTrack {
  timelineId: string;
  timelineName: string;
  bars: GanttBar[];
}

export interface GanttData {
  tracks: GanttTrack[];
  minYear: number;
  maxYear: number;
}

// ─── Interne Helfer ──────────────────────────────────────────────────────────

const DEATH_KEYWORDS = ['tod', 'stirbt', 'death', 'kill', 'getötet', 'sterben', 'fällt'];
const JUMP_KEYWORDS = ['sprung', 'jump', 'portal', 'zeitreise', 'time travel', 'multiversum', 'wechselt'];

function isDeathEvent(event: TimelineEvent): boolean {
  const haystack = `${event.name} ${event.description}`.toLowerCase();
  return DEATH_KEYWORDS.some((kw) => haystack.includes(kw));
}

function hasDocumentedJump(event: TimelineEvent): boolean {
  const haystack = `${event.name} ${event.description}`.toLowerCase();
  return JUMP_KEYWORDS.some((kw) => haystack.includes(kw));
}

function safeString(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
}

function safeNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Erzeugt eine neue Zeitleiste mit defensiven Fallbacks.
 */
export function createTimeline(
  id: string,
  name: string,
  startYear: number,
  endYear: number,
): Timeline {
  const safeId = safeString(id, `timeline-${startYear}-${endYear}`);
  const safeName = safeString(name, 'Unbenannte Zeitleiste');
  const safeStart = safeNumber(startYear, 0);
  const safeEnd = safeNumber(endYear, safeStart);

  return {
    id: safeId,
    name: safeName,
    startYear: Math.min(safeStart, safeEnd),
    endYear: Math.max(safeStart, safeEnd),
    events: [],
  };
}

/**
 * Fügt ein Ereignis hinzu und gibt eine neue Timeline zurück (immutable).
 */
export function addEvent(timeline: Timeline, event: TimelineEvent): Timeline {
  if (!timeline || typeof timeline !== 'object') {
    throw new Error('Ungültige Timeline');
  }
  if (!event || typeof event !== 'object') {
    throw new Error('Ungültiges Ereignis');
  }

  const safeEvent: TimelineEvent = {
    id: safeString(event.id, `event-${event.year}-${timeline.events.length}`),
    name: safeString(event.name, 'Unbenanntes Ereignis'),
    year: safeNumber(event.year, timeline.startYear),
    characterIds: Array.isArray(event.characterIds) ? event.characterIds : [],
    description: typeof event.description === 'string' ? event.description : '',
  };

  return {
    ...timeline,
    events: [...timeline.events, safeEvent],
  };
}

/**
 * Erkennt Kausalitätsparadoxen über mehrere Zeitleisten hinweg.
 *
 * Regeln:
 * - death: Figur stirbt in Timeline A, agiert in Timeline B ohne dokumentierten Sprung
 * - timeline: Figur ist in zwei Timelines gleichzeitig aktiv (überlappende Zeiträume)
 * - character: Ereignis in Timeline B passiert vor Ursprung in Timeline A
 */
export function detectParadoxes(timelines: Timeline[]): Paradox[] {
  if (!Array.isArray(timelines) || timelines.length === 0) {
    return [];
  }

  const paradoxes: Paradox[] = [];
  let paradoxCounter = 0;

  const nextId = (): string => {
    paradoxCounter += 1;
    return `paradox-${paradoxCounter}`;
  };

  // Sammle alle Events pro Figur
  const eventsByCharacter = new Map<string, Array<{ timeline: Timeline; event: TimelineEvent }>>();

  for (const timeline of timelines) {
    if (!timeline || !Array.isArray(timeline.events)) continue;
    for (const event of timeline.events) {
      if (!event || !Array.isArray(event.characterIds)) continue;
      for (const charId of event.characterIds) {
        if (!charId) continue;
        const list = eventsByCharacter.get(charId) ?? [];
        list.push({ timeline, event });
        eventsByCharacter.set(charId, list);
      }
    }
  }

  // Regel 1: death — Figur stirbt in A, agiert in B ohne Sprung
  for (const [charId, entries] of eventsByCharacter) {
    const deathEntries = entries.filter((e) => isDeathEvent(e.event));
    const nonDeathEntries = entries.filter((e) => !isDeathEvent(e.event));

    for (const death of deathEntries) {
      for (const other of nonDeathEntries) {
        if (other.timeline.id === death.timeline.id) continue;
        if (hasDocumentedJump(other.event)) continue;

        paradoxes.push({
          id: nextId(),
          kind: 'death',
          characterId: charId,
          timelineA: death.timeline.id,
          timelineB: other.timeline.id,
          description: `Figur "${charId}" stirbt in "${death.timeline.name}" (${death.event.year}) und agiert in "${other.timeline.name}" (${other.event.year}) ohne dokumentierten Sprung.`,
        });
      }
    }
  }

  // Regel 2: timeline — Figur in zwei Timelines gleichzeitig aktiv
  for (const [charId, entries] of eventsByCharacter) {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        if (a.timeline.id === b.timeline.id) continue;

        // Überlappende Zeiträume prüfen
        const aStart = Math.min(a.timeline.startYear, a.event.year);
        const aEnd = Math.max(a.timeline.endYear, a.event.year);
        const bStart = Math.min(b.timeline.startYear, b.event.year);
        const bEnd = Math.max(b.timeline.endYear, b.event.year);

        if (aStart <= bEnd && bStart <= aEnd) {
          paradoxes.push({
            id: nextId(),
            kind: 'timeline',
            characterId: charId,
            timelineA: a.timeline.id,
            timelineB: b.timeline.id,
            description: `Figur "${charId}" ist in "${a.timeline.name}" und "${b.timeline.name}" gleichzeitig aktiv.`,
          });
        }
      }
    }
  }

  // Regel 3: character — Ereignis in B vor Ursprung in A
  // Ein Ereignis in einer Timeline liegt vor dem Ursprung einer anderen Timeline,
  // UND die Figur hat in der anderen Timeline ein Ereignis nach deren Ursprung.
  for (const timeline of timelines) {
    if (!timeline) continue;
    for (const otherTimeline of timelines) {
      if (!otherTimeline || otherTimeline.id === timeline.id) continue;
      for (const event of timeline.events) {
        if (!event || !Array.isArray(event.characterIds)) continue;
        for (const charId of event.characterIds) {
          if (!charId) continue;
          const hasLaterEvent = otherTimeline.events.some(
            (e) => e && e.year >= otherTimeline.startYear && e.year <= otherTimeline.endYear && Array.isArray(e.characterIds) && e.characterIds.includes(charId),
          );
          if (hasLaterEvent && event.year < otherTimeline.startYear) {
            paradoxes.push({
              id: nextId(),
              kind: 'character',
              characterId: charId,
              timelineA: otherTimeline.id,
              timelineB: timeline.id,
              description: `Ereignis "${event.name}" (${event.year}) in "${timeline.name}" liegt vor dem Ursprung von "${otherTimeline.name}" (${otherTimeline.startYear}).`,
            });
          }
        }
      }
    }
  }

  return paradoxes;
}

/**
 * Erzeugt Gantt-Spur-Daten für Visualisierung.
 */
export function generateGanttData(timelines: Timeline[]): GanttData {
  if (!Array.isArray(timelines) || timelines.length === 0) {
    return { tracks: [], minYear: 0, maxYear: 0 };
  }

  const tracks: GanttTrack[] = [];
  let minYear = Infinity;
  let maxYear = -Infinity;

  for (const timeline of timelines) {
    if (!timeline) continue;

    const bars: GanttBar[] = [];
    for (const event of timeline.events) {
      if (!event) continue;
      const bar: GanttBar = {
        eventId: safeString(event.id, ''),
        eventName: safeString(event.name, ''),
        startYear: safeNumber(event.year, timeline.startYear),
        endYear: safeNumber(event.year, timeline.startYear),
        characterIds: Array.isArray(event.characterIds) ? event.characterIds : [],
      };
      bars.push(bar);

      minYear = Math.min(minYear, bar.startYear);
      maxYear = Math.max(maxYear, bar.endYear);
    }

    // Timeline-Grenzen einbeziehen
    minYear = Math.min(minYear, timeline.startYear);
    maxYear = Math.max(maxYear, timeline.endYear);

    tracks.push({
      timelineId: safeString(timeline.id, ''),
      timelineName: safeString(timeline.name, ''),
      bars,
    });
  }

  if (minYear === Infinity) minYear = 0;
  if (maxYear === -Infinity) maxYear = 0;

  return { tracks, minYear, maxYear };
}
