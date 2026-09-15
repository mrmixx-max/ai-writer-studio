// Teleprompter: Langsames Scrollen des Textes mit optionaler TTS-Ausgabe.
// Setzt Spracheingabe aus dem Redenschreiber als Vorbedingung voraus.
import { useState, useRef, useCallback, useEffect } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useI18n } from "@/i18n";

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

  const text = activeChapter?.content ?? "";
  const words = text.trim().split(/\s+/).filter(Boolean);

  const [scrolling, setScrolling] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [offset, setOffset] = useState(0);
  const [windowSize, setWindowSize] = useState(3);
  const [fontSize, setFontSize] = useState(28);
  const [darkMode, setDarkMode] = useState(true);
  const [mirror, setMirror] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const tickRef = useRef<number | null>(null);

  const speed = SCROLL_SPEEDS[speedIdx];

  // Scroll-Tick basierend auf Wörtern pro Minute
  useEffect(() => {
    if (scrolling) {
      const intervalMs = 60_000 / speed.wpm;
      tickRef.current = window.setInterval(() => {
        setOffset((o) => {
          if (o >= words.length) {
            setScrolling(false);
            return o;
          }
          return o + 1;
        });
      }, intervalMs);
    }
    return () => {
      if (tickRef.current !== null) window.clearInterval(tickRef.current);
    };
  }, [scrolling, speedIdx]);

  const visible = words.slice(offset, offset + windowSize);
  const progress = words.length > 0 ? Math.min(100, Math.round((offset / words.length) * 100)) : 0;

  const play = useCallback(() => {
    if (!text.trim()) return;
    setScrolling(true);
  }, [text]);

  const pause = useCallback(() => setScrolling(false), []);

  const stop = useCallback(() => {
    setScrolling(false);
    setOffset(0);
  }, []);

  const reset = useCallback(() => {
    setScrolling(false);
    setOffset(0);
  }, []);

  return (
    <div className={`teleprompter ${darkMode ? "dark" : "light"}`} data-testid="teleprompter">
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
