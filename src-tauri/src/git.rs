// Git-Integration (Backend): führt git-Kommandos in einem Projektverzeichnis aus.
//
// Sicherheitsprinzipien:
//   * Nur die echte git-Binary wird gespawnt (keine Shell-Interpolation).
//   * Argumente werden 1:1 als argv-Array übergeben (kein shell=true).
//   * Gefährliche Eskalations-Flags (-c/--config, --upload-pack, --exec,
//     ext::-URLs) werden abgewiesen; Steuerzeichen in Argumenten ebenso.
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

/// Weist Eskalations-Flags ab, die über das Frontend hereinkommen könnten:
/// -c/--config (Config-Injektion, z. B. protocol.ext.allow, core.sshCommand),
/// --upload-pack/--receive-pack/--exec (fremde Binaries), ext::-URLs sowie
/// Steuerzeichen (NUL, LF, CR). Das Frontend nutzt nur harmlose Subcommands
/// (branch/switch/merge/add/commit/status/log/for-each-ref/…).
fn reject_dangerous_args(args: &[String]) -> Result<(), String> {
    if args.len() > 64 {
        return Err("Zu viele Git-Argumente".into());
    }
    for a in args {
        // 0 = NUL, 10 = LF, 13 = CR (als Zahlen, damit kein Escape nötig ist).
        if a.bytes().any(|b| b == 0 || b == 10 || b == 13) {
            return Err("Ungültiges Git-Argument (Steuerzeichen)".into());
        }
        let low = a.to_lowercase();
        let short_c = low == "-c" || low.starts_with("-c ");
        let blocked = short_c
            || low == "--config"
            || low.starts_with("--config=")
            || low.starts_with("--upload-pack")
            || low.starts_with("--receive-pack")
            || low == "--exec"
            || low.starts_with("--exec=")
            || low.starts_with("ext::");
        if blocked {
            return Err(format!(
                "Git-Argument aus Sicherheitsgründen abgewiesen: {a}"
            ));
        }
    }
    Ok(())
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
    reject_dangerous_args(&args)?;
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

#[cfg(test)]
mod tests {
    use super::*;

    fn args(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn normale_befehle_werden_erlaubt() {
        assert!(reject_dangerous_args(&args(&["status", "--porcelain=v1", "-b"])).is_ok());
        assert!(reject_dangerous_args(&args(&["config", "core.autocrlf", "false"])).is_ok());
        assert!(reject_dangerous_args(&args(&["log", "--pretty=format:%H%x1f%h", "-n50"])).is_ok());
        assert!(
            reject_dangerous_args(&args(&["clone", "https://example.com/r.git", "ziel"])).is_ok()
        );
    }

    #[test]
    fn eskalations_flags_werden_abgewiesen() {
        assert!(
            reject_dangerous_args(&args(&["-c", "protocol.ext.allow=always", "clone", "u"]))
                .is_err()
        );
        assert!(reject_dangerous_args(&args(&["--config", "a.b=c"])).is_err());
        assert!(reject_dangerous_args(&args(&["clone", "--upload-pack=evil", "u"])).is_err());
        assert!(reject_dangerous_args(&args(&["clone", "--receive-pack=evil", "u"])).is_err());
        assert!(reject_dangerous_args(&args(&["--exec=evil"])).is_err());
        assert!(reject_dangerous_args(&args(&["clone", "ext::sh -c evil"])).is_err());
    }

    #[test]
    fn steuerzeichen_werden_abgewiesen() {
        let nul = format!("a{}b", char::from(0));
        let lf = format!("a{}b", char::from(10));
        let cr = format!("a{}b", char::from(13));
        for bad in [nul, lf, cr] {
            assert!(reject_dangerous_args(&[bad]).is_err());
        }
    }
}
