// KDP-Upload-Service (Sprint 7, Agent 1).
//
// Fassade für den automatischen KDP-Upload fertiger Bücher:
//
//   prepareUpload()  → Validierung (Pre-Upload-Check) + Upload-Paket
//   uploadToKdp()    → Status-Flow uploading → processing → live/rejected
//   createKdpUploadService() → Tracker + Upload + Render für CLI/Dashboard
//
// Design-Entscheidungen:
//   - Amazon bietet KEINE öffentliche KDP-Upload-REST-API für Self-Publisher.
//     Der Service ist deshalb als Upload-Paket-Generator + Status-Maschine
//     aufgebaut: Die Validierung/Serialisierung läuft vollständig hier, der
//     tatsächliche Transport (KDP-Web-Upload, später evtl. eine offizielle
//     API) wird über injizierbare `uploadFn`/`pollFn` angebunden. Damit sind
//     alle Tests offline (0 echte API-Calls) und der Transport ist austauschbar.
//   - Credentials kommen ausschließlich über kdpCredentials.ts (verschlüsselt
//     oder Env-Override) — hier werden sie NIE berührt oder geloggt.

import type { KdpMetadata } from "@/types/bookwriter";
import {
  validateUploadArtefact,
  type UploadFile,
  type UploadValidationResult,
} from "./kdpUploadValidation";
import {
  createUploadState,
  createUploadTracker,
  renderUploadProgress,
  UPLOAD_STATUS_LABELS,
  type UploadState,
  type UploadStatus,
  type UploadTracker,
} from "./kdpUploadTracker";

/** Ein fertiges Upload-Paket (Validierung bestanden). */
export interface KdpUploadPackage {
  uploadId: string;
  file: UploadFile;
  metadata: KdpMetadata;
  /** ISBN-13 (optional — KDP vergibt alternativ eine eigene). */
  isbn: string | null;
  createdAt: number;
  /** Kompakte Checkliste aus der Validierung (für die UI). */
  checklist: { label: string; ok: boolean }[];
}

/** Ergebnis von prepareUpload: ok (mit Paket) oder nicht ok (mit Issues). */
export type PrepareUploadResult =
  | { ok: true; package: KdpUploadPackage; validation: UploadValidationResult }
  | { ok: false; validation: UploadValidationResult };

/** Ergebnis eines vollständigen Upload-Runs. */
export interface KdpUploadResult {
  state: UploadState;
  package: KdpUploadPackage | null;
  remoteId: string | null;
}

/** Optionen für buildUploadPackage. */
export interface BuildPackageOptions {
  uploadId?: string;
  isbn?: string | null;
  now?: () => number;
}

/** Wandle Validierungs-Issues in eine UI-Checkliste um. */
function buildChecklist(validation: UploadValidationResult, isbn: string | null) {
  const hasErrors = validation.errorCount > 0;
  return [
    { label: "Format DOCX/EPUB", ok: !validation.issues.some((i) => i.field === "file" && /format/i.test(i.message)) },
    { label: "Dateigröße im Limit", ok: !validation.issues.some((i) => i.field === "file" && /größe|leer|klein/i.test(i.message)) },
    { label: "Pflichtfelder (Titel, Klappentext, Keywords)", ok: !validation.issues.some((i) => i.field === "metadata" && i.severity === "error") },
    { label: "Preis gesetzt", ok: !validation.issues.some((i) => /preis/i.test(i.message)) },
    { label: isbn ? "ISBN gültig" : "ISBN (KDP vergibt eigene)", ok: !validation.issues.some((i) => i.field === "isbn") },
    { label: "Alle Checks bestanden", ok: !hasErrors },
  ];
}

/** Erstellt das Upload-Paket (mit Validierung). */
export function buildUploadPackage(
  file: UploadFile,
  metadata: KdpMetadata,
  opts: BuildPackageOptions = {},
): KdpUploadPackage {
  const now = (opts.now ?? Date.now)();
  const isbn = opts.isbn ?? null;
  const validation = validateUploadArtefact(file, metadata, { isbn });
  return {
    uploadId: opts.uploadId ?? `kdp-${now}-${Math.floor(Math.random() * 1e6)}`,
    file,
    metadata,
    isbn,
    createdAt: now,
    checklist: buildChecklist(validation, isbn),
  };
}

/** Injizierbare Abhängigkeiten (Transport + Zeit + IDs). */
export interface KdpUploadDeps {
  now?: () => number;
  randomId?: () => string;
  /**
   * Transport-Funktion: lädt das Paket zu KDP hoch. Fehlt sie (kein
   * KDP-Zugang), läuft uploadToKdp im prepare-only-Modus.
   */
  uploadFn?: (pkg: KdpUploadPackage) => Promise<{ remoteId: string }>;
  /** Poll-Funktion: fragt den KDP-Review-Status ab. */
  pollFn?: (remoteId: string) => Promise<UploadStatus>;
}

/** Optionen für uploadToKdp. */
export interface UploadToKdpOptions extends KdpUploadDeps {
  onStatus?: (state: UploadState) => void;
  tracker?: UploadTracker;
}

/**
 * Validiert und bereitet den Upload vor (kein Transport).
 * Liefert ok=false mit Issues, wenn der Pre-Upload-Check fehlschlägt.
 */
export function prepareUpload(
  file: UploadFile | null,
  metadata: KdpMetadata,
  deps: KdpUploadDeps = {},
): PrepareUploadResult {
  const now = deps.now ?? Date.now;
  const isbn: string | null = (metadata as { isbn?: string | null }).isbn ?? null;
  const validation = validateUploadArtefact(file, metadata, { isbn });
  if (!file || !validation.isValid) {
    return { ok: false, validation };
  }
  const pkg = buildUploadPackage(file, metadata, {
    uploadId: deps.randomId?.(),
    isbn,
    now,
  });
  return { ok: true, package: pkg, validation };
}

/**
 * Führt den vollständigen Upload-Flow aus:
 *   1. Pre-Upload-Check (Validierung) — Fehler → rejected ohne Transport.
 *   2. Status uploading (Transport via uploadFn, falls vorhanden).
 *   3. Status processing → pollFn bis live/rejected (falls vorhanden).
 *
 * Der Tracker (falls übergeben) wird bei jedem Status benachrichtigt —
 * so hängen CLI und Dashboard direkt am selben Zustand.
 */
export async function uploadToKdp(
  file: UploadFile | null,
  metadata: KdpMetadata,
  opts: UploadToKdpOptions = {},
): Promise<KdpUploadResult> {
  const now = opts.now ?? Date.now;
  const randomId = opts.randomId ?? (() => `kdp-${now()}-${Math.floor(Math.random() * 1e6)}`);
  const tracker = opts.tracker ?? createUploadTracker();
  const notify = (state: UploadState) => {
    tracker.setState(state);
    opts.onStatus?.(state);
  };

  // 1) Pre-Upload-Check.
  const prepared = prepareUpload(file, metadata, { now, randomId });
  if (!prepared.ok) {
    const reason = prepared.validation.issues
      .filter((i) => i.severity === "error")
      .map((i) => i.message)
      .join("; ");
    let state = createUploadState(null, metadata.title, randomId(), now());
    state = {
      ...state,
      startedAt: now(),
      history: [{ from: "idle", to: "uploading", at: now(), message: "Upload gestartet" }],
    };
    state = {
      ...state,
      status: "rejected",
      reason,
      finishedAt: now(),
      updatedAt: now(),
      history: [...state.history, { from: "uploading", to: "rejected", at: now(), message: reason }],
    };
    notify(state);
    return { state, package: null, remoteId: null };
  }

  const pkg = prepared.package;

  // 2) Status uploading (kein idle-Notify: Listener sehen nur echte Statuswechsel).
  let state = createUploadState(null, metadata.title, pkg.uploadId, now());
  state = {
    ...state,
    status: "uploading",
    startedAt: now(),
    updatedAt: now(),
    history: [...state.history, { from: "idle", to: "uploading", at: now(), message: "Upload gestartet" }],
  };
  notify(state);

  // 3) Transport (optional — prepare-only, wenn kein KDP-Zugang).
  let remoteId: string | null = null;
  if (opts.uploadFn) {
    try {
      const res = await opts.uploadFn(pkg);
      remoteId = res.remoteId;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      state = {
        ...state,
        status: "rejected",
        reason: `Upload fehlgeschlagen: ${reason}`,
        finishedAt: now(),
        updatedAt: now(),
        history: [...state.history, { from: "uploading", to: "rejected", at: now(), message: reason }],
      };
      notify(state);
      return { state, package: pkg, remoteId: null };
    }
    state = {
      ...state,
      status: "processing",
      remoteId,
      updatedAt: now(),
      history: [...state.history, { from: "uploading", to: "processing", at: now(), message: "KDP verarbeitet Manuskript" }],
    };
    notify(state);

    // 4) Review-Status pollen.
    if (opts.pollFn) {
      const polled = await opts.pollFn(remoteId);
      if (polled !== "processing") {
        state = {
          ...state,
          status: polled,
          reason: polled === "rejected" ? "KDP hat das Manuskript abgelehnt (Review)." : null,
          finishedAt: now(),
          updatedAt: now(),
          history: [...state.history, { from: "processing", to: polled, at: now(), message: "Review-Status von KDP" }],
        };
        notify(state);
      }
    }
  }

  return { state, package: pkg, remoteId };
}

/** Service-Fassade für CLI/Dashboard: ein Tracker, Upload + Render. */
export function createKdpUploadService(deps: KdpUploadDeps = {}) {
  const tracker = createUploadTracker();
  return {
    tracker,
    /** Startet einen Upload und tracked den Status im eigenen Tracker. */
    upload(
      file: UploadFile | null,
      metadata: KdpMetadata,
      opts: Pick<UploadToKdpOptions, "uploadFn" | "pollFn"> = {},
    ): Promise<KdpUploadResult> {
      return uploadToKdp(file, metadata, { ...deps, ...opts, tracker });
    },
    /** Aktuelle Statusanzeige (CLI-Zeile / Dashboard-Widget). */
    render(): string {
      return renderUploadProgress(tracker.get());
    },
    /** Status-Label für die UI. */
    statusLabel(): string {
      return UPLOAD_STATUS_LABELS[tracker.get().status];
    },
  };
}
