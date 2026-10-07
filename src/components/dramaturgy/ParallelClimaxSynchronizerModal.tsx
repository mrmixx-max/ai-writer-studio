// ParallelClimaxSynchronizerModal (WP 93.1 UI)
import { useState, useMemo } from "react";
import {
  createParallelClimax,
  formatSyncProfile,
  createSampleProfile as _createSampleProfile,
  type SyncProfile as _SyncProfile,
} from "@/services/dramaturgy/parallelClimaxSynchronizer";

export interface ParallelClimaxSynchronizerModalProps {
  className?: string;
}

export function ParallelClimaxSynchronizerModal({ className }: ParallelClimaxSynchronizerModalProps) {
  const [sceneName, setSceneName] = useState("Die Schlacht um Eldoria");
  const [strandCount, setStrandCount] = useState(3);
  const [seed, setSeed] = useState(42);

  const profile = useMemo(() => createParallelClimax(sceneName, strandCount, seed), [sceneName, strandCount, seed]);

  return (
    <div
      className={className}
      data-testid="parallel-climax-modal"
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
        🎬 Paralleler Klimax- & Schnitt-Synchronizer
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Seed: {seed} · ID: {profile.id} · Stränge: {profile.strands.length} · Match-Cuts: {profile.matchCuts.length}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 200 }}>
          Szenen-Name
          <input value={sceneName} onChange={e => setSceneName(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Stränge
          <input type="number" value={strandCount} onChange={e => setStrandCount(Math.min(4, Math.max(2, Number(e.target.value) || 2)))} min="2" max="4" style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Seed
          <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary data-testid="summary-sync-profil" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎬 SYNCHRONISATIONS-PROFIL
        </summary>
        <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 9, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)", maxHeight: 500, overflow: "auto" }}>
          {formatSyncProfile(profile)}
        </pre>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-strand-details" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📍 STRANG-DETAILS ({profile.strands.length})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8, fontSize: 11 }}>
          {profile.strands.map((strand, i) => (
            <details key={i} style={{ border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }} open={i === 0}>
              <summary style={{ padding: 8, cursor: "pointer", fontWeight: 700, color: "var(--accent)" }}>
                STRANG {strand.label}: {strand.name}
              </summary>
              <div style={{ padding: 8, fontSize: 10 }}>
                <div style={{ marginBottom: 4 }}>
                  <strong>Ort:</strong> {strand.location} | <strong>Figuren:</strong> {strand.characters.join(", ")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {strand.beats.map(beat => {
                    const tensionBar = "█".repeat(Math.round(beat.tension / 2));
                    return (
                      <div key={beat.act} style={{ display: "flex", gap: 8, fontSize: 9 }}>
                        <span style={{ minWidth: 60 }}>Akt {beat.act}</span>
                        <span style={{ minWidth: 100 }}>{beat.beatType.toUpperCase()}</span>
                        <span style={{ minWidth: 80 }}>{beat.timestamp.toFixed(1)}%</span>
                        <span style={{ color: "var(--accent)" }}>{tensionBar}</span>
                        <span>{beat.description}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </details>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-match-cuts" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          ✂️ MATCH-CUTS ({profile.matchCuts.length})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8, fontSize: 10 }}>
          {profile.matchCuts.map((cut, i) => (
            <div key={i} style={{ padding: 8, border: "1px solid var(--accent)", borderRadius: 4, background: "rgba(var(--accent-rgb),0.1)" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 700, color: "var(--accent)" }}>{cut.timestamp.toFixed(1)}%</span>
                <span>{cut.fromStrand} → {cut.toStrand}</span>
              </div>
              <div style={{ fontSize: 9, color: "var(--muted)", marginBottom: 4 }}>
                Trigger: "{cut.trigger}"
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, whiteSpace: "pre-wrap" }}>
                {cut.transitionText}
              </div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-beispiel-szenen" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎲 BEISPIEL-SZENEN
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            "Die Schlacht um Eldoria",
            "Angriff auf die Sternenfestung",
            "Showdown in der Zitadelle",
            "Flucht aus der Zitadelle",
            "Duell der Erzfeinde",
            "Letzter Stand auf der Brücke",
          ].map((name, i) => (
            <button
              key={i}
              onClick={() => { setSceneName(name); setStrandCount(3); setSeed(i + 20); }}
              style={{
                padding: "6px 10px",
                textAlign: "left",
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                cursor: "pointer",
                color: "var(--fg)",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
              }}
            >
              {name}
            </button>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-strand-anzahl" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📊 STRANG-ANZAHL & BEAT-STRUKTUR
        </summary>
        <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, color: "var(--fg)" }}>
          <div style={{ marginBottom: 8 }}>
            <strong>2–4 parallele Handlungsstränge:</strong> A, B, C, D
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>6 dramaturgische Beats pro Strang:</strong>
          </div>
          <div style={{ marginLeft: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 8 }}>
            <div>1. Setup</div>
            <div>2. Complication</div>
            <div>3. Crisis</div>
            <div>4. Dark Night</div>
            <div>5. CLIMAX</div>
            <div>6. Resolution</div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Spannungs-Wellen-Abgleich:</strong> Alle Stränge erreichen Krise/Tiefpunkt/Klimax synchronisiert.
          </div>
          <div>
            <strong>Match-Cuts:</strong> Filmische Übergänge via Trigger (fallendes Schwert, zerspringender Kristall, etc.)
          </div>
        </div>
      </details>

      <details>
        <summary data-testid="summary-kinematic-hooks" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎥 KINEMATISCHE MATCH-CUT-HOOKS
        </summary>
        <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, color: "var(--fg)" }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Trigger-Beispiele:</strong>
          </div>
          <div style={{ marginLeft: 16, marginBottom: 4 }}>
            • ein fallendes Schwert<br/>
            • ein zerspringender Kristall<br/>
            • ein letzter Atemzug<br/>
            • ein aufleuchtendes Signal<br/>
            • ein zerspringendes Fenster
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Übergangs-Templates:</strong>
          </div>
          <div style={{ marginLeft: 16, fontFamily: "var(--font-mono)", fontSize: 9 }}>
            "TRIGGER – Schnitt – STRAND: ACTION"<br/>
            "TRIGGER klirrte zu Boden – Schnitt – In LOCATION ACTION"<br/>
            "Mit dem Klang von TRIGGER – harter Schnitt – STRAND ACTION"
          </div>
        </div>
      </details>
    </div>
  );
}