// @vitest-environment jsdom
// Component-Tests: BackupPanel (Sprint 24, Agent 6) — Liste, Jetzt sichern,
// Wiederherstellen, Loeschen, Auto-Backup-Toggle, Groessenanzeige.
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BackupPanel, type BackupManagerClient } from "./BackupPanel";
import type { BackupEntry } from "@/services/backup/backupManager";

function entry(partial: Partial<BackupEntry> & { id: string }): BackupEntry {
  return {
    timestamp: 1700000000000,
    size: 2048,
    projectCount: 2,
    path: `backups/${partial.id}.json`,
    ...partial,
  };
}

function mockClient(backups: BackupEntry[] = []): BackupManagerClient & { store: BackupEntry[] } {
  const store = [...backups];
  return {
    store,
    createBackup: vi.fn(async () => {
      const e = entry({ id: `backup-test-${store.length + 1}` });
      store.push(e);
      return e;
    }),
    restoreBackup: vi.fn(async () => undefined),
    getBackups: vi.fn(async () => [...store]),
    deleteBackup: vi.fn(async (id: string) => {
      const i = store.findIndex((b) => b.id === id);
      if (i < 0) throw new Error("Backup nicht gefunden");
      store.splice(i, 1);
    }),
    scheduleBackup: vi.fn(async () => undefined),
    cancelScheduledBackup: vi.fn(async () => undefined),
    getBackupSize: vi.fn(async () => store.reduce((s, b) => s + b.size, 0)),
    cleanupOldBackups: vi.fn(async () => 0),
  };
}

describe("BackupPanel", () => {
  it("rendert Backup-Liste mit allen Eintraegen", async () => {
    const client = mockClient([entry({ id: "b1" }), entry({ id: "b2" })]);
    render(<BackupPanel manager={client} />);
    await waitFor(() => expect(screen.getByTestId("backup-item-b1")).toBeInTheDocument());
    expect(screen.getByTestId("backup-item-b2")).toBeInTheDocument();
    expect(screen.getByTestId("backup-count")).toHaveTextContent("2");
  });

  it("zeigt leeren Zustand ohne Backups", async () => {
    render(<BackupPanel manager={mockClient([])} />);
    await waitFor(() => expect(screen.getByTestId("backup-empty")).toBeInTheDocument());
    expect(screen.getByTestId("backup-last")).toHaveTextContent("—");
  });

  it("'Jetzt sichern' erstellt ein Backup und zeigt Gesamtgroesse", async () => {
    const user = userEvent.setup();
    const client = mockClient([]);
    render(<BackupPanel manager={client} />);
    await waitFor(() => expect(screen.getByTestId("backup-empty")).toBeInTheDocument());
    await user.click(screen.getByTestId("backup-now"));
    await waitFor(() => expect(client.createBackup).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByTestId("backup-count")).toHaveTextContent("1"));
    expect(screen.getByTestId("backup-total-size").textContent).toMatch(/KB|B/);
  });

  it("Wiederherstellen- und Loeschen-Buttons rufen den Manager", async () => {
    const user = userEvent.setup();
    const client = mockClient([entry({ id: "b9" })]);
    render(<BackupPanel manager={client} />);
    await waitFor(() => expect(screen.getByTestId("backup-item-b9")).toBeInTheDocument());
    await user.click(screen.getByTestId("backup-restore-b9"));
    expect(client.restoreBackup).toHaveBeenCalledWith("b9");
    await user.click(screen.getByTestId("backup-delete-b9"));
    await waitFor(() => expect(client.deleteBackup).toHaveBeenCalledWith("b9"));
  });

  it("Auto-Backup-Toggle plant und bricht den Zeitplan ab", async () => {
    const user = userEvent.setup();
    const client = mockClient([]);
    render(<BackupPanel manager={client} />);
    const toggle = screen.getByTestId("backup-auto-toggle");
    await waitFor(() => expect(screen.getByTestId("backup-panel")).toBeInTheDocument());
    await user.click(toggle);
    await waitFor(() => expect(client.scheduleBackup).toHaveBeenCalledOnce());
    await user.click(toggle);
    await waitFor(() => expect(client.cancelScheduledBackup).toHaveBeenCalledOnce());
  });

  it("Intervall- und Max-Backups-Eingaben sind editierbar", async () => {
    const user = userEvent.setup();
    render(<BackupPanel manager={mockClient([])} />);
    const interval = screen.getByTestId("backup-interval");
    const max = screen.getByTestId("backup-max");
    await user.clear(interval);
    await user.type(interval, "12");
    expect(interval).toHaveValue(12);
    await user.clear(max);
    await user.type(max, "10");
    expect(max).toHaveValue(10);
  });
});
