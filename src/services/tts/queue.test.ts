// TTS-Sprechqueue: Tests mit gemockter speechSynthesis (kein echtes Audio).
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { SpeechQueue, createSpeechQueue, type TTSQueueProgress } from "@/services/tts/queue";

class FakeUtterance {
  text: string;
  rate = 1;
  voice: { name: string; voiceURI: string } | null = null;
  onend: (() => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

function installSpeechMock() {
  const spoken: FakeUtterance[] = [];
  let cancelCalls = 0;
  const voices = [
    { name: "Deutsch Anna", voiceURI: "de-anna" },
    { name: "English Bob", voiceURI: "en-bob" },
  ];
  const synth = {
    speak: vi.fn((u: FakeUtterance) => {
      spoken.push(u);
    }),
    cancel: vi.fn(() => {
      cancelCalls += 1;
    }),
    getVoices: vi.fn(() => voices),
    get spoken() {
      return spoken;
    },
    get cancelCalls() {
      return cancelCalls;
    },
  };
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  return synth;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("SpeechQueue ohne WebSpeech", () => {
  it("isSupported ist false ohne speechSynthesis", () => {
    const q = new SpeechQueue();
    expect(q.isSupported()).toBe(false);
  });

  it("enqueue gibt ID zurueck und wirft nicht", () => {
    const q = new SpeechQueue();
    expect(() => q.enqueue({ text: "Hallo" })).not.toThrow();
    expect(q.size).toBe(1);
  });

  it("cancel/skip/clear sind stille No-Ops mit Warnung, werfen nie", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const q = new SpeechQueue();
    q.enqueue({ text: "a" });
    expect(() => q.cancel()).not.toThrow();
    expect(() => q.skip()).not.toThrow();
    expect(() => q.clear()).not.toThrow();
    expect(q.size).toBe(0);
    expect(warn).toHaveBeenCalled();
  });
});

describe("SpeechQueue mit gemockter speechSynthesis", () => {
  it("spricht erstes Item sofort sequenziell mit started-Event", () => {
    const synth = installSpeechMock();
    const progress: TTSQueueProgress[] = [];
    const q = new SpeechQueue((p) => progress.push(p));
    const id = q.enqueue({ text: "Hallo Welt" });
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(synth.spoken[0].text).toBe("Hallo Welt");
    expect(progress[0]).toMatchObject({ itemId: id, itemIndex: 0, phase: "started" });
    expect(q.isSpeaking).toBe(true);
  });

  it("wählt Stimme pro Item per Name", () => {
    const synth = installSpeechMock();
    const q = new SpeechQueue();
    q.enqueue({ text: "hi", voice: "English Bob" });
    expect(synth.spoken[0].voice).toMatchObject({ name: "English Bob" });
  });

  it("unbekannte Stimme bricht nichts ab", () => {
    const synth = installSpeechMock();
    const q = new SpeechQueue();
    expect(() => q.enqueue({ text: "hi", voice: "gibts-nicht" })).not.toThrow();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(synth.spoken[0].voice).toBeNull();
  });

  it("wendet Rate pro Item an", () => {
    const synth = installSpeechMock();
    const q = new SpeechQueue();
    q.enqueue({ text: "schnell", rate: 1.5 });
    expect(synth.spoken[0].rate).toBe(1.5);
  });

  it("onend rueckt zum naechsten Item vor, am Ende queue-done", () => {
    installSpeechMock();
    const progress: TTSQueueProgress[] = [];
    const q = new SpeechQueue((p) => progress.push(p));
    q.enqueue({ text: "eins" });
    q.enqueue({ text: "zwei" });
    expect(q.size).toBe(2);
    // Erstes Item beenden -> zweites startet
    const first = (globalThis as unknown as { speechSynthesis: { spoken: FakeUtterance[] } }).speechSynthesis.spoken[0];
    first.onend?.();
    const phases = progress.map((p) => p.phase);
    expect(phases).toContain("ended");
    expect(progress.some((p) => p.phase === "started" && p.itemIndex === 1)).toBe(true);
    // Zweites Item beenden -> queue-done, Queue leer
    const second = (globalThis as unknown as { speechSynthesis: { spoken: FakeUtterance[] } }).speechSynthesis.spoken[1];
    second.onend?.();
    expect(progress[progress.length - 1]?.phase).toBe("queue-done");
    expect(q.size).toBe(0);
    expect(q.isSpeaking).toBe(false);
  });

  it("skip() meldet skipped und startet naechstes Item", () => {
    const synth = installSpeechMock();
    const progress: TTSQueueProgress[] = [];
    const q = new SpeechQueue((p) => progress.push(p));
    q.enqueue({ text: "eins" });
    q.enqueue({ text: "zwei" });
    q.skip();
    expect(synth.cancel).toHaveBeenCalled();
    expect(progress.some((p) => p.phase === "skipped")).toBe(true);
    expect(progress.some((p) => p.phase === "started" && p.itemIndex === 1)).toBe(true);
  });

  it("cancel() leert Queue und meldet cancelled", () => {
    const synth = installSpeechMock();
    const progress: TTSQueueProgress[] = [];
    const q = new SpeechQueue((p) => progress.push(p));
    q.enqueue({ text: "eins" });
    q.enqueue({ text: "zwei" });
    q.cancel();
    expect(synth.cancel).toHaveBeenCalled();
    expect(q.size).toBe(0);
    expect(q.isSpeaking).toBe(false);
    expect(progress.some((p) => p.phase === "cancelled")).toBe(true);
  });

  it("remove() entfernt wartendes Item, nicht das aktuelle", () => {
    installSpeechMock();
    const q = new SpeechQueue();
    q.enqueue({ text: "eins" });
    const id2 = q.enqueue({ text: "zwei" });
    const cur = q.currentId as string;
    expect(q.remove(cur)).toBe(false);
    expect(q.remove(id2)).toBe(true);
    expect(q.size).toBe(1);
    expect(q.remove("unbekannt")).toBe(false);
  });

  it("reorder() verschiebt wartendes Item", () => {
    installSpeechMock();
    const q = new SpeechQueue();
    q.enqueue({ text: "eins" });
    const id2 = q.enqueue({ text: "zwei" });
    const id3 = q.enqueue({ text: "drei" });
    expect(q.reorder(id3, 1)).toBe(true);
    expect(q.getQueue()[1].id).toBe(id3);
    expect(q.reorder("unbekannt", 0)).toBe(false);
    expect(q.reorder(id2, 99)).toBe(false);
  });

  it("onerror meldet error und spricht trotzdem weiter", () => {
    installSpeechMock();
    const progress: TTSQueueProgress[] = [];
    const q = new SpeechQueue((p) => progress.push(p));
    q.enqueue({ text: "eins" });
    q.enqueue({ text: "zwei" });
    const first = (globalThis as unknown as { speechSynthesis: { spoken: FakeUtterance[] } }).speechSynthesis.spoken[0];
    first.onerror?.({ error: "synthesis-failed" });
    expect(progress.some((p) => p.phase === "error")).toBe(true);
    expect(progress.some((p) => p.phase === "started" && p.itemIndex === 1)).toBe(true);
  });

  it("werfender Listener stoppt die Queue nicht", () => {
    const synth = installSpeechMock();
    const q = new SpeechQueue(() => {
      throw new Error("listener-boom");
    });
    expect(() => q.enqueue({ text: "eins" })).not.toThrow();
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it("createSpeechQueue-Factory legt Queue mit Listener an", () => {
    installSpeechMock();
    const progress: TTSQueueProgress[] = [];
    const q = createSpeechQueue((p) => progress.push(p));
    q.enqueue({ text: "hallo" });
    expect(progress[0]?.phase).toBe("started");
  });
});
