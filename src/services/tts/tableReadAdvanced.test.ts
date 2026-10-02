// Table-Read Advanced: Grenzfälle für Table-Read & Audio-State-Machine.
//
// Ergänzt tableRead.test.ts um 12 gezielte Randfälle: reiner Erzähltext,
// Szenen mit vielen Figuren, Abbruch/Wiederaufnahme sowie Extremwerte für
// rate/pitch. window.speechSynthesis und SpeechSynthesisUtterance werden
// global gemockt; getestet wird ausschließlich über die bestehenden
// Funktionen aus @/services/tts/tableRead.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  splitTextIntoVoices,
  speakWithVoices,
  highlightActiveSentence,
  type VoiceSegment,
} from "@/services/tts/tableRead";

let spokenUtterances: any[];
let mockSpeak: any;
let mockCancel: any;

// Mock für SpeechSynthesisUtterance — protokolliert pitch/rate.
class MockSpeechSynthesisUtterance {
  text: string;
  pitch = 1.0;
  rate = 1.0;
  onstart: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

beforeEach(() => {
  spokenUtterances = [];
  mockSpeak = vi.fn((utterance: any) => {
    spokenUtterances.push(utterance);
    // Simuliere onstart (Karaoke-Synchronisation).
    if (utterance && typeof utterance.onstart === "function") {
      utterance.onstart();
    }
  });
  mockCancel = vi.fn();

  vi.stubGlobal("window", {
    speechSynthesis: {
      speak: mockSpeak,
      cancel: mockCancel,
    },
  });
  vi.stubGlobal("SpeechSynthesisUtterance", MockSpeechSynthesisUtterance);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Table-Read: Segmentierung (Grenzfälle)", () => {
  // 1.
  it("reiner Erzähltext: alle Segmente haben character: null", () => {
    const text =
      "Der Wind wehte durch die Gassen. Die Laternen flackerten im Sturm. Niemand war auf den Straßen.";
    const result = splitTextIntoVoices(text);

    expect(result).toHaveLength(3);
    for (const segment of result) {
      expect(segment.character).toBeNull();
      expect(segment.isDialogue).toBe(false);
    }
  });

  // 2.
  it("Szene mit 11 wechselnden Figuren: keine Voice-ID kollidiert", () => {
    const names = [
      "Anna",
      "Bert",
      "Clara",
      "David",
      "Emma",
      "Felix",
      "Greta",
      "Hans",
      "Ida",
      "Jonas",
      "Karl",
    ];
    const text = names.map((n) => `${n}: „Ich bin ${n}“`).join(". ") + ".";

    const result = splitTextIntoVoices(text);
    const dialogue = result.filter((s) => s.isDialogue);

    expect(dialogue).toHaveLength(11);
    // Jede Figur erhält genau eine eigene Voice-ID (keine Kollision).
    const voiceIds = dialogue.map((s) => s.character);
    expect(voiceIds.every((id) => id !== null)).toBe(true);
    expect(new Set(voiceIds).size).toBe(voiceIds.length);
    expect(new Set(voiceIds).size).toBe(11);
  });

  // 9.
  it("leerer Text: keine Segmente", () => {
    expect(splitTextIntoVoices("")).toEqual([]);
    expect(splitTextIntoVoices("   ")).toEqual([]);
  });

  // 10.
  it("Text nur aus Dialogen: kein Erzähler-Segment", () => {
    const text = '„Hallo“, sagte Anna. „Wie geht es dir?“, fragte Bob.';
    const result = splitTextIntoVoices(text);

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((s) => s.isDialogue)).toBe(true);
    expect(result.every((s) => s.character !== null)).toBe(true);
  });
});

describe("Table-Read: Audio-State-Machine (Grenzfälle)", () => {
  // 3.
  it("unerwarteter Abbruch: cancel() läuft vor jedem speak()", () => {
    const order: string[] = [];
    mockCancel.mockImplementation(() => order.push("cancel"));
    mockSpeak.mockImplementation((utterance: any) => {
      order.push("speak");
      if (utterance && typeof utterance.onstart === "function") {
        utterance.onstart();
      }
    });

    const segments: VoiceSegment[] = [
      { text: "Eins.", character: null, isDialogue: false },
      { text: "Zwei.", character: null, isDialogue: false },
      { text: "Drei.", character: null, isDialogue: false },
    ];

    speakWithVoices(segments);

    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(order[0]).toBe("cancel");
    expect(order.filter((entry) => entry === "speak")).toHaveLength(3);
  });

  // 4.
  it("Wiederaufnahme nach Abbruch an exakt derselben Position", () => {
    const segments = splitTextIntoVoices(
      "Erster Satz. Zweiter Satz. Dritter Satz.",
    );
    expect(segments).toHaveLength(3);

    const started: number[] = [];
    speakWithVoices(segments, { onSentenceStart: (i) => started.push(i) });
    const interruptedPosition = started[started.length - 1];
    expect(interruptedPosition).toBe(2);

    // Unerwarteter Abbruch mitten in der Ausgabe.
    mockCancel();

    // Wiederaufnahme ab exakt der unterbrochenen Segmentposition.
    const resumed = segments.slice(interruptedPosition);
    const resumedTexts: string[] = [];
    speakWithVoices(resumed, {
      onSentenceStart: (i) => resumedTexts.push(resumed[i].text),
    });

    expect(resumed[0].text).toBe(segments[interruptedPosition].text);
    expect(resumedTexts).toEqual([segments[interruptedPosition].text]);
  });

  // 5.
  it("Extremwert Sprechtempo: 0.5x wird übernommen", () => {
    const segments: VoiceSegment[] = [
      { text: "Ganz langsam.", character: null, isDialogue: false },
    ];
    speakWithVoices(segments, { rate: 0.5 });

    expect(spokenUtterances).toHaveLength(1);
    expect(spokenUtterances[0].rate).toBe(0.5);
  });

  // 6.
  it("Extremwert Sprechtempo: 2.0x wird übernommen", () => {
    const segments: VoiceSegment[] = [
      { text: "Ganz schnell.", character: null, isDialogue: false },
    ];
    speakWithVoices(segments, { rate: 2.0 });

    expect(spokenUtterances).toHaveLength(1);
    expect(spokenUtterances[0].rate).toBe(2.0);
  });

  // 7.
  it("Extremwert Tonhöhe: 0.0 wird auf Untergrenze geklammert", () => {
    const segments: VoiceSegment[] = [
      { text: "Sehr tief.", character: null, isDialogue: false },
    ];
    speakWithVoices(segments, { pitch: 0.0 });

    expect(spokenUtterances).toHaveLength(1);
    expect(spokenUtterances[0].pitch).toBe(0.1);
  });

  // 8.
  it("Extremwert Tonhöhe: 2.0 wird übernommen", () => {
    const segments: VoiceSegment[] = [
      { text: "Sehr hoch.", character: null, isDialogue: false },
    ];
    speakWithVoices(segments, { pitch: 2.0 });

    expect(spokenUtterances).toHaveLength(1);
    expect(spokenUtterances[0].pitch).toBe(2.0);
  });

  // 12.
  it("speakWithVoices mit leerem Segments-Array: kein speak, kein cancel", () => {
    speakWithVoices([]);

    expect(mockSpeak).not.toHaveBeenCalled();
    expect(mockCancel).not.toHaveBeenCalled();
  });
});

describe("Table-Read: Karaoke-Markierung (Grenzfälle)", () => {
  // 11.
  it("highlightActiveSentence mit ungültigem Index wirft nicht", () => {
    const querySelector = vi.fn(() => null);
    const querySelectorAll = vi.fn(() => [] as any[]);
    const editor = { querySelector, querySelectorAll };

    expect(() => highlightActiveSentence(editor, 999)).not.toThrow();
    // Fallback-Suche wird ausgeführt, aber ohne Treffer keine Klasse gesetzt.
    expect(querySelectorAll).toHaveBeenCalledWith("[data-sentence]");
  });
});
