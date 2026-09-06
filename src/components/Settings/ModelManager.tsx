// Lokale Modell-Verwaltung (Sprint 9, Agent 4) — Standalone-Komponente.
//
// Liste installierter Ollama-Modelle + Modell ziehen (mit Fortschrittsbalken)
// + Modell löschen + Warnung bei wenig freiem Plattenplatz.
// Bewusst NICHT in SettingsPanel.tsx eingebaut (kein Umbau der Settings);
// kann bei Bedarf dort als <ModelManager /> eingebettet werden.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_OLLAMA_BASE_URL,
  OLLAMA_MODELS_DIR_HINT,
  deleteModel,
  formatModelSize,
  isLowDiskSpace,
  listInstalledModels,
  pullModel,
  type InstalledModel,
  type PullProgress,
} from "@/services/ollama/modelManager";
import { useI18n } from "@/i18n";
import "./settings.css";

export interface ModelManagerProps {
  /** Ollama-Adresse (Default http://127.0.0.1:11434). */
  baseUrl?: string;
  /** Modellverzeichnis nur zur Anzeige (Default D:\ollama\models). */
  modelsDirHint?: string;
  /**
   * Freier Plattenplatz in Bytes (null = unbekannt, keine Warnung).
   * Der Wert muss von außen kommen (z. B. Tauri-FS-API) — die Komponente
   * misst nichts selbst.
   */
  freeDiskBytes?: number | null;
}

export default function ModelManager({
  baseUrl = DEFAULT_OLLAMA_BASE_URL,
  modelsDirHint = OLLAMA_MODELS_DIR_HINT,
  freeDiskBytes = null,
}: ModelManagerProps) {
  const { t } = useI18n();
  const [models, setModels] = useState<InstalledModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pullName, setPullName] = useState("");
  const [pulling, setPulling] = useState(false);
  const [progress, setProgress] = useState<PullProgress | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setModels(await listInstalledModels(baseUrl));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    void refresh();
    return () => abortRef.current?.abort();
  }, [refresh]);

  async function handlePull() {
    const name = pullName.trim();
    if (!name || pulling) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPulling(true);
    setProgress({ status: t("modelmanager.pullStarting"), percent: null });
    setError(null);
    try {
      await pullModel(name, (p) => setProgress(p), { baseUrl, signal: ctrl.signal });
      setPullName("");
      setProgress({ status: t("modelmanager.pullSuccess"), percent: 100 });
      await refresh();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setProgress({ status: t("modelmanager.pullAborted"), percent: null });
      } else {
        setError(e instanceof Error ? e.message : String(e));
        setProgress(null);
      }
    } finally {
      setPulling(false);
    }
  }

  async function handleDelete(name: string) {
    if (deleting) return;
    if (!window.confirm(t("modelmanager.deleteConfirm", { name }))) return;
    setDeleting(name);
    setError(null);
    try {
      await deleteModel(name, { baseUrl });
      setModels((prev) => prev.filter((m) => m.name !== name));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(null);
    }
  }

  const totalBytes = models.reduce((sum, m) => sum + (m.size || 0), 0);
  const lowDisk = freeDiskBytes != null && isLowDiskSpace(freeDiskBytes);
  const percent = progress?.percent;

  return (
    <section className="settings-panel" aria-label={t("modelmanager.ariaLabel")}>
      <h2>{t("modelmanager.title")}</h2>
      <p className="settings-hint">
        {t("modelmanager.hint", { baseUrl, dir: modelsDirHint })}
      </p>

      {lowDisk && (
        <p className="field-error" role="alert">
          {t("modelmanager.lowDisk", { size: formatModelSize(freeDiskBytes ?? 0) })}
        </p>
      )}
      {error && (
        <p className="conn-err" role="alert">
          {error}
        </p>
      )}

      <div className="provider-card-actions">
        <button type="button" onClick={() => void refresh()} disabled={loading || pulling}>
          {loading ? t("modelmanager.loading") : t("modelmanager.refresh")}
        </button>
      </div>

      {loading && models.length === 0 ? (
        <p className="settings-hint">{t("modelmanager.loadingModels")}</p>
      ) : models.length === 0 ? (
        <p className="settings-hint">{t("modelmanager.empty")}</p>
      ) : (
        <ul className="provider-cards">
          {models.map((m) => (
            <li key={m.name} className="provider-card">
              <div className="provider-card-head">
                <span className="provider-card-title">{m.name}</span>
                <span className="provider-card-meta">
                  {formatModelSize(m.size)}
                  {m.parameterSize ? ` · ${m.parameterSize}` : ""}
                  {m.quantization ? ` · ${m.quantization}` : ""}
                </span>
              </div>
              <div className="provider-card-actions">
                <button
                  type="button"
                  onClick={() => void handleDelete(m.name)}
                  disabled={deleting === m.name || pulling}
                >
                  {deleting === m.name ? t("modelmanager.deleting") : t("modelmanager.delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {models.length > 0 && (
        <p className="settings-hint">{t("modelmanager.total", { size: formatModelSize(totalBytes) })}</p>
      )}

      <h3>{t("modelmanager.pullTitle")}</h3>
      <div className="provider-card-fields">
        <input
          type="text"
          value={pullName}
          onChange={(e) => setPullName(e.target.value)}
          placeholder={t("modelmanager.pullPlaceholder")}
          aria-label={t("modelmanager.pullAriaLabel")}
          disabled={pulling}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handlePull();
          }}
        />
        <div className="provider-card-actions">
          <button type="button" onClick={() => void handlePull()} disabled={!pullName.trim() || pulling}>
            {pulling ? t("modelmanager.loading") : t("modelmanager.pull")}
          </button>
          {pulling && (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
            >
              {t("modelmanager.cancel")}
            </button>
          )}
        </div>
      </div>

      {(pulling || progress) && percent != null && (
        <div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <progress value={percent} max={100} style={{ width: "100%" }} />
          <p className="settings-hint">
            {t("modelmanager.progress", { status: progress?.status ?? "", percent })}
          </p>
        </div>
      )}
      {pulling && percent == null && (
        <p className="settings-hint">{progress?.status ?? t("modelmanager.loading")}</p>
      )}
    </section>
  );
}
