// WP 9.2 — Tests für den Diktat-Service (lokal, deterministisch, LLM-frei).
//
// Alle Browser-APIs (SpeechRecognition, MediaRecorder, getUserMedia) werden
// injiziert bzw. durch Fakes ersetzt — es wird kein Mikrofon, kein Netzwerk
// und kein LLM benötigt. Läuft im node-Environment (siehe vitest.config.ts).
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  normalizeSpokenText,
  joinTranscript,
  startDictation,
  stopDictation,
  insertAtCursor,
  resetDictationState,
  SPOKEN_PUNCTUATION_MAP,
  DEFAULT_DICTATION_LANGUAGE,
} from "./dictationService";
import type { SpeechRecognitionLike, MediaRecorderLike, MediaStreamLike } from "./dictationService";

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

class FakeRecognition implements SpeechRecognitionLike {
  lang = "";
  interimResults = false;
  continuous = false;
  maxAlternatives = 0;
  onstart: (() => void) | null = null;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  stopped = false;
  aborted = false;
  static instances: FakeRecognition[] = [];
  constructor() {
    FakeRecognition.instances.push(this);
  }
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
  abort() {
    this.aborted = true;
  }
  /** Simuliert ein finales Ergebnis-Event. */
  emitFinal(transcript: string) {
    this.onresult?.({ results: [{ 0: { transcript }, isFinal: true }] });
  }
  /** Simuliert ein Interim-Ergebnis-Event. */
  emitInterim(transcript: string) {
    this.onresult?.({ results: [{ 0: { transcript }, isFinal: false }] });
  }
  /** Simuliert das Ende der Erkennung (löst stopDictation aus). */
  emitEnd() {
    this.onend?.();
  }
  last(): FakeRecognition {
    return FakeRecognition.instances[FakeRecognition.instances.length - 1]!;
  }
}

class FakeRecorder implements MediaRecorderLike {
  state = "inactive";
  ondataavailable: ((e: { data?: unknown }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  started = false;
  stopped = false;
  constructor(public stream: MediaStreamLike) {}
  start() {
    this.started = true;
    this.state = "recording";
  }
  stop() {
    this.stopped = true;
    this.state = "inactive";
  }
}

function makeStream(): MediaStreamLike & { tracks: { stop: () => void }[] } {
  const tracks = [{ stop: vi.fn() }];
  return { getTracks: () => tracks, tracks };
}

const tick = (ms = 5) => new Promise<void>((r) => setTimeout(r, ms));

beforeEach(() => {
  resetDictationState();
  FakeRecognition.instances = [];
});

// ---------------------------------------------------------------------------
// 1) normalizeSpokenText
// ---------------------------------------------------------------------------

describe("normalizeSpokenText", () => {
  it("wandelt 'Punkt' in einen echten Punkt um (ohne Leerzeichen davor)", () => {
    expect(normalizeSpokenText("Hallo Welt Punkt")).toBe("Hallo Welt.");
  });

  it("wandelt 'Komma' in ein Komma um", () => {
    expect(normalizeSpokenText("Hallo Komma Welt")).toBe("Hallo, Welt");
  });

  it("wandelt 'Fragezeichen' und 'Ausrufezeichen' um", () => {
    expect(normalizeSpokenText("Wie geht es dir Fragezeichen")).toBe("Wie geht es dir?");
    expect(normalizeSpokenText("Los Ausrufezeichen")).toBe("Los!");
  });

  it("wandelt 'Neue Zeile' in einen Zeilenumbruch um", () => {
    expect(normalizeSpokenText("Zeile eins Neue Zeile Zeile zwei")).toBe(
      "Zeile eins\nZeile zwei",
    );
  });

  it("erkennt Satzzeichen case-insensitiv und bei bereits vorhandenem Glyph", () => {
    expect(normalizeSpokenText("Ende punkt")).toBe("Ende.");
    expect(normalizeSpokenText("Ende Punkt.")).toBe("Ende.");
    expect(normalizeSpokenText("Halt AUSRUFEZEICHEN!")).toBe("Halt!");
  });

  it("lässt Wortbestandteile unangetastet (Wortgrenze)", () => {
    expect(normalizeSpokenText("Die Punkte sind gesetzt")).toBe("Die Punkte sind gesetzt");
    expect(normalizeSpokenText("kommando")).toBe("kommando");
  });

  it("mehrere gesprochene Satzzeichen in einem Satz", () => {
    expect(normalizeSpokenText("Achtung Komma jetzt Punkt")).toBe("Achtung, jetzt.");
  });

  it("ist deterministisch und idempotent", () => {
    const once = normalizeSpokenText("Hallo Komma Welt Punkt");
    expect(normalizeSpokenText("Hallo Komma Welt Punkt")).toBe(once);
    expect(normalizeSpokenText(once)).toBe(once);
  });

  it("defensiver Fallback: Nicht-String / leer ergibt leeren String", () => {
    expect(normalizeSpokenText(undefined as unknown as string)).toBe("");
    expect(normalizeSpokenText(null as unknown as string)).toBe("");
    expect(normalizeSpokenText("")).toBe("");
    expect(normalizeSpokenText(42 as unknown as string)).toBe("");
  });

  it("Text ohne gesprochene Satzzeichen bleibt unverändert", () => {
    expect(normalizeSpokenText("Ein ganz normaler Satz.")).toBe("Ein ganz normaler Satz.");
  });

  it("exponiert die Zuordnungstabelle mit den fünf geforderten Einträgen", () => {
    const map = Object.fromEntries(SPOKEN_PUNCTUATION_MAP.map((e) => [e.spoken, e.glyph]));
    expect(map).toMatchObject({
      punkt: ".",
      komma: ",",
      fragezeichen: "?",
      ausrufezeichen: "!",
      "neue zeile": "\n",
    });
  });
});

// ---------------------------------------------------------------------------
// 2) joinTranscript
// ---------------------------------------------------------------------------

describe("joinTranscript", () => {
  it("hängt Sätze mit Leerzeichen an", () => {
    expect(joinTranscript("Hallo", "Welt")).toBe("Hallo Welt");
  });

  it("setzt vor Satzzeichen kein Leerzeichen", () => {
    expect(joinTranscript("Hallo", ". Weiter")).toBe("Hallo. Weiter");
  });

  it("gibt bei leerem Start das Stück direkt zurück", () => {
    expect(joinTranscript("", "Hallo")).toBe("Hallo");
    expect(joinTranscript("Hallo", "")).toBe("Hallo");
  });
});

// ---------------------------------------------------------------------------
// 3) startDictation / stopDictation
// ---------------------------------------------------------------------------

describe("startDictation / stopDictation", () => {
  it("startet die Spracherkennung und setzt Sprache/Modus", () => {
    startDictation(() => {}, { createRecognition: () => new FakeRecognition() });
    const rec = FakeRecognition.instances[0]!;
    expect(rec.started).toBe(true);
    expect(rec.lang).toBe(DEFAULT_DICTATION_LANGUAGE);
    expect(rec.interimResults).toBe(true);
    expect(rec.continuous).toBe(true);
  });

  it("liefert das gesamte Transkript bei stopDictation (nach onend)", async () => {
    startDictation(() => {}, { createRecognition: () => new FakeRecognition() });
    const rec = FakeRecognition.instances[0]!;
    rec.emitFinal("Erster Satz.");
    rec.emitFinal("Zweiter Satz.");
    const p = stopDictation();
    rec.emitEnd();
    await expect(p).resolves.toBe("Erster Satz. Zweiter Satz.");
  });

  it("normalisiert gesprochene Satzzeichen im Transkript", async () => {
    startDictation(() => {}, { createRecognition: () => new FakeRecognition() });
    const rec = FakeRecognition.instances[0]!;
    rec.emitFinal("Hallo Welt Punkt");
    const p = stopDictation();
    rec.emitEnd();
    await expect(p).resolves.toBe("Hallo Welt.");
  });

  it("ruft den Callback pro finalem Segment (Delta) auf, nicht für Interim", () => {
    const received: string[] = [];
    startDictation((t) => received.push(t), { createRecognition: () => new FakeRecognition() });
    const rec = FakeRecognition.instances[0]!;
    rec.emitInterim("halb");
    expect(received).toEqual([]);
    rec.emitFinal("Fertig.");
    expect(received).toEqual(["Fertig."]);
    rec.emitFinal("Noch was.");
    expect(received).toEqual(["Fertig.", "Noch was."]);
  });

  it("stopDictation ohne aktive Sitzung ergibt leeren String", async () => {
    await expect(stopDictation()).resolves.toBe("");
  });

  it("stopDictation stoppt die Erkennung und wartet auf onend", async () => {
    startDictation(() => {}, { createRecognition: () => new FakeRecognition() });
    const rec = FakeRecognition.instances[0]!;
    rec.emitFinal("Text");
    const p = stopDictation();
    expect(rec.stopped).toBe(true);
    rec.emitEnd();
    await expect(p).resolves.toBe("Text");
  });

  it("resolvet per Sicherheits-Timeout, wenn onend nie feuert", async () => {
    startDictation(() => {}, {
      createRecognition: () => new FakeRecognition(),
      stopTimeoutMs: 20,
    });
    const rec = FakeRecognition.instances[0]!;
    rec.emitFinal("Ohne Ende");
    await expect(stopDictation()).resolves.toBe("Ohne Ende");
  });

  it("defensiv: fehlende Spracherkennung → kein Absturz, leeres Ergebnis", async () => {
    const statuses: string[] = [];
    startDictation(() => {}, { createRecognition: () => null, onStatus: (s) => statuses.push(s) });
    expect(statuses).toContain("Spracherkennung nicht unterstützt");
    await expect(stopDictation()).resolves.toBe("");
  });

  it("defensiv: werfender Callback bricht die Sitzung nicht", async () => {
    startDictation(
      () => {
        throw new Error("Callback kaputt");
      },
      { createRecognition: () => new FakeRecognition() },
    );
    const rec = FakeRecognition.instances[0]!;
    expect(() => rec.emitFinal("Trotzdem")).not.toThrow();
    const p = stopDictation();
    rec.emitEnd();
    await expect(p).resolves.toBe("Trotzdem");
  });

  it("defensiv: werfender onError-Callback wird abgefangen", () => {
    startDictation(() => {}, {
      createRecognition: () => new FakeRecognition(),
      onError: () => {
        throw new Error("onError kaputt");
      },
    });
    const rec = FakeRecognition.instances[0]!;
    expect(() => rec.onerror?.({ error: "not-allowed" })).not.toThrow();
  });

  it("startet eine neue Sitzung, ohne die vorherige hängen zu lassen", async () => {
    startDictation(() => {}, { createRecognition: () => new FakeRecognition() });
    const first = FakeRecognition.instances[0]!;
    startDictation(() => {}, { createRecognition: () => new FakeRecognition() });
    const second = FakeRecognition.instances[1]!;
    expect(second).not.toBe(first);
    // Nur die zweite (aktive) Sitzung liefert das Transkript.
    second.emitFinal("Neu");
    const p = stopDictation();
    second.emitEnd();
    await expect(p).resolves.toBe("Neu");
  });
});

// ---------------------------------------------------------------------------
// 4) MediaRecorder (parallel, defensiv)
// ---------------------------------------------------------------------------

describe("startDictation — Audio-Recording", () => {
  it("startet den MediaRecorder, wenn getUserMedia verfügbar ist", async () => {
    const stream = makeStream();
    const recorder = new FakeRecorder(stream);
    startDictation(() => {}, {
      createRecognition: () => new FakeRecognition(),
      getUserMedia: async () => stream,
      createRecorder: () => recorder,
    });
    await tick();
    expect(recorder.started).toBe(true);
  });

  it("stoppt Recorder und Mikrofon-Tracks bei stopDictation", async () => {
    const stream = makeStream();
    const recorder = new FakeRecorder(stream);
    startDictation(() => {}, {
      createRecognition: () => new FakeRecognition(),
      getUserMedia: async () => stream,
      createRecorder: () => recorder,
      stopTimeoutMs: 20,
    });
    await tick();
    await stopDictation();
    expect(recorder.stopped).toBe(true);
    expect(stream.tracks[0]!.stop).toHaveBeenCalled();
  });

  it("läuft per Spracherkennung weiter, wenn getUserMedia fehlt", async () => {
    startDictation(() => {}, {
      createRecognition: () => new FakeRecognition(),
      // kein getUserMedia → kein Recorder, aber kein Fehler
    });
    const rec = FakeRecognition.instances[0]!;
    expect(rec.started).toBe(true);
    rec.emitFinal("Ohne Recorder");
    const p = stopDictation();
    rec.emitEnd();
    await expect(p).resolves.toBe("Ohne Recorder");
  });

  it("meldet getUserMedia-Fehler, ohne die Transkription zu beenden", async () => {
    const errors: Error[] = [];
    startDictation(() => {}, {
      createRecognition: () => new FakeRecognition(),
      getUserMedia: async () => {
        throw new Error("NotAllowedError");
      },
      onError: (e) => errors.push(e),
    });
    await tick();
    expect(errors.some((e) => e.message.includes("NotAllowedError"))).toBe(true);
    const rec = FakeRecognition.instances[0]!;
    rec.emitFinal("Trotzdem da");
    const p = stopDictation();
    rec.emitEnd();
    await expect(p).resolves.toBe("Trotzdem da");
  });
});

// ---------------------------------------------------------------------------
// 5) insertAtCursor
// ---------------------------------------------------------------------------

describe("insertAtCursor", () => {
  it("fügt via TipTap-Chain an der Cursorposition ein", () => {
    const calls: string[] = [];
    const chain = {
      focus: () => {
        calls.push("focus");
        return chain;
      },
      insertContent: (t: string) => {
        calls.push(`insert:${t}`);
        return chain;
      },
      run: () => {
        calls.push("run");
        return undefined;
      },
    };
    const editor = { chain: () => chain };
    insertAtCursor(editor, "Hallo");
    expect(calls).toEqual(["focus", "insert:Hallo", "run"]);
  });

  it("nutzt eine direkte insertContent-Methode", () => {
    const insertContent = vi.fn();
    insertAtCursor({ insertContent }, "Text");
    expect(insertContent).toHaveBeenCalledWith("Text");
  });

  it("fügt in ein Textfeld an der Auswahlposition ein und setzt den Cursor", () => {
    const field: {
      value: string;
      selectionStart: number;
      selectionEnd: number;
      setSelectionRange: (s: number, e: number) => void;
    } = {
      value: "Hallo Welt",
      selectionStart: 5,
      selectionEnd: 5,
      setSelectionRange: vi.fn(),
    };
    insertAtCursor(field, ",");
    expect(field.value).toBe("Hallo, Welt");
    expect(field.setSelectionRange).toHaveBeenCalledWith(6, 6);
  });

  it("ersetzt eine bestehende Auswahl im Textfeld", () => {
    const field = {
      value: "Hallo Welt",
      selectionStart: 6,
      selectionEnd: 10,
      setSelectionRange: vi.fn(),
    };
    insertAtCursor(field, "Du");
    expect(field.value).toBe("Hallo Du");
  });

  it("defensiv: null-Editor, leerer Text und werfende Methoden sind No-ops", () => {
    expect(() => insertAtCursor(null, "Text")).not.toThrow();
    expect(() => insertAtCursor(undefined, "Text")).not.toThrow();
    expect(() => insertAtCursor({}, "")).not.toThrow();
    expect(() => insertAtCursor({ insertContent: undefined }, "Text")).not.toThrow();
    expect(() =>
      insertAtCursor(
        {
          chain: () => {
            throw new Error("kaputt");
          },
        },
        "Text",
      ),
    ).not.toThrow();
  });
});
