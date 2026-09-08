// ShortprosePanel: Kurzprosa-Generator (Sprint 20, Agent 2).
//
// Standalone-Panel — bewusst KEINE Abhaengigkeit zu BookWriterDashboard,
// QualityDashboard oder anderen Panels (weder Import noch Aenderung dort).
// Generiert Flash Fiction / Micro-Stories / Kurzgeschichten ueber
// `@/services/bookwriter/shortprose`.
//
// Der LLM-Call laeuft ueber die injizierbare `generate`-Funktion
// (Mock in Tests, echte `generateShortprose` in Produktion).
// Bloomberg-Terminal-Stil: bg #000, accent #ffa028, border #333,
// monospace (IBM Plex Mono).

import { useEffect, useRef, useState } from "react";
import {
  generateShortprose,
  SHORTPROSE_GENRES,
  SHORTPROSE_LENGTHS,
  SHORTPROSE_PERSPECTIVES,
  SHORTPROSE_STYLES,
  type ShortproseGenre,
  type ShortproseLength,
  type ShortprosePerspective,
  type ShortproseResult,
  type ShortproseStyle,
} from "@/services/bookwriter/shortprose";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import "./bookwriter.css";

export interface ShortprosePanelProps {
  projectId?: string;
  chapterId?: string;
  /** Injizierbare Generate-Funktion (Mock in Tests, Default: echte Engine). */
  generate?: typeof generateShortprose;
  className?: string;
}

const GENRE_LABELS: Record<ShortproseGenre, string> = {
  "flash-fiction": "Flash Fiction",
  "micro-story": "Micro-Story",
  kurzgeschichte: "Kurzgeschichte",
  snapshot: "Snapshot",
  fable: "Fabel",
};

const STYLE_LABELS: Record<ShortproseStyle, string> = {
  literary: "Literarisch",
  minimalist: "Minimalistisch",
  noir: "Noir",
  lyrical: "Lyrisch",
  experimental: "Experimentell",
};

const LENGTH_LABELS: Record<ShortproseLength, string> = {
  "very-short": "Sehr kurz (< 500 Wörter)",
  short: "Kurz (< 1500 Wörter)",
  medium: "Mittel (< 3000 Wörter)",
};

const PERSPECTIVE_LABELS: Record<ShortprosePerspective, string> = {
  first: "Ich-Perspektive",
  second: "Du-Perspektive",
  "third-limited": "Personal (Er/Sie, limitiert)",
  "third-omniscient": "Auktorial (allwissend)",
};

const ACCENT = "#ffa028";

function seedTitle(seed: string): string {
  const t = seed.trim().replace(/\s+/g, " ");
  if (!t) return "Ohne Titel";
  return t.length > 48 ? `${t.slice(0, 48).trimEnd()}…` : t;
}

export function ShortprosePanel({
  projectId,
  chapterId,
  generate,
  className,
}: ShortprosePanelProps) {
  const [seed, setSeed] = useState("");
  const [genre, setGenre] = useState<ShortproseGenre>("flash-fiction");
  const [style, setStyle] = useState<ShortproseStyle>("literary");
  const [length, setLength] = useState<ShortproseLength>("very-short");
  const [perspective, setPerspective] =
    useState<ShortprosePerspective>("third-limited");
  const [language, setLanguage] = useState<"de" | "en">("de");
  const [result, setResult] = useState<ShortproseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number>(0);
  const cancelledRef = useRef(false);

  // Elapsed-Timer (wie KIPanel): tickt nur waehrend busy.
  useEffect(() => {
    if (!busy) return;
    const id = window.setInterval(() => {
      setElapsed((Date.now() - startedAtRef.current) / 1000);
    }, 250);
    return () => window.clearInterval(id);
  }, [busy]);

  const handleGenerate = async () => {
    if (busy || seed.trim().length === 0) return;
    const controller = new AbortController();
    abortRef.current = controller;
    cancelledRef.current = false;
    startedAtRef.current = Date.now();
    setBusy(true);
    setElapsed(0);
    setError(null);
    setSavedNote(null);
    try {
      const run = generate ?? generateShortprose;
      const res = await run(
        {
          prompt: seed.trim(),
          genre,
          style,
          length,
          perspective,
          language,
        },
        { signal: controller.signal },
      );
      if (!cancelledRef.current) setResult(res);
    } catch (e) {
      if (!cancelledRef.current) {
        setError(
          `Generierung fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    } finally {
      if (!cancelledRef.current) {
        setElapsed((Date.now() - startedAtRef.current) / 1000);
      }
      abortRef.current = null;
      setBusy(false);
    }
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setError("Generierung abgebrochen.");
  };

  const handleOpenInEditor = () => {
    if (!result) return;
    useEditorStore.getState().insertAtEnd(result.text);
    setSavedNote("Im Editor eingefügt (Dokument-Ende).");
  };

  const handleSaveAsProject = async () => {
    if (!result || saving) return;
    setSaving(true);
    setSavedNote(null);
    try {
      const { createProject, createChapter } = await import(
        "@/services/project"
      );
      const title = seedTitle(seed);
      const proj = await createProject(`Kurzprosa: ${title}`);
      await createChapter(proj.id, title, result.text);
      useProjectStore.getState().refresh();
      setSavedNote(`Als Projekt „Kurzprosa: ${title}“ gespeichert.`);
    } catch (e) {
      setError(
        `Speichern fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  void projectId;
  void chapterId;

  return (
    <div
      className={className ?? "shortprose-panel"}
      data-testid="shortprose-panel"
      style={{
        background: "#000",
        color: "#e8e8e8",
        border: "1px solid #333",
        padding: 12,
        fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
      }}
    >
      <h3 style={{ color: ACCENT, margin: "0 0 8px" }}>✍️ Kurzprosa</h3>

      <label htmlFor="shortprose-prompt">Seed-Idee / Thema</label>
      <textarea
        id="shortprose-prompt"
        data-testid="shortprose-prompt"
        value={seed}
        onChange={(e) => setSeed(e.target.value)}
        rows={3}
        placeholder="Worum soll es gehen? (Thema, Bild, erster Satz …)"
        style={{
          width: "100%",
          background: "#0a0a0a",
          color: "#e8e8e8",
          border: "1px solid #333",
          fontFamily: "inherit",
        }}
      />

      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
        <label>
          Genre
          <select
            data-testid="shortprose-genre"
            value={genre}
            onChange={(e) => setGenre(e.target.value as ShortproseGenre)}
            style={{ width: "100%", background: "#0a0a0a", color: "#e8e8e8", border: "1px solid #333" }}
          >
            {SHORTPROSE_GENRES.map((g) => (
              <option key={g} value={g}>
                {GENRE_LABELS[g]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Stil
          <select
            data-testid="shortprose-style"
            value={style}
            onChange={(e) => setStyle(e.target.value as ShortproseStyle)}
            style={{ width: "100%", background: "#0a0a0a", color: "#e8e8e8", border: "1px solid #333" }}
          >
            {SHORTPROSE_STYLES.map((s) => (
              <option key={s} value={s}>
                {STYLE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Länge
          <select
            data-testid="shortprose-length"
            value={length}
            onChange={(e) => setLength(e.target.value as ShortproseLength)}
            style={{ width: "100%", background: "#0a0a0a", color: "#e8e8e8", border: "1px solid #333" }}
          >
            {SHORTPROSE_LENGTHS.map((l) => (
              <option key={l} value={l}>
                {LENGTH_LABELS[l]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Perspektive
          <select
            data-testid="shortprose-perspective"
            value={perspective}
            onChange={(e) =>
              setPerspective(e.target.value as ShortprosePerspective)
            }
            style={{ width: "100%", background: "#0a0a0a", color: "#e8e8e8", border: "1px solid #333" }}
          >
            {SHORTPROSE_PERSPECTIVES.map((p) => (
              <option key={p} value={p}>
                {PERSPECTIVE_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sprache
          <select
            data-testid="shortprose-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as "de" | "en")}
            style={{ width: "100%", background: "#0a0a0a", color: "#e8e8e8", border: "1px solid #333" }}
          >
            <option value="de">Deutsch</option>
            <option value="en">Englisch</option>
          </select>
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          data-testid="shortprose-generate-btn"
          onClick={handleGenerate}
          disabled={busy || seed.trim().length === 0}
          style={{
            background: ACCENT,
            color: "#000",
            border: "none",
            padding: "8px 16px",
            fontFamily: "inherit",
            fontWeight: "bold",
            cursor: busy ? "wait" : "pointer",
            opacity: busy || seed.trim().length === 0 ? 0.5 : 1,
          }}
        >
          {busy ? "Generiert …" : "Generieren"}
        </button>
        {busy && (
          <button
            data-testid="shortprose-cancel-btn"
            onClick={handleCancel}
            style={{
              background: "#000",
              color: ACCENT,
              border: `1px solid ${ACCENT}`,
              padding: "8px 16px",
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            Abbrechen
          </button>
        )}
      </div>

      {busy && (
        <p className="ws-muted" data-testid="shortprose-elapsed">
          ⏱ {elapsed.toFixed(1)} s …
        </p>
      )}

      {error && (
        <p className="ws-muted" data-testid="shortprose-error">
          {error}
        </p>
      )}

      {result && (
        <>
          <div
            data-testid="shortprose-result"
            style={{
              marginTop: 12,
              maxHeight: 320,
              overflowY: "auto",
              whiteSpace: "pre-wrap",
              border: "1px solid #333",
              padding: 8,
              background: "#0a0a0a",
            }}
          >
            {result.text}
          </div>
          <p className="ws-muted" data-testid="shortprose-meta">
            <span data-testid="shortprose-words">
              {result.wordCount} Wörter
            </span>{" "}
            ·{" "}
            <span data-testid="shortprose-chars">
              {result.characterCount} Zeichen
            </span>{" "}
            ·{" "}
            <span data-testid="shortprose-reading-time">
              ~{result.estimatedReadingTime} Min. Lesezeit
            </span>{" "}
            · {GENRE_LABELS[result.genre]} / {STYLE_LABELS[result.style]}
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              data-testid="shortprose-open-editor-btn"
              onClick={handleOpenInEditor}
              className="ws-btn"
            >
              Im Editor öffnen
            </button>
            <button
              data-testid="shortprose-save-project-btn"
              onClick={handleSaveAsProject}
              disabled={saving}
              className="ws-btn"
            >
              {saving ? "Speichert …" : "Als Projekt speichern"}
            </button>
          </div>
        </>
      )}

      {savedNote && (
        <p className="ws-muted" data-testid="shortprose-saved-note">
          {savedNote}
        </p>
      )}
    </div>
  );
}
