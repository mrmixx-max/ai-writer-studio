// DialectIsoglossWeaverModal (WP 133.1 / Meilenstein 64.0 / v7.6.0)
//
// Dialekt-Isoglossen- & Akzent-Weaver: Regionen, Isoglossen, Regionskarte,
// Dialog-Modulator und Regional-Metapher-Generator.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  DIALECT_REGIONS,
  ISOGLOSSES,
  mapDialectRegion,
  modulateDialogue,
  generateRegionalMetaphor,
  type DialogueLine,
} from "@/services/linguistics/dialectIsoglossWeaver";

export interface DialectIsoglossWeaverModalProps {
  className?: string;
}

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: 4,
  background: "var(--panel)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "4px 8px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
} as const;

const sectionStyle = {
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: 10,
  marginBottom: 14,
} as const;

const sectionTitleStyle = {
  fontSize: 11,
  color: "var(--muted)",
  marginBottom: 6,
} as const;

/** Parst 'Sprecher: Text'-Zeilen zu Dialogzeilen der gewählten Region. */
function parseDialogueLines(raw: string, regionId: string): DialogueLine[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) {
        return { speaker: "Sprecher", text: line, regionId };
      }
      const speaker = line.slice(0, idx).trim() || "Sprecher";
      const text = line.slice(idx + 1).trim();
      return { speaker, text, regionId };
    });
}

export function DialectIsoglossWeaverModal({ className }: DialectIsoglossWeaverModalProps) {
  const [seed, setSeed] = useState(42);
  const [regionId, setRegionId] = useState<string>(DIALECT_REGIONS[0].id);
  const [concept, setConcept] = useState("der Mut");
  const [dialogueText, setDialogueText] = useState(
    "Elara: Der Wind steht gut. Wir sprechen später.\nThorne: Ich brauche Geld, und die Arbeit wird schnell gehen.",
  );

  const regionMap = useMemo(() => mapDialectRegion(regionId, seed), [regionId, seed]);

  const modulation = useMemo(() => {
    const lines = parseDialogueLines(dialogueText, regionId);
    return modulateDialogue(lines, seed);
  }, [dialogueText, regionId, seed]);

  const metaphor = useMemo(
    () => generateRegionalMetaphor(regionId, concept, seed),
    [regionId, concept, seed],
  );

  return (
    <div
      className={className}
      data-testid="dialect-isogloss-modal"
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
        🗣️ Dialekt-Isoglossen- &amp; Akzent-Weaver
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {DIALECT_REGIONS.length} Regionen · {ISOGLOSSES.length} Isoglossen · Seed {seed}
      </div>

      {/* Eingaben */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>EINGABEN</div>

        <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
          Seed
          <input
            data-testid="dialect-seed-input"
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>

        <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
          Region
          <select
            data-testid="dialect-region-select"
            value={regionId}
            onChange={(e) => setRegionId(e.target.value)}
            style={inputStyle}
          >
            {DIALECT_REGIONS.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
          Konzept
          <input
            data-testid="dialect-concept-input"
            type="text"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={{ fontSize: 11, color: "var(--muted)", display: "block" }}>
          Dialogzeilen („Sprecher: Text“ je Zeile)
          <textarea
            data-testid="dialect-dialogue-input"
            value={dialogueText}
            onChange={(e) => setDialogueText(e.target.value)}
            rows={4}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </label>
      </div>

      {/* DIALEKTREGIONEN */}
      <div data-testid="dialect-regions" style={sectionStyle}>
        <div style={sectionTitleStyle}>DIALEKTREGIONEN ({DIALECT_REGIONS.length})</div>
        {DIALECT_REGIONS.map((region) => (
          <div
            key={region.id}
            data-testid={`dialect-region-${region.id}`}
            style={{ marginBottom: 8 }}
          >
            <div style={{ color: "var(--accent)", fontWeight: 700 }}>{region.name}</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{region.description}</div>
            <div style={{ fontSize: 11 }}>
              {region.vocabulary.length} Vokabeln · {region.sentencePatterns.length} Muster ·{" "}
              {region.metaphors.length} Bilder
            </div>
          </div>
        ))}
      </div>

      {/* ISOGLOSSEN */}
      <div data-testid="dialect-isoglosses" style={sectionStyle}>
        <div style={sectionTitleStyle}>ISOGLOSSEN ({ISOGLOSSES.length})</div>
        {ISOGLOSSES.map((iso) => (
          <div key={iso.id} data-testid={`dialect-isogloss-${iso.id}`} style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>
              {iso.name} <span style={{ color: "var(--muted)" }}>· {iso.marker}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{iso.description}</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>
              Regionen: {iso.regions.join(", ")}
            </div>
          </div>
        ))}
      </div>

      {/* REGIONSKARTE */}
      <div data-testid="dialect-region-map" style={sectionStyle}>
        <div style={sectionTitleStyle}>REGIONSKARTE</div>
        <div style={{ marginBottom: 6 }}>
          Region: <span style={{ color: "var(--accent)" }}>{regionMap.region}</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
          {regionMap.description}
        </div>
        <div style={{ fontSize: 11, marginBottom: 4 }}>
          Vokabeln ({regionMap.vocabulary.length})
        </div>
        {regionMap.vocabulary.map((pair, i) => (
          <div key={i} style={{ fontSize: 11 }}>
            „{pair.standard}“ → „{pair.local}“
          </div>
        ))}
        <div style={{ fontSize: 11, margin: "6px 0 4px" }}>Satzmuster</div>
        {regionMap.patterns.map((p, i) => (
          <div key={i} style={{ fontSize: 11, color: "var(--muted)" }}>
            • {p}
          </div>
        ))}
        <div style={{ fontSize: 11, margin: "6px 0 4px" }}>Bildwelt</div>
        {regionMap.metaphors.map((m, i) => (
          <div key={i} style={{ fontSize: 11, color: "var(--muted)" }}>
            • {m}
          </div>
        ))}
      </div>

      {/* DIALOG-MODULATOR */}
      <div data-testid="dialect-modulator" style={sectionStyle}>
        <div style={sectionTitleStyle}>DIALOG-MODULATOR</div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
          {modulation.description}
        </div>
        {modulation.lines.length === 0 ? (
          <div style={{ fontSize: 11, color: "var(--muted)" }}>Keine Dialogzeilen.</div>
        ) : (
          modulation.lines.map((line, i) => (
            <div key={i} data-testid={`dialect-modulated-line-${i}`} style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>{line.speaker}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>Original: {line.original}</div>
              <div style={{ fontSize: 11 }}>Moduliert: {line.modulated}</div>
              {line.changes.map((change, j) => (
                <div key={j} style={{ fontSize: 10, color: "var(--muted)" }}>
                  · {change}
                </div>
              ))}
            </div>
          ))
        )}
        <div data-testid="dialect-readability" style={{ fontSize: 11, marginTop: 6 }}>
          Lesbarkeit: {modulation.readabilityScore}/100
        </div>
      </div>

      {/* REGIONAL-METAPHER */}
      <div data-testid="dialect-metaphor" style={sectionStyle}>
        <div style={sectionTitleStyle}>REGIONAL-METAPHER</div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
          Region: {metaphor.region} · Konzept: {metaphor.concept}
        </div>
        <div data-testid="dialect-metaphor-text" style={{ color: "var(--accent)", marginBottom: 6 }}>
          {metaphor.metaphor}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>{metaphor.explanation}</div>
      </div>
    </div>
  );
}
