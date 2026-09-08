// VoiceLabPanel: Sprachaufnahme + Transkription + Export (Sprint 20, Agent 2).
//
// Standalone-Panel — bewusst KEINE Abhaengigkeit zu VoiceLab (voices-Modus),
// BookWriterDashboard oder anderen Panels (weder Import noch Aenderung dort).
// Aufnahme via MediaRecorder, Transkription via `@/services/voice/voiceLab`
// (injizierbar fuer Tests), "Im Editor oeffnen" via `useEditorStore.insertAtEnd`.
//
// Bloomberg-Terminal-Stil: bg #000, accent #ffa028, border #333,
// monospace (IBM Plex Mono).

import { useEffect, useRef, useState } from "react";
import {
  transcribeAudio,
  startRecording,
  stopRecording,
  exportTranscription,
  DEFAULT_VOICE_LAB_CONFIG,
  type TranscriptionResult,
  type TranscriptionExportFormat,
  type VoiceLabConfig,
} from "@/services/voice/voiceLab";
import { useEditorStore } from "@/store/editorStore";

export interface VoiceLabPanelProps {
  /** Injizierbare Transkriptions-Funktion (Mock in Tests, Default: echte Engine). */
  transcribe?: typeof transcribeAudio;
  /** Wohin das Transkript geht (Default: Editor-Store `insertAtEnd`). */
  onOpenInEditor?: (text: string) => void;
  className?: string;
}

type Status = "idle" | "recording" | "transcribing" | "done" | "error";

const ACCENT = "#ffa028";

const PANEL_STYLE: React.CSSProperties = {
  background: "#000",
  color: "#e8e8e8",
  border: "1px solid #333",
  fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
  padding: 12,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const BTN_STYLE: React.CSSProperties = {
  background: "#000",
  color: ACCENT,
  border: `1px solid ${ACCENT}`,
  fontFamily: "inherit",
  padding: "8px 12px",
  cursor: "pointer",
};

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function download(filename: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function VoiceLabPanel({
  transcribe,
  onOpenInEditor,
  className,
}: VoiceLabPanelProps) {
  const doTranscribe = transcribe ?? transcribeAudio;
  const insertAtEnd = useEditorStore((s) => s.insertAtEnd);

  const [status, setStatus] = useState<Status>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [language, setLanguage] = useState<VoiceLabConfig["language"]>(
    DEFAULT_VOICE_LAB_CONFIG.language,
  );
  const [model, setModel] = useState(DEFAULT_VOICE_LAB_CONFIG.model);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopWaveform = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      audioCtxRef.current?.close();
    } catch {
      /* ignore */
    }
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    });
    streamRef.current = null;
  };

  useEffect(
    () => () => {
      stopTimer();
      stopWaveform();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [],
  );

  const drawWaveform = (stream: MediaStream) => {
    try {
      const canvas = canvasRef.current;
      if (!canvas || typeof AudioContext === "undefined") return;
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const g = canvas.getContext("2d");
      if (!g) return;
      const render = () => {
        analyser.getByteFrequencyData(data);
        g.fillStyle = "#000";
        g.fillRect(0, 0, canvas.width, canvas.height);
        const barW = canvas.width / data.length;
        g.fillStyle = ACCENT;
        data.forEach((v, i) => {
          const h = (v / 255) * canvas.height;
          g.fillRect(i * barW, canvas.height - h, Math.max(1, barW - 1), h);
        });
        rafRef.current = requestAnimationFrame(render);
      };
      render();
    } catch {
      /* Waveform ist Deko — kein harter Fehler */
    }
  };

  const handleRecord = async () => {
    setError(null);
    setResult(null);
    try {
      const recorder = await startRecording();
      recorderRef.current = recorder;
      const stream = (recorder as unknown as { stream?: MediaStream }).stream;
      if (stream) {
        streamRef.current = stream;
        drawWaveform(stream);
      }
      setElapsed(0);
      setStatus("recording");
      timerRef.current = window.setInterval(
        () => setElapsed((e) => e + 1),
        1000,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  };

  const runTranscription = async (blob: Blob) => {
    setStatus("transcribing");
    try {
      const r = await doTranscribe(blob, {
        language,
        model: model.trim() || DEFAULT_VOICE_LAB_CONFIG.model,
        autoPunctuate: true,
        speakerDiarization: false,
      });
      setResult(r);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  };

  const handleStop = async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    stopTimer();
    stopWaveform();
    try {
      const blob = await stopRecording(recorder);
      recorderRef.current = null;
      blobRef.current = blob;
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(blob));
      await runTranscription(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  };

  const handleRetryTranscribe = () => {
    if (blobRef.current) void runTranscription(blobRef.current);
  };

  const handleExport = (format: TranscriptionExportFormat) => {
    if (!result) return;
    const mime =
      format === "txt"
        ? "text/plain"
        : format === "srt"
          ? "application/x-subrip"
          : "text/vtt";
    download(
      `transkript.${format}`,
      exportTranscription(result, format),
      mime,
    );
  };

  const handleOpenInEditor = () => {
    if (!result?.text) return;
    if (onOpenInEditor) onOpenInEditor(result.text);
    else insertAtEnd(result.text);
  };

  const recording = status === "recording";
  const busy = status === "recording" || status === "transcribing";

  return (
    <section
      data-testid="voicelab-panel"
      className={className}
      style={PANEL_STYLE}
      aria-label="Voice Lab"
    >
      <header style={{ color: ACCENT, fontWeight: "bold" }}>
        🎙️ VOICE LAB — Aufnahme + Transkription
      </header>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {!recording ? (
          <button
            data-testid="voicelab-record-btn"
            style={{ ...BTN_STYLE, background: "#a00", borderColor: "#a00", color: "#fff", fontSize: 16 }}
            onClick={handleRecord}
            disabled={busy}
            aria-label="Aufnahme starten"
          >
            ● AUFNAHME
          </button>
        ) : (
          <button
            data-testid="voicelab-stop-btn"
            style={{ ...BTN_STYLE, fontSize: 16 }}
            onClick={handleStop}
            aria-label="Aufnahme stoppen"
          >
            ■ STOP
          </button>
        )}
        <span data-testid="voicelab-timer" aria-label="Aufnahmedauer">
          ⏱ {formatElapsed(elapsed)}
        </span>
        {status === "transcribing" && <span>Transkribiere…</span>}
      </div>

      <canvas
        data-testid="voicelab-waveform"
        ref={canvasRef}
        width={320}
        height={64}
        style={{ width: "100%", border: "1px solid #333", background: "#000" }}
        aria-label="Audio-Waveform"
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label>
          Sprache{" "}
          <select
            data-testid="voicelab-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as "de" | "en")}
            style={{ background: "#000", color: ACCENT, border: "1px solid #333", fontFamily: "inherit" }}
          >
            <option value="de">DE</option>
            <option value="en">EN</option>
          </select>
        </label>
        <label>
          Modell{" "}
          <input
            data-testid="voicelab-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={{ background: "#000", color: "#e8e8e8", border: "1px solid #333", fontFamily: "inherit" }}
          />
        </label>
      </div>

      {audioUrl && (
        <audio data-testid="voicelab-playback" src={audioUrl} controls style={{ width: "100%" }} />
      )}

      {blobRef.current && status === "error" && (
        <button data-testid="voicelab-transcribe-btn" style={BTN_STYLE} onClick={handleRetryTranscribe}>
          🔁 Erneut transkribieren
        </button>
      )}

      {error && (
        <div data-testid="voicelab-error" role="alert" style={{ color: "#ff5555" }}>
          ⚠ {error}
        </div>
      )}

      <div
        data-testid="voicelab-transcript"
        aria-label="Transkript"
        style={{
          border: "1px solid #333",
          minHeight: 120,
          maxHeight: 240,
          overflowY: "auto",
          padding: 8,
          whiteSpace: "pre-wrap",
        }}
      >
        {result ? result.text : "(Noch kein Transkript — Aufnahme starten.)"}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button data-testid="voicelab-export-txt" style={BTN_STYLE} onClick={() => handleExport("txt")} disabled={!result}>
          ⬇ TXT
        </button>
        <button data-testid="voicelab-export-srt" style={BTN_STYLE} onClick={() => handleExport("srt")} disabled={!result}>
          ⬇ SRT
        </button>
        <button data-testid="voicelab-export-vtt" style={BTN_STYLE} onClick={() => handleExport("vtt")} disabled={!result}>
          ⬇ VTT
        </button>
        <button
          data-testid="voicelab-open-in-editor"
          style={BTN_STYLE}
          onClick={handleOpenInEditor}
          disabled={!result?.text}
        >
          📝 Im Editor öffnen
        </button>
      </div>
    </section>
  );
}
