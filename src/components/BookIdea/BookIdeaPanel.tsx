// BookIdeaPanel (Sprint 29): KI-Buchideenentwickler.
import { useState, useCallback, useEffect } from "react";
import {
  evaluateIdea,
  refineIdea,
  generateBookIdeas,
  isOllamaAvailable,
  GENRES,
  TARGET_AUDIENCES,
} from "@/services/bookIdea/bookIdeaEngine";
import type { BookIdea, IdeaEvaluation, GenerationMode } from "@/types/bookIdea";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#232b3a";
const AMBER = "#ffb000";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";

export function BookIdeaPanel() {
  const [genre, setGenre] = useState(GENRES[0]);
  const [theme, setTheme] = useState("");
  const [targetAudience, setTargetAudience] = useState(TARGET_AUDIENCES[0]);
  const [count, setCount] = useState(4);
  const [mode, setMode] = useState<GenerationMode>("demo");
  const [busy, setBusy] = useState(false);
  const [ideas, setIdeas] = useState<BookIdea[]>([]);
  const [evaluations, setEvaluations] = useState<Record<string, IdeaEvaluation>>({});
  const [ollamaAvailable, setOllamaAvailable] = useState(false);

  useEffect(() => {
    isOllamaAvailable().then(setOllamaAvailable);
  }, []);

  const generate = useCallback(async () => {
    setBusy(true);
    setIdeas([]);
    setEvaluations({});

    try {
      const result = await generateBookIdeas({
        genre,
        theme: theme.trim() || "Zukunft",
        targetAudience,
        count,
        useLLM: mode !== "demo",
        llmModel: "llama3.2",
      });
      setIdeas(result);

      // Auto-evaluate
      const evals: Record<string, IdeaEvaluation> = {};
      for (const idea of result) {
        evals[idea.id] = evaluateIdea(idea);
      }
      setEvaluations(evals);
    } catch (e) {
      console.error("Generierung fehlgeschlagen:", e);
    } finally {
      setBusy(false);
    }
  }, [genre, theme, targetAudience, count, mode]);

  const handleRefine = useCallback((idea: BookIdea) => {
    const refined = refineIdea(idea);
    setIdeas((prev) => prev.map((i) => (i.id === idea.id ? refined : i)));
    setEvaluations((prev) => ({ ...prev, [refined.id]: evaluateIdea(refined) }));
  }, []);

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: "'IBM Plex Mono', monospace", height: "100%", padding: 16, overflowY: "auto" }}>
      <h2 style={{ color: AMBER, margin: "0 0 12px 0", fontSize: 18, fontWeight: 700 }}>💡 BUCHIDEEN-ENTWICKLER</h2>

      {/* Konfiguration */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ color: DIM, fontSize: 11 }}>GENRE</label>
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            style={{ width: "100%", padding: 8, background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 12 }}
          >
            {GENRES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ color: DIM, fontSize: 11 }}>ZIELGRUPPE</label>
          <select
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            style={{ width: "100%", padding: 8, background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 12 }}
          >
            {TARGET_AUDIENCES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ color: DIM, fontSize: 11 }}>THEMA</label>
          <input
            type="text"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="z.B. Künstliche Intelligenz"
            style={{ width: "100%", padding: 8, background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 12 }}
          />
        </div>
        <div>
          <label style={{ color: DIM, fontSize: 11 }}>ANZAHL</label>
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
            style={{ width: "100%", padding: 8, background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 12 }}
          />
        </div>
      </div>

      {/* Modus */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {(["demo", "llm", "hybrid"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            disabled={busy || (m !== "demo" && !ollamaAvailable)}
            style={{
              padding: "6px 12px",
              background: mode === m ? AMBER : PANEL,
              color: mode === m ? "#000" : TEXT,
              border: `1px solid ${mode === m ? AMBER : BORDER}`,
              cursor: busy || (m !== "demo" && !ollamaAvailable) ? "not-allowed" : "pointer",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      {!ollamaAvailable && (
        <div style={{ color: DIM, fontSize: 10, marginBottom: 8 }}>
          Ollama nicht erreichbar — nur Demo-Modus verfügbar.
        </div>
      )}

      {/* Generieren */}
      <button
        onClick={generate}
        disabled={busy}
        style={{
          padding: "10px 20px",
          background: AMBER,
          color: "#000",
          border: "none",
          cursor: busy ? "not-allowed" : "pointer",
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 16,
        }}
      >
        {busy ? "Generiert …" : "💡 Ideen generieren"}
      </button>

      {/* Ergebnisse */}
      {ideas.length > 0 && (
        <div>
          <h3 style={{ color: AMBER, fontSize: 14, marginBottom: 8 }}>
            {ideas.length} Ideen generiert
          </h3>
          {ideas.map((idea) => {
            const eval_ = evaluations[idea.id];
            return (
              <div
                key={idea.id}
                style={{
                  background: PANEL,
                  border: `1px solid ${BORDER}`,
                  padding: 12,
                  marginBottom: 12,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{idea.title}</div>
                <div style={{ color: DIM, fontSize: 11, marginBottom: 8 }}>
                  {idea.genre} • {idea.targetAudience}
                </div>
                <div style={{ fontSize: 12, marginBottom: 6 }}>
                  <strong>Logline:</strong> {idea.logline}
                </div>
                <div style={{ fontSize: 11, color: DIM, marginBottom: 8 }}>
                  {idea.synopsis}
                </div>

                {/* Evaluation */}
                {eval_ && (
                  <div style={{ background: BG, padding: 8, marginBottom: 8, fontSize: 10 }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                      <span>Originalität: {eval_.originality}%</span>
                      <span>Markt: {eval_.marketPotential}%</span>
                      <span>Leser: {eval_.readerAppeal}%</span>
                      <span>Gesamt: {eval_.overallScore}%</span>
                    </div>
                    <div style={{ color: "#44ff88" }}>
                      ✓ {eval_.strengths.join(" • ")}
                    </div>
                    <div style={{ color: "#ff4444" }}>
                      ✗ {eval_.weaknesses.join(" • ")}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => handleRefine(idea)}
                  style={{
                    padding: "4px 10px",
                    background: PANEL,
                    color: AMBER,
                    border: `1px solid ${AMBER}`,
                    cursor: "pointer",
                    fontSize: 10,
                  }}
                >
                  ↻ Verfeinern
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
