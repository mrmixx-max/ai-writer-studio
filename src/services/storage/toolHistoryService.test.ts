// ---------------------------------------------------------------------------
// WP 41.2 — Tests für den Tool-History-Service
// ---------------------------------------------------------------------------
// Deterministisch, keine LLM-Aufrufe, kein Netz, keine Tauri-IPC.
// Der In-Memory-Store ist global → vor jedem Test via clearToolHistory()
// zurückgesetzt. Die bekannten SHA-256-Hashes sind gegen
// `node:crypto` createHash("sha256") kreuzgeprüft.
import { beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  clearToolHistory,
  computeContentHash,
  diffMetrics,
  getHistory,
  normalizeToolMetrics,
  recordToolRun,
  setToolHistoryAdapter,
  shouldRecompute,
  type ToolHistoryAdapter,
  type ToolHistoryEntry,
  type ToolMetrics,
} from "./toolHistoryService";

/** Referenz-Hash über Nodes crypto — unabhängige Quelle für den Abgleich. */
function refHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function entry(toolId: string, contentHash: string, timestamp: number, metrics: ToolMetrics): ToolHistoryEntry {
  return { toolId, contentHash, timestamp, metrics };
}

beforeEach(() => {
  clearToolHistory();
  setToolHistoryAdapter(null);
});

describe("toolHistoryService — computeContentHash", () => {
  it("stimmt mit Nodes SHA-256 überein (ASCII, leer, Sonderfälle)", async () => {
    const samples = ["", "abc", "hello world", "Zeile 1\nZeile 2\t— Ende"];
    for (const s of samples) {
      expect(await computeContentHash(s)).toBe(refHash(s));
    }
  });

  it("stimmt für Umlaute/UTF-8 mit Nodes SHA-256 überein", async () => {
    const s = "Grüße aus München äöüß ẞ — €";
    expect(await computeContentHash(s)).toBe(refHash(s));
  });

  it("ist deterministisch und liefert 64 Hex-Zeichen", async () => {
    const a = await computeContentHash("deterministisch");
    const b = await computeContentHash("deterministisch");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("unterscheidet sich bei geändertem Text", async () => {
    expect(await computeContentHash("Text A")).not.toBe(await computeContentHash("Text B"));
  });

  it("behandelt null/undefined defensiv wie den leeren String", async () => {
    // @ts-expect-error — bewusst defensiver Laufzeit-Fallback
    expect(await computeContentHash(undefined)).toBe(refHash(""));
    // @ts-expect-error — bewusst defensiver Laufzeit-Fallback
    expect(await computeContentHash(null)).toBe(refHash(""));
  });
});

describe("toolHistoryService — shouldRecompute", () => {
  it("meldet true, wenn für das Tool noch kein Lauf existiert", () => {
    expect(shouldRecompute("tool-x", "hash-1")).toBe(true);
  });

  it("meldet false bei Cache-Treffer (gleicher toolId + contentHash)", async () => {
    const hash = await computeContentHash("Inhalt");
    recordToolRun(entry("tool-a", hash, 1000, { readability: 50 }));
    expect(shouldRecompute("tool-a", hash)).toBe(false);
  });

  it("meldet true, wenn derselbe Text unter anderem Tool läuft", () => {
    recordToolRun(entry("tool-a", "hash-shared", 1000, { readability: 50 }));
    expect(shouldRecompute("tool-b", "hash-shared")).toBe(true);
  });

  it("meldet true bei leerem toolId oder contentHash", () => {
    recordToolRun(entry("tool-a", "hash-1", 1000, {}));
    expect(shouldRecompute("", "hash-1")).toBe(true);
    expect(shouldRecompute("tool-a", "")).toBe(true);
  });
});

describe("toolHistoryService — recordToolRun / getHistory", () => {
  it("speichert einen Lauf und gibt ihn über getHistory zurück", () => {
    recordToolRun(entry("tool-a", "h1", 1000, { readability: 42, wordCount: 120 }));
    const hist = getHistory("tool-a");
    expect(hist).toHaveLength(1);
    expect(hist[0].contentHash).toBe("h1");
    expect(hist[0].metrics).toEqual({ readability: 42, wordCount: 120 });
  });

  it("gibt für unbekannte Tools ein leeres Array zurück", () => {
    expect(getHistory("nie-gelaufen")).toEqual([]);
    // @ts-expect-error — defensiver Fallback
    expect(getHistory(undefined)).toEqual([]);
  });

  it("verwirft Einträge ohne toolId statt zu werfen", () => {
    recordToolRun(entry("", "h1", 1000, { readability: 1 }));
    // @ts-expect-error — defensiver Fallback
    recordToolRun(null);
    expect(getHistory("")).toEqual([]);
    expect(getHistory("tool-a")).toEqual([]);
  });

  it("normalisiert Metriken (nur endliche Zahlen, keine Fremdschlüssel)", () => {
    recordToolRun(
      entry("tool-a", "h1", 1000, {
        readability: 50,
        // @ts-expect-error — kaputter Wert muss verworfen werden
        cognitiveLoad: "hoch",
        wordCount: Number.NaN,
        errorCount: 3,
      }),
    );
    expect(getHistory("tool-a")[0].metrics).toEqual({ readability: 50, errorCount: 3 });
  });

  it("setzt einen fehlenden/ungültigen Timestamp auf die aktuelle Zeit", () => {
    const before = Date.now();
    recordToolRun(
      entry("tool-a", "h1", Number.NaN, { readability: 1 }),
    );
    const ts = getHistory("tool-a")[0].timestamp;
    expect(Number.isFinite(ts)).toBe(true);
    expect(ts).toBeGreaterThanOrEqual(before);
  });

  it("liefert die Historie aufsteigend nach Timestamp sortiert", () => {
    recordToolRun(entry("tool-a", "h3", 3000, {}));
    recordToolRun(entry("tool-a", "h1", 1000, {}));
    recordToolRun(entry("tool-a", "h2", 2000, {}));
    expect(getHistory("tool-a").map((e) => e.contentHash)).toEqual(["h1", "h2", "h3"]);
  });

  it("gibt eine Kopie zurück, die den Store nicht verändern kann", () => {
    recordToolRun(entry("tool-a", "h1", 1000, { readability: 10 }));
    const hist = getHistory("tool-a");
    hist[0].metrics.readability = 999;
    hist[0].contentHash = "manipuliert";
    expect(getHistory("tool-a")[0].metrics.readability).toBe(10);
    expect(getHistory("tool-a")[0].contentHash).toBe("h1");
  });

  it("trennt Historien verschiedener Tools sauber", () => {
    recordToolRun(entry("tool-a", "ha", 1000, { readability: 10 }));
    recordToolRun(entry("tool-b", "hb", 1000, { readability: 20 }));
    expect(getHistory("tool-a")).toHaveLength(1);
    expect(getHistory("tool-b")).toHaveLength(1);
    expect(getHistory("tool-a")[0].contentHash).toBe("ha");
  });

  it("ruft den injizierten Adapter beim Speichern auf", () => {
    const persisted: ToolHistoryEntry[] = [];
    const adapter: ToolHistoryAdapter = { persist: (e) => persisted.push(e) };
    setToolHistoryAdapter(adapter);
    recordToolRun(entry("tool-a", "h1", 1000, { readability: 5 }));
    expect(persisted).toHaveLength(1);
    expect(persisted[0].contentHash).toBe("h1");
  });

  it("übersteht einen werfenden Adapter ohne Datenverlust im Speicher", () => {
    setToolHistoryAdapter({
      persist: () => {
        throw new Error("DB down");
      },
    });
    expect(() => recordToolRun(entry("tool-a", "h1", 1000, { readability: 5 }))).not.toThrow();
    expect(getHistory("tool-a")).toHaveLength(1);
  });

  it("übernimmt vorhandene Adapter-Daten beim Setzen (loadAll)", () => {
    const adapter: ToolHistoryAdapter = {
      persist: () => undefined,
      loadAll: () => [entry("tool-a", "h1", 1000, { readability: 7 })],
    };
    setToolHistoryAdapter(adapter);
    expect(getHistory("tool-a")).toHaveLength(1);
    expect(shouldRecompute("tool-a", "h1")).toBe(false);
  });
});

describe("toolHistoryService — diffMetrics", () => {
  it("erkennt eine Verbesserung bei gestiegener Lesbarkeit", () => {
    const diff = diffMetrics({ readability: 50 }, { readability: 60 });
    const change = diff.changes.find((c) => c.metric === "readability")!;
    expect(change.before).toBe(50);
    expect(change.after).toBe(60);
    expect(change.deltaPercent).toBe(20);
    expect(change.direction).toBe("better");
    expect(diff.improved).toBe(true);
  });

  it("erkennt sinkende kognitive Last als Verbesserung", () => {
    const diff = diffMetrics({ cognitiveLoad: 80 }, { cognitiveLoad: 40 });
    const change = diff.changes.find((c) => c.metric === "cognitiveLoad")!;
    expect(change.deltaPercent).toBe(-50);
    expect(change.direction).toBe("better");
    expect(diff.improved).toBe(true);
  });

  it("erkennt steigende Fehlerzahl als Verschlechterung", () => {
    const diff = diffMetrics({ errorCount: 2 }, { errorCount: 5 });
    const change = diff.changes.find((c) => c.metric === "errorCount")!;
    expect(change.direction).toBe("worse");
    expect(diff.improved).toBe(false);
  });

  it("meldet 'same' bei unveränderten Werten", () => {
    const diff = diffMetrics({ readability: 42, wordCount: 100 }, { readability: 42, wordCount: 100 });
    expect(diff.changes.every((c) => c.direction === "same")).toBe(true);
    expect(diff.improved).toBe(false);
    expect(diff.summary).toContain("unverändert");
  });

  it("berechnet den Prozent-Delta korrekt bei gemischtem Vorzeichen", () => {
    const diff = diffMetrics({ wordCount: 200 }, { wordCount: 150 });
    const change = diff.changes.find((c) => c.metric === "wordCount")!;
    expect(change.deltaPercent).toBe(-25);
    expect(change.direction).toBe("worse"); // weniger Wörter → schlechter
  });

  it("behandelt before = 0 defensiv (kein Division-durch-null)", () => {
    const up = diffMetrics({ wordCount: 0 }, { wordCount: 10 });
    expect(up.changes.find((c) => c.metric === "wordCount")!.deltaPercent).toBe(100);
    const down = diffMetrics({ wordCount: 0 }, { wordCount: 0 });
    expect(down.changes.find((c) => c.metric === "wordCount")!.deltaPercent).toBe(0);
  });

  it("überspringt Metriken, die auf beiden Seiten fehlen", () => {
    const diff = diffMetrics({ readability: 10 }, { readability: 20 });
    expect(diff.changes.map((c) => c.metric)).toEqual(["readability"]);
  });

  it("behandelt fehlende Metriken als 0 (defensiv)", () => {
    const diff = diffMetrics({}, { readability: 30 });
    const change = diff.changes.find((c) => c.metric === "readability")!;
    expect(change.before).toBe(0);
    expect(change.after).toBe(30);
    expect(change.deltaPercent).toBe(100);
  });

  it("liefert eine leere, nicht verbesserte Diff bei fehlenden Daten", () => {
    const diff = diffMetrics({}, {});
    expect(diff.changes).toEqual([]);
    expect(diff.improved).toBe(false);
    expect(diff.summary).toBe("Keine vergleichbaren Metriken.");
  });

  it("ist true bei mehr besseren als schlechteren Metriken", () => {
    const diff = diffMetrics(
      { readability: 50, cognitiveLoad: 80, errorCount: 5 },
      { readability: 60, cognitiveLoad: 60, errorCount: 6 },
    );
    // readability besser, cognitiveLoad besser, errorCount schlechter
    expect(diff.improved).toBe(true);
    expect(diff.summary).toContain("verbessert");
  });
});

describe("toolHistoryService — normalizeToolMetrics", () => {
  it("behält nur bekannte endliche Zahlen und ignoriert Unbekanntes", () => {
    expect(
      normalizeToolMetrics({
        readability: 12,
        cognitiveLoad: 0,
        wordCount: -3,
        errorCount: 1.5,
        unknownMetric: 99,
        readability2: "x",
      }),
    ).toEqual({ readability: 12, cognitiveLoad: 0, wordCount: -3, errorCount: 1.5 });
  });

  it("gibt bei null/undefined ein leeres Objekt zurück", () => {
    expect(normalizeToolMetrics(null)).toEqual({});
    expect(normalizeToolMetrics(undefined)).toEqual({});
  });
});
