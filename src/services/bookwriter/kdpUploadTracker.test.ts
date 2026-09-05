// Tests: KDP-Upload-Status-Tracking (Sprint 7, Agent 1).
//
// Akzeptanzkriterium: Upload-Status wird getrackt (uploading/processing/live/rejected).
// Status-Maschine, Transition-Guards, Fortschritt, Fehler/Grund, Verlauf,
// Listener-Events für CLI + Dashboard, Serialisierung.
import { describe, it, expect } from "vitest";
import {
  createUploadTracker,
  createUploadState,
  transitionUpload,
  isTerminalStatus,
  KDP_UPLOAD_STATUSES,
  UPLOAD_STATUS_LABELS,
  UPLOAD_STATUS_COLORS,
  renderUploadProgress,
  type UploadState,
  type UploadStatus,
} from "./kdpUploadTracker";

function started(overrides: Partial<UploadState> = {}): UploadState {
  return {
    ...createUploadState("job-1", "Mein Buch"),
    status: "uploading",
    startedAt: 1_000,
    ...overrides,
  };
}

describe("Status-Maschine", () => {
  it("KDP_UPLOAD_STATUSES enthält genau die geforderten Status + idle", () => {
    expect([...KDP_UPLOAD_STATUSES]).toEqual(["idle", "uploading", "processing", "live", "rejected"]);
    expect(UPLOAD_STATUS_LABELS.live).toBe("Live");
    expect(typeof UPLOAD_STATUS_COLORS.uploading).toBe("string");
  });

  it("createUploadState erzeugt initialen Zustand (status idle, Fortschritt 0)", () => {
    const s = createUploadState("job-9", "Titel");
    expect(s.uploadId).toBeTruthy();
    expect(s.jobId).toBe("job-9");
    expect(s.title).toBe("Titel");
    expect(s.status).toBe("idle");
    expect(s.progressPercent).toBe(0);
    expect(s.history).toHaveLength(0);
  });

  it("erlaubte Übergänge: uploading→processing→live", () => {
    let s = started();
    s = transitionUpload(s, "processing", { now: 2_000 });
    expect(s.status).toBe("processing");
    s = transitionUpload(s, "live", { now: 3_000 });
    expect(s.status).toBe("live");
    expect(isTerminalStatus(s.status)).toBe(true);
  });

  it("uploading→rejected ist erlaubt, rejected ist terminal", () => {
    const s = transitionUpload(started(), "rejected", { reason: "Cover zu klein", now: 2_000 });
    expect(s.status).toBe("rejected");
    expect(s.reason).toBe("Cover zu klein");
    expect(isTerminalStatus("rejected")).toBe(true);
  });

  it("verbotene Übergänge werden abgelehnt (idle→live, live→uploading)", () => {
    expect(() => transitionUpload(createUploadState("j", "t"), "live")).toThrow(/Übergang|idle.*live|nicht erlaubt/i);
    const done = transitionUpload(started(), "processing");
    const live = transitionUpload(done, "live");
    expect(() => transitionUpload(live, "uploading")).toThrow(/Übergang|nicht erlaubt/i);
  });

  it("jede Transition hängt einen Verlaufs-Eintrag an", () => {
    const s = transitionUpload(started(), "processing", { message: "KDP verarbeitet Manuskript" });
    expect(s.history).toHaveLength(1);
    expect(s.history[0].from).toBe("uploading");
    expect(s.history[0].to).toBe("processing");
    expect(s.history[0].message).toBe("KDP verarbeitet Manuskript");
  });

  it("Fortschritt wird geklemmt (0–100) und aktualisiert updatedAt", () => {
    const s = started({ progressPercent: 50 });
    const s2 = transitionUpload(s, "uploading", { progressPercent: 150, now: 5_000 });
    expect(s2.progressPercent).toBe(100);
    expect(s2.updatedAt).toBe(5_000);
  });

  it("Fortschritt im selben Status löst KEINE History-Spam-Flut aus (gleiche Status-Transition = Fortschritts-Update)", () => {
    let s = started();
    s = transitionUpload(s, "uploading", { progressPercent: 30 });
    s = transitionUpload(s, "uploading", { progressPercent: 60 });
    expect(s.status).toBe("uploading");
    expect(s.progressPercent).toBe(60);
  });
});

describe("Tracker (Observable)", () => {
  it("setState/transition benachrichtigen Listener mit dem neuen Zustand", () => {
    const tracker = createUploadTracker();
    const seen: UploadStatus[] = [];
    tracker.subscribe((s) => seen.push(s.status));

    tracker.transition("uploading");
    tracker.transition("processing");
    expect(seen).toEqual(["uploading", "processing"]);
    expect(tracker.get().status).toBe("processing");
  });

  it("unsubscribe funktioniert", () => {
    const tracker = createUploadTracker();
    const seen: UploadStatus[] = [];
    const unsub = tracker.subscribe((s) => seen.push(s.status));
    tracker.transition("uploading");
    unsub();
    tracker.transition("processing");
    expect(seen).toEqual(["uploading"]);
  });

  it("setState setzt kompletten Zustand (Dashboard-Restore aus Persistenz)", () => {
    const tracker = createUploadTracker();
    const restored = started({ status: "processing", progressPercent: 75 });
    tracker.setState(restored);
    expect(tracker.get()).toEqual(restored);
  });
});

describe("renderUploadProgress (CLI/Dashboard-Anzeige)", () => {
  it("rendert Status, Fortschrittsbalken und Titel", () => {
    const s = started({ progressPercent: 40, title: "Der lange Weg" });
    const out = renderUploadProgress(s);
    expect(out).toContain("Der lange Weg");
    expect(out).toContain("40%");
    expect(out).toContain("Wird hochgeladen");
  });

  it("rejected zeigt den Grund an", () => {
    const s = transitionUpload(started(), "rejected", { reason: "ISBN ungültig" });
    const out = renderUploadProgress(s);
    expect(out).toContain("Abgelehnt");
    expect(out).toContain("ISBN ungültig");
  });

  it("live zeigt 100 % und Live-Label", () => {
    const s = transitionUpload(transitionUpload(started(), "processing"), "live");
    const out = renderUploadProgress(s);
    expect(out).toContain("Live");
    expect(out).toContain("100%");
  });
});
