// AI Writer Studio — Windows-Einstiegspunkt.
//
// Verantwortlichkeiten dieses Moduls:
//   1. Single-Instance-Schutz (zweiter Start fokussiert das bestehende Fenster)
//   2. Anlegen der Nutzerdatenverzeichnisse unter %APPDATA% (nie in Program Files)
//   3. Lokales Crash-/Fehlerlogging
//   4. Übergabe von Datei-Argumenten (.aiwsproj / .aiwschapter) an das Frontend
//   5. Bereitstellung von App-Metadaten für den About-Dialog

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::io::Write;
use std::path::PathBuf;
use tauri::{Emitter, Manager};

mod git;
mod whisper;
mod updater;

/// Unterverzeichnisse, die beim Start unter %APPDATA%\AI Writer Studio angelegt werden.
const USER_DIRS: [&str; 4] = ["user_data", "logs", "exports", "backups"];

/// App-Metadaten für den About-Dialog.
#[derive(serde::Serialize)]
struct AppInfo {
    name: String,
    version: String,
    identifier: String,
    tauri_version: String,
    data_dir: String,
    log_dir: String,
}

/// Liefert das Datenwurzelverzeichnis und stellt sicher, dass es existiert.
fn data_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("App-Datenverzeichnis nicht ermittelbar: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("Datenverzeichnis nicht anlegbar: {e}"))?;
    Ok(dir)
}

/// Legt user_data, logs, exports und backups an. Fehler werden protokolliert, brechen aber nicht ab.
fn ensure_user_dirs(app: &tauri::AppHandle) {
    let Ok(root) = data_root(app) else {
        return;
    };
    for sub in USER_DIRS {
        let p = root.join(sub);
        if let Err(e) = fs::create_dir_all(&p) {
            eprintln!("[AI Writer Studio] Verzeichnis {} konnte nicht angelegt werden: {e}", p.display());
        }
    }
}

/// Schreibt eine Zeile in %APPDATA%\AI Writer Studio\logs\app.log.
fn write_log(app: &tauri::AppHandle, level: &str, message: &str) {
    let Ok(root) = data_root(app) else { return };
    let log_dir = root.join("logs");
    let _ = fs::create_dir_all(&log_dir);
    let path = log_dir.join("app.log");
    let stamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(f, "[{stamp}] [{level}] {message}");
    }
}

/// Vom Frontend aufrufbar: schreibt einen Eintrag ins lokale Log.
#[tauri::command]
fn log_message(app: tauri::AppHandle, level: String, message: String) {
    write_log(&app, &level, &message);
}

/// Liefert App-Metadaten für den About-Dialog.
#[tauri::command]
fn app_info(app: tauri::AppHandle) -> Result<AppInfo, String> {
    let pkg = app.package_info();
    let root = data_root(&app)?;
    Ok(AppInfo {
        name: pkg.name.clone(),
        version: pkg.version.to_string(),
        identifier: app.config().identifier.clone(),
        tauri_version: tauri::VERSION.to_string(),
        data_dir: root.display().to_string(),
        log_dir: root.join("logs").display().to_string(),
    })
}

/// Liefert die absoluten Pfade der Nutzerverzeichnisse.
#[tauri::command]
fn user_paths(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let root = data_root(&app)?;
    Ok(serde_json::json!({
        "root": root.display().to_string(),
        "user_data": root.join("user_data").display().to_string(),
        "logs": root.join("logs").display().to_string(),
        "exports": root.join("exports").display().to_string(),
        "backups": root.join("backups").display().to_string(),
    }))
}

/// Filtert Datei-Argumente heraus, die die App öffnen soll.
fn file_args(args: &[String]) -> Vec<String> {
    args.iter()
        .skip(1) // argv[0] ist der eigene Pfad
        .filter(|a| {
            let lower = a.to_lowercase();
            lower.ends_with(".aiwsproj") || lower.ends_with(".aiwschapter")
        })
        .cloned()
        .collect()
}

/// Liefert die beim Start übergebene Datei, falls vorhanden (Doppelklick auf .aiwsproj).
#[tauri::command]
fn startup_file() -> Option<String> {
    file_args(&std::env::args().collect::<Vec<_>>()).into_iter().next()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            log_message,
            app_info,
            user_paths,
            startup_file,
            updater::check_for_updates,
            updater::download_and_install_update,
            updater::relaunch_app,
            git::git_version,
            git::run_git,
            whisper::run_whisper
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            ensure_user_dirs(&handle);
            write_log(&handle, "INFO", "AI Writer Studio gestartet");

            // Fenster explizit anzeigen und fokussieren
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
                let _ = win.unminimize();
            }

            // Panics ins lokale Log schreiben, statt sie stumm zu verlieren.
            let panic_handle = handle.clone();
            std::panic::set_hook(Box::new(move |info| {
                write_log(&panic_handle, "PANIC", &format!("{info}"));
            }));

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Fehler beim Start von AI Writer Studio");
}
