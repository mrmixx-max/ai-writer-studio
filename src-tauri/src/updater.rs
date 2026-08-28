// AI Writer Studio — Update-Modul (Auto-Update).
//
// Verantwortlichkeiten dieses Moduls:
//   1. Pruefen auf neue Versionen ueber den signierten Update-Feed
//      (tauri-plugin-updater, Endpoint siehe tauri.conf.json -> plugins.updater)
//   2. Herunterladen und Installieren des Updates (verifiziert gegen den
//      im Build eingebetteten Public Key — Minisign-Signatur)
//   3. Neustart der App in die neue Version
//
// Das Frontend ruft diese Befehle ueber invoke() auf
// (siehe src/services/updater/updateService.ts).

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

/// Ergebnis eines Update-Checks fuer das Frontend.
#[derive(Debug, Serialize)]
pub struct UpdateInfo {
    /// true, wenn eine neuere Version verfuegbar ist.
    pub available: bool,
    /// Aktuell installierte Version.
    pub current_version: String,
    /// Version des Updates (null, wenn keins verfuegbar).
    pub version: Option<String>,
    /// Release-Notes aus dem Update-Feed (null, wenn keins verfuegbar).
    pub notes: Option<String>,
    /// Veroeffentlichungsdatum aus dem Feed (RFC 3339), optional.
    pub date: Option<String>,
}

/// Prueft den Update-Feed auf eine neuere Version.
///
/// Schlaegt der Netzwerkzugriff fehl, wird ein verstaendlicher Fehler
/// zurueckgegeben — die App selbst bleibt voll funktionsfaehig.
#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<UpdateInfo, String> {
    let current = app.package_info().version.to_string();

    let update = app
        .updater()
        .map_err(|e| format!("Updater nicht initialisierbar: {e}"))?
        .check()
        .await
        .map_err(|e| format!("Update-Check fehlgeschlagen: {e}"))?;

    Ok(match update {
        Some(u) => UpdateInfo {
            available: true,
            current_version: current,
            version: Some(u.version.clone()),
            notes: u.body.clone(),
            date: u.date.map(|d| d.to_string()),
        },
        None => UpdateInfo {
            available: false,
            current_version: current,
            version: None,
            notes: None,
            date: None,
        },
    })
}

/// Laedt das Update herunter, verifiziert die Signatur und installiert es.
///
/// Der Fortschritt wird als Event `update://progress` (downloaded_bytes,
/// total_bytes) ans Frontend gesendet. Nach erfolgreichem Download startet
/// die Anwendung automatisch in die neue Version neu.
#[tauri::command]
pub async fn download_and_install_update(app: AppHandle) -> Result<(), String> {
    let update = app
        .updater()
        .map_err(|e| format!("Updater nicht initialisierbar: {e}"))?
        .check()
        .await
        .map_err(|e| format!("Update-Check fehlgeschlagen: {e}"))?
        .ok_or_else(|| "Kein Update verfuegbar.".to_string())?;

    // Signaturpruefung und Installation; danach Neustart in die neue Version.
    let mut downloaded: u64 = 0;
    update
        .download_and_install(
            &mut |chunk, total| {
                downloaded += chunk as u64;
                let _ = app.emit(
                    "update://progress",
                    serde_json::json!({
                        "downloaded": downloaded,
                        "total": total,
                    }),
                );
            },
            || {},
        )
        .await
        .map_err(|e| format!("Update-Installation fehlgeschlagen: {e}"))?;

    let _ = app.emit("update://installed", serde_json::json!({
        "version": update.version,
    }));

    // Neustart — beendet den alten Prozess und startet den Installer
    // bzw. die neue EXE im Hintergrund.
    app.restart();
    #[allow(unreachable_code)]
    Ok(())
}

/// Startet die Anwendung neu (z. B. nachdem der Nutzer "Jetzt neu starten"
/// statt des automatischen Neustarts gewaehlt hat).
#[tauri::command]
pub fn relaunch_app(app: AppHandle) -> Result<(), String> {
    app.restart();
    #[allow(unreachable_code)]
    Ok(())
}
