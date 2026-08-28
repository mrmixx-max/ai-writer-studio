// Batch-TTS: ganzes Buch vorlesen. Kapitel werden sequenziell synthetisiert,
// fertige Chunks erscheinen sofort im Player. Fortschritt + Abbruch.
import { useCallback, useRef, useState } from "react";
import type { Chapter } from "@/types/project";
import { ALL_TTS_PROVIDERS, TTS_PROVIDER_LABELS, type TTSProviderId } from "@/services/tts/tts";
import { batchSynthesizeBook, cancelBatchSynthesis, type BatchTTSProgress } from "@/services/tts/batch";
import { AudioWaveformPlayer } from "./AudioWaveformPlayer";

interface BatchTTSProps {
  chapters: Chapter[];
}

interface PlaylistItem {
  id: string;
  chapterTitle: string;
  audio: Blob;
}

export function BatchTTS({ chapters }: BatchTTSProps) {
  const [provider, setProvider] = useState<TTSProviderId>("openai-tts");
  const [voice, setVoice] = useState("alloy");
  const [speed, setSpeed] = useState(1.0);
  const [apiKey, setApiKey] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BatchTTSProgress | null>(null);
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const sorted = [...chapters].sort((a, b) => a.orderIndex - b.orderIndex);
  const totalChars = sorted.reduce((n, c) => n + c.content.length, 0);

  const start = useCallback(async () => {
    if (!sorted.length) return;
    setRunning(true);
    setError(null);
    setPlaylist([]);
    cancelledRef.current = false;

    try {
      await batchSynthesizeBook(
        provider,
        { openaiApiKey: apiKey || undefined },
        sorted.map((c) => ({ id: c.id, title: c.title, content: c.content })),
        { voice, speed },
        setProgress,
        (item) => {
          const chapter = sorted.find((c) => c.id === item.chapterId);
          setPlaylist((p) => [
            ...p,
            {
              id: `${item.chapterId}_${item.chunkIndex}`,
              chapterTitle: chapter ? `${chapter.title} (Teil ${item.chunkIndex + 1})` : item.chapterId,
              audio: new Blob([item.audio], { type: "audio/mpeg" }),
            },
          ]);
        },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }, [provider, apiKey, voice, speed, sorted]);

  function stop() {
    cancelledRef.current = true;
    cancelBatchSynthesis();
  }

  return (
    <div className="batch-tts" data-testid="batch-tts">
      <div className="batch-tts-config">
        <select value={provider} onChange={(e) => setProvider(e.target.value as TTSProviderId)}>
          {ALL_TTS_PROVIDERS.map((id) => (
            <option key={id} value={id}>{TTS_PROVIDER_LABELS[id]}</option>
          ))}
        </select>
        {provider === "openai-tts" && (
          <input
            type="password"
            placeholder="OpenAI API-Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        )}
        <label>
          Stimme:{" "}
          <input value={voice} onChange={(e) => setVoice(e.target.value)} style={{ width: 140 }} />
        </label>
        <label>
          Tempo: {speed.toFixed(1)}×{" "}
          <input
            type="range" min={0.5} max={2} step={0.1} value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="batch-tts-info">
        {sorted.length} Kapitel · {totalChars.toLocaleString("de-DE")} Zeichen
        {!running && (
          <button onClick={start} disabled={!sorted.length || !totalChars}>
            📖 Ganzes Buch vorlesen
          </button>
        )}
        {running && <button onClick={stop} className="danger">⏹ Stoppen (nach aktuellem Chunk)</button>}
      </div>

      {progress && (
        <div className="batch-tts-progress" data-testid="batch-tts-progress">
          {progress.phase === "done" && "✅ Fertig"}
          {progress.phase === "cancelled" && "⏹ Abgebrochen"}
          {progress.phase === "error" && `⚠ ${progress.message ?? "Fehler"}`}
          {(progress.phase === "chunking" || progress.phase === "synthesizing") && (
            <>
              Kapitel {progress.chapterIndex + 1}/{progress.totalChapters}: {progress.chapterTitle} —
              Chunk {Math.min(progress.chunkIndex + 1, progress.totalChunks)}/{progress.totalChunks}
              {progress.phase === "chunking" ? " (aufteilen…)" : " (synthetisiere…)"}
            </>
          )}
        </div>
      )}
      {error && <div className="batch-tts-error" role="alert">{error}</div>}

      <div className="batch-tts-playlist">
        {playlist.map((item) => (
          <div key={item.id} className="batch-tts-item">
            <AudioWaveformPlayer src={item.audio} label={item.chapterTitle} height={48} />
          </div>
        ))}
      </div>
    </div>
  );
}
