// Whisper-STT: Speech-to-Text via OpenAI Whisper API oder lokales whisper.cpp.
// Audio-Aufnahme via MediaRecorder, Konvertierung zu WAV, Upload an API.

import type { AppSettings } from "@/types/config";
import { getDb, persist } from "@/services/db";

const WHISPER_API = "https://api.openai.com/v1/audio/transcriptions";

/** Nimmt Audio auf und gibt Transkript zurück. */
let activeRecorder: { recorder: MediaRecorder; stream: MediaStream } | null = null;

export async function recordAndTranscribe(
  settings: AppSettings,
  chapterId: string | null,
  onStatus: (s: string) => void,
): Promise<string> {
  onStatus("Mikrofon aktiviert…");

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  activeRecorder = { recorder, stream };
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
          [id, chapterId, null, text, "de", settings.whisperModelPath ? "local" : (settings.provider === "openai" ? "whisper-1" : "local"), Date.now()],
        );
        await persist();
        resolve(text);
      } catch (e) {
        reject(e);
      } finally {
        stream.getTracks().forEach((t) => t.stop());
        activeRecorder = null;
      }
    };
    recorder.start();
    // Auto-Stop nach 5 Minuten
    setTimeout(() => recorder.stop(), 300000);
  });
}

/** Sendet Audio-Blob an Whisper API oder lokales whisper.cpp. */
async function transcribeBlob(settings: AppSettings, blob: Blob): Promise<string> {
  // Lokales whisper.cpp bevorzugt
  if (settings.whisperBinaryPath && settings.whisperModelPath) {
    return transcribeLocal(settings, blob);
  }
  // OpenAI Whisper API
  if (settings.provider === "openai" && settings.openaiApiKey) {
    return transcribeOpenAI(settings.openaiApiKey, blob);
  }
  throw new Error("Whisper benötigt OpenAI API-Key oder lokales whisper.cpp (Binary + Modelldatei).");
}

/** Lokale Transkription via whisper.cpp. */
async function transcribeLocal(settings: AppSettings, blob: Blob): Promise<string> {
  // Dynamische Tauri-Imports (wie in db/index.ts)
  const { invoke } = await import("@tauri-apps/api/core");
  const { tempDir } = await import("@tauri-apps/api/path");
  const { writeFile, removeFile } = await import("@tauri-apps/plugin-fs");

  // Konvertiere WebM → WAV (16kHz, mono) für whisper.cpp
  const wavBlob = await convertToWav(blob);
  const dir = await tempDir();
  const audioPath = `${dir}/whisper_${Date.now()}.wav`;
  const audioData = new Uint8Array(await wavBlob.arrayBuffer());
  await writeFile(audioPath, audioData);

  try {
    const result = await invoke<string>("run_whisper", {
      binaryPath: settings.whisperBinaryPath,
      modelPath: settings.whisperModelPath,
      audioPath,
      language: settings.language || "de",
    });
    return result;
  } finally {
    await removeFile(audioPath);
  }
}

/** Konvertiert WebM-Blob zu WAV (16kHz, mono) via Web Audio API. */
async function convertToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  // Downmix zu Mono, Resample zu 16kHz
  const offlineCtx = new OfflineAudioContext(1, audioBuffer.duration * 16000, 16000);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start();
  const rendered = await offlineCtx.startRendering();
  return audioBufferToWav(rendered);
}

/** Encodiert AudioBuffer als WAV-Blob. */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Interleaved samples
  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
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
export function stopRecording(): void {
  if (activeRecorder) {
    activeRecorder.recorder.stop();
    activeRecorder.stream.getTracks().forEach((t) => t.stop());
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
export function listTranscriptions(chapterId: string | null = null): Transcription[] {
  const db = getDb();
  const res = chapterId
    ? db.exec(
        "SELECT id, chapter_id, text, language, model, COALESCE(is_edited,0), created_at, updated_at FROM whisper_transcriptions WHERE chapter_id = ? ORDER BY created_at DESC",
        [chapterId],
      )
    : db.exec(
        "SELECT id, chapter_id, text, language, model, COALESCE(is_edited,0), created_at, updated_at FROM whisper_transcriptions ORDER BY created_at DESC",
      );
  if (!res.length) return [];
  return res[0].values.map((r) => ({
    id: r[0] as string,
    chapterId: (r[1] as string) ?? null,
    text: r[2] as string,
    language: (r[3] as string) ?? null,
    model: (r[4] as string) ?? null,
    isEdited: !!(r[5] as number),
    createdAt: r[6] as number,
    updatedAt: (r[7] as number) ?? null,
  }));
}

/** Überschreibt den Transkript-Text (manuelle Korrektur) und markiert ihn als editiert. */
export async function updateTranscriptionText(id: string, text: string): Promise<void> {
  getDb().run(
    "UPDATE whisper_transcriptions SET text = ?, is_edited = 1, updated_at = ? WHERE id = ?",
    [text, Date.now(), id],
  );
  await persist();
}

/** Löscht ein Transkript. */
export async function deleteTranscription(id: string): Promise<void> {
  getDb().run("DELETE FROM whisper_transcriptions WHERE id = ?", [id]);
  await persist();
}
