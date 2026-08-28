// Settings-Panel: Provider/Modell/Temperatur/Max-Tokens/System-Prompt/Theme + Verbindungstest.
import { useState, useEffect } from "react";
import { DEFAULT_SETTINGS, type AppSettings } from "@/types/config";
import { loadSettings, saveSettings } from "@/services/settings";
import { testConnection, type ConnectionResult } from "@/services/llm/connection";
import {
  discoverModels,
  labelFor,
  type DiscoveredModels,
} from "@/services/llm/modelRegistry";
import type { ProviderId } from "@/types/llm";
import { useI18n, LANGUAGES, type Lang } from "@/i18n";
import { setHighContrast, getHighContrastPreference } from "@/i18n/highContrast";
import { announce } from "@/i18n/a11y";

const PROVIDERS: ProviderId[] = ["ollama", "lmstudio", "openai", "openrouter", "gpt2api", "nous"];

export function SettingsPanel() {
  const { t, lang, setLang } = useI18n();
  const [s, setS] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
  const [contrast, setContrast] = useState<boolean>(() =>
    getHighContrastPreference(),
  );
  const [conn, setConn] = useState<ConnectionResult | null>(null);
  const [testing, setTesting] = useState(false);
  // Modellerkennung über den gemeinsamen ModelRegistry-Service (statt statischer Liste).
  const [discovered, setDiscovered] = useState<DiscoveredModels[]>([]);
  const [discovering, setDiscovering] = useState(false);

  useEffect(() => {
    const loaded = loadSettings();
    setS(loaded);
    // Sprache + Hochkontrast aus Persistenz übernehmen, falls vorhanden.
    if (loaded.language) setLang(loaded.language as Lang);
    if (typeof loaded.highContrast === "boolean") {
      setContrast(loaded.highContrast);
      setHighContrast(loaded.highContrast, false);
    }
  }, []);

  function update<K extends keyof AppSettings>(k: K, v: AppSettings[K]) {
    setS((prev) => ({ ...prev, [k]: v }));
  }

  function save() {
    saveSettings(s);
    // Theme anwenden + persistieren
    document.documentElement.setAttribute("data-theme", s.theme);
    try { localStorage.setItem("theme", s.theme); } catch { /* ignore */ }
  }

  // Modellerkennung beim Mount und bei relevanten Einstellungs-Änderungen
  // (Cache/TTL 60 s lebt im Service).
  useEffect(() => {
    let cancelled = false;
    setDiscovering(true);
    discoverModels(s)
      .then((r) => { if (!cancelled) setDiscovered(r); })
      .catch(() => { if (!cancelled) setDiscovered([]); })
      .finally(() => { if (!cancelled) setDiscovering(false); });
    return () => { cancelled = true; };
  }, [s.provider, s.ollamaBaseUrl, s.lmstudioBaseUrl, s.openaiApiKey, s.openrouterApiKey, s.gpt2apiBaseUrl, s.gpt2apiApiKey, s.nousBaseUrl, s.nousApiKey, s.privacyMode]);

  // Entdeckte Modelle des aktiven Anbieters (kein statisches Liste-Mehr).
  const activeDiscovery = discovered.find((d) => d.provider === s.provider) ?? null;
  const activeModels = activeDiscovery?.reachable ? activeDiscovery.models : [];

  async function test() {
    setTesting(true);
    setConn(null);
    const res = await testConnection(s);
    setConn(res);
    setTesting(false);
  }

  return (
    <div className="settings-panel">
      <h3>Einstellungen</h3>

      <label>Provider
        <select value={s.provider} onChange={(e) => update("provider", e.target.value as ProviderId)}>
          {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>

      <label>Modell
        {activeModels.length > 0 ? (
          <select
            value={activeModels.includes(s.model) ? s.model : ""}
            onChange={(e) => e.target.value && update("model", e.target.value)}
          >
            {!activeModels.includes(s.model) && <option value="">{s.model}</option>}
            {activeModels.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        ) : (
          <input value={s.model} onChange={(e) => update("model", e.target.value)} placeholder="z.B. llama3.2" />
        )}
        <span className="settings-hint">
          {discovering
            ? "Suche nach verfügbaren Modellen…"
            : activeDiscovery?.reachable
              ? `${labelFor(s.provider)}: ${activeModels.length} Modelle gefunden.`
              : (activeDiscovery?.message ?? `${labelFor(s.provider)} nicht erreichbar — Modelle werden erkannt, sobald der Anbieter antwortet.`)}
        </span>
      </label>

      {s.provider === "openai" && (
        <label>OpenAI API-Key
          <input type="password" value={s.openaiApiKey} onChange={(e) => update("openaiApiKey", e.target.value)} placeholder="sk-..." />
        </label>
      )}
      {s.provider === "openrouter" && (
        <label>OpenRouter API-Key
          <input type="password" value={s.openrouterApiKey} onChange={(e) => update("openrouterApiKey", e.target.value)} placeholder="sk-or-..." />
        </label>
      )}
      {s.provider === "ollama" && (
        <label>Ollama-URL
          <input value={s.ollamaBaseUrl} onChange={(e) => update("ollamaBaseUrl", e.target.value)} />
        </label>
      )}
      {s.provider === "lmstudio" && (
        <label>LM Studio-URL
          <input value={s.lmstudioBaseUrl} onChange={(e) => update("lmstudioBaseUrl", e.target.value)} />
        </label>
      )}
      {s.provider === "gpt2api" && (
        <>
          <label>gpt2api-URL
            <input value={s.gpt2apiBaseUrl} placeholder="http://localhost:8080/v1" onChange={(e) => update("gpt2apiBaseUrl", e.target.value)} />
          </label>
          <label>gpt2api API-Key (optional)
            <input type="password" value={s.gpt2apiApiKey} onChange={(e) => update("gpt2apiApiKey", e.target.value)} />
          </label>
        </>
      )}
      {s.provider === "nous" && (
        <label>Nous Research API-Key
          <input type="password" value={s.nousApiKey} onChange={(e) => update("nousApiKey", e.target.value)} placeholder="nous-..." />
        </label>
      )}

      <label>Temperatur: {s.temperature}
        <input type="range" min={0} max={1} step={0.1} value={s.temperature}
          onChange={(e) => update("temperature", +e.target.value)} />
      </label>

      <label>Max Tokens
        <input type="number" min={256} max={8192} value={s.maxTokens} onChange={(e) => update("maxTokens", +e.target.value)} />
      </label>

      <label>System-Prompt
        <textarea value={s.systemPrompt} onChange={(e) => update("systemPrompt", e.target.value)} rows={3} />
      </label>

      <label>{t("settings.theme")}
        <select value={s.theme} onChange={(e) => update("theme", e.target.value as "light" | "dark")}>
          <option value="dark">{t("settings.theme.dark")}</option>
          <option value="light">{t("settings.theme.light")}</option>
        </select>
      </label>

      <label>{t("settings.language")}
        <select
          value={lang}
          onChange={(e) => {
            const l = e.target.value as Lang;
            setLang(l);
            update("language", l);
          }}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </label>

      <label>
        <input
          type="checkbox"
          checked={contrast}
          onChange={(e) => {
            const on = e.target.checked;
            setContrast(on);
            setHighContrast(on);
            update("highContrast", on);
            announce(on ? t("settings.highContrast") : t("settings.theme"));
          }}
        />
        {" "}{t("settings.highContrast")}
        <span className="settings-hint">{t("settings.highContrast.hint")}</span>
      </label>

      <div className="settings-actions">
        <button onClick={test} disabled={testing}>{testing ? "Teste…" : "Verbindung testen"}</button>
        <button className="save" onClick={save}>Speichern</button>
      </div>

      {conn && (
        <div className={conn.ok ? "conn-ok" : "conn-err"}>
          {conn.ok ? "✓ " : "✗ "}{conn.message}
          {conn.ok && conn.models.length > 0 && (
            <details>
              <summary>Modelle ({conn.models.length})</summary>
              <ul>{conn.models.slice(0, 30).map((m) => <li key={m}>{m}</li>)}</ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
