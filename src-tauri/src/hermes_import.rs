// Hermes Config Import (Sprint 28, extra): Liest API-Keys aus Hermes-Config.
use std::fs;
use std::path::PathBuf;

#[derive(serde::Serialize)]
pub struct HermesKeys {
    pub openrouter_api_key: Option<String>,
    pub openai_api_key: Option<String>,
    pub gpt2api_api_key: Option<String>,
    pub deepseek_api_key: Option<String>,
    pub nous_api_key: Option<String>,
}

/// Liest die Hermes-Config und extrahiert API-Keys.
#[tauri::command]
pub fn import_hermes_keys() -> Result<HermesKeys, String> {
    let config_path = get_hermes_config_path()?;
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Hermes-Config nicht gefunden: {e}"))?;

    let keys = HermesKeys {
        openrouter_api_key: extract_key(&content, "openrouter", "api_key"),
        openai_api_key: extract_key(&content, "openai", "api_key"),
        gpt2api_api_key: extract_key(&content, "gpt2api", "api_key"),
        deepseek_api_key: extract_key(&content, "deepseek", "api_key"),
        nous_api_key: extract_key(&content, "nous", "api_key"),
    };

    log::info!("Hermes-Keys importiert aus {:?}", config_path);
    Ok(keys)
}

fn get_hermes_config_path() -> Result<PathBuf, String> {
    let app_data = std::env::var("APPDATA")
        .map_err(|e| format!("APPDATA nicht gefunden: {e}"))?;
    let path = PathBuf::from(app_data).join("hermes").join("config.yaml");
    if !path.exists() {
        return Err(format!("Config nicht gefunden: {:?}", path));
    }
    Ok(path)
}

/// Extrahiert einen API-Key aus einem YAML-String (einfaches Parsing).
fn extract_key(content: &str, provider: &str, key_name: &str) -> Option<String> {
    let mut in_provider = false;
    let mut in_delegation = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with(&format!("{provider}:")) {
            in_provider = true;
            in_delegation = false;
            continue;
        }
        if in_provider && trimmed.starts_with(key_name) {
            let parts: Vec<&str> = trimmed.splitn(2, ':').collect();
            if parts.len() == 2 {
                let value = parts[1].trim().trim_matches('"').trim_matches('\'');
                if !value.is_empty() && value != "***" {
                    return Some(value.to_string());
                }
            }
        }
        if in_provider && !trimmed.starts_with('-') && !trimmed.starts_with(key_name) && !trimmed.is_empty() {
            if line.starts_with(' ') || line.starts_with('\t') {
                continue;
            }
            in_provider = false;
        }
    }
    None
}
