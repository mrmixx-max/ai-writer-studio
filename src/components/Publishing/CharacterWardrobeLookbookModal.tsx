// CharacterWardrobeLookbookModal (WP 123.2 UI, Meilenstein 59.0 / v7.1.0)
//
// Interaktives Garderoben- & Kostüm-Lookbook: Garderoben-Raster,
// Kontinuitäts-Wächter über Kapitel hinweg und Lookbook-Export mit SVG-Cover.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  OUTFIT_CATEGORIES,
  checkWardrobeContinuity,
  buildLookbook,
  createSampleWardrobeEntry,
  createSampleLookbook,
} from "@/services/publishing/characterWardrobeLookbook";
import type { GarmentCondition, WardrobeEntry } from "@/services/publishing/characterWardrobeLookbook";

export interface CharacterWardrobeLookbookModalProps {
  className?: string;
}

const CONDITIONS: readonly GarmentCondition[] = ["pristine", "worn", "damaged", "torn"];

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: 4,
  background: "var(--bg)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 12,
} as const;

const labelStyle = {
  fontSize: 11,
  color: "var(--muted)",
  display: "block",
  marginBottom: 12,
} as const;

const sectionStyle = {
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: 10,
  marginBottom: 14,
  fontSize: 12,
} as const;

const sectionLabelStyle = {
  fontSize: 12,
  color: "var(--muted)",
  marginBottom: 6,
  fontFamily: "var(--font-mono)",
} as const;

export function CharacterWardrobeLookbookModal({ className }: CharacterWardrobeLookbookModalProps) {
  const [seed, setSeed] = useState(42);
  const [characterId, setCharacterId] = useState("isolde");

  // Deterministisch aufgebaute Garderoben-Einträge über mehrere Kapitel.
  // Ein absichtlicher Kontinuitäts-Bruch ("Umhang" torn → pristine) macht den
  // Wächter sichtbar; alle übrigen Zustände wechseln höchstens in einem Schritt.
  const entries = useMemo<WardrobeEntry[]>(() => {
    const built: WardrobeEntry[] = [];
    const charId = characterId.trim() || "isolde";
    const conditionShift = ((seed % CONDITIONS.length) + CONDITIONS.length) % CONDITIONS.length;

    OUTFIT_CATEGORIES.forEach((category, ci) => {
      const chapter = ci * 2 + 1;
      const items = category.typicalItems.slice(0, 3).map((name, ii) => {
        const idx = (ci + ii + conditionShift) % CONDITIONS.length;
        return { name, color: category.id, condition: CONDITIONS[idx] };
      });
      built.push({ characterId: charId, chapter, category: category.id, items });
    });

    // Zusätzlicher Kontinuitäts-Eintrag: Umhang verfällt von torn zu pristine
    // (Warning) und ein Kettenhemd von pristine zu torn (Violation).
    built.push({
      characterId: charId,
      chapter: 2,
      category: "travel",
      items: [{ name: "Umhang", color: "grau", condition: "torn" }],
    });
    built.push({
      characterId: charId,
      chapter: 4,
      category: "travel",
      items: [{ name: "Umhang", color: "grau", condition: "pristine" }],
    });
    built.push({
      characterId: charId,
      chapter: 6,
      category: "battle",
      items: [{ name: "Kettenhemd", color: "stahl", condition: "pristine" }],
    });
    built.push({
      characterId: charId,
      chapter: 8,
      category: "battle",
      items: [{ name: "Kettenhemd", color: "stahl", condition: "torn" }],
    });

    return built;
  }, [characterId, seed]);

  const continuity = useMemo(() => checkWardrobeContinuity(entries), [entries]);

  const lookbook = useMemo(
    () => buildLookbook(characterId.trim() || "isolde", entries, seed),
    [characterId, entries, seed],
  );

  const sampleEntry = useMemo(() => createSampleWardrobeEntry(), []);
  const sampleLookbook = useMemo(() => createSampleLookbook(), []);

  return (
    <div
      className={className}
      data-testid="character-wardrobe-modal"
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
        👗 Charakter-Garderoben- &amp; Kostüm-Lookbook
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {OUTFIT_CATEGORIES.length} Kategorien · {entries.length} Einträge · {lookbook.pages} Seite(n)
      </div>

      {/* Eingaben */}
      <label style={labelStyle}>
        Charakter-ID
        <input
          data-testid="wardrobe-character-input"
          type="text"
          value={characterId}
          onChange={(e) => setCharacterId(e.target.value)}
          style={inputStyle}
        />
      </label>

      <label style={labelStyle}>
        Seed
        <input
          data-testid="wardrobe-seed-input"
          type="number"
          value={seed}
          onChange={(e) => setSeed(Number(e.target.value) || 0)}
          style={inputStyle}
        />
      </label>

      {/* GARDEROBEN-RASTER */}
      <div style={sectionStyle} data-testid="wardrobe-raster">
        <div style={sectionLabelStyle}>GARDEROBEN-RASTER</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {OUTFIT_CATEGORIES.map((category) => (
            <div
              key={category.id}
              data-testid={`wardrobe-category-${category.id}`}
              style={{
                flex: "1 1 180px",
                minWidth: 160,
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: 8,
                background: "var(--bg)",
              }}
            >
              <div style={{ color: "var(--accent)", fontWeight: 700 }}>{category.name}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", margin: "4px 0" }}>
                {category.description}
              </div>
              <div style={{ fontSize: 10, color: "var(--fg)" }}>
                {category.typicalItems.join(", ")}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* KONTINUITÄTS-WÄCHTER */}
      <div style={sectionStyle} data-testid="wardrobe-continuity">
        <div style={sectionLabelStyle}>KONTINUITÄTS-WÄCHTER</div>
        <div data-testid="wardrobe-continuity-brokenat" style={{ fontWeight: 700, marginBottom: 6 }}>
          brokenAt: {continuity.brokenAt === null ? "—" : continuity.brokenAt}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>
          Verstöße: {continuity.violations.length} · Warnungen: {continuity.warnings.length}
        </div>
        {continuity.violations.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Verstöße</div>
            <ul
              data-testid="wardrobe-violations"
              style={{ margin: "4px 0 0", paddingLeft: 18, lineHeight: 1.6, fontSize: 11 }}
            >
              {continuity.violations.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </div>
        )}
        {continuity.warnings.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Warnungen</div>
            <ul
              data-testid="wardrobe-warnings"
              style={{ margin: "4px 0 0", paddingLeft: 18, lineHeight: 1.6, fontSize: 11 }}
            >
              {continuity.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* LOOKBOOK-EXPORT */}
      <div style={sectionStyle} data-testid="wardrobe-lookbook">
        <div style={sectionLabelStyle}>LOOKBOOK-EXPORT</div>
        <div data-testid="wardrobe-lookbook-title" style={{ fontWeight: 700, marginBottom: 6 }}>
          {lookbook.title}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
          {lookbook.pages} Seite(n) · {lookbook.entries.length} Lookbook-Einträge
        </div>
        <div
          data-testid="wardrobe-lookbook-cover"
          style={{ maxWidth: "100%", overflow: "auto" }}
          dangerouslySetInnerHTML={{ __html: lookbook.coverSvg }}
        />
        <ul
          data-testid="wardrobe-lookbook-entries"
          style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.6, fontSize: 11 }}
        >
          {lookbook.entries.map((entry, i) => (
            <li key={i}>
              <span style={{ color: "var(--accent)" }}>Kap. {entry.chapter}</span> ·{" "}
              <span style={{ color: "var(--muted)" }}>{entry.category}</span>: {entry.items.join(", ")}
            </li>
          ))}
        </ul>
      </div>

      {/* Beispiele */}
      <details data-testid="wardrobe-samples" style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Beispiele (createSampleWardrobeEntry / createSampleLookbook)
        </summary>
        <pre
          style={{
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            marginTop: 6,
            maxHeight: 200,
            overflow: "auto",
          }}
        >
          {`Eintrag: ${sampleEntry.characterId} · Kap. ${sampleEntry.chapter} · ${sampleEntry.category}\n` +
            sampleEntry.items
              .map((it) => `  - ${it.name} (${it.color}, ${it.condition})`)
              .join("\n") +
            `\n\nLookbook: ${sampleLookbook.title}\n  ${sampleLookbook.pages} Seite(n) · ${sampleLookbook.entries.length} Einträge`}
        </pre>
      </details>
    </div>
  );
}
