// Redenschreiber: Kontinuierliche Spracherkennung → Echtzeit-Transkription in den Editor.
// Nutzt Web Speech API (Chrome/Edge) mit Auto-Retry, Pausierung und Auto-Scroll.
import { useState, useRef, useCallback, useEffect } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useEditorStore } from "@/store/editorStore";
import { useI18n } from "@/i18n";
import { recordAndTranscribe, stopRecording, DEFAULT_WHISPER_LANGUAGE } from "@/services/whisper";

type Status = "idle" | "recording" | "paused" | "error";

export function RedenschreiberPanel() {
  const { t } = useI18n();
  const activeChapterId = useProjectStore((s) => s.activeChapterId);
  const chapters = useProjectStore((s) => s.chapters);
  const activeChapter = chapters.find((c: { id: string }) => c.id === activeChapterId);

  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState(DEFAULT_WHISPER_LANGUAGE);
  const [autoScroll, setAutoScroll] = useState(true);
  const [punctuation, setPunctuation] = useState(true);

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
    </div>
  );
}
