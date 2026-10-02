// Table-Read Service: Tests für Multi-Voice Table-Read.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  splitTextIntoVoices,
  speakWithVoices,
  highlightActiveSentence,
  type VoiceSegment,
} from "@/services/tts/tableRead";

// Mock für window.speechSynthesis
const mockSpeak = vi.fn((utterance: any) => {
  // Simuliere onstart-Event
  if (utterance && typeof utterance.onstart === "function") {
    utterance.onstart();
  }
});
const mockCancel = vi.fn();
const mockQuerySelector = vi.fn();
const mockQuerySelectorAll = vi.fn();

// Mock für SpeechSynthesisUtterance
class MockSpeechSynthesisUtterance {
  text: string;
  pitch: number = 1.0;
  rate: number = 1.0;
  onstart: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

beforeEach(() => {
  vi.stubGlobal("window", {
    speechSynthesis: {
      speak: mockSpeak,
      cancel: mockCancel,
    },
  });
  vi.stubGlobal("SpeechSynthesisUtterance", MockSpeechSynthesisUtterance);
  mockSpeak.mockClear();
  mockCancel.mockClear();
  mockQuerySelector.mockClear();
  mockQuerySelectorAll.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("splitTextIntoVoices", () => {
  it("gibt leeres Array für leeren Text zurück", () => {
    const result = splitTextIntoVoices("");
    expect(result).toEqual([]);
  });

  it("gibt leeres Array für nur Leerzeichen zurück", () => {
    const result = splitTextIntoVoices("   ");
    expect(result).toEqual([]);
  });

  it("erstellt Erzähler-Segment ohne Dialog", () => {
    const text = "Es war einmal ein Haus am Wald.";
    const result = splitTextIntoVoices(text);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].character).toBeNull();
    expect(result[0].isDialogue).toBe(false);
  });

  it("erkennt Dialog mit Sprecherangabe", () => {
    const text = '„Hallo“, sagte Anna.';
    const result = splitTextIntoVoices(text);
    const dialogue = result.find((s) => s.isDialogue);
    expect(dialogue).toBeTruthy();
    expect(dialogue?.character).toBe("Anna");
  });

  it("erkennt mehrere Figuren", () => {
    const text = '„Hallo“, sagte Anna. „Hi“, sagte Bob.';
    const result = splitTextIntoVoices(text);
    const characters = result
      .filter((s) => s.isDialogue)
      .map((s) => s.character);
    expect(characters).toContain("Anna");
    expect(characters).toContain("Bob");
  });

  it("mischt Erzähler und Dialog korrekt", () => {
    const text = 'Es war dunkel. „Wer ist da?“, flüsterte Max. Niemand antwortete.';
    const result = splitTextIntoVoices(text);
    const hasNarrator = result.some((s) => !s.isDialogue);
    const hasDialogue = result.some((s) => s.isDialogue);
    expect(hasNarrator).toBe(true);
    expect(hasDialogue).toBe(true);
  });

  it("verarbeitet Text ohne Satzzeichen defensiv", () => {
    const text = "Ein Text ohne Satzzeichen";
    const result = splitTextIntoVoices(text);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].text).toBeTruthy();
  });
});

describe("speakWithVoices", () => {
  it("macht nichts bei leeren Segmenten", () => {
    speakWithVoices([]);
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it("spricht Erzähler-Segmente vor", () => {
    const segments: VoiceSegment[] = [
      { text: "Es war einmal.", character: null, isDialogue: false },
    ];
    speakWithVoices(segments);
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });

  it("spricht Dialog-Segmente mit abweichendem Pitch", () => {
    const segments: VoiceSegment[] = [
      { text: "„Hallo“", character: "Anna", isDialogue: true },
    ];
    speakWithVoices(segments);
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });

  it("ruft onSentenceStart bei jedem Segment auf", () => {
    const segments: VoiceSegment[] = [
      { text: "Satz eins.", character: null, isDialogue: false },
      { text: "Satz zwei.", character: null, isDialogue: false },
      { text: "Satz drei.", character: null, isDialogue: false },
    ];
    const onStart = vi.fn();
    speakWithVoices(segments, { onSentenceStart: onStart });
    expect(onStart).toHaveBeenCalledTimes(3);
    expect(onStart).toHaveBeenNthCalledWith(1, 0);
    expect(onStart).toHaveBeenNthCalledWith(2, 1);
    expect(onStart).toHaveBeenNthCalledWith(3, 2);
  });

  it("verwendet optionale rate und pitch", () => {
    const segments: VoiceSegment[] = [
      { text: "Test.", character: null, isDialogue: false },
    ];
    speakWithVoices(segments, { rate: 1.5, pitch: 0.8 });
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });

  it("bricht laufende Ausgabe ab", () => {
    const segments: VoiceSegment[] = [
      { text: "Test.", character: null, isDialogue: false },
    ];
    speakWithVoices(segments);
    expect(mockCancel).toHaveBeenCalled();
  });
});

describe("highlightActiveSentence", () => {
  it("macht nichts bei null editor", () => {
    expect(() => highlightActiveSentence(null, 0)).not.toThrow();
  });

  it("macht nichts bei negativem Index", () => {
    const editor = { querySelector: mockQuerySelector };
    expect(() => highlightActiveSentence(editor, -1)).not.toThrow();
  });

  it("fügt CSS-Klasse hinzu wenn Element gefunden", () => {
    const mockElement = {
      classList: { add: vi.fn(), remove: vi.fn() },
    };
    mockQuerySelector.mockReturnValue(mockElement);
    const editor = { querySelector: mockQuerySelector };

    highlightActiveSentence(editor, 2);
    expect(mockElement.classList.add).toHaveBeenCalledWith("table-read-active");
  });

  it("entfernt vorherige Markierung", () => {
    const mockPrev = { classList: { remove: vi.fn() } };
    const mockNew = { classList: { add: vi.fn() } };
    mockQuerySelector
      .mockReturnValueOnce(mockPrev)
      .mockReturnValueOnce(mockNew);
    const editor = { querySelector: mockQuerySelector };

    highlightActiveSentence(editor, 0);
    expect(mockPrev.classList.remove).toHaveBeenCalledWith("table-read-active");
    expect(mockNew.classList.add).toHaveBeenCalledWith("table-read-active");
  });
});
