// Einzelne Prompt-Karte mit Aktionen + optionalem 10-Min-Freewriting-Timer.
import { useEffect, useState } from "react";
import type { GeneratedPrompt } from "@/services/prompt/types";

interface Props {
  prompt: GeneratedPrompt;
  onInsert: () => void;
  onNewChapter: () => void;
  onFavorite: () => void;
  onCopy: () => void;
  onRegenerate: () => void;
}

const FREEWRITE_MS = 10 * 60 * 1000;

export function PromptCard({ prompt, onInsert, onNewChapter, onFavorite, onCopy, onRegenerate }: Props) {
  const [timer, setTimer] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(FREEWRITE_MS);

  // Unmount-Cleanup: laufender Freewriting-Timer nicht überleben lassen.
  useEffect(() => {
    return () => {
      if (timer !== null) window.clearInterval(timer);
    };
  }, [timer]);

  function startTimer() {
    onNewChapter(); // neues Kapitel mit Prompt
    const start = Date.now();
    const id = window.setInterval(() => {
      const left = FREEWRITE_MS - (Date.now() - start);
      if (left <= 0) {
        window.clearInterval(id);
        setTimer(null);
        setRemaining(FREEWRITE_MS);
        beep();
      } else {
        setRemaining(left);
      }
    }, 1000);
    setTimer(id);
  }

  function beep() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      o.connect(ctx.destination);
      o.frequency.value = 440;
      o.start();
      o.stop(ctx.currentTime + 0.6);
    } catch {
      /* Audio nicht verfügbar → still */
    }
  }

  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);

  return (
    <div className="prompt-card">
      <p className="prompt-text">{prompt.text}</p>
      {prompt.hook && <p className="prompt-hook">{prompt.hook}</p>}
      <div className="prompt-meta">
        {prompt.genre} · {prompt.type}
      </div>
      <div className="prompt-actions">
        <button onClick={onInsert}>In Editor einfügen</button>
        <button onClick={onNewChapter}>Neues Kapitel</button>
        <button onClick={onFavorite}>★ Favorit</button>
        <button onClick={onCopy}>Kopieren</button>
        <button onClick={onRegenerate}>Neu würfeln</button>
        {timer === null ? (
          <button onClick={startTimer}>⏱ 10-Min-Timer</button>
        ) : (
          <span className="timer">{mm}:{ss.toString().padStart(2, "0")}</span>
        )}
      </div>
    </div>
  );
}
