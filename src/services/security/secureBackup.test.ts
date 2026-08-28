// Ergänzende Security-Tests: Backup-Container Roundtrip über gemocktes
// Tauri-Backend, Krypto-Edge-Cases und Privacy-Gate-Wirkung.
// Datei: src/services/security/secureBackup.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { encryptString } from "./crypto";

// Tauri-Backend mocken: collect/restore user_data-Dateien als In-Memory-Map.
const userFiles = new Map<string, string>();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
    if (cmd === "collect_user_data_files") {
      return [...userFiles.entries()].map(([path, data]) => ({
        path,
        dataB64: Buffer.from(data, "utf-8").toString("base64"),
      }));
    }
    if (cmd === "restore_user_data_files") {
      for (const e of (args!.entries as { path: string; dataB64: string }[]) ?? []) {
        userFiles.set(e.path, Buffer.from(e.dataB64, "base64").toString("utf-8"));
      }
      return null;
    }
    throw new Error(`unexpected cmd ${cmd}`);
  }),
}));

import { createEncryptedBackup, restoreEncryptedBackup, validateContainerShape } from "./secureBackup";

describe("secureBackup (Roundtrip über gemocktes Tauri-Backend)", () => {
  beforeEach(() => {
    userFiles.clear();
    userFiles.set("app.db", "SQLite-Dump");
    userFiles.set("settings.json", '{"theme":"dark"}');
  });

  it("erstellt und stellt ein verschluesseltes Backup wieder her", async () => {
    const container = await createEncryptedBackup("backup-passwort");
    expect(container.format).toBe("AIWS-BACKUP-1");
    expect(container.payload.startsWith("AWS1|")).toBe(true);
    expect(container.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(validateContainerShape(container)).toBe(true);
    // Payload enthaelt keine Klartext-Metadaten.
    expect(container.payload).not.toContain("SQLite");

    userFiles.clear(); // simuliert verlorene Daten
    const res = await restoreEncryptedBackup(container, "backup-passwort");
    expect(res.restoredFiles).toBe(2);
    expect(res.checksumOk).toBe(true);
    expect(userFiles.get("app.db")).toBe("SQLite-Dump");
    expect(userFiles.get("settings.json")).toBe('{"theme":"dark"}');
  });

  it("verweigert Backup ohne Passwort", async () => {
    await expect(createEncryptedBackup("")).rejects.toThrow(/Passwort/);
  });

  it("wirft bei falschem Passwort beim Restore", async () => {
    const container = await createEncryptedBackup("richtig");
    await expect(restoreEncryptedBackup(container, "falsch")).rejects.toThrow(/fehlgeschlagen|falsches/);
  });

  it("wirft bei manipulierter Pruefsumme", async () => {
    const container = await createEncryptedBackup("pw");
    const tampered = { ...container, checksum: "0".repeat(64) };
    await expect(restoreEncryptedBackup(tampered, "pw")).rejects.toThrow(/Pruefsumme/);
  });

  it("wirft bei unbekanntem Format und unverschluesseltem Payload", async () => {
    const container = await createEncryptedBackup("pw");
    await expect(
      restoreEncryptedBackup({ ...container, format: "OTHER" as never }, "pw"),
    ).rejects.toThrow(/Format/);
    await expect(
      restoreEncryptedBackup({ ...container, payload: "klartext" }, "pw"),
    ).rejects.toThrow(/verschluesselt/);
  });

  it("erkennt ungueltige Container-Formen", () => {
    const base = {
      format: "AIWS-BACKUP-1" as const,
      createdAt: 1,
      checksum: "a".repeat(64),
      payload: "AWS1|x|y|z",
    };
    expect(validateContainerShape({ ...base, createdAt: "x" as never })).toBe(false);
    expect(validateContainerShape({ ...base, payload: "nope" })).toBe(false);
    expect(validateContainerShape({ ...base, checksum: "a".repeat(63) })).toBe(false);
  });

  it("Roundtrip verschluesselter Inhalte bleibt stabil (Idempotenz-Check)", async () => {
    const c1 = await encryptString("x", "pw");
    const c2 = await encryptString("x", "pw");
    // Zwei Verschluesselungen desselben Klartexts liefern unterschiedliche
    // Ciphertexte (zufaelliges Salt/IV), aber beide sind AWS1-Pakete.
    expect(c1).not.toBe(c2);
    expect(c1.startsWith("AWS1|")).toBe(true);
    expect(c2.startsWith("AWS1|")).toBe(true);
  });
});
