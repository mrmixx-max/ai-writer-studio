// Audio-Notizen: Sprachmemos zu Kapiteln aufnehmen, abhören, verwalten.
// Aufnahme via MediaRecorder (startMemoRecording), Persistenz in audio_notes (Migration 010).
import { useEffect, useRef, useState } from "react";
import {
  listAudioNotes,
  saveAudioNote,
  deleteAudioNote,
  renameAudioNote,
  startMemoRecording,
  type AudioNote,
} from "@/services/voice/audioNotes";
import { AudioWaveformPlayer } from "./AudioWaveformPlayer";

interface AudioNotesProps {
  chapterId: string;
}

type RecorderHandle = Awaited<ReturnType<typeof startMemoRecording>>;

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
}

export function AudioNotes({ chapterId }: AudioNotesProps) {
  const [notes, setNotes] = useState<AudioNote[]>([]);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<RecorderHandle | null>(null);
  const timerRef = useRef<number | null>(null);

  function reload() {
    setNotes(listAudioNotes(chapterId));
  }

  useEffect(reload, [chapterId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      recorderRef.current?.stop().catch(() => {});
    };
  }, []);

  async function startRecording() {
    setError(null);
    try {
      recorderRef.current = await startMemoRecording();
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mikrofon nicht verfügbar");
    }
  }

  async function stopRecording() {
    const rec = recorderRef.current;
    if (!rec) return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setRecording(false);
    try {
      const { blob, durationMs } = await rec.stop();
      recorderRef.current = null;
      if (blob.size === 0) {
        setError("Aufnahme war leer");
        return;
      }
      await saveAudioNote(chapterId, label.trim() || `Memo ${new Date().toLocaleTimeString("de-DE")}`, blob, durationMs);
      setLabel("");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    }
  }

  async function doRename(note: AudioNote) {
    const name = window.prompt("Neuer Name:", note.label);
    if (!name || name === note.label) return;
    await renameAudioNote(note.id, name);
    reload();
  }

  function blobFromNote(note: AudioNote): Blob | null {
    if (!note.audioData) return null;
    try {
      const [meta, b64] = note.audioData.split(",");
      const mime = /data:([^;]+)/.exec(meta)?.[1] ?? "audio/webm";
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    } catch {
      return null;
    }
  }

  return (
    <div className="audio-notes" data-testid="audio-notes">
      <div className="an-recorder">
        {recording ? (
          <button className="danger" onClick={stopRecording} data-testid="memo-stop">
            ⏹ Aufnahme beenden ({formatDuration(elapsed * 1000)})
          </button>
        ) : (
          <button onClick={startRecording} data-testid="memo-start">🎙 Memo aufnehmen</button>
        )}
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Bezeichnung (optional)…"
          disabled={recording}
        />
      </div>
      {error && <div className="an-error" role="alert">{error}</div>}

      <div className="an-list">
        {notes.length === 0 && <p>(Keine Memos für dieses Kapitel.)</p>}
        {notes.map((note) => {
          const blob = blobFromNote(note);
          return (
            <div key={note.id} className="an-item" data-testid="audio-note-item">
              <div className="an-item-head">
                <strong>{note.label}</strong>
                <span className="an-meta">
                  {formatDuration(note.durationMs)} · {new Date(note.createdAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                </span>
                <button onClick={() => doRename(note)} title="Umbenennen">✎</button>
                <button
                  className="danger"
                  onClick={async () => {
                    await deleteAudioNote(note.id);
                    reload();
                  }}
                  title="Löschen"
                >
                  🗑
                </button>
              </div>
              {blob ? (
                <AudioWaveformPlayer src={blob} height={40} />
              ) : (
                <p className="an-missing">(Audio nicht mehr verfügbar)</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
