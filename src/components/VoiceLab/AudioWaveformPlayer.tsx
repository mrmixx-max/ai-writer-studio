// Audio-Player mit Waveform-Visualisierung (Web Audio API).
// Dekodiert Audio via AudioContext.decodeAudioData, zeichnet die Amplituden-
// Hüllkurve auf ein <canvas>, click-to-seek, Play/Pause, Zeit-Anzeige.
import { useCallback, useEffect, useRef, useState } from "react";

interface AudioWaveformPlayerProps {
  /** Audio-Quelle: Blob, ArrayBuffer oder Data-URL. */
  src: Blob | ArrayBuffer | string | null;
  label?: string;
  height?: number;
}

interface WaveformProps {
  audioBuffer: AudioBuffer | null;
  progress: number; // 0..1
  height: number;
  onSeek: (fraction: number) => void;
}

function extractPeaks(buffer: AudioBuffer, samples: number): Float32Array {
  const channel = buffer.getChannelData(0);
  const block = Math.floor(channel.length / samples) || 1;
  const peaks = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    let max = 0;
    const start = i * block;
    for (let j = 0; j < block; j += 4) { // Stichproben genügen für die Hüllkurve
      const v = Math.abs(channel[start + j] || 0);
      if (v > max) max = v;
    }
    peaks[i] = max;
  }
  // Normalisieren, damit leise Aufnahmen sichtbar werden.
  let peakMax = 0;
  for (let i = 0; i < samples; i++) if (peaks[i] > peakMax) peakMax = peaks[i];
  if (peakMax > 0) for (let i = 0; i < samples; i++) peaks[i] /= peakMax;
  return peaks;
}

function Waveform({ audioBuffer, progress, height, onSeek }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const mid = height / 2;
    const playedX = progress * width;

    if (!audioBuffer) {
      ctx.fillStyle = "rgba(128,128,128,0.3)";
      ctx.fillRect(0, mid - 1, width, 2);
      return;
    }

    const peaks = extractPeaks(audioBuffer, Math.max(64, Math.floor(width / 3)));
    const barW = width / peaks.length;
    for (let i = 0; i < peaks.length; i++) {
      const h = Math.max(2, peaks[i] * (height - 6));
      const x = i * barW;
      ctx.fillStyle = x <= playedX ? "var(--accent, #4a9eff)" : "rgba(128,128,128,0.45)";
      ctx.fillRect(x, mid - h / 2, Math.max(1, barW - 1), h);
    }
  }, [audioBuffer, progress, height]);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    onSeek(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
  }

  return (
    <canvas
      ref={canvasRef}
      className="waveform-canvas"
      style={{ width: "100%", height, cursor: "pointer", display: "block" }}
      onClick={handleClick}
      data-testid="waveform-canvas"
    />
  );
}

export function AudioWaveformPlayer({ src, label, height = 64 }: AudioWaveformPlayerProps) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Quelle in abspielbare URL überführen.
  useEffect(() => {
    if (!src) {
      setAudioUrl(null);
      return;
    }
    let url: string;
    if (typeof src === "string") {
      url = src.startsWith("data:") || src.startsWith("blob:") || src.startsWith("http")
        ? src
        : `data:audio/webm;base64,${src}`;
    } else {
      url = URL.createObjectURL(src instanceof Blob ? src : new Blob([src], { type: "audio/mpeg" }));
    }
    objectUrlRef.current = url.startsWith("blob:") ? url : null;
    setAudioUrl(url);
    setProgress(0);
    setError(null);
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [src]);

  // Dekodieren für die Waveform (Web Audio API).
  useEffect(() => {
    if (!audioUrl) {
      setAudioBuffer(null);
      return;
    }
    let cancelled = false;
    // AbortController: bricht den Waveform-Fetch beim Unmount / URL-Wechsel ab,
    // damit keine Antwort mehr in eine nicht mehr gemountete Komponente schreibt.
    const ctrl = new AbortController();
    (async () => {
      try {
        if (!ctxRef.current) {
          const Ctor = window.AudioContext || (window as any).webkitAudioContext;
          ctxRef.current = new Ctor();
        }
        const res = await fetch(audioUrl, { signal: ctrl.signal });
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        const decoded = await ctxRef.current.decodeAudioData(buf);
        if (!cancelled) setAudioBuffer(decoded);
      } catch (e) {
        if (cancelled || (e as Error)?.name === "AbortError") return;
        setAudioBuffer(null); // Player bleibt nutzbar, nur ohne Waveform
      }
    })();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, []);

  const onSeek = useCallback((fraction: number) => {
    const el = audioRef.current;
    if (!el || !el.duration || !isFinite(el.duration)) return;
    el.currentTime = fraction * el.duration;
    setProgress(fraction);
  }, []);

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => setError("Wiedergabe fehlgeschlagen"));
    } else {
      el.pause();
    }
  }

  function formatTime(sec: number): string {
    if (!isFinite(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div className="audio-waveform-player" data-testid="audio-waveform-player">
      {label && <div className="awp-label">{label}</div>}
      <div className="awp-row" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          className="awp-play"
          onClick={togglePlay}
          disabled={!audioUrl}
          aria-label={playing ? "Pause" : "Abspielen"}
        >
          {playing ? "⏸" : "▶"}
        </button>
        <div style={{ flex: 1 }}>
          <Waveform audioBuffer={audioBuffer} progress={progress} height={height} onSeek={onSeek} />
        </div>
        <span className="awp-time" style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatTime(progress * duration)} / {formatTime(duration)}
        </span>
      </div>
      {error && <div className="awp-error" role="alert">{error}</div>}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
          onTimeUpdate={() => {
            const el = audioRef.current;
            if (el?.duration) setProgress(el.currentTime / el.duration);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setProgress(0);
          }}
          onError={() => setError("Audio konnte nicht geladen werden")}
        />
      )}
    </div>
  );
}
