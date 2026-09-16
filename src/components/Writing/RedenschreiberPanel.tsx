// Redenschreiber: Kontinuierliche Spracherkennung → Echtzeit-Transkription in den Editor.
// Nutzt Web Speech API (Chrome/Edge) mit Auto-Retry, Pausierung und Auto-Scroll.
import { useState, useRef, useCallback, useEffect } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useEditorStore } from "@/store/editorStore";
import { useI18n } from "@/i18n";
import { recordAndTranscribe, stopRecording, DEFAULT_WHISPER_LANGUAGE } from "@/services/whisper";
import { runKIAction } from "@/services/ki";
import { loadSettings } from "@/services/settings";
import type { RedeTon } from "@/services/ki/types";
import type { TranslationKey } from "@/i18n/locales/de";
import {
  listSpeechTemplates,
  getSpeechTemplate,
  renderSpeechTemplate,
} from "@/services/speech/speechTemplates";

type Status = "idle" | "recording" | "paused" | "error";

const REDE_TOENE: RedeTon[] = [
  "feierlich",
  "sachlich",
  "motivierend",
  "humorvoll",
  "nachdenklich",
  "kämpferisch",
  "staatstragend",
];

export function RedenschreiberPanel() {
  const { t } = useI18n();
  const activeChapterId = useProjectStore((s) => s.activeChapterId);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const chapters = useProjectStore((s) => s.chapters);
  const activeChapter = chapters.find((c: { id: string }) => c.id === activeChapterId);

  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState(DEFAULT_WHISPER_LANGUAGE);
  const [autoScroll, setAutoScroll] = useState(true);
  const [punctuation, setPunctuation] = useState(true);

  // KI-Rede-Generator (politische Reden per LLM).
  const [anlass, setAnlass] = useState("");
  const [publikum, setPublikum] = useState("");
  const [funktion, setFunktion] = useState("");
  const [ton, setTon] = useState<RedeTon>("kämpferisch");
  const [minuten, setMinuten] = useState(5);
  const [kernpunkte, setKernpunkte] = useState("");
  const [gegenposition, setGegenposition] = useState("");
  const [kiOutput, setKiOutput] = useState("");
  const [kiBusy, setKiBusy] = useState(false);
  const [kiError, setKiError] = useState<string | null>(null);
  const [kiOffline, setKiOffline] = useState(false);

  // Redetexte (Musterreden-Bibliothek, Schwerpunkt Politik).
  const [templateId, setTemplateId] = useState("");
  const [copied, setCopied] = useState(false);
  const activeTemplate = templateId ? getSpeechTemplate(templateId) : undefined;

  // Vorlesefunktion (Web Speech API, wie TTSPanel — Gerätelautsprecher, kein Server).
  const [reading, setReading] = useState<string | null>(null);

  // Bei Unmount laufende Sprachausgabe stoppen.
  useEffect(() => {
    return () => {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const appendToEditor = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      useEditorStore.getState().insertAtEnd(text);
    },
    [],
  );

  const start = useCallback(async () => {
    setError(null);
    setTranscript("");
    setInterim("");
    setStatus("recording");

    try {
      const result = await recordAndTranscribe(
        { language, continuous: true, interimResults: true },
        activeChapter?.id ?? null,
        (s) => {
          if (!mountedRef.current) return;
          // Status-Meldungen parsen: "Teiltranskript…" → interim, "Transkribiert" → final
            if (s.startsWith("Teiltranskript") || s.startsWith("Höre zu")) {
              // Interim-Status — nichts finales
            } else if (s.startsWith("Transkribiert")) {
              // Finales Segment — wird über onResult geliefert
            } else if (s.startsWith("Fehler") || s.startsWith("Wiederholung")) {
              setError(s);
            }
          },
        {
          continuous: true,
          interimResults: true,
          maxRetries: 2,
        },
      );

      if (mountedRef.current) {
        setTranscript((prev) => (prev + " " + result).trim());
        appendToEditor(result);
        setStatus("idle");
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
    }
  }, [activeChapter, language, appendToEditor]);

  const stop = useCallback(() => {
    stopRecording();
    setStatus("idle");
  }, []);

  const pause = useCallback(() => {
    stopRecording();
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    start();
  }, [start]);

  const clear = useCallback(() => {
    setTranscript("");
    setInterim("");
    setError(null);
  }, []);

  const generateRede = useCallback(async () => {
    if (kiBusy) return;
    setKiError(null);
    setKiOutput("");
    setKiOffline(false);
    setKiBusy(true);
    try {
      const res = await runKIAction(
        loadSettings(),
        {
          action: "rede",
          selection: "",
          context: "",
          // Dokumenten-RAG: Bücher/Dokumente des aktiven Projekts als Faktenbasis.
          projectId: activeProjectId ?? null,
          redeOpts: {
            anlass: anlass.trim(),
            publikum: publikum.trim(),
            ton,
            minuten,
            kernpunkte,
            funktion: funktion.trim() || undefined,
            gegenposition: gegenposition.trim() || undefined,
          },
        },
        (chunk) => {
          if (!mountedRef.current) return;
          setKiOutput((prev) => prev + chunk);
        },
      );
      if (mountedRef.current) {
        // Offline: Hinweistext steht bereits per Stream in kiOutput.
        setKiOffline(res.offline);
      }
    } catch (e) {
      if (mountedRef.current) {
        setKiError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (mountedRef.current) setKiBusy(false);
    }
  }, [kiBusy, anlass, publikum, funktion, ton, minuten, kernpunkte, gegenposition, activeProjectId]);

  const useTemplateInEditor = useCallback(() => {
    if (!activeTemplate) return;
    appendToEditor(renderSpeechTemplate(activeTemplate.text, {}));
  }, [activeTemplate, appendToEditor]);

  const copyTemplate = useCallback(async () => {
    if (!activeTemplate) return;
    try {
      await navigator.clipboard.writeText(activeTemplate.text);
      setCopied(true);
      window.setTimeout(() => {
        if (mountedRef.current) setCopied(false);
      }, 2000);
    } catch {
      setCopied(false);
    }
  }, [activeTemplate]);

  /**
   * Liest einen Text per Web Speech API vor (Toggle: Klick = Start,
   * erneuter Klick = Stopp). `id` unterscheidet KI-Output vs. Vorlage,
   * damit der Button-Text pro Quelle stimmt.
   */
  const toggleRead = useCallback(
    (id: string, text: string) => {
      try {
        const synth = window.speechSynthesis;
        if (!synth) return;
        if (reading === id) {
          synth.cancel();
          setReading(null);
          return;
        }
        synth.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = "de-DE";
        utter.rate = 1.0;
        utter.onend = () => {
          if (mountedRef.current) setReading(null);
        };
        utter.onerror = () => {
          if (mountedRef.current) setReading(null);
        };
        setReading(id);
        synth.speak(utter);
      } catch {
        setReading(null);
      }
    },
    [reading],
  );

  return (
    <div className="redenschreiber" data-testid="redenschreiber">
      <div className="rs-controls">
        <div className="rs-row">
          <label>{t("redenschreiber.language")}:</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={status === "recording"}>
            <option value="de-DE">Deutsch</option>
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
            <option value="fr-FR">Français</option>
            <option value="es-ES">Español</option>
          </select>
        </div>

        <div className="rs-row rs-toggles">
          <button className={autoScroll ? "active" : ""} onClick={() => setAutoScroll((v) => !v)}>
            {t("redenschreiber.autoScroll")}
          </button>
          <button className={punctuation ? "active" : ""} onClick={() => setPunctuation((v) => !v)}>
            {t("redenschreiber.punctuation")}
          </button>
        </div>

        <div className="rs-actions">
          {status === "recording" ? (
            <>
              <button className="rs-primary" onClick={pause}>
                {t("redenschreiber.pause")}
              </button>
              <button onClick={stop}>{t("redenschreiber.stop")}</button>
            </>
          ) : status === "paused" ? (
            <>
              <button className="rs-primary" onClick={resume}>
                {t("redenschreiber.resume")}
              </button>
              <button onClick={stop}>{t("redenschreiber.stop")}</button>
            </>
          ) : (
            <button className="rs-primary" onClick={start}>
              {t("redenschreiber.start")}
            </button>
          )}
          <button onClick={clear} disabled={status === "recording"}>
            {t("redenschreiber.clear")}
          </button>
        </div>

        {error && (
          <div className="rs-error" role="alert">
            {error}
          </div>
        )}
      </div>

      <div className="rs-status" aria-live="polite">
        <span className={`rs-dot ${status}`} />
        {t(`redenschreiber.status.${status}`)}
      </div>

      <div className="rs-transcript" data-testid="rs-transcript">
        {transcript ? (
          <p>{transcript}</p>
        ) : (
          <p className="rs-empty">{t("redenschreiber.empty")}</p>
        )}
        {interim && <p className="rs-interim">{interim}</p>}
      </div>

      <div className="rs-compose" data-testid="rs-compose">
        <h4>{t("redenschreiber.compose.title")}</h4>
        <div className="rs-row">
          <label>{t("redenschreiber.compose.occasion")}:</label>
          <input
            type="text"
            value={anlass}
            onChange={(e) => setAnlass(e.target.value)}
            placeholder={t("redenschreiber.compose.occasionPh")}
            disabled={kiBusy}
          />
        </div>
        <div className="rs-row">
          <label>{t("redenschreiber.compose.audience")}:</label>
          <input
            type="text"
            value={publikum}
            onChange={(e) => setPublikum(e.target.value)}
            placeholder={t("redenschreiber.compose.audiencePh")}
            disabled={kiBusy}
          />
        </div>
        <div className="rs-row">
          <label>{t("redenschreiber.compose.funktion")}:</label>
          <input
            type="text"
            value={funktion}
            onChange={(e) => setFunktion(e.target.value)}
            placeholder={t("redenschreiber.compose.funktionPh")}
            disabled={kiBusy}
          />
        </div>
        <div className="rs-row">
          <label>{t("redenschreiber.compose.tone")}:</label>
          <select
            value={ton}
            onChange={(e) => setTon(e.target.value as RedeTon)}
            disabled={kiBusy}
          >
            {REDE_TOENE.map((x) => (
              <option key={x} value={x}>
                {t(`redenschreiber.compose.tone.${x}` as TranslationKey)}
              </option>
            ))}
          </select>
          <label>{t("redenschreiber.compose.minutes")}:</label>
          <input
            type="number"
            min={1}
            max={60}
            value={minuten}
            onChange={(e) => setMinuten(Number(e.target.value))}
            disabled={kiBusy}
            style={{ width: 64 }}
          />
        </div>
        <div className="rs-row">
          <label>{t("redenschreiber.compose.points")}:</label>
          <textarea
            value={kernpunkte}
            onChange={(e) => setKernpunkte(e.target.value)}
            placeholder={t("redenschreiber.compose.pointsPh")}
            disabled={kiBusy}
            rows={3}
          />
        </div>
        <div className="rs-row">
          <label>{t("redenschreiber.compose.gegenposition")}:</label>
          <textarea
            value={gegenposition}
            onChange={(e) => setGegenposition(e.target.value)}
            placeholder={t("redenschreiber.compose.gegenpositionPh")}
            disabled={kiBusy}
            rows={2}
          />
        </div>
        <div className="rs-actions">
          <button className="rs-primary" onClick={generateRede} disabled={kiBusy}>
            {kiBusy
              ? t("redenschreiber.compose.generating")
              : t("redenschreiber.compose.generate")}
          </button>
          {kiOutput && !kiBusy && (
            <button onClick={() => appendToEditor(kiOutput)}>
              {t("redenschreiber.compose.useInEditor")}
            </button>
          )}
          {kiOutput && !kiBusy && (
            <button onClick={() => toggleRead("ki", kiOutput)}>
              {reading === "ki"
                ? t("redenschreiber.read.stop")
                : t("redenschreiber.read.start")}
            </button>
          )}
        </div>
        {kiError && (
          <div className="rs-error" role="alert">
            {kiError}
          </div>
        )}
        {(kiOutput || kiBusy) && (
          <div className="rs-output" data-testid="rs-compose-output">
            {kiOffline && <span className="model-offline">{t("redenschreiber.compose.offline")}</span>}
            <p style={{ whiteSpace: "pre-wrap" }}>{kiOutput}</p>
          </div>
        )}
      </div>

      <div className="rs-templates" data-testid="rs-templates">
        <h4>{t("redenschreiber.templates.title")}</h4>
        <div className="rs-row">
          <label>{t("redenschreiber.templates.select")}:</label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">—</option>
            {listSpeechTemplates().map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.titel} ({tpl.anlass}, ca. {tpl.minuten} Min.)
              </option>
            ))}
          </select>
        </div>
        {activeTemplate && (
          <>
            <div className="rs-output" data-testid="rs-template-preview">
              <p style={{ whiteSpace: "pre-wrap" }}>{activeTemplate.text}</p>
            </div>
            <div className="rs-actions">
              <button onClick={useTemplateInEditor}>
                {t("redenschreiber.templates.useInEditor")}
              </button>
              <button onClick={copyTemplate}>
                {copied
                  ? t("redenschreiber.templates.copied")
                  : t("redenschreiber.templates.copy")}
              </button>
              <button onClick={() => toggleRead("template", activeTemplate.text)}>
                {reading === "template"
                  ? t("redenschreiber.read.stop")
                  : t("redenschreiber.read.start")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
