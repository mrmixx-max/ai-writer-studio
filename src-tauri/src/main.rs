// AI Writer Studio — Windows-Release-Einstiegspunkt.
//
// Verantwortlichkeiten:
//   1. Single-Instance-Schutz (zweiter Start fokussiert die bestehende Instanz)
//   2. Strukturiertes Logging in App-Datenverzeichnis (tauri-plugin-log)
//   3. Defensive Fenster-Sichtbarkeit (show() im setup Hook)
//   4. Sauberer Shutdown mit Logging

use std::fs;
use std::io::Write;
use std::path::PathBuf;
use tauri::Manager;

mod git;
mod updater;

const USER_DIRS: [&str; 4] = ["user_data", "logs", "exports", "backups"];

#[derive(serde::Serialize)]
struct AppInfo {
    name: String,
    version: String,
    identifier: String,
    tauri_version: String,
    data_dir: String,
    log_dir: String,
}

fn data_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| format!("{e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("{e}"))?;
    Ok(dir)
}

fn ensure_user_dirs(app: &tauri::AppHandle) {
    if let Ok(root) = data_root(app) {
        for sub in USER_DIRS {
            let _ = fs::create_dir_all(root.join(sub));
        }
    }
}

/// Fallback-Logger: schreibt direkt in eine Datei, falls tauri-plugin-log
/// noch nicht initialisiert ist (z.B. Fehler im Builder vor .build()).
fn write_log(app: &tauri::AppHandle, level: &str, message: &str) {
    if let Ok(root) = data_root(app) {
        let _ = fs::create_dir_all(root.join("logs"));
        let path = root.join("logs/app.log");
        let stamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
        if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&path) {
            let _ = writeln!(f, "[{stamp}] [{level}] {message}");
        }
    }
}

#[tauri::command]
fn log_message(app: tauri::AppHandle, level: String, message: String) {
    write_log(&app, &level, &message);
}

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

#[tauri::command]
fn startup_file() -> Option<String> {
    std::env::args().skip(1).find(|a| {
        let l = a.to_lowercase();
        l.ends_with(".aiwsproj") || l.ends_with(".aiwschapter")
    })
}


fn main() {
    tauri::Builder::default()
        // Single-Instance: zweiter Start wird an die bestehende Instanz weitergeleitet.
        // Verhindert WebView2-User-Data-Folder-Kollision und Zombie-Prozesse.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            log::info!("Zweiter Start erkannt — fokussiere bestehende Instanz");
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_focus();
                let _ = win.show();
            }
        }))
        // Structured Logging: schreibt nach %APPDATA%\com.aiwriterstudio.app\logs\
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::LogDir { file_name: None },
                ))
                .build(),
        )
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
            git::run_git
        ])
        .setup(|app| {
            log::info!("App started (setup)");
            ensure_user_dirs(app.handle());

            // Defensive Fenster-Sichtbarkeit: show() + Fokus.
            if let Some(win) = app.get_webview_window("main") {
                match win.show() {
                    Ok(_) => log::info!("Window show() OK"),
                    Err(e) => log::error!("Window show() failed: {e}"),
                }
                match win.set_focus() {
                    Ok(_) => log::info!("Window set_focus() OK"),
                    Err(e) => log::error!("Window set_focus() failed: {e}"),
                }
            } else {
                log::error!("No window 'main' found in setup");
            }

            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                log::info!("Window close requested — shutting down");
            }
        })
        .run(tauri::generate_context!())
        .expect("Failed to start");
}
