// Tests: Konflikt-merge, Offline-Queue, SyncService gegen Fake-Provider.
// Datei: src/services/cloud/cloud.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import { initDb } from "@/services/db";
import { createProject, createChapter, updateChapter, deleteProject } from "@/services/project";
import { mergeChapterContent, mergePayloads, resolveConflict } from "./conflict";
import { OfflineQueue, createMemoryStore } from "./offlineQueue";
import { SyncService, createMemorySyncStore } from "./sync";
import type { SyncPayload, SyncProvider, RemoteEntry } from "./types";

function payload(name: string, chapters: { id: string; content: string }[], updatedAt = 1000): SyncPayload {
  return {
    project: { id: "p1", name, createdAt: 0, updatedAt },
    chapters: chapters.map((c, i) => ({
      id: c.id, projectId: "p1", title: `Kapitel ${i + 1}`, content: c.content,
      orderIndex: i, createdAt: 0, updatedAt,
    })),
    exportedAt: 1000,
    schemaVersion: 1,
  };
}

/** Fake-Provider mit In-Memory-Dateisystem + konfigurierbarer Erreichbarkeit. */
function fakeProvider(online = true) {
  const files = new Map<string, { data: string; etag: string; modifiedAt: number }>();
  let counter = 0;
  const provider: SyncProvider = {
    kind: "webdav",
    label: "Fake",
    async put(path, data) {
      if (!online) throw new Error("offline");
      const etag = `e${++counter}`;
      files.set(path, { data, etag, modifiedAt: Date.now() });
      return { etag };
    },
    async get(path) {
      if (!online) throw new Error("offline");
      const f = files.get(path);
      return f ? { ...f } : null;
    },
    async delete(path) {
      if (!online) throw new Error("offline");
      files.delete(path);
    },
    async list(prefix) {
      const out: RemoteEntry[] = [];
      for (const [path, f] of files) {
        if (path.startsWith(prefix)) out.push({ path, etag: f.etag, modifiedAt: f.modifiedAt, size: f.data.length });
      }
      return out;
    },
    async ping() { return online; },
  };
  return { provider, files };
}

describe("mergeChapterContent", () => {
  it("kombiniert nicht ueberschneidende Aenderungen", () => {
    expect(mergeChapterContent("a\nb\nc", "a\nB\nc", "a\nb\nc")).toBe("a\nB\nc");
  });
  it("erkennnt Zielkonflikte in derselben Zeile", () => {
    expect(mergeChapterContent("a\nX\nc", "a\nY\nc", "a\nb\nc")).toBeNull();
  });
});

describe("mergePayloads / resolveConflict", () => {
  it("merged Kapitel aus beiden Seiten", () => {
    const local = payload("Buch", [{ id: "c1", content: "lokal" }, { id: "c2", content: "neu lokal" }]);
    const remote = payload("Buch", [{ id: "c1", content: "remote" }]);
    const merged = mergePayloads(local, remote);
    expect(merged).not.toBeNull();
    expect(merged!.chapters.map((c) => c.id).sort()).toEqual(["c1", "c2"]);
  });
  it("local-wins liefert den lokalen Payload", () => {
    const local = payload("Buch", [{ id: "c1", content: "lokal" }]);
    const remote = payload("Buch", [{ id: "c1", content: "remote" }]);
    const conflict = {
      id: "c", projectId: "p1", projectPath: "/x", localPayload: local, remotePayload: remote,
      remoteEtag: "e1", localTime: 2, remoteTime: 1, detectedAt: 0,
      status: "open" as const, resolution: null, mergedPayload: null,
    };
    const { conflict: resolved, payload: p } = resolveConflict(conflict, "local-wins");
    expect(resolved.status).toBe("resolved");
    expect(p).toEqual(local);
  });
});

describe("OfflineQueue", () => {
  it("puffert wenn offline und flusht beim Wiederverbinden", async () => {
    const q = new OfflineQueue(createMemoryStore());
    const { provider, files } = fakeProvider(false);
    const immediate = await q.push("put", "/p/1.aiw.json", "1", "{}", provider);
    expect(immediate).toBe(false);
    expect(q.size).toBe(1);

    const { provider: onlineProvider, files: onlineFiles } = fakeProvider(true);
    const res = await q.flush(onlineProvider);
    expect(res.processed).toBe(1);
    expect(q.size).toBe(0);
    expect(onlineFiles.has("/p/1.aiw.json")).toBe(true);
    void files;
  });
});

describe("SyncService", () => {
  let projectId = "";

  beforeEach(async () => {
    await initDb();
    const db = (globalThis as any).__aws_db;
    db.run("DELETE FROM chapters");
    db.run("DELETE FROM projects");
    const p = await createProject("Buch");
    projectId = p.id;
    await createChapter(projectId, "Kapitel 1", "a\nb\nc");
  });

  it("erster Sync pusht und setzt ETag", async () => {
    const { provider, files } = fakeProvider(true);
    const svc = new SyncService(provider, createMemorySyncStore());
    const result = await svc.syncProject(projectId);
    expect(result.action).toBe("pushed");
    expect(result.etag).not.toBeNull();
    expect(files.size).toBe(1);
    // Zweiter Sync ohne Aenderung -> up-to-date
    const again = await svc.syncProject(projectId);
    expect(again.action).toBe("up-to-date");
  });

  it("lokale Aenderung nach Sync wird gepusht", async () => {
    const { provider } = fakeProvider(true);
    const svc = new SyncService(provider, createMemorySyncStore());
    await svc.syncProject(projectId);
    const ch = (globalThis as any).__aws_db.exec("SELECT id FROM chapters")[0];
    const chapterId = ch.values[0][0] as string;
    await updateChapter(chapterId, "a\nb\nGEAENDERT");
    const result = await svc.syncProject(projectId);
    expect(result.action).toBe("pushed");
  });

  it("gleichzeitige Aenderung mit Zielkonflikt + Strategie manual -> Konflikt", async () => {
    const { provider, files } = fakeProvider(true);
    const svc = new SyncService(provider, createMemorySyncStore());
    await svc.syncProject(projectId); // ETag-Basis setzen
    const path = svc.pathFor(projectId);
    // Remote gleichzeitig anders geaendert (gleiche Zeile -> nicht mergbar).
    const base = JSON.parse(files.get(path)!.data) as SyncPayload;
    base.project.updatedAt = 999999;
    base.chapters[0].content = "a\nb\nREMOTE";
    base.chapters[0].updatedAt = 999999;
    await provider.put(path, JSON.stringify(base)); // neuer ETag != lastEtag
    const ch = (globalThis as any).__aws_db.exec("SELECT id FROM chapters")[0];
    await updateChapter(ch.values[0][0] as string, "a\nb\nLOKAL");
    const result = await svc.syncProject(projectId, "manual");
    expect(result.action).toBe("conflict");
    expect(result.conflict?.status).toBe("open");
  });

  it("offline: Aenderung landet in der Queue", async () => {
    const { provider } = fakeProvider(false);
    const svc = new SyncService(provider, createMemorySyncStore());
    const result = await svc.syncProject(projectId);
    expect(result.error).toContain("offline");
    expect(svc.queue.size).toBe(1);
  });

  it("deleteRemote entfernt die Datei", async () => {
    const { provider, files } = fakeProvider(true);
    const svc = new SyncService(provider, createMemorySyncStore());
    await svc.syncProject(projectId);
    await svc.deleteRemote(projectId);
    expect(files.size).toBe(0);
    await deleteProject(projectId);
  });
});
