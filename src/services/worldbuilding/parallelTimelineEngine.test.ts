/**
 * Tests: Parallel-Timeline-Engine (WP 51.1)
 */

import { describe, it, expect } from 'vitest';
import {
  createTimeline,
  addEvent,
  detectParadoxes,
  generateGanttData,
  type Timeline,
  type TimelineEvent,
} from './parallelTimelineEngine';

// ─── createTimeline ──────────────────────────────────────────────────────────

describe('createTimeline', () => {
  it('erstellt eine Timeline mit gültigen Werten', () => {
    const t = createTimeline('tl-1', 'Hauptlinie', 1900, 2000);
    expect(t.id).toBe('tl-1');
    expect(t.name).toBe('Hauptlinie');
    expect(t.startYear).toBe(1900);
    expect(t.endYear).toBe(2000);
    expect(t.events).toEqual([]);
  });

  it('vertauscht startYear/endYear falls nötig', () => {
    const t = createTimeline('tl-2', 'Umgekehrt', 2000, 1900);
    expect(t.startYear).toBe(1900);
    expect(t.endYear).toBe(2000);
  });

  it('leerer ID-String bekommt Fallback', () => {
    const t = createTimeline('', 'Test', 0, 100);
    expect(t.id).toBe('timeline-0-100');
  });

  it('leerer Name bekommt Fallback', () => {
    const t = createTimeline('tl-3', '', 0, 100);
    expect(t.name).toBe('Unbenannte Zeitleiste');
  });

  it('ungültige Jahreswerte werden behandelt', () => {
    const t = createTimeline('tl-4', 'Test', NaN, Infinity);
    expect(Number.isFinite(t.startYear)).toBe(true);
    expect(Number.isFinite(t.endYear)).toBe(true);
  });
});

// ─── addEvent ────────────────────────────────────────────────────────────────

describe('addEvent', () => {
  it('fügt ein Ereignis hinzu', () => {
    const t = createTimeline('tl-1', 'Test', 1900, 2000);
    const event: TimelineEvent = {
      id: 'ev-1',
      name: 'Schlacht',
      year: 1945,
      characterIds: ['char-1'],
      description: 'Große Schlacht',
    };
    const result = addEvent(t, event);
    expect(result.events.length).toBe(1);
    expect(result.events[0].name).toBe('Schlacht');
  });

  it('ist immutable (Original bleibt unverändert)', () => {
    const t = createTimeline('tl-1', 'Test', 1900, 2000);
    const event: TimelineEvent = {
      id: 'ev-1',
      name: 'Test',
      year: 1950,
      characterIds: [],
      description: '',
    };
    const result = addEvent(t, event);
    expect(t.events.length).toBe(0);
    expect(result.events.length).toBe(1);
  });

  it('null Timeline wirft Fehler', () => {
    const event: TimelineEvent = {
      id: 'ev-1',
      name: 'Test',
      year: 1950,
      characterIds: [],
      description: '',
    };
    expect(() => addEvent(null as unknown as Timeline, event)).toThrow();
  });

  it('null Event wirft Fehler', () => {
    const t = createTimeline('tl-1', 'Test', 1900, 2000);
    expect(() => addEvent(t, null as unknown as TimelineEvent)).toThrow();
  });

  it('fehlende Felder werden mit Defaults gefüllt', () => {
    const t = createTimeline('tl-1', 'Test', 1900, 2000);
    const event = {
      id: '',
      name: '',
      year: NaN,
      characterIds: null,
      description: null,
    } as unknown as TimelineEvent;
    const result = addEvent(t, event);
    expect(result.events[0].id).toContain('event-');
    expect(result.events[0].name).toBe('Unbenanntes Ereignis');
    expect(result.events[0].characterIds).toEqual([]);
  });
});

// ─── detectParadoxes ─────────────────────────────────────────────────────────

describe('detectParadoxes', () => {
  it('leere Liste ergibt keine Paradoxen', () => {
    expect(detectParadoxes([])).toEqual([]);
  });

  it('null/undefined ergibt keine Paradoxen', () => {
    expect(detectParadoxes(null as unknown as Timeline[])).toEqual([]);
    expect(detectParadoxes(undefined as unknown as Timeline[])).toEqual([]);
  });

  it('erkennt death-Paradox (Tod ohne Sprung)', () => {
    const t1 = createTimeline('tl-a', 'Timeline A', 1900, 2000);
    const t2 = createTimeline('tl-b', 'Timeline B', 1900, 2000);

    const deathEvent: TimelineEvent = {
      id: 'ev-death',
      name: 'Tod von Heldin',
      year: 1950,
      characterIds: ['char-1'],
      description: 'Die Heldin stirbt',
    };
    const aliveEvent: TimelineEvent = {
      id: 'ev-alive',
      name: 'Heldin kämpft',
      year: 1960,
      characterIds: ['char-1'],
      description: 'Die Heldin kämpft',
    };

    const t1WithDeath = addEvent(t1, deathEvent);
    const t2WithAlive = addEvent(t2, aliveEvent);

    const paradoxes = detectParadoxes([t1WithDeath, t2WithAlive]);
    expect(paradoxes.length).toBeGreaterThan(0);
    expect(paradoxes.some((p) => p.kind === 'death')).toBe(true);
  });

  it('dokumentierter Sprung verhindert death-Paradox', () => {
    const t1 = createTimeline('tl-a', 'Timeline A', 1900, 2000);
    const t2 = createTimeline('tl-b', 'Timeline B', 1900, 2000);

    const deathEvent: TimelineEvent = {
      id: 'ev-death',
      name: 'Tod',
      year: 1950,
      characterIds: ['char-1'],
      description: 'Die Heldin stirbt',
    };
    const jumpEvent: TimelineEvent = {
      id: 'ev-jump',
      name: 'Sprung',
      year: 1960,
      characterIds: ['char-1'],
      description: 'Die Heldin macht einen Zeitreise-Sprung',
    };

    const t1WithDeath = addEvent(t1, deathEvent);
    const t2WithJump = addEvent(t2, jumpEvent);

    const paradoxes = detectParadoxes([t1WithDeath, t2WithJump]);
    expect(paradoxes.filter((p) => p.kind === 'death')).toEqual([]);
  });

  it('erkennt timeline-Paradox (gleichzeitig aktiv)', () => {
    const t1 = createTimeline('tl-a', 'Timeline A', 1900, 2000);
    const t2 = createTimeline('tl-b', 'Timeline B', 1900, 2000);

    const ev1: TimelineEvent = {
      id: 'ev-1',
      name: 'Aktion A',
      year: 1950,
      characterIds: ['char-1'],
      description: '',
    };
    const ev2: TimelineEvent = {
      id: 'ev-2',
      name: 'Aktion B',
      year: 1955,
      characterIds: ['char-1'],
      description: '',
    };

    const t1WithEv = addEvent(t1, ev1);
    const t2WithEv = addEvent(t2, ev2);

    const paradoxes = detectParadoxes([t1WithEv, t2WithEv]);
    expect(paradoxes.some((p) => p.kind === 'timeline')).toBe(true);
  });

  it('erkennt character-Paradox (Ereignis vor Ursprung)', () => {
    const t1 = createTimeline('tl-a', 'Timeline A', 1800, 1850);
    const t2 = createTimeline('tl-b', 'Timeline B', 1900, 2000);

    const ev1: TimelineEvent = {
      id: 'ev-1',
      name: 'Frühe Aktion',
      year: 1820,
      characterIds: ['char-1'],
      description: '',
    };
    const ev2: TimelineEvent = {
      id: 'ev-2',
      name: 'Späte Aktion',
      year: 1950,
      characterIds: ['char-1'],
      description: '',
    };

    const t1WithEv = addEvent(t1, ev1);
    const t2WithEv = addEvent(t2, ev2);

    const paradoxes = detectParadoxes([t1WithEv, t2WithEv]);
    expect(paradoxes.some((p) => p.kind === 'character')).toBe(true);
  });

  it('keine Paradoxen bei disjunkten Zeiträumen', () => {
    const t1 = createTimeline('tl-a', 'Timeline A', 1900, 1950);
    const t2 = createTimeline('tl-b', 'Timeline B', 2000, 2050);

    const ev1: TimelineEvent = {
      id: 'ev-1',
      name: 'Aktion A',
      year: 1920,
      characterIds: ['char-1'],
      description: '',
    };
    const ev2: TimelineEvent = {
      id: 'ev-2',
      name: 'Aktion B',
      year: 2020,
      characterIds: ['char-2'],
      description: '',
    };

    const t1WithEv = addEvent(t1, ev1);
    const t2WithEv = addEvent(t2, ev2);

    const paradoxes = detectParadoxes([t1WithEv, t2WithEv]);
    expect(paradoxes).toEqual([]);
  });
});

// ─── generateGanttData ───────────────────────────────────────────────────────

describe('generateGanttData', () => {
  it('leere Liste ergibt leere Tracks', () => {
    const result = generateGanttData([]);
    expect(result.tracks).toEqual([]);
    expect(result.minYear).toBe(0);
    expect(result.maxYear).toBe(0);
  });

  it('erstellt Tracks für jede Timeline', () => {
    const t1 = createTimeline('tl-1', 'A', 1900, 2000);
    const t2 = createTimeline('tl-2', 'B', 1800, 1850);
    const result = generateGanttData([t1, t2]);
    expect(result.tracks.length).toBe(2);
    expect(result.tracks[0].timelineId).toBe('tl-1');
    expect(result.tracks[1].timelineId).toBe('tl-2');
  });

  it('berechnet minYear/maxYear korrekt', () => {
    const t1 = createTimeline('tl-1', 'A', 1900, 2000);
    const t2 = createTimeline('tl-2', 'B', 1800, 1850);
    const result = generateGanttData([t1, t2]);
    expect(result.minYear).toBe(1800);
    expect(result.maxYear).toBe(2000);
  });

  it('ereignisse werden als Bars übernommen', () => {
    const t = createTimeline('tl-1', 'A', 1900, 2000);
    const event: TimelineEvent = {
      id: 'ev-1',
      name: 'Schlacht',
      year: 1945,
      characterIds: ['char-1'],
      description: '',
    };
    const tWithEv = addEvent(t, event);
    const result = generateGanttData([tWithEv]);
    expect(result.tracks[0].bars.length).toBe(1);
    expect(result.tracks[0].bars[0].eventName).toBe('Schlacht');
    expect(result.tracks[0].bars[0].startYear).toBe(1945);
  });

  it('null/undefined Eingaben werden behandelt', () => {
    const result = generateGanttData(null as unknown as Timeline[]);
    expect(result.tracks).toEqual([]);
  });
});
