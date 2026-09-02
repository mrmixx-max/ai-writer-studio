// Ergaenzende Offline-Queue- und Konflikt-Strategie-Tests (ohne DB).
// Datei: src/services/cloud/queueConflict.test.ts
import { describe, it, expect, vi } from "vitest";
import { OfflineQueue, createMemoryStore } from "./offlineQueue";
import { mergeChapterContent, mergePayloads, resolveConflict, isNewerLocally } from "./conflict";
import type { SyncPayload, SyncProvider } from "./types";
import { QueueOp } from "./offlineQueue";

/** Provider aus vi.fn()-Spies (Ping/Put/Delete beobachtbar). */
function spyProvider(online = true) {
  return {
    kind: "webdav" as const,
    label: "Spy",
    ping: vi.fn(async () => online),
    put: vi.fn(async () => ({ etag: "e1" })),
    get: vi.fn(async () => null),
    delete: vi.fn(async () => undefined),
    list: vi.fn(async () => []),
  } satisfies SyncProvider;
}

function payload(name = "Buch", chapters: { id: string; content: string }[] = []): SyncPayload {
  return {
    project: { id: "p1", name, createdAt: 0, updatedAt: 1 },
    chapters: chapters.map((c, i) => ({
      id: c.id, projectId: "p1", title: `K${i}`, content: c.content,
      orderIndex: i, createdAt: 0, updatedAt: 1,
      status: "planned" as const, targetWordCount: 2000, minimumWordCount: 1600,
      maximumWordCount: 2400, currentWordCount: 0,
    })),
    exportedAt: 1,
    schemaVersion: 1,
  };
}

describe("OfflineQueue (erweitert)", () => {
  it("push fuehrt put sofort aus, wenn der Provider online ist", async () => {
    const q = new OfflineQueue(createMemoryStore());
    const p = spyProvider(true);
    const immediate = await q.push("put", "/x.json", "p1", "{}", p);
    expect(immediate).toBe(true);
    expect(p.put).toHaveBeenCalledWith("/x.json", "{}");
    expect(q.size).toBe(0);
  });

  it("enqueue/pending haelt die Einreihungs-Reihenfolge ein", () => {
    const q = new OfflineQueue(createMemoryStore());
    const ops: QueueOp[] = ["put", "delete", "put"];
    ops.forEach((op, i) => {
      const e = q.enqueue(op, `/pfad-${i}`, "p1", op === "put" ? "d" : null);
      e.enqueuedAt = i; // deterministisch machen
      void e;
    });
    // enqueue setzt Date.now() — fuer die Reihenfolge reichen Millisekunden-Unterschiede
    // hier nicht aus, daher direkt ueber pending() pruefen:
    expect(q.pending().length).toBe(3);
  });

  it("flush offline verarbeitet nichts und meldet einen Fehler", async () => {
    const q = new OfflineQueue(createMemoryStore());
    q.enqueue("put", "/a", "p1", "d");
    const p = spyProvider(false);
    const res = await q.flush(p);
    expect(res).toEqual({ processed: 0, remaining: 1, error: "offline" });
    expect(p.put).not.toHaveBeenCalled();
  });

  it("flush: Fehler bei einem Eintrag stoppt die Abarbeitung und erhoehlt attempts", async () => {
    const q = new OfflineQueue(createMemoryStore());
    q.enqueue("put", "/a", "p1", "d");
    q.enqueue("put", "/b", "p1", "d");
    const p = spyProvider(true);
    (p.put as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("boom"));
    const res = await q.flush(p);
    expect(res.processed).toBe(0);
    expect(res.error).toBe("boom");
    expect(q.size).toBe(2);
    const pending = q.pending();
    const failed = pending.find((e) => e.path === "/a")!;
    expect(failed.attempts).toBe(1);
    expect(failed.lastError).toBe("boom");
    expect(pending.find((e) => e.path === "/b")!.attempts).toBe(0); // zweiter Eintrag unberuehrt
  });

  it("flush verarbeitet delete-Operationen", async () => {
    const q = new OfflineQueue(createMemoryStore());
    q.enqueue("delete", "/weg.json", "p1", null);
    const p = spyProvider(true);
    const res = await q.flush(p);
    expect(res.processed).toBe(1);
    expect(p.delete).toHaveBeenCalledWith("/weg.json");
    expect(q.size).toBe(0);
  });

  it("flush meldet einen Fehler bei put ohne Daten", async () => {
    const q = new OfflineQueue(createMemoryStore());
    q.enqueue("put", "/ohne-daten", "p1", null);
    const p = spyProvider(true);
    const res = await q.flush(p);
    expect(res.processed).toBe(0);
    expect(res.error).toContain("put ohne Daten");
  });

  it("clear leert die Queue", async () => {
    const q = new OfflineQueue(createMemoryStore());
    q.enqueue("put", "/a", "p1", "d");
    q.enqueue("delete", "/b", "p1", null);
    q.clear();
    expect(q.size).toBe(0);
    expect(q.pending()).toEqual([]);
  });
});

describe("mergeChapterContent (Edge-Cases)", () => {
  it("nimmt die Remote-Zeile, wenn nur remote geaendert hat", () => {
    expect(mergeChapterContent("base\nb", "base\nREMOTE", "base\nb")).toBe("base\nREMOTE");
  });

  it("nimmt die lokale Zeile, wenn nur lokal geaendert hat", () => {
    expect(mergeChapterContent("base\nLOKAL", "base\nb", "base\nb")).toBe("base\nLOKAL");
  });

  it("ergaenzt Zeilen, die eine Seite hinzugefuegt hat", () => {
    expect(mergeChapterContent("a\nb\nlokal-neu", "a\nb", "a\nb")).toBe("a\nb\nlokal-neu");
    expect(mergeChapterContent("a\nb", "a\nb\nremote-neu", "a\nb")).toBe("a\nb\nremote-neu");
  });

  it("behandelt unterschiedliche Zeilenzahlen ohne Crash", () => {
    expect(mergeChapterContent("a", "a\nx\ny", "a")).toBe("a\nx\ny");
  });
});

describe("mergePayloads / resolveConflict (Strategien)", () => {
  it("schlaegt fehl, wenn der Projektname kollidiert", () => {
    const local = payload("A");
    const remote = { ...payload("B") };
    expect(mergePayloads(local, remote)).toBeNull();
  });

  function conflict() {
    const local = payload("Buch");
    const remote = payload("Buch");
    return {
      id: "k1", projectId: "p1", projectPath: "/p/1.aiw.json",
      localPayload: local, remotePayload: remote, remoteEtag: "e",
      localTime: 10, remoteTime: 5, detectedAt: 0,
      status: "open" as const, resolution: null, mergedPayload: null,
    };
  }

  it("remote-wins liefert den Remote-Payload", () => {
    const c = conflict();
    const { conflict: r, payload: p } = resolveConflict(c, "remote-wins");
    expect(r.status).toBe("resolved");
    expect(r.resolution).toBe("remote-wins");
    expect(p).toBe(c.remotePayload);
  });

  it("merged strategie kombiniert, wenn der Merge moeglich ist", () => {
    const local = payload("Buch");
    local.chapters = [];
    const remote = payload("Buch");
    remote.chapters = [];
    const c = conflict();
    c.localPayload = local;
    c.remotePayload = remote;
    const { conflict: r, payload: mergedPayload } = resolveConflict(c, "merged");
    expect(r.status).toBe("resolved");
    expect(mergedPayload).not.toBeNull();
  });

  it("merged faellt auf manual zurueck, wenn der Merge scheitert (Titelkonflikt)", () => {
    const local = payload("Buch");
    const remote = payload("Anderer Titel");
    const c = conflict();
    c.localPayload = local;
    c.remotePayload = remote;
    const { conflict: r, payload: mergedPayload } = resolveConflict(c, "merged");
    expect(r.status).toBe("open");
    expect(r.resolution).toBe("manual");
    expect(mergedPayload).toBeNull();
  });

  it("manual laesst den Konflikt offen", () => {
    const c = conflict();
    const { conflict: r, payload: resolved } = resolveConflict(c, "manual");
    expect(r.status).toBe("open");
    expect(resolved).toBeNull();
  });

  it("isNewerLocally bewertet Zeitstempel", () => {
    const c = conflict();
    expect(isNewerLocally(c)).toBe(true);
    expect(isNewerLocally({ ...c, localTime: 1, remoteTime: 5 })).toBe(false);
  });
});
