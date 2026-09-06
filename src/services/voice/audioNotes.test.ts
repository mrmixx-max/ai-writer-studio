// Audio-Notizen: CRUD gegen echte Test-DB; FileReader gemockt (node hat keinen).
// Kein echtes Mikrofon — startMemoRecording bleibt ungetestet (braucht MediaRecorder).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initDb } from "@/services/db";
import { createProject, createChapter } from "@/services/project";
import { saveAudioNote, listAudioNotes, renameAudioNote, deleteAudioNote } from "@/services/voice/audioNotes";

class FakeFileReader {
  result: string | null = "data:audio/webm;base64,ZmFrZQ==";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL(_blob: Blob) {
    queueMicrotask(() => this.onload?.());
  }
}

describe("audioNotes", () => {
  let chapterId: string;
  let otherChapterId: string;

  beforeEach(async () => {
    await initDb();
    // DB ist Singleton (cached) → zwischen Tests aufräumen
    const db = (globalThis as any).__aws_db;
    db.run("DELETE FROM audio_notes");
    db.run("DELETE FROM chapters");
    db.run("DELETE FROM projects");
    // audio_notes.chapter_id hat FK auf chapters(id) → echtes Kapitel nötig
    const p = await createProject("Voice-Testbuch");
    chapterId = (await createChapter(p.id, "Kapitel 1")).id;
    otherChapterId = (await createChapter(p.id, "Kapitel 2")).id;
    vi.stubGlobal("FileReader", FakeFileReader);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("speichert ein Memo und listet es", async () => {
    const blob = new Blob(["fake-audio"], { type: "audio/webm" });
    const note = await saveAudioNote(chapterId, "Memo 1", blob, 1234);
    expect(note.id).toMatch(/^an_/);
    expect(note.chapterId).toBe(chapterId);
    expect(note.mimeType).toBe("audio/webm");
    expect(note.audioData).toContain("data:audio/webm");
    const list = listAudioNotes(chapterId);
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe("Memo 1");
  });

  it("listet nur Memos des Kapitels, neueste zuerst", async () => {
    const blob = new Blob(["x"], { type: "audio/webm" });
    await saveAudioNote(chapterId, "A", blob, null);
    await saveAudioNote(otherChapterId, "Fremd", blob, null);
    await saveAudioNote(chapterId, "B", blob, null);
    const list2 = listAudioNotes(chapterId);
    expect(list2).toHaveLength(2);
    expect(list2.map((n) => n.label)).toEqual(["B", "A"]);
  });

  it("renameAudioNote benennt um", async () => {
    const blob = new Blob(["x"], { type: "audio/webm" });
    const note = await saveAudioNote(chapterId, "Alt", blob, null);
    await renameAudioNote(note.id, "Neu");
    expect(listAudioNotes(chapterId)[0].label).toBe("Neu");
  });

  it("deleteAudioNote löscht", async () => {
    const blob = new Blob(["x"], { type: "audio/webm" });
    const note = await saveAudioNote(chapterId, "Weg", blob, null);
    await deleteAudioNote(note.id);
    expect(listAudioNotes(chapterId)).toEqual([]);
  });
});
