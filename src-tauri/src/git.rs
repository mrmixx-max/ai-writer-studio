// Git-Integration (Backend): führt git-Kommandos in einem Projektverzeichnis aus.
//
// Sicherheitsprinzipien:
//   * Nur die echte git-Binary wird gespawnt (keine Shell-Interpolation).
//   * Argumente werden 1:1 als argv-Array übergeben (kein shell=true).
//   * cwd muss existieren; Fehler als String an das Frontend.

use std::path::Path;
use std::process::Command;

#[derive(serde::Serialize)]
pub struct GitRunResult {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

/// Prüft, ob die git-Binary verfügbar ist und liefert die Version.
#[tauri::command]
pub fn git_version() -> Result<String, String> {
    let out = Command::new("git")
        .arg("--version")
        .output()
        .map_err(|e| format!("git nicht gefunden: {e}"))?;
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

/// Führt `git <args>` im Verzeichnis `cwd` aus und liefert Exit-Code + Ausgaben.
///
/// Bewusst KEIN Whitelisting einzelner Subcommands: das Frontend baut die
/// Kommandos, der Prozess bleibt aber shell-frei und daher injectionsicher —
/// jedes Argument ist ein eigenes argv-Element.
#[tauri::command]
pub fn run_git(cwd: String, args: Vec<String>) -> Result<GitRunResult, String> {
    if args.is_empty() {
        return Err("Kein Git-Kommando angegeben".into());
    }
    let dir = Path::new(&cwd);
    if !dir.is_dir() {
        return Err(format!("Verzeichnis existiert nicht: {cwd}"));
    }

    let output = Command::new("git")
        .args(&args)
        .current_dir(dir)
        .output()
        .map_err(|e| format!("git konnte nicht gestartet werden: {e}"))?;

    Ok(GitRunResult {
        code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}
