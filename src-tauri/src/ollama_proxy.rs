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
///
/// Der Host wird aus der geparsten URL verglichen — ein reiner
/// Präfix-Vergleich wäre umgehbar (`http://127.0.0.1.evil.com`,
/// `http://127.0.0.1@evil.com`).
fn require_loopback(url: &str) -> Result<(), String> {
    let parsed = reqwest::Url::parse(url).map_err(|e| format!("Ungültige URL ({url}): {e}"))?;
    if parsed.scheme() != "http" {
        return Err(format!(
            "Nur http-URLs erlaubt (kein {0}): {url}",
            parsed.scheme()
        ));
    }
    let host = parsed.host_str().unwrap_or_default().to_lowercase();
    let ok = host == "127.0.0.1" || host == "localhost" || host == "::1" || host == "[::1]";
    if ok {
        Ok(())
    } else {
        Err(format!(
            "Nur lokale URLs erlaubt (127.0.0.1/localhost): {url}"
        ))
    }
}

/// Klemmt das Timeout auf einen sinnvollen Bereich (1 s … Limit).
/// `0` würde sofort abbrechen und nur kryptische Timeout-Fehler liefern.
fn clamp_timeout(timeout_secs: u64, max: u64) -> u64 {
    timeout_secs.clamp(1, max)
}

/// GET gegen einen lokalen Server — liefert Status + Body als String.
#[tauri::command]
pub async fn ollama_get(url: String, timeout_secs: u64) -> Result<String, String> {
    require_loopback(&url)?;
    let res = client(clamp_timeout(timeout_secs, 120))?
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
    let res = client(clamp_timeout(timeout_secs, 600))?
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loopback_wird_akzeptiert() {
        assert!(require_loopback("http://127.0.0.1:11434/api/tags").is_ok());
        assert!(require_loopback("http://localhost:11434/").is_ok());
        assert!(require_loopback("http://[::1]:11434/").is_ok());
    }

    #[test]
    fn ssrf_bypass_wird_abgewiesen() {
        // Praefix-Tarnung: Host ist evil.com, nicht Loopback.
        assert!(require_loopback("http://127.0.0.1.evil.com/").is_err());
        assert!(require_loopback("http://localhost.evil.com/").is_err());
        // Userinfo-Trick: Host ist evil.com.
        assert!(require_loopback("http://127.0.0.1@evil.com/").is_err());
        // Extern + falsches Scheme.
        assert!(require_loopback("http://example.com/").is_err());
        assert!(require_loopback("https://127.0.0.1:11434/").is_err());
    }

    #[test]
    fn timeout_wird_geklammert() {
        assert_eq!(clamp_timeout(0, 120), 1);
        assert_eq!(clamp_timeout(5, 120), 5);
        assert_eq!(clamp_timeout(9999, 120), 120);
    }
}
