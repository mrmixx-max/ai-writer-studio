// Settings-Panel: Provider/Modell/Temperatur/Max-Tokens/System-Prompt/Theme.
// LLM-Bereich als Anbieter-Karten: Status-Ampel, Latenz, Modell-Anzahl,
// aufklappbare Felder, Verbindungstest pro Karte, Feld-Validierung,
// Änderungen-Kennzeichnung (gelber Punkt) + Verwerfen.
import { useState, useEffect, useMemo } from "react";
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

// ---- Feld-Validierung ------------------------------------------------------

/** Prüft, ob der Wert eine gültige http(s)-URL ist. */
function isValidUrl(v: string): boolean {
  if (!v.trim()) return true; // leer = Validierung später beim Testen
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Erwartetes Key-Präfix je Anbieter (null = kein Key nötig). */
const KEY_PREFIX: Partial<Record<ProviderId, { re: RegExp; hint: string }>> = {
  openai: { re: /^sk-/, hint: "OpenAI-Schlüssel beginnen mit „sk-…“." },
  openrouter: { re: /^sk-or-/, hint: "OpenRouter-Schlüssel beginnen mit „sk-or-…“." },
  nous: { re: /^nous-/, hint: "Nous-Schlüssel beginnen mit „nous-…“." },
};

/** Deutsche Hilfetexte je Anbieter-Feld. */
const FIELD_HELP: Record<ProviderId, { key?: string; url?: string }> = {
  ollama: { url: "Adresse des lokalen Ollama-Servers, z. B. http://localhost:11434" },
  lmstudio: { url: "OpenAI-kompatible Adresse des LM Studio-Servers, z. B. http://localhost:1234/v1" },
  openai: { key: "Persönlicher Schlüssel von platform.openai.com. Wird nur lokal gespeichert.", },
  openrouter: { key: "Persönlicher Schlüssel von openrouter.ai/keys. Wird nur lokal gespeichert." },
  gpt2api: {
    key: "Optional: Schlüssel, falls dein gpt2api-Gateway eines verlangt.",
    url: "Adresse des gpt2api-Gateways, z. B. http://localhost:8080/v1",
  },
  nous: { key: "Schlüssel der Nous Research Inference API. Wird nur lokal gespeichert.", },
};

interface ProviderCardProps {
  provider: ProviderId;
  settings: AppSettings;
  discovery: DiscoveredModels | null;
  discovering: boolean;
  isActive: boolean;
  dirty: boolean;
  onUse: () => void;
  onField: (field: keyof AppSettings, value: string) => void;
}

/** Eine Anbieter-Karte: Status-Ampel, Latenz, Modell-Anzahl, aufklappbare Felder. */
function ProviderCard({
  provider, settings, discovery, discovering, isActive, dirty, onUse, onField,
}: ProviderCardProps) {
  const [result, setResult] = useState<ConnectionResult | null>(null);
  const [testing, setTesting] = useState(false);

  const reachable = discovery?.reachable === true;
  const statusClass = discovering
    ? "status-unknown"
    : discovery
      ? reachable ? "status-ok" : "status-err"
      : "status-unknown";
  const statusText = discovering
    ? "wird geprüft…"
    : reachable
      ? `erreichbar${discovery!.latencyMs != null ? ` · ${discovery!.latencyMs} ms` : ""}`
      : (discovery?.message?.split(".")[0] ?? "unbekannt");

  const keyField = `${provider}ApiKey` as keyof AppSettings;
  const urlField = `${provider}BaseUrl` as keyof AppSettings;
  const keyValue = (settings[keyField] as string | undefined) ?? "";
  const urlValue = (settings[urlField] as string | undefined) ?? "";
  const hasKey = KEY_PREFIX[provider] !== undefined || provider === "gpt2api";
  const hasUrl = provider === "ollama" || provider === "lmstudio" || provider === "gpt2api";

  const keyInvalid = hasKey && KEY_PREFIX[provider] && keyValue.trim() && !KEY_PREFIX[provider]!.re.test(keyValue.trim());
  const urlInvalid = hasUrl && !isValidUrl(urlValue);
  const invalid = keyInvalid || urlInvalid;

  async function test() {
    setTesting(true);
    setResult(null);
    const res = await testConnection({ ...settings, provider });
    setResult(res);
    setTesting(false);
  }

  return (
    <div
      className={`provider-card${isActive ? " active" : ""}`}
      data-provider={provider}
    >
      <div className="provider-card-head">
        <span className={`status-dot ${statusClass}`} aria-hidden="true" />
        <span className="provider-card-title">{labelFor(provider)}</span>
        {isActive && <span className="active-badge">aktiv</span>}
        {dirty && <span className="dirty-dot" title="Ungespeicherte Änderungen" aria-label="Ungespeicherte Änderungen" />}
      </div>
      <div className="provider-card-meta">
        {statusText}
        {reachable && discovery!.models.length > 0 && <> · {discovery!.models.length} Modelle</>}
      </div>

      <details className="provider-card-fields">
        <summary>Felder</summary>
        {hasUrl && (
          <label>{labelFor(provider)}-Base-URL
            <input
              value={urlValue}
              onChange={(e) => onField(urlField, e.target.value)}
              placeholder={FIELD_HELP[provider].url?.split(", ").pop()}
              aria-invalid={urlInvalid ? true : undefined}
            />
            <span className="settings-hint">{FIELD_HELP[provider].url}</span>
            {urlInvalid && <span className="field-error">Bitte eine gültige URL angeben (beginnend mit http:// oder https://).</span>}
          </label>
        )}
        {hasKey && (
          <label>
            {labelFor(provider)} API-Key{provider === "gpt2api" ? " (optional)" : ""}
            <input
              type="password"
              value={keyValue}
              onChange={(e) => onField(keyField, e.target.value)}
              placeholder={KEY_PREFIX[provider] ? KEY_PREFIX[provider]!.hint : ""}
              aria-invalid={keyInvalid ? true : undefined}
            />
            <span className="settings-hint">{FIELD_HELP[provider].key}</span>
            {keyInvalid && <span className="field-error">{KEY_PREFIX[provider]!.hint}</span>}
          </label>
        )}
        {!hasKey && !hasUrl && null}
      </details>

      <div className="provider-card-actions">
        <button onClick={test} disabled={testing || invalid}>
          {testing ? "Teste…" : "Verbindung testen"}
        </button>
        <button
          className="use-active"
          onClick={onUse}
          disabled={isActive}
          title={isActive ? "Bereits aktiv" : `${labelFor(provider)} als aktiven Anbieter verwenden`}
        >
          {isActive ? "Aktiv" : "Als aktiv verwenden"}
        </button>
      </div>

      {result && (
        <div className={result.ok ? "conn-ok" : "conn-err"} role="status">
          {result.ok ? "✓ " : "✗ "}{result.message}
          {result.ok && result.models.length > 0 && (
            <details>
              <summary>Modelle ({result.models.length})</summary>
              <ul>{result.models.slice(0, 30).map((m) => <li key={m}>{m}</li>)}</ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export function SettingsPanel() {
  const { t, lang, setLang } = useI18n();
  const [s, setS] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
  const [initial, setInitial] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
  const [contrast, setContrast] = useState<boolean>(() =>
    getHighContrastPreference(),
  );
  // Modellerkennung über den gemeinsamen ModelRegistry-Service (statt statischer Liste).
  const [discovered, setDiscovered] = useState<DiscoveredModels[]>([]);
  const [discovering, setDiscovering] = useState(false);

  useEffect(() => {
    const loaded = loadSettings();
    setS(loaded);
    setInitial(loaded);
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

  const dirty = useMemo(() => {
    const keys = [
      "provider", "model", "temperature", "maxTokens", "systemPrompt", "theme", "language", "highContrast",
      "ollamaBaseUrl", "lmstudioBaseUrl", "openaiApiKey", "openrouterApiKey",
      "gpt2apiBaseUrl", "gpt2apiApiKey", "nousBaseUrl", "nousApiKey",
    ] as (keyof AppSettings)[];
    return keys.some((k) => s[k] !== initial[k]);
  }, [s, initial]);

  function save() {
    saveSettings(s);
    setInitial(s);
    // Theme anwenden + persistieren
    document.documentElement.setAttribute("data-theme", s.theme);
    try { localStorage.setItem("theme", s.theme); } catch { /* ignore */ }
  }

  function discard() {
    setS({ ...initial });
    announce("Änderungen verworfen.");
  }

  // Modellerkennung beim Mount und bei relevanten Einstellungs-Änderungen
  // (Cache/TTL lebt im Service).
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

  return (
    <div className="settings-panel">
      <h3>
        Einstellungen
        {dirty && <span className="dirty-dot" title="Ungespeicherte Änderungen" aria-label="Ungespeicherte Änderungen" />}
      </h3>

      <section className="provider-cards" aria-label="Anbieter">
        {PROVIDERS.map((p) => (
          <ProviderCard
            key={p}
            provider={p}
            settings={s}
            discovery={discovered.find((d) => d.provider === p) ?? null}
            discovering={discovering && !discovered.some((d) => d.provider === p)}
            isActive={s.provider === p}
            dirty={
              p === "ollama" ? s.ollamaBaseUrl !== initial.ollamaBaseUrl
              : p === "lmstudio" ? s.lmstudioBaseUrl !== initial.lmstudioBaseUrl
              : p === "openai" ? s.openaiApiKey !== initial.openaiApiKey
              : p === "openrouter" ? s.openrouterApiKey !== initial.openrouterApiKey
              : p === "gpt2api" ? (s.gpt2apiBaseUrl !== initial.gpt2apiBaseUrl || s.gpt2apiApiKey !== initial.gpt2apiApiKey)
              : (s.nousBaseUrl !== initial.nousBaseUrl || s.nousApiKey !== initial.nousApiKey)
            }
            onUse={() => update("provider", p)}
            onField={(field, value) => update(field, value as never)}
          />
        ))}
      </section>

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

      <label>Temperatur: {s.temperature}
        <input type="range" min={0} max={1} step={0.1} value={s.temperature}
          onChange={(e) => update("temperature", +e.target.value)} />
        <span className="settings-hint">Steuert die Kreativität der Antworten: 0 = exakt, 1 = einfallsreich.</span>
      </label>

      <label>Max Tokens
        <input type="number" min={256} max={8192} value={s.maxTokens} onChange={(e) => update("maxTokens", +e.target.value)} />
        <span className="settings-hint">Maximale Länge einer Antwort in Tokens (256–8192).</span>
      </label>

      <label>System-Prompt
        <textarea value={s.systemPrompt} onChange={(e) => update("systemPrompt", e.target.value)} rows={3} />
        <span className="settings-hint">Grundanweisung an das Modell, z. B. Ton und Rolle festlegen.</span>
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
        <button className="save" onClick={save} disabled={!dirty}>
          Speichern{dirty ? " •" : ""}
        </button>
        <button onClick={discard} disabled={!dirty} title="Alle ungespeicherten Änderungen zurücksetzen">
          Änderungen verwerfen
        </button>
      </div>
    </div>
  );
}
