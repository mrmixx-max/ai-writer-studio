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

// --- Robustness-Bausteine (Sprint 12, Agent 1) ---

/** Standard-Timeout für eine Transkription (inkl. Retries). */
export const DEFAULT_WHISPER_TIMEOUT_MS = 60_000;
/** Standard: Anzahl zusätzlicher Versuche nach transienten Fehlern. */
export const DEFAULT_WHISPER_MAX_RETRIES = 2;
/** Standard-Basis für exponentielles Backoff zwischen Versuchen. */
export const DEFAULT_WHISPER_RETRY_DELAY_MS = 200;
/** Standard-Sprache (BCP-47), wenn keine angegeben/ungültig. */
export const DEFAULT_WHISPER_LANGUAGE = "de-DE";

export interface WhisperOptions {
  /** Zusätzliche Versuche nach transienten Fehlern (Default 2). */
  maxRetries?: number;
  /** Basis-ms für Backoff: Wartezeit = basis * 2^versuch (Default 200). */
  retryDelayMs?: number;
  /** Gesamt-Timeout inkl. Retries (Default 60000). */
  timeoutMs?: number;
  /** Fortlaufende Erkennung: sammelt Partials, resolved bei onend. */
  continuous?: boolean;
  /** Zwischenstände zulassen (Default true bei continuous, sonst false). */
  interimResults?: boolean;
}

/** Transiente Web-Speech-Fehler, bei denen ein Retry lohnt. */
const TRANSIENT_ERRORS = new Set(["network", "audio-capture", "no-speech", "aborted"]);

/** True, wenn der Fehlercode einen erneuten Versuch rechtfertigt. */
export function isTransientWhisperError(code: string | undefined | null): boolean {
  if (!code) return false;
  return TRANSIENT_ERRORS.has(String(code).toLowerCase().replace(/_/g, "-"));
}

/** Normalisiert Sprachkürzel auf BCP-47 (Web-Speech-tauglich). */
export function normalizeWhisperLanguage(input: unknown): string {
  if (typeof input !== "string" || input.trim() === "") return DEFAULT_WHISPER_LANGUAGE;
  const raw = input.trim().replace(/_/g, "-");
  const shortMap: Record<string, string> = {
    de: "de-DE",
    en: "en-US",
    fr: "fr-FR",
    es: "es-ES",
    it: "it-IT",
    pt: "pt-PT",
    nl: "nl-NL",
    pl: "pl-PL",
    tr: "tr-TR",
    ru: "ru-RU",
  };
  const lower = raw.toLowerCase();
  if (shortMap[lower]) return shortMap[lower];
  const [lang, ...rest] = raw.split("-");
  if (!lang || rest.length === 0) {
    // Unbekanntes Einzelkürzel ohne Mapping: als Sprache mit Fallback-Region
    // nur übernehmen, wenn es wie ein ISO-639-Code aussieht, sonst Default.
    if (/^[a-zA-Z]{2,3}$/.test(raw)) return `${lang.toLowerCase()}-${lang.toUpperCase()}`;
    return DEFAULT_WHISPER_LANGUAGE;
  }
  return `${lang.toLowerCase()}-${rest.join("-").toUpperCase()}`;
}

/** Fügt erkannte Teilstücke zu einem Transkript zusammen. */
export function assemblePartialTranscripts(parts: unknown[]): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((p): p is string => typeof p === "string")
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .join(" ");
}

function extractEventTexts(event: any): string[] {
  const results = event?.results;
  if (!results || typeof results.length !== "number") return [];
  const out: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const t = results[i]?.[0]?.transcript;
    if (typeof t === "string" && t.trim() !== "") out.push(t);
  }
  return out;
}

function eventIsFinal(event: any): boolean {
  const results = event?.results;
  if (!results || typeof results.length !== "number" || results.length === 0) return true;
  for (let i = 0; i < results.length; i++) {
    if (results[i]?.isFinal === false) return false;
  }
  return true;
}

function getCtor(): (new () => SpeechRecognition) | undefined {
  const w = (globalThis as any).window ?? (typeof window !== "undefined" ? window : undefined);
  return w?.SpeechRecognition ?? w?.webkitSpeechRecognition;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Startet Spracherkennung und gibt Transkript zurück. */
export function recordAndTranscribe(
  _settings: any,
  _chapterId: string | null,
  onStatus: (s: string) => void,
  options: WhisperOptions = {},
): Promise<string> {
  const maxRetries = Math.max(0, options.maxRetries ?? _settings?.maxRetries ?? DEFAULT_WHISPER_MAX_RETRIES);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? _settings?.retryDelayMs ?? DEFAULT_WHISPER_RETRY_DELAY_MS);
  const timeoutMs = options.timeoutMs ?? _settings?.timeoutMs ?? DEFAULT_WHISPER_TIMEOUT_MS;
  const continuous = options.continuous ?? _settings?.continuous ?? false;
  const interimResults = options.interimResults ?? _settings?.interimResults ?? continuous;
  const language = normalizeWhisperLanguage(_settings?.language);

  return new Promise<string>((resolve, reject) => {
    const Ctor = getCtor();
    if (!Ctor) {
      reject(new Error("Web Speech API wird von diesem Browser nicht unterstützt"));
      return;
    }

    let settled = false;
    let attempts = 0;
    const parts: string[] = [];
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      activeRecognition = null;
      fn();
    };
    const ok = (text: string) => settle(() => resolve(text));
    const fail = (err: Error) => settle(() => reject(err));

    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            try {
              activeRecognition?.abort?.();
            } catch {
              /* ignore */
            }
            fail(new Error(`Spracherkennung Zeitüberschreitung nach ${timeoutMs} ms`));
          }, timeoutMs)
        : (undefined as unknown as ReturnType<typeof setTimeout>);

    const attempt = () => {
      if (settled) return;
      attempts += 1;
      let recognition: SpeechRecognition;
      try {
        recognition = new Ctor();
      } catch (e) {
        if (settled) return;
        if (attempts <= maxRetries) {
          onStatus(`Wiederholung ${attempts}/${maxRetries}…`);
          const delay = retryDelayMs * 2 ** (attempts - 1);
          void sleep(delay).then(() => {
            if (!settled) attempt();
          });
          return;
        }
        fail(e instanceof Error ? e : new Error(String(e)));
        return;
      }
      activeRecognition = recognition as SpeechRecognition;
      recognition.lang = language;
      recognition.interimResults = interimResults;
      recognition.continuous = continuous;
      (recognition as any).maxAlternatives = 1;

      (recognition as any).onstart = () => {
        onStatus("Aufnahme läuft…");
      };

      recognition.onresult = (event: any) => {
        if (settled) return;
        const texts = extractEventTexts(event);
        if (texts.length === 0) return;
        if (continuous) {
          // Nur finale Segmente sammeln; Interim löst keinen resolve aus.
          if (eventIsFinal(event)) {
            parts.push(...texts);
            onStatus("Teiltranskript…");
          } else {
            onStatus("Höre zu…");
          }
          return;
        }
        const text = assemblePartialTranscripts(texts);
        onStatus("Transkribiert");
        ok(text);
      };

      recognition.onerror = (event: any) => {
        if (settled) return;
        const code = event?.error;
        if (isTransientWhisperError(code) && attempts <= maxRetries) {
          onStatus(`Wiederholung ${attempts}/${maxRetries}…`);
          const delay = retryDelayMs * 2 ** (attempts - 1);
          void sleep(delay).then(() => {
            if (!settled) attempt();
          });
          return;
        }
        fail(new Error(`Spracherkennung Fehler: ${code}`));
      };

      recognition.onend = () => {
        if (settled) return;
        if (continuous) {
          const text = assemblePartialTranscripts(parts);
          if (text) {
            onStatus("Transkribiert");
            ok(text);
          } else {
            fail(new Error("Spracherkennung Fehler: kein Transkript (kein Ergebnis)"));
          }
          return;
        }
        // Single-shot ohne Ergebnis: auf Retry hoffen oder sauber ablehnen,
        // statt das Promise für immer hängen zu lassen.
        if (attempts <= maxRetries) {
          onStatus(`Wiederholung ${attempts}/${maxRetries}…`);
          const delay = retryDelayMs * 2 ** (attempts - 1);
          void sleep(delay).then(() => {
            if (!settled) attempt();
          });
          return;
        }
        fail(new Error("Spracherkennung Fehler: kein Transkript (kein Ergebnis)"));
      };

      try {
        recognition.start();
      } catch (e) {
        if (settled) return;
        const transient = e instanceof DOMException
          ? e.name === "InvalidStateError" || e.name === "NetworkError"
          : true;
        if (transient && attempts <= maxRetries) {
          onStatus(`Wiederholung ${attempts}/${maxRetries}…`);
          const delay = retryDelayMs * 2 ** (attempts - 1);
          void sleep(delay).then(() => {
            if (!settled) attempt();
          });
          return;
        }
        fail(e instanceof Error ? e : new Error(String(e)));
      }
    };

    attempt();
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
