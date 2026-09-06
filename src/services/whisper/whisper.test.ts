// Whisper/Web-Speech: SpeechRecognition-API gemockt (kein Mikrofon/Browser nötig).
// Hinweis: recordAndTranscribe nutzt `window` direkt — Tests stellen window bereit.
import { describe, it, expect, beforeEach } from "vitest";
import {
  recordAndTranscribe,
  stopRecording,
  listTranscriptions,
  updateTranscriptionText,
  deleteTranscription,
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

  it("liefert Transkript bei onresult und setzt Sprache", async () => {
    withSpeechApi(FakeRecognition);
    const statuses: string[] = [];
    const p = recordAndTranscribe({ language: "de" }, "ch1", (s) => statuses.push(s));
    const inst = FakeRecognition.instances[FakeRecognition.instances.length - 1]!;
    expect(inst.started).toBe(true);
    expect(inst.lang).toBe("DE");
    inst.onresult?.({ results: [[{ transcript: "Hallo Welt" }]] });
    await expect(p).resolves.toBe("Hallo Welt");
    expect(statuses).toContain("Transkribiert");
  });

  it("rejected bei Erkennungsfehler", async () => {
    withSpeechApi(FakeRecognition);
    const p = recordAndTranscribe({}, null, () => {});
    const inst = FakeRecognition.instances[FakeRecognition.instances.length - 1]!;
    inst.onerror?.({ error: "no-speech" });
    await expect(p).rejects.toThrow("no-speech");
  });

  it("stopRecording beendet aktive Erkennung", () => {
    withSpeechApi(FakeRecognition);
    // Promise bleibt pending — bewusst nicht awaited (kein Event nötig für stop-Test)
    void recordAndTranscribe({}, null, () => {});
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
