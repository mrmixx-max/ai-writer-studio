// Tests: Live-Audience-Telemetry-Service (WP 48.1 — Live-Bühnen-Dashboard).
//
// Deckt ab: createTelemetrySession, measureAudioLevel, generateDirectorCue,
// submitQuestion, getTopQuestions, generateQRLink.
// Alles deterministisch, ohne LLM/Netzwerk/Audio-IO.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTelemetrySession,
  measureAudioLevel,
  generateDirectorCue,
  submitQuestion,
  getTopQuestions,
  generateQRLink,
  __setTelemetryClock,
  __resetTelemetry,
  QUESTIONS_PER_CUE,
  DEFAULT_AUTHOR_NAME,
  DEFAULT_EVENT_NAME,
  DEFAULT_MAX_QUESTIONS,
  DEFAULT_QR_HOST,
  type TelemetryConfig,
} from './liveAudienceTelemetry';

function makeConfig(overrides: Partial<TelemetryConfig> = {}): TelemetryConfig {
  return {
    authorName: 'Anna Beispiel',
    eventName: 'Lesung im Park',
    maxQuestions: 10,
    ...overrides,
  };
}

beforeEach(() => {
  __resetTelemetry();
});

// ---------------------------------------------------------------------------
// createTelemetrySession
// ---------------------------------------------------------------------------

describe('createTelemetrySession', () => {
  it('erstellt eine Session mit allen Feldern', () => {
    const session = createTelemetrySession(makeConfig());
    expect(session.authorName).toBe('Anna Beispiel');
    expect(session.eventName).toBe('Lesung im Park');
    expect(session.maxQuestions).toBe(10);
    expect(session.audioLevels).toEqual([]);
    expect(session.questions).toEqual([]);
    expect(typeof session.startTime).toBe('number');
    expect(session.id).toMatch(/^session-/);
  });

  it('setzt startTime über die injizierte Uhr (deterministisch)', () => {
    __setTelemetryClock(() => 1000);
    const session = createTelemetrySession(makeConfig());
    expect(session.startTime).toBe(1000);
  });

  it('nutzt Fallback bei leerem authorName/eventName', () => {
    const session = createTelemetrySession(makeConfig({ authorName: '   ', eventName: '' }));
    expect(session.authorName).toBe(DEFAULT_AUTHOR_NAME);
    expect(session.eventName).toBe(DEFAULT_EVENT_NAME);
  });

  it('nutzt Default-maxQuestions bei ungültiger Eingabe', () => {
    const session = createTelemetrySession(makeConfig({ maxQuestions: 0 }));
    expect(session.maxQuestions).toBe(DEFAULT_MAX_QUESTIONS);
  });

  it('vergibt eindeutige Session-IDs', () => {
    const s1 = createTelemetrySession(makeConfig());
    const s2 = createTelemetrySession(makeConfig());
    expect(s1.id).not.toBe(s2.id);
  });
});

// ---------------------------------------------------------------------------
// measureAudioLevel — Akustik-Regeln
// ---------------------------------------------------------------------------

describe('measureAudioLevel', () => {
  it('meldet too-quiet unter 40 dB', () => {
    const session = createTelemetrySession(makeConfig());
    const result = measureAudioLevel(session, 39);
    expect(result.status).toBe('too-quiet');
    expect(result.decibels).toBe(39);
    expect(result.message).toContain('lauter');
  });

  it('meldet optimal im Bereich 40–70 dB', () => {
    const session = createTelemetrySession(makeConfig());
    expect(measureAudioLevel(session, 40).status).toBe('optimal');
    expect(measureAudioLevel(session, 55).status).toBe('optimal');
    expect(measureAudioLevel(session, 70).status).toBe('optimal');
  });

  it('meldet too-loud im Bereich 70–85 dB (exklusiv 70)', () => {
    const session = createTelemetrySession(makeConfig());
    const result = measureAudioLevel(session, 80);
    expect(result.status).toBe('too-loud');
    expect(result.message).toContain('leiser');
    expect(measureAudioLevel(session, 85).status).toBe('too-loud');
  });

  it('meldet muffled über 85 dB', () => {
    const session = createTelemetrySession(makeConfig());
    const result = measureAudioLevel(session, 90);
    expect(result.status).toBe('muffled');
    expect(result.message).toContain('übersteuert');
  });

  it('behandelt NaN defensiv als 0 dB (too-quiet)', () => {
    const session = createTelemetrySession(makeConfig());
    const result = measureAudioLevel(session, NaN);
    expect(result.decibels).toBe(0);
    expect(result.status).toBe('too-quiet');
  });

  it('protokolliert Messungen in der Session', () => {
    const session = createTelemetrySession(makeConfig());
    measureAudioLevel(session, 50);
    measureAudioLevel(session, 30);
    expect(session.audioLevels).toEqual([50, 30]);
  });

  it('behandelt null-Session ohne Absturz', () => {
    // @ts-expect-error — defensive Absicherung zur Laufzeit
    const result = measureAudioLevel(null, 50);
    expect(result.status).toBe('optimal');
  });
});

// ---------------------------------------------------------------------------
// generateDirectorCue
// ---------------------------------------------------------------------------

describe('generateDirectorCue', () => {
  it('liefert null ohne ausreichende Signale', () => {
    const session = createTelemetrySession(makeConfig({ maxQuestions: 100 }));
    measureAudioLevel(session, 50);
    expect(generateDirectorCue(session)).toBeNull();
  });

  it('erzeugt Cue nach genau QUESTIONS_PER_CUE Fragen', () => {
    const session = createTelemetrySession(makeConfig({ maxQuestions: 100 }));
    for (let i = 0; i < QUESTIONS_PER_CUE - 1; i++) {
      submitQuestion(session, `Frage ${i}`, 'Leser');
    }
    expect(generateDirectorCue(session)).toBeNull();

    submitQuestion(session, 'Letzte Frage', 'Leser');
    const cue = generateDirectorCue(session);
    expect(cue).not.toBeNull();
    expect(cue?.kind).toBe('drink-break');
    expect(cue?.message).toBe('[Trinkpause 10s]');
  });

  it('erzeugt Cue nach WARNINGS_PER_CUE Audio-Warnungen', () => {
    const session = createTelemetrySession(makeConfig());
    measureAudioLevel(session, 20); // too-quiet
    measureAudioLevel(session, 95); // muffled
    expect(generateDirectorCue(session)).toBeNull();

    measureAudioLevel(session, 30); // too-quiet → 3. Warnung
    const cue = generateDirectorCue(session);
    expect(cue).not.toBeNull();
    expect(cue?.message).toBe('[Trinkpause 10s]');
  });

  it('ignoriert optimale Werte beim Warnungszähler', () => {
    const session = createTelemetrySession(makeConfig());
    measureAudioLevel(session, 50);
    measureAudioLevel(session, 60);
    measureAudioLevel(session, 40);
    expect(generateDirectorCue(session)).toBeNull();
  });

  it('durchläuft die Cue-Sequenz zyklisch', () => {
    const session = createTelemetrySession(makeConfig({ maxQuestions: 100 }));
    for (let i = 0; i < QUESTIONS_PER_CUE * 3; i++) {
      submitQuestion(session, `Frage ${i}`, 'Leser');
    }
    // 15 Fragen → 3 Meilensteine → Sequenz-Index 2 = slow-down
    const cue = generateDirectorCue(session);
    expect(cue?.kind).toBe('slow-down');
    expect(cue?.message).toBe('[Tempo drosseln]');
    expect(cue?.priority).toBe('high');
  });

  it('liefert null bei null-Session', () => {
    // @ts-expect-error — defensive Absicherung zur Laufzeit
    expect(generateDirectorCue(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// submitQuestion
// ---------------------------------------------------------------------------

describe('submitQuestion', () => {
  it('erstellt eine Frage mit Upvotes 0 und Zeitstempel', () => {
    __setTelemetryClock(() => 42);
    const session = createTelemetrySession(makeConfig());
    const q = submitQuestion(session, 'Wie schreibst du Dialoge?', 'Leser A');
    expect(q.text).toBe('Wie schreibst du Dialoge?');
    expect(q.author).toBe('Leser A');
    expect(q.upvotes).toBe(0);
    expect(q.timestamp).toBe(42);
    expect(q.id).toMatch(/^q-/);
  });

  it('trimmt Fragetext und nutzt Fallback-Autor', () => {
    const session = createTelemetrySession(makeConfig());
    const q = submitQuestion(session, '  Was inspiriert dich?  ', '   ');
    expect(q.text).toBe('Was inspiriert dich?');
    expect(q.author).toBe('Anonym');
  });

  it('respektiert die Kapazität maxQuestions', () => {
    const session = createTelemetrySession(makeConfig({ maxQuestions: 2 }));
    submitQuestion(session, 'Frage 1', 'A');
    submitQuestion(session, 'Frage 2', 'B');
    submitQuestion(session, 'Frage 3', 'C');
    expect(session.questions.length).toBe(2);
  });

  it('vergibt eindeutige Frage-IDs', () => {
    const session = createTelemetrySession(makeConfig());
    const q1 = submitQuestion(session, 'Frage 1', 'A');
    const q2 = submitQuestion(session, 'Frage 2', 'B');
    expect(q1.id).not.toBe(q2.id);
  });
});

// ---------------------------------------------------------------------------
// getTopQuestions
// ---------------------------------------------------------------------------

describe('getTopQuestions', () => {
  it('sortiert nach Upvotes absteigend', () => {
    const session = createTelemetrySession(makeConfig({ maxQuestions: 100 }));
    const a = submitQuestion(session, 'A', 'x');
    const b = submitQuestion(session, 'B', 'y');
    const c = submitQuestion(session, 'C', 'z');
    a.upvotes = 1;
    b.upvotes = 5;
    c.upvotes = 3;

    const top = getTopQuestions(session, 3);
    expect(top.map((q) => q.text)).toEqual(['B', 'C', 'A']);
  });

  it('begrenzt die Anzahl auf limit', () => {
    const session = createTelemetrySession(makeConfig({ maxQuestions: 100 }));
    submitQuestion(session, 'A', 'x');
    submitQuestion(session, 'B', 'y');
    submitQuestion(session, 'C', 'z');
    expect(getTopQuestions(session, 2).length).toBe(2);
  });

  it('ist bei Gleichstand deterministisch (frühere Einreichung zuerst)', () => {
    __setTelemetryClock(() => 100);
    const session = createTelemetrySession(makeConfig({ maxQuestions: 100 }));
    submitQuestion(session, 'Zuerst', 'x');
    __setTelemetryClock(() => 200);
    submitQuestion(session, 'Danach', 'y');
    const top = getTopQuestions(session, 2);
    expect(top.map((q) => q.text)).toEqual(['Zuerst', 'Danach']);
  });

  it('mutiert die Session nicht', () => {
    const session = createTelemetrySession(makeConfig({ maxQuestions: 100 }));
    const a = submitQuestion(session, 'A', 'x');
    submitQuestion(session, 'B', 'y');
    a.upvotes = 9;
    const before = session.questions.map((q) => q.text);
    getTopQuestions(session, 2);
    expect(session.questions.map((q) => q.text)).toEqual(before);
  });

  it('liefert [] bei leerer Session oder limit <= 0', () => {
    const session = createTelemetrySession(makeConfig());
    expect(getTopQuestions(session, 5)).toEqual([]);
    submitQuestion(session, 'A', 'x');
    expect(getTopQuestions(session, 0)).toEqual([]);
    expect(getTopQuestions(session, -1)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// generateQRLink
// ---------------------------------------------------------------------------

describe('generateQRLink', () => {
  it('erzeugt einen https-Link mit Session-ID und Event', () => {
    __setTelemetryClock(() => 0);
    const session = createTelemetrySession(makeConfig());
    const link = generateQRLink(session, 'buehne.example.com');
    expect(link).toBe(`https://buehne.example.com/live/${session.id}?event=Lesung%20im%20Park`);
  });

  it('behält ein vorhandenes Schema und entfernt Slashes', () => {
    const session = createTelemetrySession(makeConfig());
    const link = generateQRLink(session, 'http://192.168.0.10:8080/');
    expect(link.startsWith('http://192.168.0.10:8080/live/')).toBe(true);
  });

  it('nutzt localhost-Fallback bei leerem Host', () => {
    const session = createTelemetrySession(makeConfig());
    const link = generateQRLink(session, '   ');
    expect(link.startsWith(`https://${DEFAULT_QR_HOST}/live/`)).toBe(true);
  });

  it('ist deterministisch für gleiche Session und Host', () => {
    const session = createTelemetrySession(makeConfig());
    expect(generateQRLink(session, 'host.test')).toBe(generateQRLink(session, 'host.test'));
  });
});
