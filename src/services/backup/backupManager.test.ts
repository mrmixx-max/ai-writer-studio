// Unit-Tests: BackupManager (Sprint 24, Agent 6) — CRUD + Schedule + Cleanup.
import { describe, it, expect, beforeEach } from "vitest";
import {
  createBackup,
  restoreBackup,
  getBackups,
  deleteBackup,
  scheduleBackup,
  cancelScheduledBackup,
  getBackupSize,
  cleanupOldBackups,
  getScheduledConfig,
  getLastRestoredId,
  __resetBackupState,
} from "./backupManager";

beforeEach(async () => {
  await __resetBackupState();
});

describe("backupManager", () => {
  it("createBackup() erzeugt einen Backup-Eintrag mit ID, Zeitstempel und Pfad", async () => {
    const entry = await createBackup();
    expect(entry.id).toMatch(/^backup-/);
    expect(entry.timestamp).toBeGreaterThan(0);
    expect(entry.path).toContain("backups/");
    expect(entry.size).toBeGreaterThan(0);
    const all = await getBackups();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(entry.id);
  });

  it("getBackups() gibt alle Backups neueste-zuerst zurueck", async () => {
    const first = await createBackup();
    const second = await createBackup();
    const all = await getBackups();
    expect(all).toHaveLength(2);
    expect(all.map((b) => b.id)).toContain(first.id);
    expect(all.map((b) => b.id)).toContain(second.id);
    expect(all[0].timestamp).toBeGreaterThanOrEqual(all[1].timestamp);
  });

  it("restoreBackup() setzt den Zustand zurueck, unbekannte ID wirft", async () => {
    const entry = await createBackup();
    await restoreBackup(entry.id);
    expect(getLastRestoredId()).toBe(entry.id);
    await expect(restoreBackup("backup-gibt-es-nicht")).rejects.toThrow();
  });

  it("deleteBackup() loescht gezielt, unbekannte ID wirft", async () => {
    const a = await createBackup();
    const b = await createBackup();
    await deleteBackup(a.id);
    const rest = await getBackups();
    expect(rest).toHaveLength(1);
    expect(rest[0].id).toBe(b.id);
    await expect(deleteBackup(a.id)).rejects.toThrow();
  });

  it("getBackupSize() summiert alle Backup-Groessen", async () => {
    expect(await getBackupSize()).toBe(0);
    const a = await createBackup();
    const b = await createBackup();
    expect(await getBackupSize()).toBe(a.size + b.size);
  });

  it("cleanupOldBackups() loescht aelteste ueber dem Limit", async () => {
    await createBackup();
    await createBackup();
    await createBackup();
    const deleted = await cleanupOldBackups(2);
    expect(deleted).toBe(1);
    expect(await getBackups()).toHaveLength(2);
    expect(await cleanupOldBackups(5)).toBe(0);
  });

  it("scheduleBackup()/cancelScheduledBackup() verwalten den Zeitplan", async () => {
    await scheduleBackup({
      enabled: true,
      interval: 24,
      maxBackups: 5,
      backupPath: "backups",
      includeSettings: true,
      includeKnowledge: true,
      compress: true,
    });
    expect(getScheduledConfig()?.enabled).toBe(true);
    await cancelScheduledBackup();
    expect(getScheduledConfig()).toBeNull();
  });

  it("scheduleBackup() mit ungueltigem Intervall wirft", async () => {
    await expect(
      scheduleBackup({
        enabled: true,
        interval: 0,
        maxBackups: 5,
        backupPath: "backups",
        includeSettings: true,
        includeKnowledge: true,
        compress: false,
      }),
    ).rejects.toThrow();
  });
});
