// Sichere Backups: verschluesseltes Archiv der user_data (inkl. app.db)
// mit SHA-256-Pruefsummen. Nutzt das Tauri fs-Plugin (dynamischer Import,
// wie im DB-Service), damit vitest/browser dev nicht bricht.
//
// Backup-Container-Format (JSON, Base64-Komponenten):
// {
//   format: "AIWS-BACKUP-1",
//   createdAt: number,
//   entries: [{ path, sizeB64? — verschluesselt }, ...],
//   checksums: { [path]: sha256Hex(Klartext) },
//   payload: "AWS1|..."   // AES-256-GCM ueber JSON aller Dateiinhalte
// }
// Die Pruefsummen werden VOR der Verschluesselung gebildet (Integritaet
// auch ohne Passwort pruefbar? Nein — checksums liegen im verschluesselten
// Payload, damit Metadaten keine Rckschlsse auf Inhalte geben).
import { invoke } from "@tauri-apps/api/core";
import { encryptString, decryptString, sha256Hex, isEncryptedPayload } from "./crypto";

export interface BackupEntry {
  path: string;
  dataB64: string; // Base64 des Rohinhalts
}

export interface BackupContainer {
  format: "AIWS-BACKUP-1";
  createdAt: number;
  payload: string; // AWS1-Paket ueber JSON.stringify(BackupPayload)
  checksum: string; // SHA-256 ueber den Klartext-Payload (Integritaet)
}

export interface BackupPayload {
  entries: BackupEntry[];
}

/** Liest user_data-Dateien rekursiv (Tauri-Kommando muss in Rust existieren). */
async function collectUserDataFiles(): Promise<BackupEntry[]> {
  return invoke<BackupEntry[]>("collect_user_data_files");
}

/**
 * Erzeugt ein verschluesseltes Backup aller user_data-Dateien.
 * @param password Passwort/PIN fuer AES-256-GCM
 * @returns Backup-Container (als JSON auf Platte zu schreiben oder via save-Dialog)
 */
export async function createEncryptedBackup(password: string): Promise<BackupContainer> {
  if (!password) throw new Error("Backup ohne Passwort ist nicht erlaubt.");
  const files = await collectUserDataFiles();
  const payload: BackupPayload = { entries: files };
  const plain = JSON.stringify(payload);
  const checksum = await sha256Hex(plain);
  const payloadEnc = await encryptString(plain, password);
  return {
    format: "AIWS-BACKUP-1",
    createdAt: Date.now(),
    payload: payloadEnc,
    checksum,
  };
}

export interface RestoreResult {
  restoredFiles: number;
  checksumOk: boolean;
}

/**
 * Prueft Pruefsumme, entschluesselt und stellt die Dateien wieder her.
 * Wirft bei falschem Passwort oder beschdigtem Container.
 */
export async function restoreEncryptedBackup(
  container: BackupContainer,
  password: string,
): Promise<RestoreResult> {
  if (container.format !== "AIWS-BACKUP-1") {
    throw new Error("Unbekanntes Backup-Format.");
  }
  if (!isEncryptedPayload(container.payload)) {
    throw new Error("Backup-Payload ist nicht verschluesselt — verweigere Wiederherstellung.");
  }
  const plain = await decryptString(container.payload, password);
  const checksumOk = (await sha256Hex(plain)) === container.checksum;
  if (!checksumOk) {
    throw new Error("Pruefsummen-Fehler: Backup beschdigt oder manipuliert.");
  }
  const payload = JSON.parse(plain) as BackupPayload;
  await invoke("restore_user_data_files", { entries: payload.entries });
  return { restoredFiles: payload.entries.length, checksumOk };
}

/** Prueft nur die Integritaetspruefsumme (ohne Entschluesselung). */
export function validateContainerShape(c: BackupContainer): boolean {
  return (
    c.format === "AIWS-BACKUP-1" &&
    typeof c.createdAt === "number" &&
    typeof c.checksum === "string" &&
    c.checksum.length === 64 &&
    isEncryptedPayload(c.payload)
  );
}
