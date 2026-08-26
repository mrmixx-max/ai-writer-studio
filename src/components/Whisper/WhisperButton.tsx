// WhisperButton: Mikrofon-Button für Speech-to-Text.
import { useState } from "react";
import { recordAndTranscribe } from "@/services/whisper";
import { DEFAULT_SETTINGS } from "@/types/config";

interface Props {
  onResult: (text: string) => void;
  chapterId: string | null;
}

export function WhisperButton({ onResult, chapterId }: Props) {
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState("");

  async function toggle() {
    if (recording) return; // Stop handled by recorder timeout or unmount
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

  return (
    <div className="whisper-btn">
      <button
        onClick={toggle}
        disabled={recording}
        className={recording ? "rec" : ""}
        title="Sprachaufnahme (Whisper)"
      >
        {recording ? "⏺ Aufnahme läuft…" : "🎤 Sprechen"}
      </button>
      {status && <span className="whisper-status">{status}</span>}
    </div>
  );
}
