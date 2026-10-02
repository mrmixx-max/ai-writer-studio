// WP 9.2 — Whisper Live-Diktat mit Typografie-Autokorrektur.
//
// Vollständig lokal und deterministisch: Es gibt KEINEN LLM-Aufruf und keine
// Netzabhängigkeit. Die Transkription stammt aus der browserinternen
// Web-Speech-API (SpeechRecognition); MediaRecorder zeichnet parallel das
// Audio auf. `normalizeSpokenText` wandelt gesprochene Satzzeichen in echte
// Glyphen um — eine reine, deterministische Funktion ohne Seiteneffekte.
//
// Alle Funktionen sind defensiv: fehlende Browser-APIs, `null`-Editoren oder
// werfende Callbacks führen zu einem sauberen No-op/Fallback statt zum Absturz.
//
// Abgrenzung: Der bestehende `src/services/whisper` deckt die Einzel-
// Transkription (inkl. Retry/Timeout) ab. Dieser Service ergänzt das Live-
// Diktat: laufende Aufnahme, Delta-Callback, gesprochene Satzzeichen und
// Cursor-Einfügung.

// ---------------------------------------------------------------------------
// Minimale, browser- und testfreundliche Typen (kein DOM-Zwang in Tests)
// ---------------------------------------------------------------------------

export interface SpeechAlternativeLike {
  transcript?: unknown;
}

export interface SpeechResultLike {
  isFinal?: unknown;
  [alternative: number]: SpeechAlternativeLike | undefined;
}

export interface SpeechResultListLike {
  length: number;
  [result: number]: SpeechResultLike | undefined;
}

export interface SpeechResultEventLike {
  results?: SpeechResultListLike;
}

export interface SpeechErrorEventLike {
  error?: unknown;
}

export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives?: number;
  onstart?: (() => void) | null;
  onresult?: ((event: SpeechResultEventLike) => void) | null;
  onerror?: ((event: SpeechErrorEventLike) => void) | null;
  onend?: (() => void) | null;
  start(): void;
  stop(): void;
  abort?(): void;
}

export interface MediaRecorderLike {
  state?: string;
  ondataavailable?: ((event: { data?: unknown }) => void) | null;
  onstop?: (() => void) | null;
  onerror?: ((event: unknown) => void) | null;
  start(timeslice?: number): void;
  stop(): void;
}

export interface MediaStreamLike {
  getTracks?(): { stop(): void }[];
}

export interface DictationOptions {
  /** BCP-47-Sprachkürzel (Default "de-DE"). */
  language?: string;
  /** Injizierbar (Tests): liefert eine SpeechRecognition-Instanz. */
  createRecognition?: () => SpeechRecognitionLike | null;
  /** Injizierbar (Tests): getUserMedia. */
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStreamLike>;
  /** Injizierbar (Tests): MediaRecorder-Konstruktor. */
  createRecorder?: (stream: MediaStreamLike) => MediaRecorderLike | null;
  /** Statusmeldungen (Aufnahme läuft, Transkribiert …). */
  onStatus?: (status: string) => void;
  /** Fehler-Callback. Wird nie geworfen. */
  onError?: (error: Error) => void;
  /** Gesprochene Satzzeichen normalisieren (Default true). */
  normalize?: boolean;
  /** Sicherheits-Timeout beim Stoppen, falls onend nie feuert (Default 1500). */
  stopTimeoutMs?: number;
}

export const DEFAULT_DICTATION_LANGUAGE = "de-DE";
export const DEFAULT_STOP_TIMEOUT_MS = 1500;

// ---------------------------------------------------------------------------
// Gesprochene Satzzeichen → echte Glyphen
// ---------------------------------------------------------------------------

/**
 * Gesprochene Satzzeichen, die in Glyphen umgewandelt werden.
 *
 * Reihenfolge ist wichtig: Mehrwort-Befehle („neuer absatz“, „neue zeile“,
 * „anführungszeichen …“) stehen vor kürzeren, damit sie zuerst greifen.
 * Erweiterbar über diese Liste.
 */
export const SPOKEN_PUNCTUATION_MAP: ReadonlyArray<{
  spoken: string;
  glyph: string;
  /**
   * Beim Ersetzen auch den folgenden Whitespace verschlingen. Nötig für
   * Befehle, deren Glyph direkt am Folgewort kleben soll (öffnendes
   * Anführungszeichen, Absatz-/Zeilenumbruch).
   */
  consumeTrailingSpace?: boolean;
}> = [
  { spoken: "neue zeile", glyph: "\n", consumeTrailingSpace: true },
  { spoken: "neuer absatz", glyph: "\n\n", consumeTrailingSpace: true },
  { spoken: "anführungszeichen unten", glyph: "„", consumeTrailingSpace: true },
  { spoken: "anführungszeichen oben", glyph: "“" },
  { spoken: "gedankenstrich", glyph: "—" },
  { spoken: "punkt", glyph: "." },
  { spoken: "komma", glyph: "," },
  { spoken: "fragezeichen", glyph: "?" },
  { spoken: "ausrufezeichen", glyph: "!" },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Baut das Erkennungsmuster für ein gesprochenes Satzzeichen.
 *
 * - Führender Whitespace wird mitkonsumiert (→ "Satz Punkt" wird "Satz.").
 * - Satzzeichen dürfen ihr Glyph bereits angehängt haben ("Punkt." → ".").
 * - `consumeTrailingSpace` schluckt auch den Whitespace NACH dem Befehl
 *   (öffnendes Anführungszeichen, Absatz-/Zeilenumbruch).
 * - `\b` verhindert Treffer in Wortinneren ("Punkte" bleibt unangetastet).
 */
function buildSpokenPattern(
  spoken: string,
  glyph: string,
  consumeTrailingSpace = false,
): RegExp {
  const words = spoken
    .trim()
    .split(/\s+/)
    .map(escapeRegExp)
    .join("\\s+");
  const trailing = consumeTrailingSpace ? "\\s*" : `${escapeRegExp(glyph)}?`;
  return new RegExp(`\\s*${words}\\b${trailing}`, "giu");
}

const SPOKEN_PATTERNS: ReadonlyArray<{ pattern: RegExp; glyph: string }> = SPOKEN_PUNCTUATION_MAP.map(
  ({ spoken, glyph, consumeTrailingSpace }) => ({
    pattern: buildSpokenPattern(spoken, glyph, consumeTrailingSpace),
    glyph,
  }),
);

/**
 * Wandelt gesprochene Satzzeichen in echte Glyphen um.
 *
 * Beispiele:
 *   "Hallo Welt Punkt"            → "Hallo Welt."
 *   "Hallo Komma Welt"            → "Hallo, Welt"
 *   "Wie geht es dir Fragezeichen"→ "Wie geht es dir?"
 *   "Los Ausrufezeichen"          → "Los!"
 *   "Zeile eins Neue Zeile zwei"  → "Zeile eins\nzeile zwei"
 *
 * Deterministisch und rein. Nicht-Strings (null/undefined/…) ergeben "".
 */
export function normalizeSpokenText(text: string): string {
  if (typeof text !== "string" || text.length === 0) return "";
  let out = text;
  for (const { pattern, glyph } of SPOKEN_PATTERNS) {
    out = out.replace(pattern, () => glyph);
  }
  // Durch die Ersetzungen entstandene Doppel-Leerzeichen zusammenfassen.
  out = out.replace(/[ \t]{2,}/g, " ");
  return out;
}

// ---------------------------------------------------------------------------
// Sitzungszustand (modulweit, ein aktives Diktat)
// ---------------------------------------------------------------------------

interface DictationSession {
  options: DictationOptions;
  callback: (text: string) => void;
  recognition: SpeechRecognitionLike | null;
  recorder: MediaRecorderLike | null;
  stream: MediaStreamLike | null;
  finalText: string;
  interimText: string;
  audioChunks: unknown[];
  stopping: boolean;
  ended: boolean;
  stopResolvers: ((text: string) => void)[];
  stopTimer: ReturnType<typeof setTimeout> | null;
}

let session: DictationSession | null = null;

// ---------------------------------------------------------------------------
// Helfer
// ---------------------------------------------------------------------------

function safeInvoke<T>(fn: ((arg: T) => void) | undefined | null, arg: T): void {
  if (typeof fn === "function") {
    try {
      fn(arg);
    } catch {
      /* Nutzer-Callback darf den Dienst nie brechen */
    }
  }
}

function reportError(options: DictationOptions, error: unknown): void {
  const err =
    error instanceof Error
      ? error
      : new Error(typeof error === "string" ? error : "Unbekannter Diktat-Fehler");
  safeInvoke(options.onError, err);
}

function status(options: DictationOptions, message: string): void {
  safeInvoke(options.onStatus, message);
}

/** Verkettet Transkriptstücke ohne Leerzeichen vor Satzzeichen. */
export function joinTranscript(existing: string, addition: string): string {
  if (!existing) return addition;
  if (!addition) return existing;
  if (/^[.,!?;:)\]…]/.test(addition)) return existing + addition;
  return `${existing} ${addition}`;
}

/**
 * Prüft, ob ein MediaRecorder-Datenstück tatsächlich Audio enthält.
 *
 * Leere/silente Puffer (`null`, `undefined`, 0 Bytes, leere Blobs) liefern
 * `false` und werden vom Recorder lautlos verworfen — sie landen nicht im
 * Audiopuffer der Sitzung. Reine, deterministische Funktion ohne Seiteneffekte.
 */
export function isMeaningfulAudioChunk(data: unknown): boolean {
  if (data == null) return false;
  if (typeof data === "string") return data.length > 0;
  if (typeof (data as { size?: unknown }).size === "number") {
    return (data as { size: number }).size > 0;
  }
  if (typeof (data as { byteLength?: unknown }).byteLength === "number") {
    return (data as { byteLength: number }).byteLength > 0;
  }
  // Unbekannte, aber vorhandene Datenobjekte gelten als verwertbar.
  return true;
}

function extractResults(event: SpeechResultEventLike | null | undefined): {
  finalParts: string[];
  interimParts: string[];
} {
  const finalParts: string[] = [];
  const interimParts: string[] = [];
  const results = event?.results;
  if (!results || typeof results.length !== "number") return { finalParts, interimParts };
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (!result) continue;
    const transcript = result[0]?.transcript;
    if (typeof transcript !== "string" || transcript.trim() === "") continue;
    if (result.isFinal === false) interimParts.push(transcript);
    else finalParts.push(transcript);
  }
  return { finalParts, interimParts };
}

function resolveSpeechCtor(): (new () => SpeechRecognitionLike) | null {
  const g = globalThis as unknown as {
    window?: Record<string, unknown>;
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const scope = (g.window ?? (g as unknown as Record<string, unknown>)) as Record<string, unknown>;
  const ctor = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
  return typeof ctor === "function" ? (ctor as new () => SpeechRecognitionLike) : null;
}

function resolveRecorderCtor(): (new (stream: MediaStreamLike, options?: unknown) => MediaRecorderLike) | null {
  const g = globalThis as unknown as { window?: Record<string, unknown>; MediaRecorder?: unknown };
  const scope = (g.window ?? (g as unknown as Record<string, unknown>)) as Record<string, unknown>;
  const ctor = scope.MediaRecorder;
  return typeof ctor === "function"
    ? (ctor as new (stream: MediaStreamLike, options?: unknown) => MediaRecorderLike)
    : null;
}

function resolveGetUserMedia(): ((constraints: MediaStreamConstraints) => Promise<MediaStreamLike>) | null {
  const g = globalThis as unknown as {
    navigator?: { mediaDevices?: { getUserMedia?: unknown } };
    window?: { navigator?: { mediaDevices?: { getUserMedia?: unknown } } };
  };
  const nav = g.navigator ?? g.window?.navigator;
  const fn = nav?.mediaDevices?.getUserMedia;
  if (typeof fn !== "function") return null;
  return (fn as (constraints: MediaStreamConstraints) => Promise<MediaStreamLike>).bind(
    nav?.mediaDevices,
  );
}

// ---------------------------------------------------------------------------
// Ergebnis-/Fehler-/Ende-Handler
// ---------------------------------------------------------------------------

function handleResult(s: DictationSession, event: SpeechResultEventLike | null | undefined): void {
  const { finalParts, interimParts } = extractResults(event);
  if (finalParts.length > 0) {
    const raw = finalParts.join(" ");
    const text = (s.options.normalize === false ? raw : normalizeSpokenText(raw)).trim();
    if (text) {
      s.finalText = joinTranscript(s.finalText, text);
      // Delta-Semantik: der Callback erhält das neu finalisierte Textstück.
      safeInvoke(s.callback, text);
      status(s.options, "Transkribiert");
    }
  }
  if (interimParts.length > 0) {
    s.interimText = interimParts.join(" ");
  }
}

function handleError(
  event: SpeechErrorEventLike | null | undefined,
  options: DictationOptions,
): void {
  const code = typeof event?.error === "string" ? event.error : "unbekannt";
  // "no-speech"/"aborted" sind beim Live-Diktat normal (Stille, Nutzer-Stopp).
  if (code === "no-speech" || code === "aborted") {
    status(options, "Keine Sprache erkannt");
    return;
  }
  reportError(options, new Error(`Spracherkennung Fehler: ${code}`));
}

function handleEnd(s: DictationSession): void {
  s.ended = true;
  if (s.stopping) finishStop(s);
}

function finishStop(s: DictationSession): void {
  if (s.stopTimer) {
    clearTimeout(s.stopTimer);
    s.stopTimer = null;
  }
  const text = (s.finalText ?? "").trim();
  const resolvers = s.stopResolvers;
  s.stopResolvers = [];
  if (session === s) session = null;
  for (const resolve of resolvers) {
    try {
      resolve(text);
    } catch {
      /* Resolver dürfen nicht werfen */
    }
  }
}

// ---------------------------------------------------------------------------
// MediaRecorder (parallel zur Transkription, rein defensiv)
// ---------------------------------------------------------------------------

async function startRecorder(s: DictationSession, options: DictationOptions): Promise<void> {
  try {
    const getMedia = options.getUserMedia ?? resolveGetUserMedia();
    if (!getMedia) return;
    const stream = await getMedia({ audio: true });
    // Sitzung wurde inzwischen neu gestartet → Ergebnis verwerfen.
    if (session !== s) return;
    s.stream = stream;

    let recorder: MediaRecorderLike | null = null;
    if (options.createRecorder) {
      recorder = options.createRecorder(stream);
    } else {
      const Ctor = resolveRecorderCtor();
      recorder = Ctor ? new Ctor(stream) : null;
    }
    if (!recorder) return;

    recorder.ondataavailable = (ev) => {
      // Leere/silente Puffer lautlos verwerfen — sie gehören nicht ins Diktat.
      if (ev && isMeaningfulAudioChunk(ev.data)) s.audioChunks.push(ev.data);
    };
    recorder.onerror = (ev) => {
      reportError(options, ev instanceof Error ? ev : new Error("MediaRecorder Fehler"));
    };
    recorder.start();
    s.recorder = recorder;
    status(options, "Aufnahme läuft…");
  } catch (error) {
    // Mikrofon verweigert/fehlt → Diktat läuft per Web Speech API weiter.
    reportError(options, error);
  }
}

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

/**
 * Startet das Live-Diktat.
 *
 * @param callback Erhält bei jedem finalisierten Sprachsegment das neue,
 *                 normalisierte Textstück (Delta) — zum Anhängen/Einfügen.
 * @param options  Sprache, injizierbare Browser-APIs, Status-/Fehler-Callbacks.
 *
 * Startet immer die Spracherkennung und, sofern verfügbar, parallel die
 * Audio-Aufnahme via MediaRecorder. Wirft nie.
 */
export function startDictation(callback: (text: string) => void, options: DictationOptions = {}): void {
  // Laufende Sitzung defensiv beenden, bevor eine neue beginnt.
  if (session) {
    void stopDictation().catch(() => {
      /* ignore */
    });
  }

  const s: DictationSession = {
    options,
    callback: typeof callback === "function" ? callback : () => {},
    recognition: null,
    recorder: null,
    stream: null,
    finalText: "",
    interimText: "",
    audioChunks: [],
    stopping: false,
    ended: false,
    stopResolvers: [],
    stopTimer: null,
  };
  session = s;

  // 1) Spracherkennung
  let recognition: SpeechRecognitionLike | null = null;
  try {
    if (options.createRecognition) {
      recognition = options.createRecognition();
    } else {
      const Ctor = resolveSpeechCtor();
      recognition = Ctor ? new Ctor() : null;
    }
  } catch (error) {
    reportError(options, error);
    recognition = null;
  }

  if (recognition) {
    try {
      recognition.lang =
        typeof options.language === "string" && options.language ? options.language : DEFAULT_DICTATION_LANGUAGE;
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => status(options, "Aufnahme läuft…");
      recognition.onresult = (event) => handleResult(s, event);
      recognition.onerror = (event) => handleError(event, options);
      recognition.onend = () => handleEnd(s);
      s.recognition = recognition;
      recognition.start();
    } catch (error) {
      reportError(options, error);
      s.recognition = null;
    }
  } else {
    status(options, "Spracherkennung nicht unterstützt");
  }

  // 2) Audio-Aufnahme (parallel, nicht blockierend)
  void startRecorder(s, options);
}

/**
 * Stoppt das Live-Diktat und gibt das gesamte normalisierte Transkript zurück.
 *
 * Resolvet immer (auch ohne aktive Sitzung mit ""). Wartet auf `onend` der
 * Spracherkennung, aber höchstens `stopTimeoutMs` (Default 1500 ms), damit ein
 * ausbleibendes Event das Promise nicht hängen lässt.
 */
export function stopDictation(): Promise<string> {
  const s = session;
  if (!s) return Promise.resolve("");

  return new Promise<string>((resolve) => {
    s.stopping = true;
    s.stopResolvers.push(resolve);

    // Recorder + Mikrofon-Tracks freigeben.
    try {
      s.recorder?.stop();
    } catch {
      /* ignore */
    }
    s.recorder = null;
    try {
      s.stream?.getTracks?.().forEach((track) => {
        try {
          track.stop();
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* ignore */
    }
    s.stream = null;

    // Spracherkennung stoppen; auf onend warten (mit Sicherheits-Timeout).
    if (s.recognition && !s.ended) {
      try {
        s.recognition.stop();
      } catch {
        /* ignore */
      }
      const timeoutMs =
        typeof s.options.stopTimeoutMs === "number" && s.options.stopTimeoutMs >= 0
          ? s.options.stopTimeoutMs
          : DEFAULT_STOP_TIMEOUT_MS;
      s.stopTimer = setTimeout(() => finishStop(s), timeoutMs);
    } else {
      finishStop(s);
    }
  });
}

/**
 * Fügt `text` an der aktuellen Cursorposition des Editors ein.
 *
 * Unterstützt:
 *  - TipTap-Editor (Editor-Instanz): `editor.chain().focus().insertContent(text).run()`
 *  - Objekte mit direkter `insertContent(text)`-Methode
 *  - `<textarea>`/`<input>` (value + selectionStart/End) inkl. Cursor-Setzen
 *
 * Defensiv: `null`-Editor, leerer Text oder werfende Methoden → No-op.
 */
export function insertAtCursor(editor: unknown, text: string): void {
  if (typeof text !== "string" || text.length === 0) return;
  if (!editor) return;

  const ed = editor as {
    chain?: () => unknown;
    insertContent?: (t: string) => unknown;
    value?: unknown;
    selectionStart?: unknown;
    selectionEnd?: unknown;
    setSelectionRange?: (s: number, e: number) => void;
    dispatchEvent?: (e: unknown) => boolean;
  };

  // 1) TipTap-Chain
  try {
    if (typeof ed.chain === "function") {
      const chain = ed.chain() as {
        focus?: () => unknown;
        insertContent?: (t: string) => unknown;
        run?: () => unknown;
      } | null;
      if (
        chain &&
        typeof chain.focus === "function" &&
        typeof chain.insertContent === "function" &&
        typeof chain.run === "function"
      ) {
        chain.focus();
        chain.insertContent(text);
        chain.run();
        return;
      }
    }
  } catch {
    /* Fallback unten */
  }

  // 2) Direkte insertContent-Methode
  try {
    if (typeof ed.insertContent === "function") {
      ed.insertContent(text);
      return;
    }
  } catch {
    /* Fallback unten */
  }

  // 3) Textfeld (textarea/input)
  try {
    if (typeof ed.value === "string" && typeof ed.selectionStart === "number") {
      const start = ed.selectionStart as number;
      const end = typeof ed.selectionEnd === "number" ? (ed.selectionEnd as number) : start;
      const before = ed.value.slice(0, start);
      const after = ed.value.slice(end);
      ed.value = before + text + after;
      const pos = before.length + text.length;
      if (typeof ed.setSelectionRange === "function") ed.setSelectionRange(pos, pos);
      if (typeof ed.dispatchEvent === "function" && typeof Event === "function") {
        ed.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  } catch {
    /* No-op */
  }
}

/**
 * Setzt den modulweiten Sitzungszustand zurück (defensiv, u. a. für Tests).
 * Beendet eine laufende Erkennung/Aufnahme, ohne das Transkript zu liefern.
 */
export function resetDictationState(): void {
  const s = session;
  if (s) {
    if (s.stopTimer) clearTimeout(s.stopTimer);
    try {
      s.recognition?.abort?.();
    } catch {
      /* ignore */
    }
    try {
      s.recorder?.stop();
    } catch {
      /* ignore */
    }
    try {
      s.stream?.getTracks?.().forEach((track) => {
        try {
          track.stop();
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* ignore */
    }
  }
  session = null;
}
