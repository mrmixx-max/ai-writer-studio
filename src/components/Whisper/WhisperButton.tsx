// WhisperButton: Spracheingabe via Web Speech API (kein Download, kein Modell).
import { useState, useRef } from "react";

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

interface Props {
  onResult: (text: string) => void;
  chapterId: string | null;
}

export function WhisperButton({ onResult }: Props) {
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  function start() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus("Spracherkennung nicht unterstützt");
      setTimeout(() => setStatus(""), 3000);
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "de-DE";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setRecording(true);
      setStatus("Aufnahme läuft…");
    };

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      onResult(text);
      setStatus("Transkribiert");
      setTimeout(() => setStatus(""), 2000);
    };

    recognition.onerror = (event: any) => {
      setStatus(`Fehler: ${event.error}`);
      setTimeout(() => setStatus(""), 3000);
    };

    recognition.onend = () => {
      setRecording(false);
      recognitionRef.current = null;
    };

    recognition.start();
  }

  function stop() {
    recognitionRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="whisper-btn">
      {!recording ? (
        <button onClick={start} title="Spracheingabe starten">
          🎤 Sprechen
        </button>
      ) : (
        <button onClick={stop} className="rec" title="Aufnahme stoppen">
          ⏹ Stop
        </button>
      )}
      {status && <span className="whisper-status">{status}</span>}
    </div>
  );
}
