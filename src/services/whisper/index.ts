// Whisper-STT: Speech-to-Text via Web Speech API (kein Download, kein Modell).
// Nutzt die browserinterne Spracherkennung (Chrome/Edge: de-DE, en-US etc.).

// Minimale Typdefinition für Web Speech API
interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionEvent {
  results: { transcript: string }[][];
}
declare const SpeechRecognition: {
  new (): SpeechRecognition;
};

let activeRecognition: SpeechRecognition | null = null;

/** Startet Spracherkript und gibt Transkript zurück. */
export function recordAndTranscribe(
  _settings: any,
  _chapterId: string | null,
  onStatus: (s: string) => void,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      reject(new Error("Web Speech API wird von diesem Browser nicht unterstützt"));
      return;
    }

    const recognition = new SpeechRecognition();
    activeRecognition = recognition;
    recognition.lang = (_settings?.language || "de").toUpperCase();
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      onStatus("Aufnahme läuft…");
    };

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      onStatus("Transkribiert");
      resolve(text);
    };

    recognition.onerror = (event: any) => {
      reject(new Error(`Spracherkennung Fehler: ${event.error}`));
    };

    recognition.onend = () => {
      activeRecognition = null;
    };

    recognition.start();
  });
}

/** Stoppt aktive Spracherkennung. */
export function stopRecording(): void {
  if (activeRecognition) {
    activeRecognition.stop();
    activeRecognition = null;
  }
}

// --- Transcript-Editor: Lesen und Korrigieren ---

export interface Transcription {
  id: string;
  chapterId: string | null;
  text: string;
  language: string | null;
  model: string | null;
  isEdited: boolean;
  createdAt: number;
  updatedAt: number | null;
}

/** Listet Transkripte auf, optional gefiltert auf ein Kapitel. */
export function listTranscriptions(_chapterId: string | null = null): Transcription[] {
  // Web Speech API speichert nicht in DB — nur Session-basiert
  return [];
}

/** Überschreibt den Transkript-Text (manuelle Korrektur) und markiert ihn als editiert. */
export async function updateTranscriptionText(_id: string, _text: string): Promise<void> {
  // No-op für Web Speech API
}

/** Löscht ein Transkript. */
export async function deleteTranscription(_id: string): Promise<void> {
  // No-op für Web Speech API
}
