// Tests: Upload-Retry mit Backoff + Resume (Sprint 9, Agent 3).
// Alle Timer über injizierbares delayFn (0 echte Wartezeiten, 0 API-Calls).
import { describe, it, expect, vi } from "vitest";
import {
  canResumeUpload,
  computeBackoffDelay,
  resumeUpload,
  uploadWithRetry,
} from "./kdpUploadRetry";
import { buildUploadPackage } from "./kdpUpload";
import { createUploadState } from "./kdpUploadTracker";
import type { UploadFile } from "./kdpUploadValidation";
import type { KdpMetadata } from "@/types/bookwriter";

const META: KdpMetadata = {
  title: "Retry-Roman",
  subtitle: "Sub",
  blurbVariants: ["Klappentext mit Inhalt. ".repeat(5)],
  shortDescription: "Kurz",
  keywords: ["retry"],
  categories: ["Fiction > Thriller"],
  authorBio: "Autorin.",
  seriesIdea: null,
  marketingNotes: null,
  coverImage: "cover.jpg",
  priceUsd: 4.99,
};

const FILE: UploadFile = { name: "manuscript.epub", sizeBytes: 1_500_000, mimeType: "application/epub+zip" };
const noWait = () => Promise.resolve();

describe("computeBackoffDelay", () => {
  it("wächst exponentiell (1000 → 2000 → 4000)", () => {
    expect(computeBackoffDelay(1, { baseDelayMs: 1000, backoffFactor: 2 })).toBe(1000);
    expect(computeBackoffDelay(2, { baseDelayMs: 1000, backoffFactor: 2 })).toBe(2000);
    expect(computeBackoffDelay(3, { baseDelayMs: 1000, backoffFactor: 2 })).toBe(4000);
  });

  it("deckelt auf maxDelayMs", () => {
    expect(computeBackoffDelay(10, { baseDelayMs: 1000, backoffFactor: 2, maxDelayMs: 5000 })).toBe(5000);
  });

  it("liefert 0 für attempt < 1", () => {
    expect(computeBackoffDelay(0)).toBe(0);
  });
});

describe("uploadWithRetry", () => {
  it("Erfolg beim Erstversuch: 1 Versuch, kein Retry", async () => {
    const r = await uploadWithRetry(FILE, META, {
      now: () => 1000,
      randomId: () => "u-1",
      delayFn: noWait,
      uploadFn: async () => ({ remoteId: "r-1" }),
      pollFn: async () => "live",
    });
    expect(r.result.state.status).toBe("live");
    expect(r.attempts).toBe(1);
    expect(r.retried).toBe(false);
  });

  it("Netzwerkfehler → Retry → Erfolg beim 2. Versuch (mit Backoff-Wartezeit)", async () => {
    const delays: number[] = [];
    let calls = 0;
    const r = await uploadWithRetry(FILE, META, {
      now: () => 1000,
      randomId: () => "u-2",
      delayFn: (ms) => { delays.push(ms); return Promise.resolve(); },
      uploadFn: async () => {
        calls += 1;
        if (calls === 1) throw new Error("503 Service Unavailable");
        return { remoteId: "r-2" };
      },
      pollFn: async () => "live",
    });
    expect(r.result.state.status).toBe("live");
    expect(r.attempts).toBe(2);
    expect(r.retried).toBe(true);
    expect(delays).toEqual([1000]);
  });

  it("Validierungsfehler → kein Retry (sofortiger Abbruch)", async () => {
    const uploadFn = vi.fn(async () => ({ remoteId: "x" }));
    const r = await uploadWithRetry({ ...FILE, name: "buch.txt" }, META, {
      now: () => 1000,
      randomId: () => "u-3",
      delayFn: noWait,
      uploadFn,
    });
    expect(r.result.state.status).toBe("rejected");
    expect(r.attempts).toBe(1);
    expect(uploadFn).not.toHaveBeenCalled();
  });

  it("erschöpft maxAttempts und meldet rejected", async () => {
    const attempts: number[] = [];
    const r = await uploadWithRetry(FILE, META, {
      now: () => 1000,
      randomId: () => "u-4",
      delayFn: noWait,
      retry: { maxAttempts: 3, onAttempt: undefined },
      uploadFn: async () => { throw new Error("fetch failed"); },
    });
    expect(r.result.state.status).toBe("rejected");
    expect(r.attempts).toBe(3);
    expect(r.retried).toBe(true);
    expect(attempts).toEqual([]);
  });

  it("ruft onAttempt pro Versuch auf", async () => {
    const seen: number[] = [];
    await uploadWithRetry(FILE, META, {
      now: () => 1000,
      randomId: () => "u-5",
      delayFn: noWait,
      retry: { maxAttempts: 2, onAttempt: (a) => { seen.push(a); } },
      uploadFn: async () => { throw new Error("fetch failed"); },
    });
    expect(seen).toEqual([1, 2]);
  });
});

describe("canResumeUpload", () => {
  it("uploading mit startedAt ist fortsetzbar", () => {
    const s = { ...createUploadState(null, "T", "u-1", 1000), status: "uploading" as const, startedAt: 1000 };
    expect(canResumeUpload(s)).toBe(true);
  });

  it("processing mit remoteId ist fortsetzbar", () => {
    const s = { ...createUploadState(null, "T", "u-2", 1000), status: "processing" as const, startedAt: 1000, remoteId: "r-1" };
    expect(canResumeUpload(s)).toBe(true);
  });

  it("terminal (live/rejected) und idle sind NICHT fortsetzbar", () => {
    const live = { ...createUploadState(null, "T", "u-3", 1000), status: "live" as const, startedAt: 1000, finishedAt: 2000 };
    const rejected = { ...createUploadState(null, "T", "u-4", 1000), status: "rejected" as const, startedAt: 1000, finishedAt: 2000 };
    const idle = createUploadState(null, "T", "u-5", 1000);
    expect(canResumeUpload(live)).toBe(false);
    expect(canResumeUpload(rejected)).toBe(false);
    expect(canResumeUpload(idle)).toBe(false);
  });
});

describe("resumeUpload", () => {
  const pkg = buildUploadPackage(FILE, META, { uploadId: "u-res", now: () => 1000 });

  it("setzt uploading fort: Transport → processing → live (ohne Re-Validierung)", async () => {
    const state = { ...createUploadState(null, META.title, "u-res", 1000), status: "uploading" as const, startedAt: 1000 };
    const r = await resumeUpload(state, pkg, {
      now: () => 2000,
      retry: { delayFn: noWait },
      uploadFn: async () => ({ remoteId: "r-res" }),
      pollFn: async () => "live",
    });
    expect(r.state.status).toBe("live");
    expect(r.remoteId).toBe("r-res");
    expect(r.package?.uploadId).toBe("u-res");
  });

  it("setzt processing fort: nur Poll, kein erneuter Upload", async () => {
    const state = {
      ...createUploadState(null, META.title, "u-res", 1000),
      status: "processing" as const, startedAt: 1000, remoteId: "r-p",
    };
    const uploadFn = vi.fn(async () => ({ remoteId: "must-not-happen" }));
    const r = await resumeUpload(state, pkg, {
      now: () => 2000,
      uploadFn,
      pollFn: async () => "live",
    });
    expect(r.state.status).toBe("live");
    expect(uploadFn).not.toHaveBeenCalled();
  });

  it("wirft bei nicht-fortsetzbarem Status (terminal)", async () => {
    const state = { ...createUploadState(null, "T", "u-x", 1000), status: "live" as const, startedAt: 1000, finishedAt: 2000 };
    await expect(resumeUpload(state, pkg)).rejects.toThrow("nicht fortgesetzt");
  });
});
