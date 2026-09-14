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
    reader.onload = () => {
      if (typeof reader.result === "string" && reader.result) resolve(reader.result);
      else reject(new Error("Audio konnte nicht gelesen werden"));
    };
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
  if (!chapterId || !chapterId.trim()) throw new Error("Memo braucht ein Kapitel");
  if (!blob || blob.size === 0) throw new Error("Aufnahme war leer — Memo wurde nicht gespeichert");
  const safeDuration =
    typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs >= 0
      ? Math.min(durationMs, MAX_DURATION_MS)
      : null;
  const safeLabel = label.trim() || `Memo ${new Date().toLocaleTimeString("de-DE")}`;
  const db = getDb();
  const id = uid();
  const now = Date.now();
  const dataUrl = await blobToDataUrl(blob);
  db.run(
    "INSERT INTO audio_notes (id, chapter_id, label, duration_ms, mime_type, audio_data, created_at) VALUES (?,?,?,?,?,?,?)",
    [id, chapterId, safeLabel, safeDuration, blob.type || "audio/webm", dataUrl, now],
  );
  await persist();
  return { id, chapterId, label: safeLabel, durationMs: safeDuration, mimeType: blob.type || "audio/webm", audioData: dataUrl, createdAt: now };
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
  const name = label.trim();
  if (!name) throw new Error("Memo-Name darf nicht leer sein");
  getDb().run("UPDATE audio_notes SET label = ? WHERE id = ?", [name, id]);
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
  const nav = (globalThis as unknown as { navigator?: Navigator }).navigator;
  const getUserMedia = nav?.mediaDevices?.getUserMedia?.bind(nav.mediaDevices);
  if (!getUserMedia) throw new Error("Mikrofon-Aufnahme wird nicht unterstützt (kein getUserMedia).");
  if (typeof MediaRecorder === "undefined") throw new Error("Mikrofon-Aufnahme wird nicht unterstützt (kein MediaRecorder).");
  let stream: MediaStream;
  try {
    stream = await getUserMedia({ audio: true });
  } catch (e) {
    throw new Error(`Mikrofon-Zugriff verweigert: ${e instanceof Error ? e.message : String(e)}`);
  }
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  const startedAt = Date.now();

  recorder.ondataavailable = (e) => {
    if (e?.data && e.data.size > 0) chunks.push(e.data);
  };
  try {
    recorder.start();
  } catch (e) {
    try {
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    throw e instanceof Error ? e : new Error(String(e));
  }

  let recordError: Error | null = null;
  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => {
      if (recordError) reject(recordError);
      else resolve();
    };
    recorder.onerror = () => {
      recordError = new Error("Memo-Aufnahme fehlgeschlagen.");
    };
  });

  // Hartes Limit: Aufnahme automatisch beenden.
  const timer = setTimeout(() => {
    if (recorder.state !== "inactive") recorder.stop();
  }, MAX_DURATION_MS);

  return {
    async stop(): Promise<{ blob: Blob; durationMs: number }> {
      clearTimeout(timer);
      try {
        if (recorder.state !== "inactive") recorder.stop();
        await stopped;
      } finally {
        try {
          stream.getTracks().forEach((t) => t.stop());
        } catch {
          /* ignore */
        }
      }
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      if (blob.size === 0) throw new Error("Aufnahme war leer — Memo wurde nicht gespeichert");
      return { blob, durationMs: Date.now() - startedAt };
    },
  };
}
