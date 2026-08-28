// Tests: Resilience-Schicht (Retry, Validation, Logger, Error-Handler).
// Datei: src/services/resilience/resilience.test.ts

import { describe, it, expect, vi } from "vitest";
import { withRetry, HttpError, backoffDelay, defaultIsRetryable } from "./retry";
import { installFetchRetryShim } from "./fetchRetryShim";
import {
  createProjectSchema,
  chapterContentSchema,
  validateAppSettings,
  validate,
} from "@/services/validation/schemas";
import { getLogger, getLogEntries } from "@/services/logger";

describe("withRetry", () => {
  it("gibt beim ersten Erfolg direkt zurück", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retryt bei 5xx und gibt den Erfolg zurück", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new HttpError(503, "down"))
      .mockResolvedValue("ok");
    await expect(withRetry(fn, { baseDelayMs: 1 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retryt nicht bei 4xx", async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError(401, "unauthorized"));
    await expect(withRetry(fn, { baseDelayMs: 1 })).rejects.toThrow("unauthorized");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retryt nicht bei AbortError", async () => {
    const fn = vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError"));
    await expect(withRetry(fn, { baseDelayMs: 1 })).rejects.toThrow("Aborted");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("gibt nach attempts Versuchen auf", async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError(500, "down"));
    await expect(withRetry(fn, { attempts: 3, baseDelayMs: 1 })).rejects.toThrow("down");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe("backoffDelay / defaultIsRetryable", () => {
  it("Backoff wächst exponentiell, bleibt unter maxDelay", () => {
    expect(backoffDelay(1, 100, 8000)).toBeLessThanOrEqual(125);
    expect(backoffDelay(3, 100, 8000)).toBeLessThanOrEqual(500);
    expect(backoffDelay(10, 100, 5000)).toBeLessThanOrEqual(5000);
  });
  it("klassifiziert Status korrekt", () => {
    expect(defaultIsRetryable(new HttpError(500, "x"))).toBe(true);
    expect(defaultIsRetryable(new HttpError(429, "x"))).toBe(true);
    expect(defaultIsRetryable(new HttpError(404, "x"))).toBe(false);
  });
});

describe("fetchRetryShim", () => {
  it("Installation ist idempotent und ohne window kein Fehler", () => {
    expect(() => installFetchRetryShim()).not.toThrow();
    expect(() => installFetchRetryShim()).not.toThrow();
  });
});

describe("Validation (Zod)", () => {
  it("Projektname: nicht leer", () => {
    expect(createProjectSchema.safeParse({ name: "Mein Roman" }).success).toBe(true);
    expect(createProjectSchema.safeParse({ name: "  " }).success).toBe(false);
    expect(createProjectSchema.safeParse({ name: "x".repeat(200) }).success).toBe(false);
  });

  it("Kapitel: Titel Pflicht, Inhalt begrenzt", () => {
    expect(
      chapterContentSchema.safeParse({ id: "abcdefgh", title: "Kapitel 1", content: "" }).success,
    ).toBe(true);
    expect(
      chapterContentSchema.safeParse({ id: "abcdefgh", title: "", content: "" }).success,
    ).toBe(false);
  });

  it("Settings: Temperature-Range wird erkannt", () => {
    const ok = validateAppSettings({ temperature: 1.5 });
    expect(ok).toEqual({ temperature: 1.5 });
    const bad = validateAppSettings({ temperature: 5 });
    expect(bad).toBeNull();
  });

  it("validate liefert verständliche Fehlermeldung", () => {
    const r = validate(createProjectSchema, { name: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Projektname");
  });
});

describe("Logger", () => {
  it("getLogger liefert funktionsfähigen Logger mit Puffer", () => {
    const log = getLogger("test-scope");
    log.info("Testnachricht");
    const entries = getLogEntries(10);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[entries.length - 1].message).toContain("test-scope");
    expect(typeof log.fatal).toBe("function");
    expect(typeof log.getRecent).toBe("function");
  });
});
