// Tests: Voice-Lab-Engine (Sprint 20, Agent 2) — Transkription (gemocktes
// fetch), Aufnahme (gemockter MediaRecorder), Export (TXT/SRT/VTT).
import { describe, it, expect, vi, type Mock } from "vitest";
import {
  transcribeAudio,
  startRecording,
  stopRecording,
  exportTranscription,
  formatSrtTimestamp,
  formatVttTimestamp,
  punctuate,
  type TranscriptionResult,
  type VoiceLabConfig,
} from "./voiceLab";

const CONFIG: VoiceLabConfig = {
  language: "de",
  model: "whisper-1",
  autoPunctuate: false,
  speakerDiarization: false,
};

const RESULT: TranscriptionResult = {
  text: "Hallo Welt. Zweiter Satz.",
  segments: [
    { start: 0, end: 1.5, text: "Hallo Welt." },
    { start: 1.5, end: 3.25, text: "Zweiter Satz." },
  ],
  language: "de",
  duration: 3.25,
};

function mockFetchJson(payload: unknown, ok = true, status = 200): Mock {
  return vi.fn(async () => ({
    ok,
    status,
    json: async () => payload,
    text: async () => (typeof payload === "string" ? payload : JSON.stringify(payload)),
  })) as unknown as Mock;
}

function asFetch(fn: Mock): typeof fetch {
  return fn as unknown as typeof fetch;
}

describe("transcribeAudio", () => {
  it("mockt fetch und liefert ein TranscriptionResult", async () => {
    const fetchFn = mockFetchJson({
      text: "Hallo Welt. Zweiter Satz.",
      language: "de",
      duration: 3.25,
      segments: [
        { start: 0, end: 1.5, text: "Hallo Welt." },
        { start: 1.5, end: 3.25, text: "Zweiter Satz." },
      ],
    });
    const blob = new Blob(["audio"], { type: "audio/webm" });
    const result = await transcribeAudio(blob, CONFIG, { fetchFn: asFetch(fetchFn) });

    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/v1/audio/transcriptions");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect(result.text).toBe("Hallo Welt. Zweiter Satz.");
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]).toMatchObject({ start: 0, end: 1.5 });
    expect(result.language).toBe("de");
    expect(result.duration).toBe(3.25);
  });

  it("wirft einen Fehler bei HTTP-Fehlerstatus", async () => {
    const fetchFn = mockFetchJson("model not found", false, 500);
    await expect(
      transcribeAudio(new Blob(["x"]), CONFIG, { fetchFn: asFetch(fetchFn) }),
    ).rejects.toThrow("HTTP 500");
  });

  it("baut Text aus Segmenten, wenn text fehlt, und wendet Optionen an", async () => {
    const fetchFn = mockFetchJson({
      segments: [
        { start: 0, end: 1, text: "hallo welt" },
        { start: 1, end: 2, text: "zweiter satz" },
      ],
    });
    const result = await transcribeAudio(
      new Blob(["x"]),
      { ...CONFIG, autoPunctuate: true, speakerDiarization: true },
      { fetchFn: asFetch(fetchFn) },
    );
    expect(result.text).toBe("hallo welt. zweiter satz.");
    expect(result.segments[0].speaker).toBe("Sprecher 1");
    expect(result.segments[1].speaker).toBe("Sprecher 2");
    expect(result.duration).toBe(2);
  });
});

describe("exportTranscription", () => {
  it("erzeugt korrektes SRT-Format", () => {
    expect(exportTranscription(RESULT, "srt")).toBe(
      "1\n00:00:00,000 --> 00:00:01,500\nHallo Welt.\n\n" +
        "2\n00:00:01,500 --> 00:00:03,250\nZweiter Satz.\n",
    );
  });

  it("erzeugt TXT (eine Zeile pro Segment) und VTT mit WEBVTT-Header", () => {
    expect(exportTranscription(RESULT, "txt")).toBe(
      "Hallo Welt.\nZweiter Satz.\n",
    );
    const vtt = exportTranscription(RESULT, "vtt");
    expect(vtt.startsWith("WEBVTT\n\n")).toBe(true);
    expect(vtt).toContain("00:00:00.000 --> 00:00:01.500");
    expect(vtt).toContain("Hallo Welt.");
  });

  it("stellt Sprecher in allen Formaten dar", () => {
    const withSpeakers: TranscriptionResult = {
      ...RESULT,
      segments: [
        { start: 0, end: 1, text: "Hallo.", speaker: "Sprecher 1" },
        { start: 1, end: 2, text: "Hi.", speaker: "Sprecher 2" },
      ],
    };
    expect(exportTranscription(withSpeakers, "txt")).toContain(
      "[Sprecher 1] Hallo.",
    );
    expect(exportTranscription(withSpeakers, "srt")).toContain(
      "[Sprecher 2] Hi.",
    );
    expect(exportTranscription(withSpeakers, "vtt")).toContain(
      "<v Sprecher 1>Hallo.</v>",
    );
  });
});

describe("Zeitstempel und Punktuierung", () => {
  it("formatiert SRT/VTT-Zeitstempel", () => {
    expect(formatSrtTimestamp(0)).toBe("00:00:00,000");
    expect(formatSrtTimestamp(61.5)).toBe("00:01:01,500");
    expect(formatSrtTimestamp(3723.25)).toBe("01:02:03,250");
    expect(formatVttTimestamp(61.5)).toBe("00:01:01.500");
  });

  it("punktuiert nur saetze ohne Endzeichen", () => {
    expect(punctuate("hallo welt")).toBe("hallo welt.");
    expect(punctuate("Hallo Welt.")).toBe("Hallo Welt.");
    expect(punctuate("Wirklich?")).toBe("Wirklich?");
    expect(punctuate("  ")).toBe("");
  });
});

describe("startRecording / stopRecording", () => {
  it("startRecording nutzt getUserMedia und startet den Recorder", async () => {
    const stream = {} as MediaStream;
    const getUserMedia = vi.fn(async () => stream);
    const start = vi.fn();
    const FakeRecorder = vi.fn(function (this: unknown, s: MediaStream) {
      expect(s).toBe(stream);
      return { start, stream: s };
    }) as unknown as typeof MediaRecorder;

    const recorder = await startRecording({ getUserMedia, Recorder: FakeRecorder });
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(FakeRecorder).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledOnce();
    expect(recorder).toBeTruthy();
  });

  it("startRecording wirft ohne getUserMedia", async () => {
    await expect(
      startRecording({ getUserMedia: undefined, Recorder: undefined }),
    ).rejects.toThrow();
  });

  it("stopRecording sammelt Chunks und liefert einen Blob", async () => {
    const listeners: Record<string, Array<(e: unknown) => void>> = {};
    const fake = {
      state: "recording" as string,
      mimeType: "audio/webm",
      ondataavailable: null as ((e: BlobEvent) => void) | null,
      onerror: null as (() => void) | null,
      onstop: null as (() => void) | null,
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["a"]) } as BlobEvent);
        this.ondataavailable?.({ data: new Blob(["b"]) } as BlobEvent);
        this.onstop?.();
      },
    };
    void listeners;
    const blob = await stopRecording(fake as unknown as MediaRecorder);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("audio/webm");
    expect(await blob.text()).toBe("ab");
  });
});
