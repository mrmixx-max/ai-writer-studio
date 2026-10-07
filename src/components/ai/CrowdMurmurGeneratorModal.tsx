// CrowdMurmurGeneratorModal (WP 89.1 UI)
import { useState, useMemo } from "react";
import {
  createCrowdMurmur,
  generateCrowdSnippets,
  formatCrowdMurmur,
  createSampleMurmur as _createSampleMurmur,
  type CrowdMurmur as _CrowdMurmur,
  type CrowdMood as _CrowdMood,
  type CrowdSnippet as _CrowdSnippet,
} from "@/services/ai/crowdMurmurGenerator";

export interface CrowdMurmurGeneratorModalProps {
  className?: string;
}

export function CrowdMurmurGeneratorModal({ className }: CrowdMurmurGeneratorModalProps) {
  const [location, setLocation] = useState("Marktplatz");
  const [mood, setMood] = useState<_CrowdMood>("festive");
  const [timeOfDay, setTimeOfDay] = useState<_CrowdMurmur["timeOfDay"]>("morning");
  const [seed, setSeed] = useState(42);
  const [snippetCount, setSnippetCount] = useState(10);

  const murmur = useMemo(() => createCrowdMurmur(location, mood, timeOfDay, seed), [location, mood, timeOfDay, seed]);
  const snippets = useMemo(() => generateCrowdSnippets(murmur, snippetCount), [murmur, snippetCount]);

  const moodLabels: Record<_CrowdMood, string> = {
    festive: "🎉 Festlich",
    tense: "⚡ Angespannt",
    reverent: "🙏 Ehrfürchtig",
    hostile: "😡 Feindselig",
    neutral: "😐 Neutral",
    panic: "😱 Panisch",
    mourning: "😢 Trauernd",
    celebration: "🎊 Feiernd",
  };

  const timeLabels: Record<_CrowdMurmur["timeOfDay"], string> = {
    dawn: "🌅 Morgendämmerung",
    morning: "☀️ Vormittag",
    noon: "☀️ Mittag",
    afternoon: "🌤️ Nachmittag",
    evening: "🌆 Abend",
    night: "🌙 Nacht",
  };

  return (
    <div
      className={className}
      data-testid="crowd-murmur-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        👥 Menschenmengen-Gemurmel & Hofklatsch-Generator
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Seed: {seed} · ID: {murmur.id} · Lautstärke: {murmur.overallVolume}%
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 150 }}>
          Ort
          <input value={location} onChange={e => setLocation(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 140 }}>
          Stimmung
          <select value={mood} onChange={e => setMood(e.target.value as _CrowdMood)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}>
            <option value="festive">🎉 Festlich</option>
            <option value="tense">⚡ Angespannt</option>
            <option value="reverent">🙏 Ehrfürchtig</option>
            <option value="hostile">😡 Feindselig</option>
            <option value="neutral">😐 Neutral</option>
            <option value="panic">😱 Panisch</option>
            <option value="mourning">😢 Trauernd</option>
            <option value="celebration">🎊 Feiernd</option>
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 140 }}>
          Tageszeit
          <select value={timeOfDay} onChange={e => setTimeOfDay(e.target.value as _CrowdMurmur["timeOfDay"])} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}>
            <option value="dawn">🌅 Morgendämmerung</option>
            <option value="morning">☀️ Vormittag</option>
            <option value="noon">☀️ Mittag</option>
            <option value="afternoon">🌤️ Nachmittag</option>
            <option value="evening">🌆 Abend</option>
            <option value="night">🌙 Nacht</option>
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Seed
          <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Snippets
          <input type="number" value={snippetCount} onChange={e => setSnippetCount(clamp(Number(e.target.value), 1, 30))} min="1" max="30" style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📊 MENGEN-ÜBERSICHT
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 10, fontSize: 11 }}>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <strong>Ort:</strong> {murmur.location}
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <strong>Stimmung:</strong> {moodLabels[murmur.mood]}
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <strong>Zeit:</strong> {timeLabels[murmur.timeOfDay]}
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <strong>Gesamt-Lautstärke:</strong> {murmur.overallVolume}%
          </div>
          {murmur.dominantTopic && (
            <div style={{ padding: 8, border: "1px solid var(--accent)", borderRadius: 4, background: "rgba(var(--accent-rgb),0.1)" }}>
              <strong>🎯 Dominantes Thema:</strong> {murmur.dominantTopic}
            </div>
          )}
        </div>
      </details>

      {murmur.layers.map((layer, layerIndex) => (
        <details key={layer.id} style={{ marginBottom: 12 }} open={layerIndex === 0}>
          <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
            {layer.name.toUpperCase()} — {layer.volume}% Lautstärke · {layer.content.length} Einträge · Dichte: {layer.density}/m²
          </summary>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
            <div style={{ display: "flex", gap: 10, fontSize: 10, color: "var(--muted)" }}>
              <span>Volumen: <span style={{ color: "var(--fg)" }}>{"█".repeat(Math.round(layer.volume / 10))}</span></span>
              <span>Dichte: {layer.density} Pers./m²</span>
            </div>
            {layer.content.slice(0, 10).map((content, i) => (
              <div key={i} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
                <code style={{ whiteSpace: "pre-wrap", fontSize: 10 }}>"{content}"</code>
              </div>
            ))}
            {layer.content.length > 10 && (
              <div style={{ padding: 6, color: "var(--muted)", fontSize: 10, textAlign: "center" }}>
                ... und {layer.content.length - 10} weitere
              </div>
            )}
          </div>
        </details>
      ))}

      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📝 GENERIERTE SNIPPETS ({snippets.length})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {snippets.map((snippet, i) => (
            <div key={i} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: 10 }}>
                [{snippet.layer.toUpperCase()}]
              </span>
              <span style={{ flex: 1 }}>"{snippet.text}"</span>
              <span style={{ color: "var(--muted)", fontSize: 10 }}>
                {moodLabels[snippet.mood]}
              </span>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📋 FORMATIERTE AUSGABE
        </summary>
        <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 9, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)" }}>
          {formatCrowdMurmur(murmur)}
        </pre>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📚 3-SCHICHTEN-DIALOGMATRIX ERKLÄRUNG
        </summary>
        <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, color: "var(--fg)" }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Vordergrund (Foreground):</strong> Direkte Rufe, Händler-Rufe, Ansprache an Protagonisten.
            Höchste Lautstärke, direkte Interaktion möglich.
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Mittelgrund (Middleground):</strong> Geflüsterter Klatsch, Gerüchte über Politik/Heldin.
            Mittlere Lautstärke, Weltbau-Informationen.
          </div>
          <div>
            <strong>Hintergrund (Background):</strong> Rhythmischer Teppich: Lachen, Feilschen, Becherklappern, Schritte.
            Niedrigste Lautstärke, Atmosphäre.
          </div>
        </div>
      </details>
    </div>
  );
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}