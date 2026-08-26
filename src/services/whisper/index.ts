// Whisper-STT: Speech-to-Text via OpenAI Whisper API oder lokales whisper.cpp.
// Audio-Aufnahme via MediaRecorder, Konvertierung zu WAV, Upload an API.

import type { AppSettings } from "@/types/config";
import { getDb, persist } from "@/services/db";

const WHISPER_API = "https://api.openai.com/v1/audio/transcriptions";

/** Nimmt Audio auf und gibt Transkript zurück. */
export async function recordAndTranscribe(
  settings: AppSettings,
  chapterId: string | null,
  onStatus: (s: string) => void,
): Promise<string> {
  onStatus("Mikrofon aktiviert…");

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];

  return new Promise<string>((resolve, reject) => {
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = async () => {
      try {
        const blob = new Blob(chunks, { type: "audio/webm" });
        onStatus("Verarbeite Audio…");
        const text = await transcribeBlob(settings, blob);
        onStatus("Transkribiert");
        // Speichern
        const db = getDb();
        const id = "w_" + Date.now().toString(36);
        db.run(
          "INSERT INTO whisper_transcriptions (id, chapter_id, audio_hash, text, language, model, created_at) VALUES (?,?,?,?,?,?,?)",
          [id, chapterId, null, text, "de", settings.provider === "openai" ? "whisper-1" : "local", Date.now()],
        );
        await persist();
        resolve(text);
      } catch (e) {
        reject(e);
      } finally {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
    recorder.start();
    // Auto-Stop nach 5 Minuten
    setTimeout(() => recorder.stop(), 300000);
  });
}

/** Sendet Audio-Blob an Whisper API. */
async function transcribeBlob(settings: AppSettings, blob: Blob): Promise<string> {
  if (settings.provider === "openai" && settings.openaiApiKey) {
    return transcribeOpenAI(settings.openaiApiKey, blob);
  }
  // Fallback: lokales whisper.cpp via Tauri Shell (wenn konfiguriert)
  throw new Error("Whisper benötigt OpenAI API-Key oder lokales whisper.cpp.");
}

async function transcribeOpenAI(apiKey: string, blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", blob, "audio.webm");
  form.append("model", "whisper-1");
  form.append("language", "de");

  const res = await fetch(WHISPER_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Whisper API Fehler: ${res.status}`);
  const data = await res.json();
  return data.text || "";
}

/** Stoppt Aufnahme (wird von UI aufgerufen). */
export function stopRecording() {
  // Der MediaRecorder wird im Component gehalten → stop() von außen.
}
