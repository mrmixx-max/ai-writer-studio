// Table-Read Service (WP 9.1): Multi-Voice Table-Read.
//
// Zerlegt Text in Erzähler- und Dialog-Segmente und liest sie mit
// unterschiedlichen Stimmen vor (Pitch, Rate). Nutzt window.speechSynthesis
// als Basisschicht. Lokal, kein LLM nötig, deterministisch.

import { assignDialogueToCharacters } from "@/services/dialogue/voiceProfiling";

/** Ein Segment des Textes — entweder Erzähler oder eine Figur. */
export interface VoiceSegment {
  /** Der Text des Segments. */
  text: string;
  /** Name der Figur, oder null für Erzähler. */
  character: string | null;
  /** true wenn es ein Dialog ist. */
  isDialogue: boolean;
}

/** Optionen für die Sprachausgabe. */
export interface SpeakOptions {
  /** Sprechtempo (0.5–2.0, Standard 1.0). */
  rate?: number;
  /** Tonhöhe (0.1–2.0, Standard 1.0). */
  pitch?: number;
  /** Callback bei Satz-Start (für Karaoke-Synchronisation). */
  onSentenceStart?: (index: number) => void;
}

/** Klampft eine Zahl auf einen Bereich. */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Zerlegt den Text in Segmente (Erzähler vs. Figur).
 * Nutzt assignDialogueToCharacters zur Dialog-Erkennung.
 */
export function splitTextIntoVoices(text: string): VoiceSegment[] {
  if (!text || !text.trim()) return [];

  const characterSpeech = assignDialogueToCharacters(text);
  const segments: VoiceSegment[] = [];

  // Satzweise zerlegen (defensiv: auch bei fehlenden Satzzeichen)
  const sentences = text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length === 0) {
    // Fallback: gesamter Text als ein Segment
    return [{ text: text.trim(), character: null, isDialogue: false }];
  }

  for (const sentence of sentences) {
    const trimmed = sentence.trim();

    // Prüfe ob der Satz ein Dialog enthält (Anführungszeichen)
    let character: string | null = null;
    let isDialogue = false;

    const dialogueMatch = trimmed.match(/[„"»«“](.*?)[“”"«»]/);
    if (dialogueMatch) {
      const dialogueText = dialogueMatch[1]?.trim() ?? "";
      // Finde die Figur in der characterSpeech Map
      for (const [char, speeches] of characterSpeech) {
        if (speeches.some((s) => s.trim() === dialogueText)) {
          character = char;
          isDialogue = true;
          break;
        }
      }
    }

    segments.push({
      text: trimmed,
      character,
      isDialogue,
    });
  }

  return segments;
}

/**
 * Liest die Segmente mit unterschiedlichen Stimmen vor.
 * Erzähler: normale Stimme. Figur: abweichender Pitch/Rate.
 */
export function speakWithVoices(segments: VoiceSegment[], options?: SpeakOptions): void {
  if (!segments || segments.length === 0) return;

  const synth = window.speechSynthesis;
  if (!synth) return; // Defensiv: kein speechSynthesis verfügbar
  if (typeof SpeechSynthesisUtterance === "undefined") return; // Defensiv: keine Utterance-Klasse

  const rate = clamp(options?.rate ?? 1.0, 0.5, 2.0);
  const basePitch = clamp(options?.pitch ?? 1.0, 0.1, 2.0);

  // Stoppe laufende Ausgabe
  synth.cancel();

  segments.forEach((segment, index) => {
    const utterance = new SpeechSynthesisUtterance(segment.text);

    // Stimmen-Unterscheidung
    if (segment.isDialogue && segment.character) {
      // Figur: leicht abweichender Pitch
      utterance.pitch = clamp(basePitch * 0.85, 0.1, 2.0);
      utterance.rate = clamp(rate * 1.05, 0.5, 2.0);
    } else {
      // Erzähler: normale Stimme
      utterance.pitch = basePitch;
      utterance.rate = rate;
    }

    // Callback für Karaoke-Synchronisation
    if (options?.onSentenceStart) {
      utterance.onstart = () => options.onSentenceStart!(index);
    }

    synth.speak(utterance);
  });
}

/**
 * Markiert den aktiven Satz im Editor (Karaoke-Synchronisation).
 * Sucht nach data-sentence-index Attributen oder fällt auf Text-Suche zurück.
 */
export function highlightActiveSentence(editor: any, sentenceIndex: number): void {
  if (!editor || sentenceIndex < 0) return;

  // Entferne vorherige Markierung
  const prev = editor.querySelector?.(".table-read-active");
  if (prev) {
    prev.classList.remove("table-read-active");
  }

  // Suche nach data-sentence-index
  const target = editor.querySelector?.(`[data-sentence-index="${sentenceIndex}"]`);
  if (target) {
    target.classList.add("table-read-active");
    return;
  }

  // Fallback: Text-basierte Suche
  const sentences = editor.querySelectorAll?.("[data-sentence]");
  if (sentences && sentences[sentenceIndex]) {
    sentences[sentenceIndex].classList.add("table-read-active");
  }
}
