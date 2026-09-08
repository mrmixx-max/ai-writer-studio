// Backup-Panel (Sprint 24, Agent 6): Backup-Liste, Jetzt sichern,
// Wiederherstellen, Loeschen, Auto-Backup-Toggle, Intervall- und
// Max-Backups-Eingaben, Gesamtgroesse, Letztes Backup.
// Bloomberg-Terminal-Stil (Inline-Styles — kein neues CSS-Asset noetig).
// Der Manager ist per Prop injizierbar (Tests/Storybook), Default: echter Manager.
import { useEffect, useState } from "react";
import {
  createBackup,
  restoreBackup,
  getBackups,
  deleteBackup,
  scheduleBackup,
  cancelScheduledBackup,
  getBackupSize,
  cleanupOldBackups,
  type BackupConfig,
  type BackupEntry,
} from "@/services/backup/backupManager";

export interface BackupManagerClient {
  createBackup: () => Promise<BackupEntry>;
  restoreBackup: (id: string) => Promise<void>;
  getBackups: () => Promise<BackupEntry[]>;
  deleteBackup: (id: string) => Promise<void>;
  scheduleBackup: (config: BackupConfig) => Promise<void>;
  cancelScheduledBackup: () => Promise<void>;
  getBackupSize: () => Promise<number>;
  cleanupOldBackups: () => Promise<number>;
}

const DEFAULT_CLIENT: BackupManagerClient = {
  createBackup,
  restoreBackup,
  getBackups,
  deleteBackup,
  scheduleBackup,
  cancelScheduledBackup,
  getBackupSize,
  cleanupOldBackups,
};

const TERM: React.CSSProperties = {
  background: "#0a0e14",
  color: "#ffb000",
  fontFamily: "ui-monospace, Menlo, Consolas, monospace",
  fontSize: 13,
  padding: 12,
  borderRadius: 6,
  border: "1px solid #2a3340",
};

const BTN: React.CSSProperties = {
  background: "#131a24",
  color: "#ffb000",
  border: "1px solid #ffb000",
  borderRadius: 4,
  padding: "4px 10px",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 12,
};

const INPUT: React.CSSProperties = {
  background: "#131a24",
  color: "#ffb000",
  border: "1px solid #2a3340",
  borderRadius: 4,
  padding: "4px 8px",
  fontFamily: "inherit",
  fontSize: 12,
  width: 80,
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export interface BackupPanelProps {
  manager?: BackupManagerClient;
}

export function BackupPanel({ manager = DEFAULT_CLIENT }: BackupPanelProps) {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const [autoBackup, setAutoBackup] = useState(false);
  const [interval, setIntervalHours] = useState(24);
  const [maxBackups, setMaxBackups] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    try {
      const [list, size] = await Promise.all([manager.getBackups(), manager.getBackupSize()]);
      setBackups(list);
      setTotalSize(size);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleBackupNow() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const entry = await manager.createBackup();
      setNotice(`Backup erstellt: ${entry.id}`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(id: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await manager.restoreBackup(id);
      setNotice(`Backup wiederhergestellt: ${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await manager.deleteBackup(id);
      setNotice(`Backup geloescht: ${id}`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleAutoToggle(next: boolean) {
    setAutoBackup(next);
    setError(null);
    try {
      if (next) {
        await manager.scheduleBackup({
          enabled: true,
          interval,
          maxBackups,
          backupPath: "backups",
          includeSettings: true,
          includeKnowledge: true,
          compress: true,
        });
        setNotice(`Auto-Backup aktiv: alle ${interval} h, max. ${maxBackups}`);
      } else {
        await manager.cancelScheduledBackup();
        setNotice("Auto-Backup deaktiviert.");
      }
    } catch (e) {
      setAutoBackup(!next);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const last = backups.length > 0 ? backups[0] : null;

  return (
    <div data-testid="backup-panel" style={TERM}>
      <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>🔒 BACKUP // AUTOMATISCHE SICHERUNG</h3>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <button data-testid="backup-now" style={BTN} onClick={handleBackupNow} disabled={busy}>
          ⬇ Jetzt sichern
        </button>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            data-testid="backup-auto-toggle"
            type="checkbox"
            checked={autoBackup}
            onChange={(e) => void handleAutoToggle(e.target.checked)}
          />
          Auto-Backup
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          Intervall (h):
          <input
            data-testid="backup-interval"
            style={INPUT}
            type="number"
            min={1}
            value={interval}
            onChange={(e) => setIntervalHours(Number(e.target.value))}
          />
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          Max. Backups:
          <input
            data-testid="backup-max"
            style={INPUT}
            type="number"
            min={1}
            value={maxBackups}
            onChange={(e) => setMaxBackups(Number(e.target.value))}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
        <span data-testid="backup-total-size">Gesamt: {formatSize(totalSize)}</span>
        <span data-testid="backup-last">
          Letztes: {last ? new Date(last.timestamp).toLocaleString() : "—"}
        </span>
        <span data-testid="backup-count">Anzahl: {backups.length}</span>
      </div>

      {error && (
        <div data-testid="backup-error" style={{ color: "#ff5555", marginBottom: 8 }}>
          ⚠ {error}
        </div>
      )}
      {notice && (
        <div data-testid="backup-notice" style={{ color: "#5fff87", marginBottom: 8 }}>
          {notice}
        </div>
      )}

      <div data-testid="backup-list">
        {backups.length === 0 ? (
          <div data-testid="backup-empty" style={{ opacity: 0.7 }}>
            Keine Backups vorhanden — „Jetzt sichern“ erstellt das erste.
          </div>
        ) : (
          backups.map((b) => (
            <div
              key={b.id}
              data-testid={`backup-item-${b.id}`}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                padding: "4px 0",
                borderBottom: "1px solid #1a2230",
              }}
            >
              <span title={b.path} style={{ flex: 1 }}>
                {new Date(b.timestamp).toLocaleString()} · {formatSize(b.size)} ·{" "}
                {b.projectCount} Projekt(e)
              </span>
              <button
                data-testid={`backup-restore-${b.id}`}
                style={BTN}
                disabled={busy}
                onClick={() => void handleRestore(b.id)}
              >
                Wiederherstellen
              </button>
              <button
                data-testid={`backup-delete-${b.id}`}
                style={{ ...BTN, borderColor: "#ff5555", color: "#ff5555" }}
                disabled={busy}
                onClick={() => void handleDelete(b.id)}
              >
                Löschen
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
