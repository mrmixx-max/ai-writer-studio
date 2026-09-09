// Scene Breakdown Panel (Sprint 27, Agent 1): Szenen-Erkennung und -Analyse.
import { useState, useCallback } from "react";
import {
  generateSceneBreakdown,
  type SceneBreakdown,
} from "@/services/scene/sceneBreakdown";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#232b3a";
const AMBER = "#ffb000";
const CYAN = "#00e5ff";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";

export function SceneBreakdownPanel() {
  const [text, setText] = useState("");
  const [breakdown, setBreakdown] = useState<SceneBreakdown | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAnalyze = useCallback(() => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      setBreakdown(generateSceneBreakdown(text));
    } finally {
      setBusy(false);
    }
  }, [text]);

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: "'IBM Plex Mono', monospace", height: "100%", padding: 16, overflowY: "auto" }}>
      <h2 style={{ color: AMBER, margin: "0 0 12px 0", fontSize: 18, fontWeight: 700 }}>
        🎬 SCENE BREAKDOWN
      </h2>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="Text hier einfügen..."
        style={{
          width: "100%", padding: "8px 10px", background: PANEL, border: `1px solid ${BORDER}`,
          color: TEXT, fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", marginBottom: 12,
        }}
      />

      <button onClick={handleAnalyze} disabled={busy || !text.trim()}
        style={{ padding: "8px 20px", background: busy || !text.trim() ? DIM : AMBER, color: "#000", border: "none", cursor: busy || !text.trim() ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
        {busy ? "LÄUFT..." : "ANALYSIEREN"}
      </button>

      {breakdown && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}>
              <div style={{ color: DIM, fontSize: 10 }}>SZENEN</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{breakdown.totalScenes}</div>
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}>
              <div style={{ color: DIM, fontSize: 10 }}>Ø LÄNGE</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{breakdown.averageSceneLength}</div>
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}>
              <div style={{ color: DIM, fontSize: 10 }}>ORTE</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{breakdown.locations.length}</div>
            </div>
          </div>

          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12, marginBottom: 12 }}>
            <div style={{ color: AMBER, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>SZENEN</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {breakdown.scenes.map((scene) => (
                <div key={scene.id} style={{ background: BG, border: `1px solid ${BORDER}`, padding: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{scene.title}</span>
                    <span style={{ color: DIM, fontSize: 10 }}>{scene.wordCount} Wörter</span>
                  </div>
                  <div style={{ color: DIM, fontSize: 10, marginTop: 4 }}>
                    {scene.location} • {scene.timeOfDay} • {scene.mood}
                  </div>
                  {scene.characters.length > 0 && (
                    <div style={{ color: CYAN, fontSize: 10, marginTop: 2 }}>
                      {scene.characters.join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12 }}>
            <div style={{ color: AMBER, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>STIMMUNGSVERTEILUNG</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {Object.entries(breakdown.moodDistribution).map(([mood, count]) => (
                <span key={mood} style={{ background: BG, border: `1px solid ${BORDER}`, padding: "2px 8px", fontSize: 11 }}>
                  {mood} ({count})
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
