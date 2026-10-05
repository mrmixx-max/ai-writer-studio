// LoreMythGenerator (WP 57.2)
//
// Erzeugt In-Universe-Folklore: Orakelsprüche, Tavernenlieder, Schöpfungsmythen
// und Schlachtenchroniken — mit Metrum-Analyse und Epigraph-Export.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  generateLore,
  analyzeMeter,
  toEpigraph,
  KIND_LABELS,
  type LoreKind,
  type Meter,
  type RhymeScheme,
} from "@/services/ai/loreMythGenerator";
import { formatEpigraph } from "@/services/typesetting/epigraphAnthology";

export interface LoreMythGeneratorProps {
  /** Vorbefülltes Thema. */
  initialSubject?: string;
  className?: string;
}

const KINDS: { value: LoreKind; label: string }[] = [
  { value: "oracle", label: "Orakelspruch" },
  { value: "tavern-song", label: "Tavernenlied" },
  { value: "creation-myth", label: "Schöpfungsmythos" },
  { value: "battle-chronicle", label: "Schlachtenchronik" },
];

const METERS: { value: Meter; label: string }[] = [
  { value: "trochee", label: "Trochäus" },
  { value: "iambus", label: "Jambus" },
  { value: "alliterative", label: "Stabreim" },
];

const RHYMES: { value: RhymeScheme; label: string }[] = [
  { value: "AABB", label: "AABB (Paarreim)" },
  { value: "ABAB", label: "ABAB (Kreuzreim)" },
  { value: "none", label: "ohne Reim" },
];

export function LoreMythGenerator({
  initialSubject = "dem gefallenen Reich",
  className,
}: LoreMythGeneratorProps) {
  const [kind, setKind] = useState<LoreKind>("oracle");
  const [subject, setSubject] = useState(initialSubject);
  const [stanzas, setStanzas] = useState(3);
  const [meterOverride, setMeterOverride] = useState<Meter | "">("");
  const [rhymeOverride, setRhymeOverride] = useState<RhymeScheme | "">("");
  const [epigraphChapter, setEpigraphChapter] = useState(1);

  const piece = useMemo(
    () =>
      generateLore({
        kind,
        subject,
        stanzas,
        meter: meterOverride || undefined,
        rhymeScheme: rhymeOverride || undefined,
      }),
    [kind, subject, stanzas, meterOverride, rhymeOverride],
  );
  const meter = useMemo(() => analyzeMeter(piece.text), [piece.text]);
  const epigraph = useMemo(
    () => toEpigraph(piece, { chapter: epigraphChapter, fleuron: true }),
    [piece, epigraphChapter],
  );
  const epigraphText = useMemo(
    () => (epigraph ? formatEpigraph(epigraph) : ""),
    [epigraph],
  );

  const selectStyle = {
    marginLeft: 6,
    padding: "2px 6px",
    background: "var(--panel)",
    color: "var(--fg)",
    border: "1px solid var(--border)",
    borderRadius: 3,
    fontSize: 11,
  } as const;

  return (
    <div
      className={className}
      data-testid="lore-myth-generator"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        📜 Mythen- & Prophezeiungs-Generator
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {piece.lineCount} Verse · {piece.wordCount} Wörter · {KIND_LABELS[piece.kind]}
      </div>

      {/* Textsorte */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>TEXTSORTE</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {KINDS.map((k) => (
            <button
              key={k.value}
              data-testid={`lore-kind-${k.value}`}
              onClick={() => setKind(k.value)}
              aria-pressed={kind === k.value}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 4,
                cursor: "pointer",
                background: kind === k.value ? "var(--accent)" : "var(--panel)",
                color: kind === k.value ? "var(--bg)" : "var(--fg)",
                border: "1px solid var(--border)",
              }}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {/* Thema */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>
        Thema
        <input
          data-testid="lore-subject-input"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          style={{
            display: "block",
            width: "100%",
            marginTop: 4,
            background: "var(--panel)",
            color: "var(--fg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: "4px 8px",
            fontSize: 12,
          }}
        />
      </label>

      {/* Regler */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", margin: "10px 0" }}>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>
          Strophen
          <input
            data-testid="lore-stanzas-input"
            type="number"
            min={1}
            max={8}
            value={stanzas}
            onChange={(e) => setStanzas(Number(e.target.value) || 3)}
            style={{
              width: 50,
              marginLeft: 6,
              background: "var(--panel)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "2px 5px",
              fontSize: 11,
            }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>
          Metrum
          <select
            data-testid="lore-meter-select"
            value={meterOverride}
            onChange={(e) => setMeterOverride(e.target.value as Meter | "")}
            style={selectStyle}
          >
            <option value="">Standard</option>
            {METERS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>
          Reim
          <select
            data-testid="lore-rhyme-select"
            value={rhymeOverride}
            onChange={(e) => setRhymeOverride(e.target.value as RhymeScheme | "")}
            style={selectStyle}
          >
            <option value="">Standard</option>
            {RHYMES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Titel + Dichtung */}
      <div data-testid="lore-output" style={{ marginBottom: 14 }}>
        <div
          data-testid="lore-title"
          style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", marginBottom: 6 }}
        >
          {piece.title}
        </div>
        <div
          data-testid="lore-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 12,
            fontSize: 12,
            lineHeight: 1.9,
            whiteSpace: "pre-wrap",
          }}
        >
          {piece.text}
        </div>
      </div>

      {/* Metrum-Analyse */}
      <div
        data-testid="lore-meter-analysis"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>METRUM-ANALYSE</div>
        <div>
          Verse: <strong data-testid="lore-meter-lines">{meter.lineCount}</strong> · Ø Silben:{" "}
          <strong data-testid="lore-meter-syllables">{meter.avgSyllables}</strong>
        </div>
        <div style={{ marginTop: 4 }}>
          Erkannt:{" "}
          <strong data-testid="lore-meter-detected">{meter.detectedMeter ?? "—"}</strong> · Reim:{" "}
          <strong data-testid="lore-rhyme-detected">{meter.detectedRhyme}</strong> (
          {Math.round(meter.rhymeRatio * 100)}%)
        </div>
      </div>

      {/* Epigraph-Export */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          EPIGRAPH-EXPORT (WP 52.2)
        </div>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>
          Kapitel
          <input
            data-testid="lore-epigraph-chapter"
            type="number"
            min={1}
            value={epigraphChapter}
            onChange={(e) => setEpigraphChapter(Number(e.target.value) || 1)}
            style={{
              width: 50,
              marginLeft: 6,
              background: "var(--panel)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "2px 5px",
              fontSize: 11,
            }}
          />
        </label>
        <div
          data-testid="lore-epigraph"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 12,
            marginTop: 8,
            fontSize: 11,
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
            fontStyle: "italic",
          }}
        >
          {epigraphText || "—"}
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
          Als fiktiver In-Universe-Text markiert — der Public-Domain-Wächter greift nicht.
        </div>
      </div>
    </div>
  );
}
