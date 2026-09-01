// BookWriterPanel: vollautomatische Buchgenerierung mit Live-Vorschau.
import { useState, useRef, useCallback } from "react";
import { generateOutline, generateChapter, type BookOutline, type BookChapter } from "@/services/writing/bookwriter";
import { useActiveModel } from "@/components/KIPanel/useActiveModel";
import { useProjectStore } from "@/store/projectStore";
import { markdownToTipTap } from "@/services/editor/markdown";

export function BookWriterPanel() {
  const { settings } = useActiveModel();
  const newChapter = useProjectStore((s) => s.newChapter);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const [topic, setTopic] = useState("");
  const [genre, setGenre] = useState("Sachbuch");
  const [targetAudience, setTargetAudience] = useState("Erwachsene");
  const [chapterCount, setChapterCount] = useState(8);
  const [language] = useState("Deutsch");
  const [outline, setOutline] = useState<BookOutline | null>(null);
  const [chapters, setChapters] = useState<BookChapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [liveText, setLiveText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setError(null);
    setOutline(null);
    setChapters([]);
    setCurrentChapter(0);
    setLiveText("");
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      // Schritt 1: Outline
      setLiveText("📋 Erstelle Gliederung...");
      const bookOutline = await generateOutline(
        {
          topic: topic.trim(),
          genre,
          targetAudience,
          chapterCount,
          model: settings.model,
          baseUrl: settings.ollamaBaseUrl || "http://127.0.0.1:11434",
          language,
        },
        ctrl.signal,
      );
      setOutline(bookOutline);
      setLiveText(`✅ Gliederung erstellt: ${bookOutline.chapters.length} Kapitel\n\n`);

      // Schritt 2: Kapitel einzeln generieren mit Live-Text
      const writtenChapters: BookChapter[] = [];
      for (let i = 1; i <= bookOutline.chapters.length; i++) {
        if (ctrl.signal.aborted) break;
        setCurrentChapter(i);
        setLiveText((prev) => prev + `✍️ Schreibe Kapitel ${i}: ${bookOutline.chapters[i - 1].title}...\n`);

        const chapter = await generateChapter(
          {
            topic: topic.trim(),
            genre,
            targetAudience,
            chapterCount,
            model: settings.model,
            baseUrl: settings.ollamaBaseUrl || "http://127.0.0.1:11434",
            language,
          },
          bookOutline,
          i,
          writtenChapters,
          ctrl.signal,
        );
        writtenChapters.push(chapter);
        setChapters([...writtenChapters]);
        setLiveText((prev) => prev + `✅ Kapitel ${i} fertig (${chapter.content.length} Zeichen)\n\n`);
      }

      setLiveText((prev) => prev + "🎉 Buch fertig!");
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        setError(e.message);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [topic, genre, targetAudience, chapterCount, language, settings]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
  }, []);

  const fullText = outline
    ? `# ${outline.title}\n\n${chapters.map((c) => `## Kapitel ${c.number}: ${c.title}\n\n${c.content}`).join("\n\n---\n\n")}`
    : "";

  return (
    <div className="bookwriter-panel">
      <h3>📖 Automatischer Buchautor</h3>

      <div className="bw-fields">
        <label>
          Thema:
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="z.B. KI im Alltag" />
        </label>
        <label>
          Genre:
          <select value={genre} onChange={(e) => setGenre(e.target.value)}>
            <option>Sachbuch</option><option>Roman</option><option>Thriller</option>
            <option>Fantasy</option><option>Selbsthilfe</option><option>Business</option>
          </select>
        </label>
        <label>
          Zielgruppe:
          <input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} />
        </label>
        <label>
          Kapitel:
          <input type="number" min={3} max={30} value={chapterCount} onChange={(e) => setChapterCount(Number(e.target.value))} />
        </label>
      </div>

      <div className="bw-actions">
        {!isGenerating ? (
          <button onClick={handleGenerate} disabled={!topic.trim()} className="bw-start">
            📝 Buch generieren
          </button>
        ) : (
          <button onClick={handleStop} className="bw-stop">⏹ Stoppen</button>
        )}
      </div>

      {isGenerating && (
        <div className="bw-progress">
          <div className="bw-progress-bar">
            <div className="bw-progress-fill" style={{ width: `${(currentChapter / chapterCount) * 100}%` }} />
          </div>
          <span className="bw-progress-text">Kapitel {currentChapter} / {chapterCount}</span>
        </div>
      )}

      {error && <div className="bw-error">Fehler: {error}</div>}

      {liveText && (
        <div className="bw-live">
          <h4>Live:</h4>
          <pre>{liveText}</pre>
        </div>
      )}

      {outline && chapters.length > 0 && (
        <div className="bw-result">
          <h4>{outline.title}</h4>
          <div className="bw-chapters">
            {chapters.map((c) => (
              <details key={c.number} className="bw-chapter">
                <summary>Kapitel {c.number}: {c.title} ({c.content.length} Zeichen)</summary>
                <p>{c.content}</p>
              </details>
            ))}
          </div>
          {outline && chapters.length > 0 && (
            <>
              <button
                onClick={() => {
                  if (!activeProjectId) {
                    alert("Bitte erst ein Projekt öffnen/anlegen!");
                    return;
                  }
                  // Kapitel mit Content anlegen (nur Kapitelkörper — Titel steht in der DB)
                  for (const ch of chapters) {
                    const tipTapJson = markdownToTipTap(ch.content);
                    newChapter(`Kapitel ${ch.number}: ${ch.title}`, tipTapJson);
                  }
                  setLiveText((prev) => prev + `\n📚 ${chapters.length} Kapitel mit Content angelegt!`);
                }}
                className="bw-export"
                style={{ background: "#4f46e5", marginRight: "8px" }}
              >
                📚 Kapitel anlegen ({chapters.length})
              </button>
              <button
                onClick={() => {
                  const filename = `${outline.title.replace(/[^a-zA-Z0-9]/g, "_")}.md`;
                  const w = window.open("", "_blank");
                  if (w) {
                    w.document.write(`<pre style="white-space:pre-wrap;font-family:monospace;padding:20px">${fullText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`);
                    w.document.title = filename;
                  }
                }}
                className="bw-export"
              >
                📥 Als Markdown anzeigen
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
