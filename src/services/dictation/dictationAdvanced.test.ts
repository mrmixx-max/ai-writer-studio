// WP 9.2 (Advanced) — Diktat-Interpunktion & Audiopuffer.
//
// Ergänzt dictationService.test.ts um 10 gezielte Fälle: Absatz-/Zeilenbefehle,
// deutsche Anführungszeichen, Gedankenstrich, Verwerfen leerer Audiopuffer
// sowie die gesprochenen Satzzeichen. Nutzt ausschließlich die bestehenden
// Funktionen aus ./dictationService; alle Browser-APIs werden per Fakes
// injiziert — kein Mikrofon, kein Netzwerk, kein LLM.
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normalizeSpokenText,
  startDictation,
  resetDictationState,
  isMeaningfulAudioChunk,
} from "./dictationService";
import type {
  SpeechRecognitionLike,
  MediaRecorderLike,
  MediaStreamLike,
} from "./dictationService";

// ---------------------------------------------------------------------------
// Fakes (bewusst lokal, damit die Datei eigenständig bleibt)
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
}

class FakeRecorder implements MediaRecorderLike {
  state = "inactive";
  ondataavailable: ((e: { data?: unknown }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  started = false;
  stopped = false;
  start() {
    this.started = true;
    this.state = "recording";
  }
  stop() {
    this.stopped = true;
    this.state = "inactive";
  }
  /** Simuliert ein ondataavailable-Event des MediaRecorders. */
  emitData(data: unknown) {
    this.ondataavailable?.({ data });
  }
}

function makeStream(): MediaStreamLike {
  return { getTracks: () => [{ stop: vi.fn() }] };
}

const tick = (ms = 5) => new Promise<void>((r) => setTimeout(r, ms));

beforeEach(() => {
  resetDictationState();
  FakeRecognition.instances = [];
});

describe("Diktat-Interpunktion & Audiopuffer (Advanced)", () => {
  // 1.
  it("'neue Zeile' → \\n, 'neuer Absatz' → doppeltes \\n", () => {
    expect(normalizeSpokenText("Erste Zeile Neue Zeile Zweite Zeile")).toBe(
      "Erste Zeile\nZweite Zeile",
    );
    expect(normalizeSpokenText("Erster Absatz Neuer Absatz Zweiter Absatz")).toBe(
      "Erster Absatz\n\nZweiter Absatz",
    );
  });

  // 2.
  it("gesprochene Anführungszeichen ergeben deutsche „Hallo Welt“", () => {
    expect(
      normalizeSpokenText("Anführungszeichen unten Hallo Welt Anführungszeichen oben"),
    ).toBe("„Hallo Welt“");
  });

  // 3.
  it("'Gedankenstrich' wird zum Em-Dash — statt Bindestrich -", () => {
    expect(normalizeSpokenText("Gedankenstrich")).toBe("—");
    const inline = normalizeSpokenText("Hallo Gedankenstrich Welt");
    expect(inline).toContain("—");
    expect(inline).not.toContain("-");
    expect(inline).toBe("Hallo— Welt");
  });

  // 4.
  it("stille/leere Audiopuffer werden lautlos verworfen", async () => {
    // Reine Prüf-Logik: leere Varianten enthalten kein Audio.
    expect(isMeaningfulAudioChunk(null)).toBe(false);
    expect(isMeaningfulAudioChunk(undefined)).toBe(false);
    expect(isMeaningfulAudioChunk("")).toBe(false);
    expect(isMeaningfulAudioChunk({ size: 0 })).toBe(false);
    expect(isMeaningfulAudioChunk(new Uint8Array(0))).toBe(false);
    // Echte Daten bleiben erhalten.
    expect(isMeaningfulAudioChunk({ size: 8 })).toBe(true);
    expect(isMeaningfulAudioChunk(new Uint8Array([1, 2, 3]))).toBe(true);

    // Integration: leere Puffer an den Recorder → kein Fehler (lautlos).
    const errors: Error[] = [];
    let recorder!: FakeRecorder;
    startDictation(() => {}, {
      createRecognition: () => new FakeRecognition(),
      getUserMedia: async () => makeStream(),
      createRecorder: () => (recorder = new FakeRecorder()),
      onError: (e) => errors.push(e),
    });
    await tick();
    expect(() => {
      recorder.emitData(null);
      recorder.emitData(undefined);
      recorder.emitData({ size: 0 });
      recorder.emitData(new Uint8Array(0));
    }).not.toThrow();
    expect(errors).toEqual([]);
  });

  // 5.
  it("'Punkt' am Satzende ergibt einen echten Punkt", () => {
    expect(normalizeSpokenText("Das ist ein ganzer Satz Punkt")).toBe(
      "Das ist ein ganzer Satz.",
    );
  });

  // 6.
  it("'Komma' mitten im Satz ergibt ein echtes Komma", () => {
    expect(normalizeSpokenText("Hallo Komma Welt")).toBe("Hallo, Welt");
  });

  // 7.
  it("'Fragezeichen' ergibt ein echtes Fragezeichen", () => {
    expect(normalizeSpokenText("Wie geht es dir Fragezeichen")).toBe(
      "Wie geht es dir?",
    );
  });

  // 8.
  it("'Ausrufezeichen' ergibt ein echtes Ausrufezeichen", () => {
    expect(normalizeSpokenText("Los Ausrufezeichen")).toBe("Los!");
  });

  // 9.
  it("mehrere gesprochene Satzzeichen hintereinander werden kombiniert", () => {
    expect(normalizeSpokenText("Wirklich Fragezeichen Ausrufezeichen")).toBe(
      "Wirklich?!",
    );
    expect(normalizeSpokenText("Achtung Komma jetzt Punkt")).toBe(
      "Achtung, jetzt.",
    );
  });

  // 10.
  it("Text ohne gesprochene Satzzeichen bleibt unverändert", () => {
    expect(normalizeSpokenText("Ein ganz normaler Satz.")).toBe(
      "Ein ganz normaler Satz.",
    );
    expect(normalizeSpokenText("Die Punkte sind gesetzt")).toBe(
      "Die Punkte sind gesetzt",
    );
  });
});
