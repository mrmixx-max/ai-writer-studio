// Typografie-Panel: Schrift, Schriftgröße, Zeilenabstand, Absatzausrichtung,
// Erstzeilen-Einzug und Absatzabstand — mit Live-Muster.
import {
  FONT_FAMILY_LABELS,
  type FontFamilyId,
  type PrintLayout,
} from "@/services/printlayout";

interface TypographyPanelProps {
  layout: PrintLayout;
  onChange: (patch: Partial<PrintLayout>) => void;
}

const SAMPLE_TEXT =
  "Der Morgen lag schwer über dem Tal, als sie den ersten Schritt wagte. Kein Vogel sang, kein Wind bewegte die Zweige — nur der Klang ihrer eigenen Schritte begleitete sie den Weg hinab.";

export function TypographyPanel({ layout, onChange }: TypographyPanelProps) {
  const t = layout.typography;

  const set = (patch: Partial<PrintLayout["typography"]>) =>
    onChange({ typography: { ...t, ...patch } });

  return (
    <div>
      <div className="pl-section-title">Schrift</div>
      <div className="pl-form-row">
        <label htmlFor="pl-typ-font">Schriftfamilie</label>
        <select
          id="pl-typ-font"
          value={t.fontFamily}
          onChange={(e) => set({ fontFamily: e.target.value as FontFamilyId })}
        >
          {(Object.keys(FONT_FAMILY_LABELS) as FontFamilyId[]).map((f) => (
            <option key={f} value={f}>{FONT_FAMILY_LABELS[f]}</option>
          ))}
        </select>
      </div>
      <div className="pl-form-row">
        <label htmlFor="pl-typ-size">Schriftgröße (pt)</label>
        <input
          id="pl-typ-size"
          type="number"
          min={8}
          max={18}
          value={t.fontSizePt}
          onChange={(e) => set({ fontSizePt: Math.max(8, Math.min(18, Number(e.target.value))) })}
        />
      </div>

      <div className="pl-section-title">Abstände</div>
      <div className="pl-form-row">
        <label htmlFor="pl-typ-lh">Zeilenabstand ({t.lineHeight.toFixed(2)}×)</label>
        <input
          id="pl-typ-lh"
          type="range"
          min={1}
          max={2}
          step={0.05}
          value={t.lineHeight}
          onChange={(e) => set({ lineHeight: Number(e.target.value) })}
        />
      </div>
      <div className="pl-form-row">
        <label htmlFor="pl-typ-spacing">Absatzabstand (pt)</label>
        <input
          id="pl-typ-spacing"
          type="number"
          min={0}
          max={24}
          value={t.paragraphSpacingPt}
          onChange={(e) => set({ paragraphSpacingPt: Math.max(0, Math.min(24, Number(e.target.value))) })}
        />
      </div>
      <div className="pl-form-row">
        <label htmlFor="pl-typ-indent">Erstzeilen-Einzug (mm)</label>
        <input
          id="pl-typ-indent"
          type="number"
          min={0}
          max={15}
          step={0.5}
          value={t.firstLineIndentMm}
          onChange={(e) => set({ firstLineIndentMm: Math.max(0, Math.min(15, Number(e.target.value))) })}
        />
      </div>

      <div className="pl-section-title">Absatzausrichtung</div>
      <div className="pl-form-row">
        <label>
          <input
            type="radio"
            name="pl-align"
            checked={t.paragraphAlign === "left"}
            onChange={() => set({ paragraphAlign: "left" })}
          />{" "}
          Linksbündig (Flattersatz)
        </label>
        <label>
          <input
            type="radio"
            name="pl-align"
            checked={t.paragraphAlign === "justify"}
            onChange={() => set({ paragraphAlign: "justify" })}
          />{" "}
          Blocksatz
        </label>
      </div>

      <div className="pl-type-sample">
        <div className="pl-section-title" style={{ marginTop: 0 }}>Vorschau</div>
        <div
          className="sample-body"
          style={
            {
              fontFamily:
                t.fontFamily === "serif" ? "Georgia, serif"
                : t.fontFamily === "sans" ? "Helvetica, Arial, sans-serif"
                : "'Courier New', monospace",
              fontSize: t.fontSizePt,
              lineHeight: t.lineHeight,
              "--pl-align": t.paragraphAlign,
              "--pl-indent": `${t.firstLineIndentMm}mm`,
            } as React.CSSProperties
          }
        >
          {SAMPLE_TEXT}
        </div>
        <div
          className="sample-body"
          style={
            {
              fontFamily:
                t.fontFamily === "serif" ? "Georgia, serif"
                : t.fontFamily === "sans" ? "Helvetica, Arial, sans-serif"
                : "'Courier New', monospace",
              fontSize: t.fontSizePt,
              lineHeight: t.lineHeight,
              marginTop: t.paragraphSpacingPt,
              "--pl-align": t.paragraphAlign,
              "--pl-indent": `${t.firstLineIndentMm}mm`,
            } as React.CSSProperties
          }
        >
          Zweiter Absatz — hier sieht man Absatzabstand und Einzug im direkten Vergleich.
        </div>
      </div>
    </div>
  );
}
