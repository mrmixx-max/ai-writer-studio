// KDP-Upload-Retry mit Backoff + Resume nach Abbruch (Sprint 9, Agent 3).
//
// Ergänzt kdpUpload.ts ADDITIV (keine bestehenden Signaturen geändert):
//   - computeBackoffDelay(): reine Backoff-Rechnung (testbar, kein Timer).
//   - uploadWithRetry(): wiederholt uploadToKdp bei retrybaren Fehlern
//     (Netzwerk/Abbruch laut kdpUploadErrors-Taxonomie) mit exponentiellem
//     Backoff; nicht-retrybare Fehler (Validierung, Format, Rejected, Auth)
//     werden sofort durchgereicht.
//   - canResumeUpload()/resumeUpload(): setzt einen abgebrochenen oder
//     hängengebliebenen Upload anhand der Tracker-Stati fort, ohne die
//     Validierung zu wiederholen (Paket wird wiederverwendet).

import type { KdpMetadata } from "@/types/bookwriter";
import {
  uploadToKdp,
  type KdpUploadPackage,
  type KdpUploadResult,
  type UploadToKdpOptions,
} from "./kdpUpload";
import { classifyUploadError } from "./kdpUploadErrors";
import {
  isTerminalStatus,
  type UploadState,
  type UploadStatus,
  type UploadTracker,
} from "./kdpUploadTracker";
import type { UploadFile } from "./kdpUploadValidation";

/** Retry-Konfiguration (alle Felder optional, sinnvolle Defaults). */
export interface UploadRetryOptions {
  /** Max. Gesamtversuche inkl. Erstversuch. Default: 4. */
  maxAttempts?: number;
  /** Basis-Wartezeit vor dem 1. Retry in ms. Default: 1000. */
  baseDelayMs?: number;
  /** Exponentieller Faktor. Default: 2. */
  backoffFactor?: number;
  /** Deckel pro Wartezeit in ms. Default: 30000. */
  maxDelayMs?: number;
  /** Injizierbarer Timer (Tests: Fake ohne echtes Warten). */
  delayFn?: (ms: number) => Promise<void>;
  /** Extra-Hook pro Versuch (Logging/Fortschritt). */
  onAttempt?: (attempt: number, maxAttempts: number) => void;
}

export const DEFAULT_RETRY_OPTIONS: Required<Omit<UploadRetryOptions, "delayFn" | "onAttempt">> = {
  maxAttempts: 4,
  baseDelayMs: 1000,
  backoffFactor: 2,
  maxDelayMs: 30000,
};

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Exponentieller Backoff: baseDelay * factor^(attempt-1), gedeckelt auf
 * maxDelay. attempt ist 1-basiert (1 = Wartezeit vor dem 2. Gesamtversuch).
 * Reine Funktion — kein Timer, keine Seiteneffekte.
 */
export function computeBackoffDelay(
  attempt: number,
  opts: Pick<UploadRetryOptions, "baseDelayMs" | "backoffFactor" | "maxDelayMs"> = {},
): number {
  const base = opts.baseDelayMs ?? DEFAULT_RETRY_OPTIONS.baseDelayMs;
  const factor = opts.backoffFactor ?? DEFAULT_RETRY_OPTIONS.backoffFactor;
  const max = opts.maxDelayMs ?? DEFAULT_RETRY_OPTIONS.maxDelayMs;
  if (attempt < 1) return 0;
  return Math.min(max, Math.round(base * Math.pow(factor, attempt - 1)));
}

/** Ergebnis eines Retry-Laufs: Upload-Resultat + Versuchszählung. */
export interface RetryUploadResult {
  result: KdpUploadResult;
  /** Durchgeführte Gesamtversuche (1 = Erfolg beim Erstversuch). */
  attempts: number;
  /** Ob mindestens ein Retry stattfand. */
  retried: boolean;
}

/**
 * Upload mit Retry: führt uploadToKdp aus und wiederholt bei retrybaren
 * Fehlern (Netzwerk/Abbruch) mit exponentiellem Backoff.
 *
 * Retry-Erkennung: (a) rejected-Status, dessen reason als retrybar
 * klassifiziert wird, oder (b) ein aus uploadFn/pollFn geworfener Fehler —
 * uploadToKdp fängt Transportfehler selbst ab und meldet sie als rejected,
 * daher prüft der Retry die reason-Klassifikation. Nicht-retrybare
 * Ablehnungen (Validierung/Format/KDP-Review/Auth) brechen sofort ab.
 */
export async function uploadWithRetry(
  file: UploadFile | null,
  metadata: KdpMetadata,
  opts: UploadToKdpOptions & { retry?: UploadRetryOptions; delayFn?: (ms: number) => Promise<void> } = {},
): Promise<RetryUploadResult> {
  const { retry = {}, delayFn: topDelayFn, ...uploadOpts } = opts;
  const maxAttempts = Math.max(1, retry.maxAttempts ?? DEFAULT_RETRY_OPTIONS.maxAttempts);
  const delayFn = retry.delayFn ?? topDelayFn ?? defaultDelay;

  let attempts = 0;
  while (true) {
    attempts += 1;
    retry.onAttempt?.(attempts, maxAttempts);
    const result = await uploadToKdp(file, metadata, uploadOpts);
    if (result.state.status !== "rejected") {
      return { result, attempts, retried: attempts > 1 };
    }
    const failure = classifyUploadError(result.state.reason ?? "");
    const lastAttempt = attempts >= maxAttempts;
    if (!failure.retryable || lastAttempt) {
      return { result, attempts, retried: attempts > 1 };
    }
    await delayFn(computeBackoffDelay(attempts, retry));
  }
}

/** Stati, aus denen ein Upload fortgesetzt werden kann (nicht-terminal + gestartet). */
const RESUMABLE_STATUSES: UploadStatus[] = ["uploading", "processing"];

/**
 * true, wenn der Upload-Zustand fortsetzbar ist: Status uploading/processing
 * (laut Tracker-Statusgraph die einzigen nicht-terminalen Nach-Start-Stati)
 * mit gesetztem startedAt und ohne finishedAt.
 */
export function canResumeUpload(state: UploadState): boolean {
  if (isTerminalStatus(state.status)) return false;
  if (!RESUMABLE_STATUSES.includes(state.status)) return false;
  if (state.startedAt == null || state.finishedAt != null) return false;
  return true;
}

/** Optionen für resumeUpload (Transport + Tracker-Anbindung). */
export interface ResumeUploadOptions {
  now?: () => number;
  onStatus?: (state: UploadState) => void;
  tracker?: UploadTracker;
  /** Poll-Funktion für processing-Resume (KDP-Review-Status). */
  pollFn?: (remoteId: string) => Promise<UploadStatus>;
  /** Transport für uploading-Resume (erneuter Hochladeversuch). */
  uploadFn?: (pkg: KdpUploadPackage) => Promise<{ remoteId: string }>;
  retry?: UploadRetryOptions;
}

/**
 * Setzt einen abgebrochenen Upload fort, ohne die Validierung zu
 * wiederholen: Das bereits geprüfte Paket wird wiederverwendet.
 *   - Status uploading → erneuter Transport via uploadFn (+ Retry), dann Poll.
 *   - Status processing → nur Review-Poll via pollFn (kein erneuter Upload).
 * Wirft einen KdpUploadError-klassifizierbaren Fehler, wenn der Zustand
 * nicht fortsetzbar ist (siehe canResumeUpload).
 */
export async function resumeUpload(
  state: UploadState,
  pkg: KdpUploadPackage,
  opts: ResumeUploadOptions = {},
): Promise<KdpUploadResult> {
  const now = opts.now ?? Date.now;
  if (!canResumeUpload(state)) {
    throw new Error(
      `Upload ${state.uploadId} kann nicht fortgesetzt werden (Status: ${state.status}).`,
    );
  }
  const tracker = opts.tracker;
  const notify = (s: UploadState) => {
    tracker?.setState(s);
    opts.onStatus?.(s);
  };

  if (state.status === "processing") {
    const remoteId = state.remoteId;
    if (remoteId && opts.pollFn) {
      const polled = await opts.pollFn(remoteId);
      if (polled !== "processing") {
        const next: UploadState = {
          ...state,
          status: polled,
          reason: polled === "rejected" ? "KDP hat das Manuskript abgelehnt (Review)." : state.reason,
          finishedAt: polled === "processing" ? null : now(),
          updatedAt: now(),
          history: [
            ...state.history,
            { from: "processing", to: polled, at: now(), message: "Review-Status von KDP (Resume)" },
          ],
        };
        notify(next);
        return { state: next, package: pkg, remoteId };
      }
    }
    notify(state);
    return { state, package: pkg, remoteId };
  }

  // Status uploading → Transport erneut versuchen (mit Retry/Backoff).
  const { retry = {} } = opts;
  const maxAttempts = Math.max(1, retry.maxAttempts ?? DEFAULT_RETRY_OPTIONS.maxAttempts);
  const delayFn = retry.delayFn ?? defaultDelay;
  let attempts = 0;
  while (true) {
    attempts += 1;
    retry.onAttempt?.(attempts, maxAttempts);
    if (!opts.uploadFn) {
      notify(state);
      return { state, package: pkg, remoteId: state.remoteId };
    }
    try {
      const res = await opts.uploadFn(pkg);
      const processing: UploadState = {
        ...state,
        status: "processing",
        remoteId: res.remoteId,
        updatedAt: now(),
        history: [
          ...state.history,
          { from: "uploading", to: "processing", at: now(), message: "Upload fortgesetzt — KDP verarbeitet Manuskript" },
        ],
      };
      notify(processing);
      if (opts.pollFn) {
        const polled = await opts.pollFn(res.remoteId);
        if (polled !== "processing") {
          const done: UploadState = {
            ...processing,
            status: polled,
            reason: polled === "rejected" ? "KDP hat das Manuskript abgelehnt (Review)." : null,
            finishedAt: now(),
            updatedAt: now(),
            history: [
              ...processing.history,
              { from: "processing", to: polled, at: now(), message: "Review-Status von KDP (Resume)" },
            ],
          };
          notify(done);
          return { state: done, package: pkg, remoteId: res.remoteId };
        }
      }
      return { state: processing, package: pkg, remoteId: res.remoteId };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const failure = classifyUploadError(errMsg);
      if (!failure.retryable || attempts >= maxAttempts) {
        const failed: UploadState = {
          ...state,
          status: "rejected",
          reason: `Upload fehlgeschlagen: ${errMsg}`,
          finishedAt: now(),
          updatedAt: now(),
          history: [
            ...state.history,
            { from: "uploading", to: "rejected", at: now(), message: errMsg },
          ],
        };
        notify(failed);
        return { state: failed, package: pkg, remoteId: null };
      }
      await delayFn(computeBackoffDelay(attempts, retry));
    }
  }
}
