// TransmediaWorldBibleModal (WP 74.2)
//
// Interaktive Darstellung der transmedialen Franchise-Bibel.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  createSampleBible,
  exportAsMarkdown,
  getEntriesByTier,
  auditAllCollisions,
  TIER_LABELS,
  type CanonTier,
} from "@/services/worldbuilding/transmediaWorldBible";

export interface TransmediaWorldBibleModalProps {
  className?: string;
}

const TIER_COLORS: Record<CanonTier, string> = {
  core: "var(--accent)",
  prequel: "var(--success)",
  legend: "var(--warn)",
};

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: 4,
  background: "var(--panel)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 12,
} as const;

export function TransmediaWorldBibleModal({ className }: TransmediaWorldBibleModalProps) {
  const [activeTier, setActiveTier] = useState<CanonTier>("core");
  const [searchQuery, setSearchQuery] = useState("");

  const bible = useMemo(() => createSampleBible(), []);
  const entries = useMemo(() => getEntriesByTier(bible, activeTier), [bible, activeTier]);
  const collisions = useMemo(() => auditAllCollisions(bible), [bible]);

  return (
    <div
      className={className}
      data-testid="transmedia-world-bible-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🌍 Transmediale Franchise-Bibel & Kanon-Wiki
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {bible.entries.length} Einträge · {bible.cosmologyLevels.length} Kosmologie-Ebenen · {collisions.length} Kollisionen
      </div>

      {/* Kanon-Tier-Auswahl */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {(["core", "prequel", "legend"] as CanonTier[]).map((tier) => (
          <button
            key={tier}
            data-testid={`bible-tier-${tier}`}
            onClick={() => setActiveTier(tier)}
            style={{
              fontSize: 11,
              padding: "4px 12px",
              borderRadius: 4,
              cursor: "pointer",
              background: activeTier === tier ? "var(--accent)" : "var(--panel)",
              color: activeTier === tier ? "var(--bg)" : "var(--fg)",
              border: "1px solid var(--border)",
            }}
          >
            {TIER_LABELS[tier]}
          </button>
        ))}
      </div>

      {/* Suche */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Suche
        <input
          data-testid="bible-search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Einträge durchsuchen..."
          style={inputStyle}
        />
      </label>

      {/* Kanon-Einträge */}
      <div
        data-testid="bible-entries"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          KANON ({TIER_LABELS[activeTier]})
        </div>
        {entries.length === 0 ? (
          <div data-testid="bible-no-entries" style={{ color: "var(--muted)" }}>
            Keine Einträge in dieser Kanon-Stufe.
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} data-testid={`bible-entry-${entry.id}`} style={{ marginBottom: 8 }}>
              <div style={{ color: TIER_COLORS[entry.tier], fontWeight: 700 }}>{entry.title}</div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>{entry.description}</div>
            </div>
          ))
        )}
      </div>

      {/* Kosmologie */}
      <div
        data-testid="bible-cosmology"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>KOSMOLOGIE</div>
        {bible.cosmologyLevels.map((level) => (
          <div key={level.id} data-testid={`bible-cosmology-${level.id}`} style={{ marginBottom: 8 }}>
            <div style={{ color: "var(--accent)", fontWeight: 700 }}>{level.name}</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>{level.description}</div>
            <div style={{ fontSize: 9, color: "var(--muted)" }}>
              Unantastbar: {level.inviolableLaws.join(", ")}
            </div>
          </div>
        ))}
      </div>

      {/* Kollisionen */}
      <div
        data-testid="bible-collisions"
        style={{
          border: `1px solid ${collisions.length > 0 ? "var(--warn)" : "var(--success)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          KANON-KOLLISIONEN ({collisions.length})
        </div>
        {collisions.length === 0 ? (
          <div data-testid="bible-no-collisions" style={{ color: "var(--success)" }}>
            ✓ Keine Kollisionen
          </div>
        ) : (
          collisions.map((c, i) => (
            <div key={i} data-testid={`bible-collision-${i}`} style={{ marginBottom: 4 }}>
              <span style={{ color: "var(--warn)" }}>●</span> {c.entryId}: {c.conflicts.join("; ")}
            </div>
          ))
        )}
      </div>

      {/* Export */}
      <details data-testid="bible-export">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Markdown-Export
        </summary>
        <pre
          data-testid="bible-markdown"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            marginTop: 6,
            maxHeight: 200,
            overflow: "auto",
          }}
        >
          {exportAsMarkdown(bible)}
        </pre>
      </details>
    </div>
  );
}
