// Voice-Lab-Engine (Sprint 20, Agent 2): Aufnahme + Transkription + Export.
//
// Standalone-Service — bewusst KEINE Abhaengigkeit zu Settings-Store,
// Provider-Schicht oder anderen Panels (weder Import noch Aenderung dort).
// Transkription laeuft ueber einen Whisper-kompatiblen
// `/v1/audio/transcriptions`-Endpunkt (OpenAI-kompatibel, z. B. lokales
// Whisper-Gateway). `fetchFn`/`endpoint` sind injizierbar (Tests).

export interface VoiceLabConfig {
  language: "de" | "en";
  model: string;
  autoPunctuate: boolean;
  speakerDiarization: boolean;
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
  language: string;
  duration: number;
}

export type TranscriptionExportFormat = "txt" | "srt" | "vtt";

export const DEFAULT_VOICE_LAB_CONFIG: VoiceLabConfig = {
  language: "de",
  model: "whisper-1",
  autoPunctuate: true,
  speakerDiarization: false,
};

/** Standard-Endpunkt (OpenAI-kompatibel) — per `deps.endpoint` ueberschreibbar. */
export const VOICE_LAB_DEFAULT_ENDPOINT =
  "http://localhost:11434/v1/audio/transcriptions";

export interface TranscribeDeps {
  fetchFn?: typeof fetch;
  endpoint?: string;
}

export interface RecordDeps {
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  Recorder?: typeof MediaRecorder;
}

function errorMessage(status: number, body: string): string {
  const detail = body.trim().slice(0, 200);
  return detail
    ? `Transkription fehlgeschlagen (HTTP ${status}): ${detail}`
    : `Transkription fehlgeschlagen (HTTP ${status})`;
}

/** Haengt Satzzeichen an, wenn der Text ohne endet (Auto-Punktuierung). */
export function punctuate(text: string): string {
  const t = text.trim();
  if (!t) return t;
  return /[.!?…:;,]$/.test(t) ? t : `${t}.`;
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

/** Sekunden -> "HH:MM:SS,mmm" (SRT). Negative/clamp-gesichert. */
export function formatSrtTimestamp(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s - Math.floor(s)) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(sec)},${String(ms).padStart(3, "0")}`;
}

/** Sekunden -> "HH:MM:SS.mmm" (VTT). */
export function formatVttTimestamp(totalSeconds: number): string {
  return formatSrtTimestamp(totalSeconds).replace(",", ".");
}

interface RawSegment {
  start?: number;
  end?: number;
  text?: string;
  speaker?: string;
}

function normalizeSegments(raw: unknown): TranscriptionSegment[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawSegment[]).map((s, i) => ({
    start: typeof s.start === "number" && s.start >= 0 ? s.start : i,
    end:
      typeof s.end === "number" && s.end >= 0
        ? s.end
        : (typeof s.start === "number" ? s.start : i) + 1,
    text: typeof s.text === "string" ? s.text.trim() : "",
    ...(typeof s.speaker === "string" ? { speaker: s.speaker } : {}),
  }));
}

/**
 * Transkribiert Audio via Whisper-kompatiblem Endpunkt.
 * Erwartet `verbose_json` ({text, language, duration, segments}) —
 * toleriert auch Minimal-Antworten ({text}).
 */
export async function transcribeAudio(
  audioBlob: Blob,
  config: VoiceLabConfig,
  deps: TranscribeDeps = {},
): Promise<TranscriptionResult> {
  const fetchFn = deps.fetchFn ?? fetch;
  const endpoint = deps.endpoint ?? VOICE_LAB_DEFAULT_ENDPOINT;

  const form = new FormData();
  form.append("file", audioBlob, "recording.webm");
  form.append("model", config.model);
  form.append("language", config.language);
  form.append("response_format", "verbose_json");

  const res = await fetchFn(endpoint, { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(errorMessage(res.status, body));
  }
  const data = (await res.json()) as {
    text?: unknown;
    language?: unknown;
    duration?: unknown;
    segments?: unknown;
  };

  let segments = normalizeSegments(data.segments);
  if (config.autoPunctuate) {
    segments = segments.map((s) => ({ ...s, text: punctuate(s.text) }));
  }
  if (config.speakerDiarization) {
    segments = segments.map((s, i) => ({
      ...s,
      speaker: s.speaker ?? `Sprecher ${(i % 2) + 1}`,
    }));
  }

  const text =
    typeof data.text === "string" && data.text.trim()
      ? data.text.trim()
      : segments.map((s) => s.text).filter(Boolean).join(" ");
  const language =
    typeof data.language === "string" && data.language
      ? data.language
      : config.language;
  const duration =
    typeof data.duration === "number" && data.duration >= 0
      ? data.duration
      : segments.length > 0
        ? segments[segments.length - 1].end
        : 0;

  return { text, segments, language, duration };
}

/** Startet die Mikrofon-Aufnahme und gibt den laufenden Recorder zurueck. */
export async function startRecording(deps: RecordDeps = {}): Promise<MediaRecorder> {
  const getUserMedia =
    deps.getUserMedia ?? navigator?.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  const Recorder = deps.Recorder ?? (typeof MediaRecorder !== "undefined" ? MediaRecorder : undefined);
  if (!getUserMedia) throw new Error("Mikrofon-Aufnahme wird nicht unterstützt (kein getUserMedia).");
  if (!Recorder) throw new Error("Mikrofon-Aufnahme wird nicht unterstützt (kein MediaRecorder).");
  const stream = await getUserMedia({ audio: true });
  const recorder = new Recorder(stream);
  recorder.start();
  return recorder;
}

/**
 * Stoppt die Aufnahme und gibt den Audio-Blob zurueck.
 * Sammelt `dataavailable`-Chunks; loest beim `stop`-Event auf.
 */
export function stopRecording(recorder: MediaRecorder): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const chunks: BlobPart[] = [];
    const mimeType = recorder.mimeType || "audio/webm";
    const done = () => {
      try {
        resolve(new Blob(chunks, { type: mimeType }));
      } catch (e) {
        reject(e);
      }
    };
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.onerror = () => reject(new Error("Aufnahme fehlgeschlagen."));
    recorder.onstop = done;
    try {
      if (recorder.state !== "inactive") recorder.stop();
      else done();
    } catch (e) {
      reject(e);
    }
  });
}

/** Exportiert eine Transkription als TXT, SRT oder VTT. */
export function exportTranscription(
  result: TranscriptionResult,
  format: TranscriptionExportFormat,
): string {
  if (format === "txt") {
    const body = result.segments.length > 0
      ? result.segments
          .map((s) =>
            s.speaker ? `[${s.speaker}] ${s.text}`.trim() : s.text,
          )
          .filter(Boolean)
          .join("\n")
      : result.text;
    return body.endsWith("\n") ? body : `${body}\n`;
  }
  if (format === "srt") {
    return result.segments
      .map(
        (s, i) =>
          `${i + 1}\n${formatSrtTimestamp(s.start)} --> ${formatSrtTimestamp(s.end)}\n${s.speaker ? `[${s.speaker}] ` : ""}${s.text}\n`,
      )
      .join("\n");
  }
  const body = result.segments
    .map(
      (s) =>
        `${formatVttTimestamp(s.start)} --> ${formatVttTimestamp(s.end)}\n${s.speaker ? `<v ${s.speaker}>` : ""}${s.text}${s.speaker ? "</v>" : ""}\n`,
    )
    .join("\n");
  return `WEBVTT\n\n${body}`;
}
