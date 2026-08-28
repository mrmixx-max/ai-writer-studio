// AI Writer Studio — Update-Service (Auto-Update).
//
// Kapselt die Kommunikation mit dem Rust-Update-Modul
// (src-tauri/src/updater.rs, tauri-plugin-updater):
//   - checkForUpdates():  Prueft den signierten Update-Feed
//   - installUpdate():    Lädt das Update, verifiziert die Signatur,
//                         installiert und startet neu
//   - onUpdateProgress(): Download-Fortschritt als Event-Subscription
//
// Die App bleibt beim fehlgeschlagenen Update-Check voll nutzbar —
// Fehler werden dem Aufrufer als bewertetes Ergebnis zurueckgegeben.

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { assertCloudAllowed } from '@/services/security/privacy';

/** Ergebnis eines Update-Checks (aus updater.rs). */
export interface UpdateInfo {
  /** true, wenn eine neuere Version verfuegbar ist. */
  available: boolean;
  /** Aktuell installierte Version. */
  current_version: string;
  /** Version des Updates (null, wenn keins verfuegbar). */
  version: string | null;
  /** Release-Notes aus dem Feed. */
  notes: string | null;
  /** Veroeffentlichungsdatum (RFC 3339). */
  date: string | null;
}

/** Download-Fortschritt waehrend der Installation. */
export interface UpdateProgress {
  /** Bereits geladene Bytes. */
  downloaded: number;
  /** Gesamtgroesse in Bytes (null, wenn unbekannt). */
  total: number | null;
  /** Anteil geladen, 0..1 (null, wenn unbekannt). */
  fraction: number | null;
}

/** Check-Check auf Update mit Fehlertoleranz: wirft nie, liefert immer ein Ergebnis. */
export async function checkForUpdates(): Promise<
  { ok: true; info: UpdateInfo } | { ok: false; error: string }
> {
  // Privatsphaere-Modus: kein Kontakt zum Update-Feed (Telemetrie-frei).
  if (!assertCloudAllowed("Update-Check").allowed) {
    return { ok: false, error: "Privatsphaere-Modus aktiv: Update-Check bersprungen." };
  }
  try {
    const info = await invoke<UpdateInfo>('check_for_updates');
    return { ok: true, info };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * Laedt das verfuegbare Update herunter, verifiziert die Signatur,
 * installiert es und startet die App neu.
 * Wirft bei Fehlern — Aufrufer sollten das in der UI abfangen.
 */
export async function installUpdate(): Promise<void> {
  if (!assertCloudAllowed("Update-Download").allowed) {
    throw new Error("Privatsphaere-Modus aktiv: Update-Download blockiert.");
  }
  await invoke('download_and_install_update');
}

/** Beendet die App und startet sie neu (manueller Neustart). */
export async function relaunchApp(): Promise<void> {
  await invoke('relaunch_app');
}

/**
 * Abonniert den Download-Fortschritt des Updates.
 * Rueckgabe ist die Unsubscribe-Funktion (bei Komponenten-Unmount aufrufen).
 */
export function onUpdateProgress(
  callback: (progress: UpdateProgress) => void,
): Promise<UnlistenFn> {
  return listen<UpdateProgress>('update://progress', (event) => {
    const p = event.payload;
    callback({
      downloaded: p.downloaded,
      total: p.total ?? null,
      fraction: p.total ? Math.min(1, p.downloaded / p.total) : null,
    });
  });
}

/** Abonniert das Ereignis "Update installiert, Neustart steht bevor". */
export function onUpdateInstalled(
  callback: (payload: { version: string }) => void,
): Promise<UnlistenFn> {
  return listen<{ version: string }>('update://installed', (event) => {
    callback(event.payload);
  });
}
