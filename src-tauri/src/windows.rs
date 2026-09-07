//! Windows 11 native look + Windows-Shell-Integration (Sprint 18, Agent 5).
//!
//! Verantwortlichkeiten:
//!   1. Mica-Backdrop (dunkel) via `window-vibrancy` — Windows 11 nativ.
//!   2. Dunkle Titelleiste + runde Ecken (DWMWA_*) via direktem dwmapi-FFI
//!      (keine zusätzliche Dependency, nur std).
//!   3. Taskleisten-Fortschritt (`set_taskbar_progress`-Command, Tauri-Core).
//!   4. Sprunglisten-Einträge (`add_recent_document`-Command, SHAddToRecentDocs).
//!
//! Kein Verhaltenswandel: alles ist additiv und fällt bei Fehlern still auf
//! das bisherige Aussehen zurück (Fehler werden geloggt, nicht propagiert).

// --- DWM-Attributkonstanten (öffentlich für Tests) ---------------------------
/// DWMWA_USE_IMMERSIVE_DARK_MODE — dunkle Titelleiste.
pub const DWMWA_USE_IMMERSIVE_DARK_MODE: u32 = 20;
/// DWMWA_WINDOW_CORNER_PREFERENCE — Eckenform (Windows 11).
pub const DWMWA_WINDOW_CORNER_PREFERENCE: u32 = 33;
/// DWMWCP_ROUND — voll abgerundete Ecken (Windows-11-Stil).
pub const DWMWCP_ROUND: i32 = 2;

// --- Reine Helfer (plattformunabhängig, unit-testbar) ------------------------

/// Projekt-Dateiendungen, die die App per Doppelklick/Öffnen-Mit versteht.
/// `awproject` ist der neue kanonische Alias (tauri.conf.json fileAssociations),
/// die beiden anderen bleiben aus Kompatibilität erhalten.
pub fn project_extensions() -> &'static [&'static str] {
    &["awproject", "aiwsproj", "aiwschapter"]
}

/// true, wenn `path` auf eine Projektdatei zeigt (Erweiterungs-Check, case-insensitiv).
pub fn is_project_file(path: &str) -> bool {
    let lower = path.to_lowercase();
    project_extensions()
        .iter()
        .any(|ext| lower.ends_with(&format!(".{ext}")))
}

/// Taskleisten-Zustand aus Frontend-String mappen.
/// Gültig: "normal" | "indeterminate" | "paused" | "error" | "none".
/// Alles andere (inkl. "") fällt auf "none" zurück (= Anzeige aus).
pub fn normalize_progress_status(status: &str) -> &'static str {
    match status.to_lowercase().as_str() {
        "normal" | "indeterminate" | "paused" | "error" => {
            // Exakter kanonischer Bezeichner zurückgeben (Kleinschreibung ok,
            // Mapping erfolgt in `progress_state_for`).
            match status.to_lowercase().as_str() {
                "normal" => "normal",
                "indeterminate" => "indeterminate",
                "paused" => "paused",
                _ => "error",
            }
        }
        _ => "none",
    }
}

/// Fortschritt auf 0..=100 klemmen (Taskleiste erwartet Prozentwerte).
pub fn clamp_progress(progress: Option<u64>) -> Option<u64> {
    progress.map(|p| p.min(100))
}

#[cfg(windows)]
mod imp {
    use super::*;
    use std::ffi::c_void;
    use std::os::windows::ffi::OsStrExt;

    #[link(name = "dwmapi")]
    extern "system" {
        fn DwmSetWindowAttribute(
            hwnd: isize,
            dw_attribute: u32,
            pv_attribute: *const c_void,
            cb_attribute: u32,
        ) -> i32;
    }

    #[link(name = "shell32")]
    extern "system" {
        fn SHAddToRecentDocsW(u_flags: u32, pv: *const c_void) -> ();
    }

    /// SHARD_PATHW — pv zeigt auf einen nullterminierten UTF-16-Pfad.
    const SHARD_PATHW: u32 = 1;

    fn set_dwm_attr(hwnd: isize, attr: u32, value: i32) -> bool {
        // SAFETY: DwmSetWindowAttribute mit 4-Byte-INT ist dokumentiertes Verhalten;
        // hwnd stammt aus tauri::WebviewWindow::hwnd().
        let ok = unsafe {
            DwmSetWindowAttribute(
                hwnd,
                attr,
                &value as *const i32 as *const c_void,
                std::mem::size_of::<i32>() as u32,
            )
        };
        ok == 0
    }

    /// Wendet das Windows-11-Aussehen auf `window` an. Fehler sind nicht fatal:
    /// Sie werden geloggt, die App läuft mit Standard-Chrome weiter.
    pub fn apply_windows_chrome(window: &tauri::WebviewWindow) {
        // 1. Mica (dunkel passend zum Dark-Theme der App).
        if let Err(e) = window_vibrancy::apply_mica(window, Some(true)) {
            log::warn!("Mica-Effekt fehlgeschlagen (Fallback: Standard-Chrome): {e}");
        } else {
            log::info!("Mica-Backdrop aktiv (dark)");
        }
        // 2./3. Dunkle Titelleiste + runde Ecken via DWM.
        match window.hwnd() {
            // `windows::HWND` ist ein Tupel-Struct; `.0` ist das rohe Handle.
            Ok(hwnd) => {
                let raw = hwnd.0 as isize;
                if !set_dwm_attr(raw, DWMWA_USE_IMMERSIVE_DARK_MODE, 1) {
                    log::warn!("DWM dunkle Titelleiste fehlgeschlagen");
                }
                if !set_dwm_attr(raw, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_ROUND) {
                    log::warn!("DWM runde Ecken fehlgeschlagen");
                }
            }
            Err(e) => log::warn!("Kein HWND verfügbar, DWM-Attribute übersprungen: {e}"),
        }
    }

    /// Taskleisten-Fortschritt für `window` setzen.
    pub fn set_progress(
        window: &tauri::WebviewWindow,
        status: &str,
        progress: Option<u64>,
    ) -> Result<(), String> {
        use tauri::window::{ProgressBarState, ProgressBarStatus};
        let state = match normalize_progress_status(status) {
            "normal" => ProgressBarStatus::Normal,
            "indeterminate" => ProgressBarStatus::Indeterminate,
            "paused" => ProgressBarStatus::Paused,
            "error" => ProgressBarStatus::Error,
            _ => ProgressBarStatus::None,
        };
        window
            .set_progress_bar(ProgressBarState {
                status: Some(state),
                progress: clamp_progress(progress),
            })
            .map_err(|e| format!("{e}"))
    }

    /// Pfad in "Zuletzt verwendet" (Sprungliste) eintragen. Nur Projektdateien.
    pub fn add_recent(path: &str) -> Result<(), String> {
        if !is_project_file(path) {
            return Err(format!("Keine Projektdatei (erwartet .awproject): {path}"));
        }
        let wide: Vec<u16> = std::ffi::OsStr::new(path)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        // SAFETY: SHAddToRecentDocsW mit SHARD_PATHW + nullterminiertem UTF-16-Puffer.
        unsafe {
            SHAddToRecentDocsW(SHARD_PATHW, wide.as_ptr() as *const c_void);
        }
        Ok(())
    }
}

// --- Tauri-Commands (auf Nicht-Windows als No-Op-Stubs) ----------------------

/// Taskleisten-Fortschritt: status ∈ normal|indeterminate|paused|error|none,
/// progress ∈ 0..=100 (wird geklemmt). Frontend: `invoke('set_taskbar_progress', …)`.
#[tauri::command]
pub fn set_taskbar_progress(
    window: tauri::WebviewWindow,
    status: String,
    progress: Option<u64>,
) -> Result<(), String> {
    #[cfg(windows)]
    return imp::set_progress(&window, &status, progress);
    #[cfg(not(windows))]
    {
        let _ = (&window, status, progress);
        Ok(())
    }
}

/// Projektdatei in die Windows-Sprungliste ("Zuletzt verwendet") aufnehmen.
#[tauri::command]
pub fn add_recent_document(path: String) -> Result<(), String> {
    #[cfg(windows)]
    return imp::add_recent(&path);
    #[cfg(not(windows))]
    {
        let _ = path;
        Ok(())
    }
}

/// Windows-11-Chrome (Mica + dunkle Titelleiste + runde Ecken) anwenden.
/// Auf Nicht-Windows ein No-Op; Fehler sind intern geloggt, nie fatal.
pub fn apply_chrome(window: &tauri::WebviewWindow) {
    #[cfg(windows)]
    imp::apply_windows_chrome(window);
    #[cfg(not(windows))]
    let _ = window;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_window_dark_theme() {
        // tauri.conf.json muss dunkles Theme + Mica-kompatible Flags tragen:
        // decorations:true (native Titelleiste für DWM), transparent:false
        // (Mica braucht opakes Fenster), theme:"Dark".
        let raw = include_str!("../tauri.conf.json");
        let cfg: serde_json::Value =
            serde_json::from_str(raw).expect("tauri.conf.json muss valides JSON sein");
        let win = &cfg["app"]["windows"][0];
        assert_eq!(win["theme"], serde_json::Value::String("Dark".into()));
        assert_eq!(win["decorations"], serde_json::Value::Bool(true));
        assert_eq!(win["transparent"], serde_json::Value::Bool(false));
        assert_eq!(win["label"], serde_json::Value::String("main".into()));
    }

    #[test]
    fn config_file_association_awproject() {
        // .awproject muss als Dateiassoziation registriert sein.
        let raw = include_str!("../tauri.conf.json");
        let cfg: serde_json::Value =
            serde_json::from_str(raw).expect("tauri.conf.json muss valides JSON sein");
        let assocs = cfg["bundle"]["fileAssociations"]
            .as_array()
            .expect("fileAssociations muss ein Array sein");
        let has_awproject = assocs.iter().any(|a| {
            a["ext"]
                .as_array()
                .map(|exts| {
                    exts.iter()
                        .any(|e| e.as_str().map(|s| s.to_lowercase()) == Some("awproject".into()))
                })
                .unwrap_or(false)
        });
        assert!(has_awproject, ".awproject-Assoziation fehlt");
        // Alte Endungen bleiben aus Kompatibilität erhalten.
        for legacy in ["aiwsproj", "aiwschapter"] {
            let found = assocs.iter().any(|a| {
                a["ext"]
                    .as_array()
                    .map(|exts| {
                        exts.iter()
                            .any(|e| e.as_str().map(|s| s.to_lowercase()) == Some(legacy.into()))
                    })
                    .unwrap_or(false)
            });
            assert!(found, "Legacy-Assoziation .{legacy} fehlt");
        }
    }

    #[test]
    fn window_creation_defaults() {
        // Fenster-Geometrie/Flags aus der Config: sinnvolle Defaults,
        // zentriert, sichtbar, kein Vollbild/AlwaysOnTop.
        let raw = include_str!("../tauri.conf.json");
        let cfg: serde_json::Value = serde_json::from_str(raw).unwrap();
        let win = &cfg["app"]["windows"][0];
        assert!(win["width"].as_u64().unwrap_or(0) >= 1000);
        assert!(win["height"].as_u64().unwrap_or(0) >= 600);
        assert_eq!(win["center"], serde_json::Value::Bool(true));
        assert_eq!(win["visible"], serde_json::Value::Bool(true));
        assert_eq!(win["fullscreen"], serde_json::Value::Bool(false));
        assert_eq!(win["alwaysOnTop"], serde_json::Value::Bool(false));
    }

    #[test]
    fn project_file_detection() {
        assert!(is_project_file("C:\\Docs\\roman.awproject"));
        assert!(is_project_file("roman.AIWsProj"));
        assert!(is_project_file("kap1.aiwschapter"));
        assert!(!is_project_file("roman.docx"));
        assert!(!is_project_file("awproject.txt"));
        assert!(!is_project_file(""));
    }

    #[test]
    fn progress_status_mapping() {
        assert_eq!(normalize_progress_status("normal"), "normal");
        assert_eq!(normalize_progress_status("Indeterminate"), "indeterminate");
        assert_eq!(normalize_progress_status("paused"), "paused");
        assert_eq!(normalize_progress_status("error"), "error");
        assert_eq!(normalize_progress_status("bogus"), "none");
        assert_eq!(normalize_progress_status(""), "none");
    }

    #[test]
    fn progress_clamping() {
        assert_eq!(clamp_progress(Some(50)), Some(50));
        assert_eq!(clamp_progress(Some(250)), Some(100));
        assert_eq!(clamp_progress(Some(0)), Some(0));
        assert_eq!(clamp_progress(None), None);
    }

    #[test]
    fn dwm_constants_match_win32_sdk() {
        // Gegenprüfwerte aus dem Windows SDK (winuser/dwmapi):
        assert_eq!(DWMWA_USE_IMMERSIVE_DARK_MODE, 20);
        assert_eq!(DWMWA_WINDOW_CORNER_PREFERENCE, 33);
        assert_eq!(DWMWCP_ROUND, 2);
    }
}
