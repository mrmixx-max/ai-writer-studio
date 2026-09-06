// KDP-Upload-Fehlertaxonomie (Sprint 9, Agent 3).
//
// Sprechende Fehler für den KDP-Upload-Flow: Jede Fehlerklasse trägt einen
// stabilen Code, eine deutsche User-Meldung und einen konkreten
// Recovery-Hinweis (was der Nutzer als Nächstes tun kann). Die Taxonomie
// ergänzt kdpUpload.ts/kdpUploadValidation.ts — sie ersetzt nichts und
// ändert keine bestehenden Interfaces.

import type { UploadStatus } from "./kdpUploadTracker";

/** Stabile Fehler-Codes des KDP-Upload-Flows. */
export type KdpUploadErrorCode =
  | "validation"
  | "format"
  | "rejected"
  | "network"
  | "auth"
  | "aborted"
  | "unknown";

/** Kategorisierter, anzeigefähiger KDP-Upload-Fehler. */
export interface KdpUploadFailure {
  code: KdpUploadErrorCode;
  /** Kurze deutsche Meldung für die UI. */
  message: string;
  /** Konkreter nächster Schritt für den Nutzer. */
  recovery: string;
  /** Ob ein automatischer Retry sinnvoll ist. */
  retryable: boolean;
  /** Ursprüngliche Fehlermeldung (Debug). */
  detail: string | null;
  /** Zugehöriger Tracker-Status (falls aus einem UploadState abgeleitet). */
  status: UploadStatus | null;
}

const FAILURE_DEFS: Record<
  KdpUploadErrorCode,
  { message: string; recovery: string; retryable: boolean }
> = {
  validation: {
    message: "Pre-Upload-Check fehlgeschlagen — Pflichtangaben fehlen oder sind ungültig.",
    recovery: "Prüfe die markierten Punkte in der Pre-Upload-Checkliste und starte den Upload erneut.",
    retryable: false,
  },
  format: {
    message: "Dateiformat wird von KDP nicht akzeptiert (erwartet: DOCX oder EPUB).",
    recovery: "Exportiere das Manuskript erneut als DOCX oder EPUB und lade die neue Datei hoch.",
    retryable: false,
  },
  rejected: {
    message: "KDP hat das Manuskript im Review abgelehnt.",
    recovery: "Lies den Ablehnungsgrund in den Upload-Details, behebe Inhalt oder Metadaten und reiche das Buch erneut ein.",
    retryable: false,
  },
  network: {
    message: "Netzwerkfehler beim Upload — die Verbindung zu KDP ist abgebrochen.",
    recovery: "Verbindung prüfen und Upload erneut versuchen — der Upload wird automatisch mit Backoff wiederholt oder kann fortgesetzt werden.",
    retryable: true,
  },
  auth: {
    message: "KDP-Zugang ungültig oder abgelaufen.",
    recovery: "KDP-Credentials in den Einstellungen neu hinterlegen (Master-Passphrase bereithalten) und Upload erneut starten.",
    retryable: false,
  },
  aborted: {
    message: "Upload wurde abgebrochen.",
    recovery: "Upload über „Fortsetzen“ wieder aufnehmen — bereits validierte Pakete müssen nicht neu geprüft werden.",
    retryable: true,
  },
  unknown: {
    message: "Unbekannter Upload-Fehler.",
    recovery: "Upload erneut versuchen — bleibt der Fehler bestehen, die Detailmeldung prüfen oder den Support kontaktieren.",
    retryable: false,
  },
};

/** Baut ein KdpUploadFailure aus Code + Detailmeldung. */
export function createKdpUploadFailure(
  code: KdpUploadErrorCode,
  detail: string | null = null,
  status: UploadStatus | null = null,
): KdpUploadFailure {
  const def = FAILURE_DEFS[code];
  return { code, message: def.message, recovery: def.recovery, retryable: def.retryable, detail, status };
}

/** Error-Klasse für geworfene KDP-Upload-Fehler (trägt Code + Recovery). */
export class KdpUploadError extends Error {
  readonly code: KdpUploadErrorCode;
  readonly recovery: string;
  readonly retryable: boolean;
  constructor(code: KdpUploadErrorCode, detail?: string) {
    const failure = createKdpUploadFailure(code, detail ?? null);
    super(detail ? `${failure.message} (${detail})` : failure.message);
    this.name = "KdpUploadError";
    this.code = code;
    this.recovery = failure.recovery;
    this.retryable = failure.retryable;
  }
  toFailure(status: UploadStatus | null = null): KdpUploadFailure {
    return createKdpUploadFailure(this.code, this.message, status);
  }
}

const NETWORK_PATTERNS = [
  /network/i, /netzwerk/i, /fetch failed/i, /failed to fetch/i, /timeout/i, /timedout/i,
  /econnreset/i, /econnrefused/i, /enotfound/i, /eai_again/i, /epipe/i,
  /\b503\b/, /\b502\b/, /\b504\b/, /\b429\b/, /service unavailable/i,
  /gateway timeout/i, /bad gateway/i, /temporarily unavailable/i,
  /aborted/i, /abgebrochen/i, /socket hang up/i,
];

const AUTH_PATTERNS = [/401/, /403/, /unauthorized/i, /forbidden/i, /token.*(expired|invalid|abgelaufen)/i, /auth/i];

const FORMAT_PATTERNS = [
  /nicht unterstütztes format/i, /keine endung/i, /mime-type/i,
  /unsupported.*format/i, /invalid.*format/i, /\.pdf|\.txt|\.mobi/i,
];

const REJECTED_PATTERNS = [/abgelehnt/i, /rejected/i, /review/i];

/**
 * Klassifiziert eine beliebige Upload-Fehlermeldung in die Taxonomie.
 * Reihenfolge: auth → format → rejected → network → validation → unknown.
 * Bereits kategorisierte KdpUploadError-Instanzen werden durchgereicht.
 */
export function classifyUploadError(err: unknown): KdpUploadFailure {
  if (err instanceof KdpUploadError) return err.toFailure();
  const detail = err instanceof Error ? err.message : String(err ?? "");
  if (AUTH_PATTERNS.some((p) => p.test(detail))) return createKdpUploadFailure("auth", detail);
  if (FORMAT_PATTERNS.some((p) => p.test(detail))) return createKdpUploadFailure("format", detail);
  if (REJECTED_PATTERNS.some((p) => p.test(detail))) return createKdpUploadFailure("rejected", detail, "rejected");
  if (NETWORK_PATTERNS.some((p) => p.test(detail))) return createKdpUploadFailure("network", detail);
  if (/pflichtfeld|pre-upload|validierung|isbn|preis|klappentext|keyword/i.test(detail)) {
    return createKdpUploadFailure("validation", detail);
  }
  return createKdpUploadFailure("unknown", detail || null);
}

/** true, wenn der Fehler einen automatischen Retry verdient (nur Netzwerk/Abbruch). */
export function isRetryableUploadError(err: unknown): boolean {
  return classifyUploadError(err).retryable;
}

/** Rendert einen Failure als zwei UI-Zeilen (Meldung + Recovery). */
export function renderUploadFailure(failure: KdpUploadFailure): string {
  return `${failure.message}\n  ↳ Nächster Schritt: ${failure.recovery}`;
}
