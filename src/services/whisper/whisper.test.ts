// Whisper/Web-Speech: SpeechRecognition-API gemockt (kein Mikrofon/Browser nötig).
// Hinweis: recordAndTranscribe nutzt `window` direkt — Tests stellen window bereit.
import { describe, it, expect, beforeEach } from "vitest";
import {
  recordAndTranscribe,
  stopRecording,
  listTranscriptions,
  updateTranscriptionText,
  deleteTranscription,
  normalizeWhisperLanguage,
  assemblePartialTranscripts,
  isTransientWhisperError,
} from "@/services/whisper";

class FakeRecognition {
  lang = "";
  interimResults = false;
  continuous = false;
  maxAlternatives = 0;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;
  started = false;
  stopped = false;
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
  abort() {}
}

function withSpeechApi(cls: unknown) {
  (globalThis as any).window = { SpeechRecognition: cls, webkitSpeechRecognition: undefined };
}

const tick = (ms = 5) => new Promise<void>((r) => setTimeout(r, ms));

beforeEach(() => {
  FakeRecognition.instances = [];
  delete (globalThis as any).window;
  stopRecording();
});

describe("recordAndTranscribe", () => {
  it("rejected ohne Web Speech API", async () => {
    withSpeechApi(undefined);
    await expect(recordAndTranscribe({}, null, () => {})).rejects.toThrow("nicht unterstützt");
  });

  it("liefert Transkript bei onresult und setzt Sprache (BCP-47)", async () => {
    withSpeechApi(FakeRecognition);
    const statuses: string[] = [];
    const p = recordAndTranscribe({ language: "de" }, "ch1", (s) => statuses.push(s));
    const inst = FakeRecognition.instances[FakeRecognition.instances.length - 1]!;
    expect(inst.started).toBe(true);
    expect(inst.lang).toBe("de-DE");
    inst.onresult?.({ results: [[{ transcript: "Hallo Welt" }]] });
    await expect(p).resolves.toBe("Hallo Welt");
    expect(statuses).toContain("Transkribiert");
  });

  it("rejected bei Erkennungsfehler", async () => {
    withSpeechApi(FakeRecognition);
    const p = recordAndTranscribe({}, null, () => {}, { maxRetries: 0, timeoutMs: 1000 });
    const assertion = expect(p).rejects.toThrow("no-speech");
    const inst = FakeRecognition.instances[FakeRecognition.instances.length - 1]!;
    inst.onerror?.({ error: "no-speech" });
    await assertion;
  });

  it("stopRecording beendet aktive Erkennung", () => {
    withSpeechApi(FakeRecognition);
    // Promise bleibt pending — bewusst nicht awaited (kein Event nötig für stop-Test);
    // catch angehängt, damit der Timeout-Guard keine unhandled rejection erzeugt.
    void recordAndTranscribe({}, null, () => {}, { timeoutMs: 1000 }).catch(() => {});
    const inst = FakeRecognition.instances[FakeRecognition.instances.length - 1]!;
    stopRecording();
    expect(inst.stopped).toBe(true);
    // Zweiter Aufruf ohne aktive Erkennung: No-op
    expect(() => stopRecording()).not.toThrow();
  });
});

describe("transcript-editor no-ops", () => {
  it("listTranscriptions ist leer (Session-basiert)", () => {
    expect(listTranscriptions(null)).toEqual([]);
    expect(listTranscriptions("ch1")).toEqual([]);
  });

  it("update/delete sind No-ops und resolven", async () => {
    await expect(updateTranscriptionText("x", "neu")).resolves.toBeUndefined();
    await expect(deleteTranscription("x")).resolves.toBeUndefined();
  });
});

describe("normalizeWhisperLanguage (Sprach-Passthrough)", () => {
  it("mappt Kurzcodes auf BCP-47", () => {
    expect(normalizeWhisperLanguage("de")).toBe("de-DE");
    expect(normalizeWhisperLanguage("en")).toBe("en-US");
    expect(normalizeWhisperLanguage("fr")).toBe("fr-FR");
  });

  it("reicht qualifizierte Tags unverändert durch", () => {
    expect(normalizeWhisperLanguage("en-US")).toBe("en-US");
    expect(normalizeWhisperLanguage("de-DE")).toBe("de-DE");
  });

  it("normalisiert Underscore und Casing", () => {
    expect(normalizeWhisperLanguage("de_DE")).toBe("de-DE");
    expect(normalizeWhisperLanguage("EN-us")).toBe("en-US");
  });

  it("fällt bei leer/ungültig auf Default zurück", () => {
    expect(normalizeWhisperLanguage(undefined)).toBe("de-DE");
    expect(normalizeWhisperLanguage("")).toBe("de-DE");
    expect(normalizeWhisperLanguage("!!!")).toBe("de-DE");
  });

  it("setzt recognition.lang aus Settings via Passthrough", async () => {
    withSpeechApi(FakeRecognition);
    const p = recordAndTranscribe({ language: "en" }, null, () => {}, { timeoutMs: 1000 });
    expect(FakeRecognition.instances[0]!.lang).toBe("en-US");
    FakeRecognition.instances[0]!.onresult?.({ results: [[{ transcript: "hi" }]] });
    await expect(p).resolves.toBe("hi");
  });
});

describe("isTransientWhisperError", () => {
  it("transiente Codes sind retrybar", () => {
    expect(isTransientWhisperError("network")).toBe(true);
    expect(isTransientWhisperError("audio-capture")).toBe(true);
    expect(isTransientWhisperError("no-speech")).toBe(true);
  });

  it("permanente Codes sind nicht retrybar", () => {
    expect(isTransientWhisperError("not-allowed")).toBe(false);
    expect(isTransientWhisperError("service-not-allowed")).toBe(false);
    expect(isTransientWhisperError("bad-grammar")).toBe(false);
    expect(isTransientWhisperError(undefined)).toBe(false);
    expect(isTransientWhisperError("")).toBe(false);
  });
});

describe("retry mit Backoff", () => {
  it("wiederholt nach transientem Fehler und liefert Transkript", async () => {
    withSpeechApi(FakeRecognition);
    const statuses: string[] = [];
    const p = recordAndTranscribe({ language: "de" }, null, (s) => statuses.push(s), {
      maxRetries: 2,
      retryDelayMs: 0,
      timeoutMs: 2000,
    });
    FakeRecognition.instances[0]!.onerror?.({ error: "network" });
    await tick(10);
    expect(FakeRecognition.instances.length).toBe(2);
    expect(statuses.some((s) => s.includes("Wiederholung"))).toBe(true);
    FakeRecognition.instances[1]!.onresult?.({ results: [[{ transcript: "Zweiter Versuch" }]] });
    await expect(p).resolves.toBe("Zweiter Versuch");
  });

  it("kein Retry bei permanentem Fehler", async () => {
    withSpeechApi(FakeRecognition);
    const p = recordAndTranscribe({}, null, () => {}, { maxRetries: 3, retryDelayMs: 0, timeoutMs: 2000 });
    const assertion = expect(p).rejects.toThrow("not-allowed");
    FakeRecognition.instances[0]!.onerror?.({ error: "not-allowed" });
    await tick(10);
    expect(FakeRecognition.instances.length).toBe(1);
    await assertion;
  });

  it("gibt nach ausgeschöpften Retries auf", async () => {
    withSpeechApi(FakeRecognition);
    const p = recordAndTranscribe({}, null, () => {}, { maxRetries: 1, retryDelayMs: 0, timeoutMs: 2000 });
    const assertion = expect(p).rejects.toThrow("network");
    FakeRecognition.instances[0]!.onerror?.({ error: "network" });
    await tick(10);
    expect(FakeRecognition.instances.length).toBe(2);
    FakeRecognition.instances[1]!.onerror?.({ error: "network" });
    await tick(10);
    expect(FakeRecognition.instances.length).toBe(2);
    await assertion;
  });

  it("maxRetries 0 bedeutet kein einziger Wiederholungsversuch", async () => {
    withSpeechApi(FakeRecognition);
    const p = recordAndTranscribe({}, null, () => {}, { maxRetries: 0, retryDelayMs: 0, timeoutMs: 2000 });
    const assertion = expect(p).rejects.toThrow("network");
    FakeRecognition.instances[0]!.onerror?.({ error: "network" });
    await tick(10);
    expect(FakeRecognition.instances.length).toBe(1);
    await assertion;
  });

  it("start()-Exception triggert Retry", async () => {
    let calls = 0;
    class Flaky {
      lang = "";
      interimResults = false;
      continuous = false;
      onresult: any = null;
      onerror: any = null;
      onend: any = null;
      onstart: any = null;
      constructor() {
        calls += 1;
        if (calls === 1) {
          throw new Error("start failed");
        }
      }
      start() {
        queueMicrotask(() => this.onresult?.({ results: [[{ transcript: "nach Startfehler" }]] }));
      }
      stop() {}
      abort() {}
    }
    (globalThis as any).window = { SpeechRecognition: Flaky, webkitSpeechRecognition: undefined };
    const p = recordAndTranscribe({}, null, () => {}, { maxRetries: 2, retryDelayMs: 0, timeoutMs: 2000 });
    await expect(p).resolves.toBe("nach Startfehler");
  });
});

describe("assemblePartialTranscripts", () => {
  it("fügt Teilstücke mit Leerzeichen zusammen", () => {
    expect(assemblePartialTranscripts(["Hallo", "Welt"])).toBe("Hallo Welt");
  });

  it("filtert Leerstrings und trimmt", () => {
    expect(assemblePartialTranscripts(["  Hallo  ", "", "   ", "Welt "])).toBe("Hallo Welt");
  });

  it("leeres Array ergibt leeren String", () => {
    expect(assemblePartialTranscripts([])).toBe("");
  });
});

describe("partial assembly im Continuous-Modus", () => {
  it("sammelt mehrere finale onresult-Events bis onend", async () => {
    withSpeechApi(FakeRecognition);
    const statuses: string[] = [];
    const p = recordAndTranscribe({}, null, (s) => statuses.push(s), {
      continuous: true,
      retryDelayMs: 0,
      timeoutMs: 2000,
    });
    const inst = FakeRecognition.instances[0]!;
    expect(inst.continuous).toBe(true);
    expect(inst.interimResults).toBe(true);
    inst.onresult?.({ results: [{ 0: { transcript: "Erster Satz." }, isFinal: true }] });
    inst.onresult?.({ results: [{ 0: { transcript: "Zweiter Satz." }, isFinal: true }] });
    inst.onend?.();
    await expect(p).resolves.toBe("Erster Satz. Zweiter Satz.");
    expect(statuses).toContain("Transkribiert");
  });

  it("ignoriert Interim-Ergebnisse bei der Assembly", async () => {
    withSpeechApi(FakeRecognition);
    const p = recordAndTranscribe({}, null, () => {}, {
      continuous: true,
      retryDelayMs: 0,
      timeoutMs: 2000,
    });
    const inst = FakeRecognition.instances[0]!;
    inst.onresult?.({ results: [{ 0: { transcript: "halb" }, isFinal: false }] });
    inst.onresult?.({ results: [{ 0: { transcript: "fertig" }, isFinal: true }] });
    inst.onend?.();
    await expect(p).resolves.toBe("fertig");
  });

  it("onend ohne Ergebnis rejected sauber statt zu hängen", async () => {
    withSpeechApi(FakeRecognition);
    const p = recordAndTranscribe({}, null, () => {}, {
      continuous: true,
      maxRetries: 0,
      retryDelayMs: 0,
      timeoutMs: 2000,
    });
    const assertion = expect(p).rejects.toThrow("kein Transkript");
    FakeRecognition.instances[0]!.onend?.();
    await assertion;
  });
});

describe("timeout guard", () => {
  it("rejected bei Zeitüberschreitung ohne Ergebnis", async () => {
    withSpeechApi(FakeRecognition);
    const p = recordAndTranscribe({}, null, () => {}, { timeoutMs: 20, retryDelayMs: 0, maxRetries: 0 });
    await expect(p).rejects.toThrow("Zeitüberschreitung");
  });

  it("erfolg vor Timeout löst normal auf", async () => {
    withSpeechApi(FakeRecognition);
    const p = recordAndTranscribe({}, null, () => {}, { timeoutMs: 2000, retryDelayMs: 0 });
    FakeRecognition.instances[0]!.onresult?.({ results: [[{ transcript: "schnell" }]] });
    await expect(p).resolves.toBe("schnell");
  });
});
