// Audio-Notizen (Sprachmemos) zu Kapiteln.
// Metadaten + Audio als Data-URL in SQLite (audio_notes, Migration 010).
// Memos sind bewusst kurz (Standard-Limit 10 Min.) — Data-URLs bleiben handhabbar.
import { getDb, persist } from "@/services/db";

export interface AudioNote {
  id: string;
  chapterId: string;
  label: string;
  durationMs: number | null;
  mimeType: string | null;
  audioData: string | null; // Data-URL
  createdAt: number;
}

const MAX_DURATION_MS = 10 * 60 * 1000;

function uid(): string {
  return "an_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Audio konnte nicht gelesen werden"));
    reader.readAsDataURL(blob);
  });
}

/** Speichert ein aufgezeichnetes Memo (Audio-Blob) zu einem Kapitel. */
export async function saveAudioNote(
  chapterId: string,
  label: string,
  blob: Blob,
  durationMs: number | null,
): Promise<AudioNote> {
  const db = getDb();
  const id = uid();
  const dataUrl = await blobToDataUrl(blob);
  db.run(
    "INSERT INTO audio_notes (id, chapter_id, label, duration_ms, mime_type, audio_data, created_at) VALUES (?,?,?,?,?,?,?)",
    [id, chapterId, label, durationMs, blob.type, dataUrl, Date.now()],
  );
  await persist();
  return { id, chapterId, label, durationMs, mimeType: blob.type, audioData: dataUrl, createdAt: Date.now() };
}

/** Listet Memos eines Kapitels, neueste zuerst. */
export function listAudioNotes(chapterId: string): AudioNote[] {
  const db = getDb();
  const res = db.exec(
    "SELECT id, chapter_id, label, duration_ms, mime_type, audio_data, created_at FROM audio_notes WHERE chapter_id = ? ORDER BY created_at DESC",
    [chapterId],
  );
  if (!res.length) return [];
  return res[0].values.map((r) => ({
    id: r[0] as string,
    chapterId: r[1] as string,
    label: r[2] as string,
    durationMs: (r[3] as number) ?? null,
    mimeType: (r[4] as string) ?? null,
    audioData: (r[5] as string) ?? null,
    createdAt: r[6] as number,
  }));
}

/** Benennt ein Memo um. */
export async function renameAudioNote(id: string, label: string): Promise<void> {
  getDb().run("UPDATE audio_notes SET label = ? WHERE id = ?", [label, id]);
  await persist();
}

/** Löscht ein Memo. */
export async function deleteAudioNote(id: string): Promise<void> {
  getDb().run("DELETE FROM audio_notes WHERE id = ?", [id]);
  await persist();
}

/**
 * Startet eine Memo-Aufnahme. Liefert einen Recorder-Handle;
 * stop() resolved mit dem fertigen Blob + Dauer.
 */
export async function startMemoRecording(): Promise<{
  stop(): Promise<{ blob: Blob; durationMs: number }>;
}> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  const startedAt = Date.now();

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.start();

  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  // Hartes Limit: Aufnahme automatisch beenden.
  const timer = setTimeout(() => {
    if (recorder.state !== "inactive") recorder.stop();
  }, MAX_DURATION_MS);

  return {
    async stop(): Promise<{ blob: Blob; durationMs: number }> {
      clearTimeout(timer);
      if (recorder.state !== "inactive") recorder.stop();
      await stopped;
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      return { blob, durationMs: Date.now() - startedAt };
    },
  };
}
