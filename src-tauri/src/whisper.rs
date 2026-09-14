// Whisper.cpp-Integration für lokale Speech-to-Text.
//
// Führt whisper.cpp mit einer GGUF-Modelldatei aus und gibt das
// Transkript als String zurück.

use std::path::Path;
use std::process::Command;
use tauri::command;

/// Whisper-Sprachcode: 2–12 Zeichen, Buchstaben und Bindestrich
/// (z. B. "de", "en", "pt-br"). Verhindert versehentliche
/// Fehlbedienung und unsaubere Argumente an die Binary.
fn valid_language(lang: &str) -> bool {
    (2..=12).contains(&lang.len()) && lang.chars().all(|c| c.is_ascii_alphabetic() || c == '-')
}

fn require_existing_file(what: &str, path: &str) -> Result<(), String> {
    if !Path::new(path).is_file() {
        return Err(format!("{what} nicht gefunden: {path}"));
    }
    Ok(())
}

#[command]
pub fn run_whisper(
    binary_path: String,
    model_path: String,
    audio_path: String,
    language: String,
) -> Result<String, String> {
    // Frühzeitige, verständliche Fehler statt kryptischer Spawn-Fehler.
    if !binary_path.to_lowercase().ends_with(".exe") {
        return Err(format!(
            "Unerwartete Whisper-Binary (erwartet .exe): {binary_path}"
        ));
    }
    require_existing_file("Whisper-Binary", &binary_path)?;
    require_existing_file("Whisper-Modell", &model_path)?;
    require_existing_file("Audio-Datei", &audio_path)?;
    if !valid_language(&language) {
        return Err(format!("Ungültiger Sprachcode: {language}"));
    }
    // whisper-cli.exe -m <model> -f <audio> -l <lang> -nt
    let output = Command::new(&binary_path)
        .arg("-m")
        .arg(&model_path)
        .arg("-f")
        .arg(&audio_path)
        .arg("-l")
        .arg(&language)
        .arg("-nt")
        .output()
        .map_err(|e| format!("whisper.cpp-Ausführung fehlgeschlagen: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("whisper.cpp Fehler: {}", stderr));
    }

    let text = String::from_utf8_lossy(&output.stdout);
    Ok(text.trim().to_string())
}
