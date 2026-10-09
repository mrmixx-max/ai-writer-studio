// ErgodicFootnoteLabyrinthModal (WP 124.2 UI, Meilenstein 60.0 / v7.2.0)
import { useState, useMemo } from "react";
import {
  COMMENTATORS,
  buildFootnoteLabyrinth,
  assignCommentators,
  generateReadingPaths,
  createSampleFootnoteNode,
  createSampleReadingPath,
} from "@/services/dramaturgy/ergodicFootnoteLabyrinth";

export interface ErgodicFootnoteLabyrinthModalProps {
  className?: string;
}

export function ErgodicFootnoteLabyrinthModal({ className }: ErgodicFootnoteLabyrinthModalProps) {
  const [seed, setSeed] = useState(1242);

  const labyrinth = useMemo(() => buildFootnoteLabyrinth(seed), [seed]);
  const annotated = useMemo(() => assignCommentators(labyrinth, seed), [labyrinth, seed]);
  const paths = useMemo(() => generateReadingPaths(annotated, seed), [annotated, seed]);
  const sampleNode = useMemo(() => createSampleFootnoteNode(), []);
  const samplePath = useMemo(() => createSampleReadingPath(), []);

  const countNodes = (node: typeof labyrinth): number => {
    let count = 0;
    const walk = (n: typeof labyrinth): void => {
      for (const child of n.children) {
        count++;
        walk(child);
      }
    };
    walk(node);
    return count;
  };

  const nodeCount = countNodes(labyrinth);

  return (
    <div
      className={className}
      data-testid="ergodic-footnote-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🌀 Ergodisches Fußnoten-Labyrinth-Studio
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Seed {seed} · {nodeCount} Fußnoten-Knoten · {paths.length} Lese-Pfade
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 200 }}>
          Seed (Zufalls-Startwert)
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
          📐 FUSSNOTEN-HIERARCHIE
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          <div style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <span style={{ color: "var(--accent)" }}>Wurzel:</span> {labyrinth.label}
            <span style={{ fontSize: 10, color: "var(--muted)" }}> · {labyrinth.content}</span>
          </div>
          {labyrinth.children.map((fn) => (
            <div key={fn.id} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <span style={{ color: "var(--accent)" }}>[{fn.label}]</span> {fn.content}
              {fn.commentator && (
                <span style={{ fontSize: 10, color: "var(--muted)" }}> · Kommentar: {fn.commentator}</span>
              )}
              {fn.children.length > 0 && (
                <div style={{ marginLeft: 16, marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                  {fn.children.map((child) => (
                    <div key={child.id} style={{ fontSize: 10, color: "var(--muted)" }}>
                      ↳ [{child.label}] {child.content}
                      {child.commentator && <span> · {child.commentator}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎭 KOMMENTATOREN
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
          {COMMENTATORS.map((c) => (
            <div key={c.id} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <div style={{ fontWeight: 700, color: "var(--accent)" }}>{c.name}</div>
              <div style={{ marginTop: 2 }}>{c.description}</div>
              <div style={{ marginTop: 2, fontSize: 10, color: "var(--muted)" }}>Ton: {c.tone}</div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🛤️ LESEPFADER
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
          {paths.map((p) => (
            <div key={p.id} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <div style={{ fontWeight: 700, color: "var(--accent)" }}>{p.label}</div>
              <div style={{ marginTop: 2 }}>{p.description}</div>
              <div style={{ marginTop: 4, fontSize: 10, color: "var(--muted)" }}>
                Sprungmarken: {p.steps.join(" → ")}
              </div>
            </div>
          ))}
        </div>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📋 BEISPIEL-DATEN
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ fontWeight: 700, color: "var(--accent)" }}>Beispiel-Labyrinth (Seed 1242)</div>
            <div style={{ marginTop: 2 }}>Wurzel: {sampleNode.label} · {sampleNode.children.length} Top-Fußnoten</div>
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ fontWeight: 700, color: "var(--accent)" }}>Beispiel-Lese-Pfad</div>
            <div style={{ marginTop: 2 }}>{samplePath.label}</div>
            <div style={{ marginTop: 2, fontSize: 10, color: "var(--muted)" }}>
              Sprungmarken: {samplePath.steps.join(" → ")}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
