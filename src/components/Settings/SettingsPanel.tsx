// Settings-Panel: Provider/Modell/Temperatur/Max-Tokens/System-Prompt/Theme + Verbindungstest.
import { useState, useEffect } from "react";
import { DEFAULT_SETTINGS, type AppSettings } from "@/types/config";
import { loadSettings, saveSettings } from "@/services/settings";
import { testConnection, type ConnectionResult } from "@/services/llm/connection";
import type { ProviderId } from "@/types/llm";

const PROVIDERS: ProviderId[] = ["ollama", "lmstudio", "openai", "openrouter", "gpt2api"];

export function SettingsPanel() {
  const [s, setS] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
  const [conn, setConn] = useState<ConnectionResult | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setS(loadSettings());
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
        <input value={s.model} onChange={(e) => update("model", e.target.value)} placeholder="z.B. llama3.2" />
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
            <input value={s.gpt2apiBaseUrl} onChange={(e) => update("gpt2apiBaseUrl", e.target.value)} />
          </label>
          <label>gpt2api API-Key (optional)
            <input type="password" value={s.gpt2apiApiKey} onChange={(e) => update("gpt2apiApiKey", e.target.value)} />
          </label>
        </>
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

      <label>Theme
        <select value={s.theme} onChange={(e) => update("theme", e.target.value as "light" | "dark")}>
          <option value="dark">Dunkel</option>
          <option value="light">Hell</option>
        </select>
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
