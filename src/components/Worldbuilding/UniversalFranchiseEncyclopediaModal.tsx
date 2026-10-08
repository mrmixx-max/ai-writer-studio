// UniversalFranchiseEncyclopediaModal (WP 120.2 UI, Meilenstein 58.0 / v7.0.0)
import { useState, useMemo } from "react";
import {
  linkifyManuscript,
  EPOCHS,
  CATEGORIES,
  buildTaxonomy,
  buildCompanionBook,
  createSampleEncyclopedia,
  createSampleCompanionBook,
} from "@/services/worldbuilding/universalFranchiseEncyclopedia";

export interface UniversalFranchiseEncyclopediaModalProps {
  className?: string;
}

const DEFAULT_MANUSCRIPT =
  "Im Schöpfungszeitalter erhob sich das Haus Falkenstein über die Falkenklamm, " +
  "und die Runenkunst floss aus dem Aetherquell. Als die Schlacht von Falkenstein " +
  "über die Aschenmark zog, zerbrach der Krieg der zwei Kronen das Reich, und das " +
  "Kronjuwel von Falkenstein ging an die Kirche des Ersten Lichts verloren.";

export function UniversalFranchiseEncyclopediaModal({
  className,
}: UniversalFranchiseEncyclopediaModalProps) {
  const [seed, setSeed] = useState(42);
  const [text, setText] = useState(DEFAULT_MANUSCRIPT);

  const encyclopedia = useMemo(() => createSampleEncyclopedia(), []);

  const linkified = useMemo(
    () => linkifyManuscript(text, encyclopedia),
    [text, encyclopedia],
  );

  const taxonomy = useMemo(
    () => buildTaxonomy([...EPOCHS], [...CATEGORIES]),
    [],
  );

  const companion = useMemo(
    () => buildCompanionBook(encyclopedia, seed),
    [encyclopedia, seed],
  );

  const inputStyle = {
    width: "100%",
    marginTop: 4,
    padding: "4px 8px",
    fontSize: 11,
    background: "var(--panel)",
    color: "var(--fg)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    fontFamily: "var(--font-mono)",
  } as const;

  const cellStyle = {
    display: "flex",
    justifyContent: "space-between",
    padding: 6,
    border: "1px solid var(--border)",
    borderRadius: 4,
    background: "var(--panel)",
  } as const;

  return (
    <div
      className={className}
      data-testid="franchise-encyclopedia-modal"
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
        📖 Universelle Franchise-Enzyklopädie (Silmarillion)
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {encyclopedia.length} Einträge · {EPOCHS.length} Epochen ·{" "}
        {CATEGORIES.length} Kategorien · Seed {seed}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
        <button
          onClick={() => {
            const sample = createSampleCompanionBook();
            setSeed(42);
            setText(DEFAULT_MANUSCRIPT);
            void sample;
          }}
          style={{
            alignSelf: "flex-end",
            padding: "6px 12px",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            cursor: "pointer",
            color: "var(--fg)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
          }}
        >
          🎲 BEISPIEL LADEN
        </button>
      </div>

      <label
        style={{
          display: "block",
          fontSize: 11,
          color: "var(--muted)",
          marginBottom: 12,
        }}
      >
        Manuskript-Text (Klartext oder [[Term]]-Verweise)
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
        />
      </label>

      <details style={{ marginBottom: 12 }} open>
        <summary
          style={{
            fontSize: 11,
            color: "var(--accent)",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          🔗 WIKI-VERLINKER ({linkified.links.length} Backlinks)
        </summary>
        <pre
          style={{
            marginTop: 8,
            padding: 10,
            border: "1px solid var(--border)",
            borderRadius: 4,
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            background: "var(--panel)",
            lineHeight: 1.6,
          }}
        >
          {linkified.linkedText}
        </pre>
        <div
          style={{
            marginTop: 8,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            fontSize: 11,
          }}
        >
          {linkified.links.map((link, i) => (
            <div key={i} style={cellStyle}>
              <span style={{ color: "var(--accent)" }}>{link.term}</span>
              <span style={{ color: "var(--muted)", fontSize: 10 }}>
                #{link.targetId} · {link.category}
              </span>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary
          style={{
            fontSize: 11,
            color: "var(--accent)",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          🗂️ TAXONOMIE &amp; EPOCHEN ({taxonomy.crossLinks.length} Querverbindungen)
        </summary>
        <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
          <div style={{ marginBottom: 6 }}>
            <strong style={{ color: "var(--accent)" }}>Epochen:</strong>{" "}
            {taxonomy.epochs.join(" · ")}
          </div>
          <div style={{ marginBottom: 6 }}>
            <strong style={{ color: "var(--accent)" }}>Kategorien:</strong>{" "}
            {taxonomy.categories.join(" · ")}
          </div>
        </div>
        <div
          style={{
            marginTop: 8,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            fontSize: 11,
          }}
        >
          {taxonomy.crossLinks.map((cross, i) => (
            <div key={i} style={cellStyle}>
              <span>{cross}</span>
            </div>
          ))}
        </div>
      </details>

      <details>
        <summary
          style={{
            fontSize: 11,
            color: "var(--accent)",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          📚 BEGLEITBAND ({companion.pageCount} Seiten)
        </summary>
        <div
          style={{
            marginTop: 8,
            padding: 10,
            border: "1px solid var(--border)",
            borderRadius: 4,
            background: "var(--panel)",
          }}
        >
          <div style={{ fontSize: 13, color: "var(--accent)", fontWeight: 700 }}>
            {companion.title}
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
            {companion.index.length} Registereinträge · geschätzt {companion.pageCount} Seiten
          </div>
        </div>
        <div
          style={{
            marginTop: 8,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontSize: 11,
          }}
        >
          {companion.sections.map((section, i) => (
            <div
              key={i}
              style={{
                padding: 10,
                border: "1px solid var(--border)",
                borderRadius: 4,
                background: "var(--panel)",
              }}
            >
              <div style={{ color: "var(--accent)", fontWeight: 700 }}>
                {section.heading} ({section.entries.length})
              </div>
              <div style={{ marginTop: 6, lineHeight: 1.6 }}>
                {section.entries.length === 0 ? (
                  <span style={{ color: "var(--muted)" }}>— keine Einträge —</span>
                ) : (
                  section.entries.map((entry, j) => (
                    <div key={j} style={{ marginBottom: 4 }}>
                      {entry}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: "var(--muted)" }}>
          Register: {companion.index.join(", ")}
        </div>
      </details>
    </div>
  );
}
