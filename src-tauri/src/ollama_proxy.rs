// Ollama-Proxy (Backend): HTTP-Anfragen an den lokalen Ollama-Server.
//
// Warum: Die WebView der installierten App sendet Origin `https://tauri.localhost`,
// den Ollama ohne OLLAMA_ORIGINS mit 403 ablehnt — und WebView-fetch scheitert
// in dieser Umgebung sogar mit Netzwerkfehler (Failed to fetch), obwohl der
// Server per curl antwortet. Diese Commands laufen im Rust-Prozess (nativer
// Client, kein Browser-Origin, kein CORS) und umgehen das Problem vollständig.
//
// WICHTIG: Commands sind async (reqwest-async) — KEIN blocking-Client.
// Ein blocking-Client im async-Tauri-Runtime blockiert Worker-Threads; bei
// parallelen Probes (Auto-Discovery alle 10 s) stapeln sich blockierte Threads
// und invoke() hängt scheinbar ewig → Frontend meldet "Timeout nach 2,5 s",
// obwohl der Server in Millisekunden antwortet.
//
// Sicherheitsprinzipien (wie git.rs):
//   * Nur Loopback-Ziele (127.0.0.1/localhost/::1) — kein offenes Relay.
//   * Argumente als getrennte Parameter, kein shell=true.
//   * Fehler als String an das Frontend.

use std::time::Duration;

/// Baut einen async-Client mit Timeout.
fn client(timeout_secs: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| format!("HTTP-Client konnte nicht erstellt werden: {e}"))
}

/// Prüft, ob die URL ein Loopback-Ziel ist (nur lokale Server erlaubt).
fn require_loopback(url: &str) -> Result<(), String> {
    let lower = url.to_lowercase();
    let ok = lower.starts_with("http://127.0.0.1")
        || lower.starts_with("http://localhost")
        || lower.starts_with("http://[::1]");
    if ok {
        Ok(())
    } else {
        Err(format!("Nur lokale URLs erlaubt (127.0.0.1/localhost): {url}"))
    }
}

/// GET gegen einen lokalen Server — liefert Status + Body als String.
#[tauri::command]
pub async fn ollama_get(url: String, timeout_secs: u64) -> Result<String, String> {
    require_loopback(&url)?;
    let res = client(timeout_secs.min(120))?
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Ollama nicht erreichbar ({url}): {e}"))?;
    let status = res.status().as_u16();
    if !(200..300).contains(&status) {
        return Err(format!("Ollama antwortet mit HTTP {status} ({url})."));
    }
    res.text()
        .await
        .map_err(|e| format!("Antwort konnte nicht gelesen werden: {e}"))
}

/// POST mit JSON-Body gegen einen lokalen Server — liefert Body als String.
#[tauri::command]
pub async fn ollama_post(url: String, body: String, timeout_secs: u64) -> Result<String, String> {
    require_loopback(&url)?;
    let res = client(timeout_secs.min(600))?
        .post(&url)
        .header("Content-Type", "application/json")
        .body(body)
        .send()
        .await
        .map_err(|e| format!("Ollama nicht erreichbar ({url}): {e}"))?;
    let status = res.status().as_u16();
    if !(200..300).contains(&status) {
        return Err(format!("Ollama antwortet mit HTTP {status} ({url})."));
    }
    res.text()
        .await
        .map_err(|e| format!("Antwort konnte nicht gelesen werden: {e}"))
}

/// DELETE mit JSON-Body gegen einen lokalen Server (Modell löschen).
#[tauri::command]
pub async fn ollama_delete(url: String, body: String) -> Result<String, String> {
    require_loopback(&url)?;
    let res = client(30)?
        .delete(&url)
        .header("Content-Type", "application/json")
        .body(body)
        .send()
        .await
        .map_err(|e| format!("Ollama nicht erreichbar ({url}): {e}"))?;
    let status = res.status().as_u16();
    if !(200..300).contains(&status) {
        return Err(format!("Ollama antwortet mit HTTP {status} ({url})."));
    }
    res.text()
        .await
        .map_err(|e| format!("Antwort konnte nicht gelesen werden: {e}"))
}
