// Tests: KDP-Upload-Fehlertaxonomie (Sprint 9, Agent 3).
import { describe, it, expect } from "vitest";
import {
  classifyUploadError,
  createKdpUploadFailure,
  isRetryableUploadError,
  KdpUploadError,
  renderUploadFailure,
} from "./kdpUploadErrors";

describe("classifyUploadError", () => {
  it("klassifiziert Netzwerkfehler (Timeout, 503) als network + retryable", () => {
    for (const msg of ["fetch failed", "503 Service Unavailable", "socket hang up", "ETIMEDOUT"]) {
      const f = classifyUploadError(new Error(msg));
      expect(f.code).toBe("network");
      expect(f.retryable).toBe(true);
      expect(f.recovery.length).toBeGreaterThan(0);
    }
  });

  it("klassifiziert KDP-Review-Ablehnung als rejected (nicht retryable)", () => {
    const f = classifyUploadError(new Error("KDP hat das Manuskript abgelehnt (Review)."));
    expect(f.code).toBe("rejected");
    expect(f.retryable).toBe(false);
    expect(f.status).toBe("rejected");
  });

  it("klassifiziert falsches Format (PDF/TXT) als format", () => {
    const f = classifyUploadError('Nicht unterstütztes Format ".pdf" — KDP erwartet DOCX oder EPUB.');
    expect(f.code).toBe("format");
    expect(f.retryable).toBe(false);
    expect(f.recovery).toContain("DOCX");
  });

  it("klassifiziert 401/403 als auth mit Credential-Recovery", () => {
    const f = classifyUploadError(new Error("401 Unauthorized"));
    expect(f.code).toBe("auth");
    expect(f.recovery).toContain("Credentials");
  });

  it("klassifiziert Validierungsmeldungen als validation", () => {
    const f = classifyUploadError("Pflichtfeld fehlt: Titel.");
    expect(f.code).toBe("validation");
    expect(f.retryable).toBe(false);
  });

  it("fällt für Unbekanntes auf unknown mit Detail zurück", () => {
    const f = classifyUploadError(new Error("völlig unerwarteter Zustand XYZ"));
    expect(f.code).toBe("unknown");
    expect(f.detail).toContain("XYZ");
  });

  it("reicht KdpUploadError-Instanzen mit Code durch", () => {
    const f = classifyUploadError(new KdpUploadError("network", "fetch failed"));
    expect(f.code).toBe("network");
    expect(f.retryable).toBe(true);
  });
});

describe("KdpUploadError + render", () => {
  it("trägt Code, Recovery und retryable", () => {
    const err = new KdpUploadError("auth");
    expect(err.code).toBe("auth");
    expect(err.retryable).toBe(false);
    expect(err.recovery.length).toBeGreaterThan(10);
    expect(err.message.length).toBeGreaterThan(0);
  });

  it("isRetryableUploadError: nur network/aborted sind retryable", () => {
    expect(isRetryableUploadError(new Error("503 Service Unavailable"))).toBe(true);
    expect(isRetryableUploadError(new Error("Upload wurde abgebrochen"))).toBe(true);
    expect(isRetryableUploadError(new Error("Pflichtfeld fehlt: Titel."))).toBe(false);
    expect(isRetryableUploadError(new Error("401 Unauthorized"))).toBe(false);
  });

  it("renderUploadFailure zeigt Meldung + nächsten Schritt", () => {
    const line = renderUploadFailure(createKdpUploadFailure("format", "buch.pdf"));
    expect(line).toContain("DOCX");
    expect(line).toContain("Nächster Schritt");
  });
});
