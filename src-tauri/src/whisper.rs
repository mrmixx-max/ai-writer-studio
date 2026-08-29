// Whisper.cpp-Integration für lokale Speech-to-Text.
//
// Führt whisper.cpp mit einer GGUF-Modelldatei aus und gibt das
// Transkript als String zurück.

use std::process::Command;
use tauri::command;

#[command]
pub fn run_whisper(
    binary_path: String,
    model_path: String,
    audio_path: String,
    language: String,
) -> Result<String, String> {
    let output = Command::new(&binary_path)
        .arg("-m")
        .arg(&model_path)
        .arg("-f")
        .arg(&audio_path)
        .arg("-l")
        .arg(&language)
        .arg("-nt")
        .arg("-of")
        .arg(format!("{}.txt", audio_path))
        .output()
        .map_err(|e| format!("whisper.cpp-Ausführung fehlgeschlagen: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("whisper.cpp Fehler: {}", stderr));
    }

    // Transkript aus Datei lesen
    let txt_path = format!("{}.txt", audio_path);
    let text = std::fs::read_to_string(&txt_path)
        .map_err(|e| format!("Transkript-Datei nicht lesbar: {}", e))?;

    // Aufräumen
    let _ = std::fs::remove_file(&txt_path);

    Ok(text.trim().to_string())
}
