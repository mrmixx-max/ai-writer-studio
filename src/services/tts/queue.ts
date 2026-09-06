// TTS-Sprechqueue (Web Speech API): sequenzielle Wiedergabe mit
// Cancel/Skip/Reorder, pro-Item Voice + Rate, Progress-Callbacks.
// Ohne WebSpeech: Feature-Detect + stiller No-Op mit Warnung, nie throw.

export interface TTSQueueItemInput {
  text: string;
  voice?: string;
  rate?: number;
}

export interface TTSQueueItem extends TTSQueueItemInput {
  id: string;
}

export type TTSQueuePhase =
  | "started"
  | "ended"
  | "skipped"
  | "cancelled"
  | "queue-done"
  | "error";

export interface TTSQueueProgress {
  itemId: string;
  itemIndex: number;
  total: number;
  phase: TTSQueuePhase;
  message?: string;
}

export type TTSQueueListener = (p: TTSQueueProgress) => void;

let nextId = 0;
function newId(): string {
  nextId += 1;
  return `q-${Date.now().toString(36)}-${nextId}`;
}

function getSynthesis(): SpeechSynthesis | null {
  try {
    const g = globalThis as unknown as {
      window?: { speechSynthesis?: SpeechSynthesis };
      speechSynthesis?: SpeechSynthesis;
    };
    if (g.window?.speechSynthesis) return g.window.speechSynthesis;
    if (g.speechSynthesis) return g.speechSynthesis;
    return null;
  } catch {
    return null;
  }
}

function getUtteranceCtor(): (new (text: string) => SpeechSynthesisUtterance) | null {
  try {
    const g = globalThis as unknown as {
      window?: { SpeechSynthesisUtterance?: new (t: string) => SpeechSynthesisUtterance };
      SpeechSynthesisUtterance?: new (t: string) => SpeechSynthesisUtterance;
    };
    return g.window?.SpeechSynthesisUtterance ?? g.SpeechSynthesisUtterance ?? null;
  } catch {
    return null;
  }
}

function warnUnavailable(method: string): void {
  try {
    console.warn(`[tts-queue] WebSpeech nicht verfuegbar — ${method} als No-Op.`);
  } catch {
    /* ignore */
  }
}

export class SpeechQueue {
  private items: TTSQueueItem[] = [];
  private currentIndex = -1;
  private speaking = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private listener: TTSQueueListener | null = null;

  constructor(listener?: TTSQueueListener) {
    if (listener) this.listener = listener;
  }

  /** True, wenn WebSpeech (speechSynthesis + Utterance) verfuegbar ist. */
  isSupported(): boolean {
    return getSynthesis() !== null && getUtteranceCtor() !== null;
  }

  onProgress(listener: TTSQueueListener | null): void {
    this.listener = listener;
  }

  get size(): number {
    return this.items.length;
  }

  get isSpeaking(): boolean {
    return this.speaking;
  }

  get currentId(): string | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.items.length) return null;
    return this.items[this.currentIndex]?.id ?? null;
  }

  /** Warteschlange als Snapshot (Kopie). */
  getQueue(): TTSQueueItem[] {
    return this.items.map((i) => ({ ...i }));
  }

  /** Haengt ein Item an; startet die Wiedergabe, wenn idle. Gibt die ID zurueck. */
  enqueue(input: TTSQueueItemInput): string {
    const item: TTSQueueItem = {
      id: newId(),
      text: input.text,
      voice: input.voice,
      rate: input.rate,
    };
    this.items.push(item);
    if (!this.isSupported()) {
      warnUnavailable("enqueue");
      return item.id;
    }
    if (!this.speaking) this.playFrom(this.currentIndex === -1 ? 0 : this.currentIndex);
    return item.id;
  }

  /** Entfernt ein wartendes Item (nicht das aktuelle). True bei Erfolg. */
  remove(id: string): boolean {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx === -1) return false;
    if (idx === this.currentIndex && this.speaking) return false;
    this.items.splice(idx, 1);
    if (idx < this.currentIndex) this.currentIndex -= 1;
    if (this.items.length === 0) this.currentIndex = -1;
    return true;
  }

  /** Verschiebt ein Item an neue Position. False bei unbekannter ID/Index. */
  reorder(id: string, toIndex: number): boolean {
    if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= this.items.length) return false;
    const from = this.items.findIndex((i) => i.id === id);
    if (from === -1) return false;
    if (from === toIndex) return true;
    // Aktuell sprechendes Item darf nicht verschoben werden.
    if (from === this.currentIndex && this.speaking) return false;
    const [moved] = this.items.splice(from, 1);
    // Zielindex bezieht sich auf die Liste nach dem Entfernen: clampen.
    const clamped = Math.max(0, Math.min(toIndex, this.items.length));
    this.items.splice(clamped, 0, moved);
    // currentIndex nachfuehren.
    if (this.speaking && this.currentIndex !== -1) {
      const curId = this.currentUtteranceId;
      this.currentIndex = this.items.findIndex((i) => i.id === curId);
    }
    return true;
  }

  /** Ueberspringt das aktuelle Item und spricht ggf. das naechste. */
  skip(): void {
    if (!this.isSupported()) {
      warnUnavailable("skip");
      return;
    }
    if (!this.speaking || this.currentIndex === -1) return;
    const synth = getSynthesis();
    const item = this.items[this.currentIndex];
    try {
      // onend des aktuellen Items unterdruecken, stattdessen skipped melden.
      if (this.currentUtterance) {
        this.currentUtterance.onend = null;
        this.currentUtterance.onerror = null;
      }
      synth?.cancel();
    } catch {
      /* cancel darf nie werfen */
    }
    this.currentUtterance = null;
    this.emit({ itemId: item.id, itemIndex: this.currentIndex, total: this.items.length, phase: "skipped" });
    this.advance();
  }

  /** Bricht alles ab und leert die Queue. Nie throw, auch ohne WebSpeech. */
  cancel(): void {
    if (!this.isSupported()) {
      // Lokalen Zustand trotzdem zuruecksetzen.
      this.items = [];
      this.currentIndex = -1;
      this.speaking = false;
      this.currentUtterance = null;
      this.currentUtteranceId = null;
      warnUnavailable("cancel");
      return;
    }
    const synth = getSynthesis();
    try {
      if (this.currentUtterance) {
        this.currentUtterance.onend = null;
        this.currentUtterance.onerror = null;
      }
      synth?.cancel();
    } catch {
      /* ignore */
    }
    const total = this.items.length;
    const idx = this.currentIndex;
    const id = this.currentId;
    this.items = [];
    this.currentIndex = -1;
    this.speaking = false;
    this.currentUtterance = null;
    this.currentUtteranceId = null;
    if (id !== null) {
      this.emit({ itemId: id, itemIndex: Math.max(0, idx), total, phase: "cancelled" });
    }
  }

  /** Alias fuer cancel(). */
  clear(): void {
    this.cancel();
  }

  private currentUtteranceId: string | null = null;

  private emit(p: TTSQueueProgress): void {
    try {
      this.listener?.(p);
    } catch {
      /* Listener-Fehler duerfen die Queue nie stoppen */
    }
  }

  private playFrom(index: number): void {
    const synth = getSynthesis();
    const Ctor = getUtteranceCtor();
    if (!synth || !Ctor) {
      this.speaking = false;
      warnUnavailable("speak");
      return;
    }
    if (index < 0 || index >= this.items.length) {
      this.speaking = false;
      this.currentIndex = -1;
      return;
    }
    this.speaking = true;
    this.currentIndex = index;
    const item = this.items[index];
    let utter: SpeechSynthesisUtterance;
    try {
      utter = new Ctor(item.text);
    } catch {
      this.emit({ itemId: item.id, itemIndex: index, total: this.items.length, phase: "error", message: "Utterance konnte nicht erstellt werden" });
      this.advance();
      return;
    }
    if (typeof item.rate === "number" && Number.isFinite(item.rate)) {
      utter.rate = Math.min(10, Math.max(0.1, item.rate));
    }
    if (item.voice) {
      try {
        const voices = synth.getVoices?.() ?? [];
        const match = voices.find((v) => v.name === item.voice || v.voiceURI === item.voice);
        if (match) utter.voice = match;
      } catch {
        /* Voice-Matching ist best-effort */
      }
    }
    this.currentUtterance = utter;
    this.currentUtteranceId = item.id;
    utter.onend = () => {
      this.currentUtterance = null;
      this.currentUtteranceId = null;
      this.emit({ itemId: item.id, itemIndex: index, total: this.items.length, phase: "ended" });
      this.advance();
    };
    utter.onerror = (ev) => {
      this.currentUtterance = null;
      this.currentUtteranceId = null;
      const msg = typeof (ev as { error?: unknown })?.error === "string" ? ((ev as { error: string }).error as string) : "speak-error";
      this.emit({ itemId: item.id, itemIndex: index, total: this.items.length, phase: "error", message: msg });
      this.advance();
    };
    this.emit({ itemId: item.id, itemIndex: index, total: this.items.length, phase: "started" });
    try {
      synth.speak(utter);
    } catch {
      this.currentUtterance = null;
      this.currentUtteranceId = null;
      this.emit({ itemId: item.id, itemIndex: index, total: this.items.length, phase: "error", message: "speak() warf" });
      this.advance();
    }
  }

  private advance(): void {
    const next = this.currentIndex + 1;
    if (next < this.items.length) {
      this.playFrom(next);
    } else {
      const lastId = this.items.length ? this.items[this.items.length - 1].id : "";
      const total = this.items.length;
      this.speaking = false;
      this.currentIndex = -1;
      this.items = [];
      this.emit({ itemId: lastId, itemIndex: Math.max(0, total - 1), total, phase: "queue-done" });
    }
  }
}

/** Factory-Hilfe: legt eine Queue mit optionalem Listener an. */
export function createSpeechQueue(listener?: TTSQueueListener): SpeechQueue {
  return new SpeechQueue(listener);
}
