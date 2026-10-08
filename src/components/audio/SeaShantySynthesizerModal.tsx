// SeaShantySynthesizerModal (WP 108.2 UI)
import { useState, useMemo } from "react";
import {
  analyzeShanty,
  SHANTY_GENRES,
  type ShantyGenreId,
} from "@/services/audio/seaShantySynthesizer";

export interface SeaShantySynthesizerModalProps {
  className?: string;
}

export function SeaShantySynthesizerModal({ className }: SeaShantySynthesizerModalProps) {
  const [genre, setGenre] = useState<ShantyGenreId>("halyard");
  const [verseCount, setVerseCount] = useState(4);
  const [seed, setSeed] = useState(42);

  const report = useMemo(() => analyzeShanty(genre, verseCount, seed), [genre, verseCount, seed]);
  const shanty = report.shanty;

  return (
    <div
      className={className}
      data-testid="sea-shanty-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎶 Shantychor- &amp; Spill-Arbeitslied-Synthesizer
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {shanty.title} · {shanty.genre.timeSignature} · {shanty.genre.tempoBpm} BPM · {shanty.durationSeconds}s
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 200 }}>
          Shanty-Gattung
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value as ShantyGenreId)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          >
            {SHANTY_GENRES.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 80 }}>
          Verse
          <input
            type="number"
            min={1}
            max={8}
            value={verseCount}
            onChange={(e) => setVerseCount(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 80 }}>
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🧭 GATTUNG: {shanty.genre.name}
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Zweck:</strong> {shanty.genre.purpose}</div>
          <div><strong>Takt:</strong> {shanty.genre.timeSignature} · {shanty.genre.tempoBpm} BPM · {shanty.genre.mode === "moll" ? "Moll" : "Dur"}</div>
          <div><strong>Akzente auf Zählzeit:</strong> {shanty.genre.accentBeats.join(" und ")}</div>
          <div><strong>Schlagdauer:</strong> {shanty.beatMs} ms · Gesamtschläge {report.totalBeats}</div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📜 VERS &amp; KEHRREIM ({shanty.verses.length})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {shanty.verses.map((v, i) => (
            <div key={i} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
              <div><span style={{ color: "var(--muted)", fontSize: 10 }}>Shantyman:</span> {v.shantyman}</div>
              <div style={{ color: "var(--accent)", fontWeight: 700, marginTop: 2 }}>Chor: {v.chorus}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>Fachbegriff: {v.term}</div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🥁 TAKTSCHLAG-SCHEMA
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 40 }}>
            {shanty.accentPattern.map((a, i) => (
              <div
                key={i}
                title={a ? `Zählzeit ${i + 1} — betont` : `Zählzeit ${i + 1}`}
                style={{ width: 28, height: a ? 36 : 16, background: a ? "var(--accent)" : "var(--muted)", borderRadius: 3 }}
              />
            ))}
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: "var(--muted)" }}>
            Muster [{shanty.accentPattern.join(", ")}] — 1 = betonte Zählzeit für den Chor-Zug
          </div>
        </div>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔊 WEBAUDIO-RHYTHMUS-PLAYER
        </summary>
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Taktschlag:</strong> {report.patch.clickFrequencyHz} Hz · Abklingen {report.patch.clickDecayMs} ms</div>
          <div><strong>Chor-Pegel:</strong> {report.patch.chorusGain} · <strong>Vorsänger:</strong> {report.patch.shantymanGain}</div>
          <div><strong>Grundton:</strong> {report.patch.tonicHz} Hz · Tonleiter [{report.patch.scaleIntervals.join(", ")}]</div>
          <div style={{ marginTop: 4, fontSize: 10, color: "var(--muted)", fontStyle: "italic" }}>{report.patch.instruction}</div>
        </div>
      </details>
    </div>
  );
}
