// WhisperButton: Mikrofon-Button für Speech-to-Text.
import { useState } from "react";
import { recordAndTranscribe, stopRecording } from "@/services/whisper";
import { DEFAULT_SETTINGS } from "@/types/config";

interface Props {
  onResult: (text: string) => void;
  chapterId: string | null;
}

export function WhisperButton({ onResult, chapterId }: Props) {
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState("");

  async function start() {
    setRecording(true);
    setStatus("Aufnahme läuft…");
    try {
      const text = await recordAndTranscribe(DEFAULT_SETTINGS, chapterId, setStatus);
      onResult(text);
    } catch (e) {
      setStatus(`Fehler: ${(e as Error).message}`);
    } finally {
      setRecording(false);
      setTimeout(() => setStatus(""), 3000);
    }
  }

  function stop() {
    stopRecording();
    setRecording(false);
  }

  return (
    <div className="whisper-btn">
      {!recording ? (
        <button
          onClick={start}
          className=""
          title="Sprachaufnahme starten (Whisper)"
        >
          🎤 Sprechen
        </button>
      ) : (
        <button
          onClick={stop}
          className="rec"
          title="Aufnahme stoppen"
        >
          ⏹ Stop
        </button>
      )}
      {status && <span className="whisper-status">{status}</span>}
    </div>
  );
}
