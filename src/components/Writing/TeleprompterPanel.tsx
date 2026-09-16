// Teleprompter: Weiches Scrollen (requestAnimationFrame) des Textes mit
// optionaler TTS-Ausgabe. Nimmt Redetexte per Fenster-Event entgegen
// (teleprompter:open-with-text aus dem Redenschreiber).
import { useState, useRef, useCallback, useEffect } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useI18n } from "@/i18n";
import { OPEN_TELEPROMPTER_EVENT } from "@/services/speech/speechTemplates";

const SCROLL_SPEEDS = [
  { label: "langsam", wpm: 80 },
  { label: "normal", wpm: 130 },
  { label: "schnell", wpm: 180 },
] as const;

export function TeleprompterPanel() {
  const { t } = useI18n();
  const activeChapterId = useProjectStore((s) => s.activeChapterId);
  const chapters = useProjectStore((s) => s.chapters);
  const activeChapter = chapters.find((c: { id: string }) => c.id === activeChapterId);

  const [scrolling, setScrolling] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [progressFrac, setProgressFrac] = useState(0);
  const [windowSize, setWindowSize] = useState(3);
  const [fontSize, setFontSize] = useState(28);
  const [darkMode, setDarkMode] = useState(true);
  const [mirror, setMirror] = useState(false);
  // Redetext-Override: per Event aus dem Redenschreiber (statt Kapitel).
  const [overrideText, setOverrideText] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const stopScrollRef = useRef(false);

  const speed = SCROLL_SPEEDS[speedIdx];
  const text = overrideText ?? activeChapter?.content ?? "";
  const words = text.trim().split(/\s+/).filter(Boolean);

  // Redetext übernehmen (Event aus Redenschreiber) — ersetzt Kapiteltext.
  useEffect(() => {
    const onText = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === "string" && detail.trim()) {
        setOverrideText(detail);
        setProgressFrac(0);
        setScrolling(false);
      }
    };
    window.addEventListener(OPEN_TELEPROMPTER_EVENT, onText);
    return () => window.removeEventListener(OPEN_TELEPROMPTER_EVENT, onText);
  }, []);

  // Weiches Scrollen per requestAnimationFrame: kontinuierlicher Fortschritt
  // (Bruchteil-Wörter) statt hartem Wort-Sprung pro Intervall (setInterval).
  // px/sec aus Wörtern/Min: Wort ≈ 5 Zeichen ≈ 0.5 * fontSize px.
  useEffect(() => {
    if (!scrolling) return;
    stopScrollRef.current = false;
    const pxPerWord = Math.max(8, fontSize * 0.5);
    const pxPerSec = ((speed.wpm * pxPerWord) / 60) * 0.35;
    const totalPx = Math.max(1, words.length * pxPerWord);
    let last = performance.now();
    const step = (now: number) => {
      if (stopScrollRef.current) return;
      const dt = (now - last) / 1000;
      last = now;
      const el = containerRef.current;
      if (el) el.scrollTop += pxPerSec * dt;
      const frac = (pxPerSec * dt) / totalPx;
      if (words.length > 0) {
        setProgressFrac((prev) => {
          const next = prev + frac;
          return next >= 1 ? 1 : next;
        });
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      stopScrollRef.current = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [scrolling, speedIdx, fontSize, words.length]);

  // Am Ende automatisch stoppen.
  useEffect(() => {
    if (progressFrac >= 1 && scrolling) setScrolling(false);
  }, [progressFrac, scrolling]);

  const totalWords = words.length;
  const offset = Math.min(totalWords, Math.floor(progressFrac * totalWords));
  const visible = words.slice(offset, offset + windowSize);
  const progress = totalWords > 0 ? Math.min(100, Math.round(progressFrac * 100)) : 0;

  const play = useCallback(() => {
    if (!text.trim()) return;
    if (progressFrac >= 1) setProgressFrac(0);
    setScrolling(true);
  }, [text, progressFrac]);

  const pause = useCallback(() => setScrolling(false), []);

  const stop = useCallback(() => {
    setScrolling(false);
    setProgressFrac(0);
  }, []);

  const reset = useCallback(() => {
    setScrolling(false);
    setProgressFrac(0);
  }, []);

  const clearOverride = useCallback(() => {
    setOverrideText(null);
    setProgressFrac(0);
    setScrolling(false);
  }, []);

  return (
    <div className={`teleprompter ${darkMode ? "dark" : "light"}`} data-testid="teleprompter">
      {overrideText && (
        <div className="tp-row">
          <span>{t("teleprompter.speechMode")}</span>
          <button onClick={clearOverride}>{t("teleprompter.clearSpeech")}</button>
        </div>
      )}
      <div className="tp-controls">
        <div className="tp-row">
          <label>{t("teleprompter.speed")}:</label>
          <div className="tp-speed">
            {SCROLL_SPEEDS.map((s, i) => (
              <button key={s.label} className={i === speedIdx ? "active" : ""} onClick={() => setSpeedIdx(i)}>
                {t(`teleprompter.speed.${s.label}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="tp-row">
          <label>{t("teleprompter.window")}:</label>
          <input
            type="range"
            min={1}
            max={10}
            value={windowSize}
            onChange={(e) => setWindowSize(Number(e.target.value))}
          />
          <span>{windowSize} {t("teleprompter.words")}</span>
        </div>

        <div className="tp-row">
          <label>{t("teleprompter.fontSize")}:</label>
          <input
            type="range"
            min={16}
            max={64}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
          />
          <span>{fontSize}px</span>
        </div>

        <div className="tp-row tp-toggles">
          <button className={darkMode ? "active" : ""} onClick={() => setDarkMode((v) => !v)}>
            {t("teleprompter.darkMode")}
          </button>
          <button className={mirror ? "active" : ""} onClick={() => setMirror((v) => !v)}>
            {t("teleprompter.mirror")}
          </button>
        </div>

        <div className="tp-actions">
          <button className="tp-primary" onClick={scrolling ? pause : play}>
            {scrolling ? t("teleprompter.pause") : t("teleprompter.play")}
          </button>
          <button onClick={stop}>{t("teleprompter.stop")}</button>
          <button onClick={reset}>{t("teleprompter.reset")}</button>
        </div>

        <div className="tp-progress" aria-label={t("teleprompter.progressLabel")}>
          <div className="tp-progress-bar" style={{ width: `${progress}%` }} />
          <span>{progress}%</span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="tp-viewport"
        style={{
          fontSize: `${fontSize}px`,
          transform: mirror ? "scaleX(-1)" : undefined,
        }}
      >
        {words.length === 0 ? (
          <p className="tp-empty">{t("teleprompter.noText")}</p>
        ) : (
          <div className="tp-words">
            {visible.map((w: string, i: number) => (
              <span key={offset + i} className={`tp-word ${i === visible.length - 1 ? "tp-focus" : ""}`}>
                {w}{" "}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
