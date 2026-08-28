// PDF-Layout-Editor: Seitenformat, Seitenränder und Kopf-/Fußzeilen.
// Änderungen werden sofort in das übergebene layout-Objekt geschrieben
// (kontrollierter State im Panel) und live in der Vorschau gespiegelt.
import {
  PAGE_SIZES,
  MARGIN_PRESETS,
  type PageSizeId,
  type PrintLayout,
} from "@/services/printlayout";

interface PdfLayoutEditorProps {
  layout: PrintLayout;
  onChange: (patch: Partial<PrintLayout>) => void;
}

type MarginKey = keyof PrintLayout["margins"];

export function PdfLayoutEditor({ layout, onChange }: PdfLayoutEditorProps) {
  const m = layout.margins;
  const hf = layout.headerFooter;

  const setMargin = (key: MarginKey, value: number) =>
    onChange({ margins: { ...m, [key]: Math.max(0, Math.min(80, value)) } });

  const setHf = (patch: Partial<PrintLayout["headerFooter"]>) =>
    onChange({ headerFooter: { ...hf, ...patch } });

  return (
    <div>
      <div className="pl-section-title">Seitenformat</div>
      <div className="pl-form-row">
        <label htmlFor="pl-pagesize">Seite</label>
        <select
          id="pl-pagesize"
          value={layout.pageSize}
          onChange={(e) => onChange({ pageSize: e.target.value as PageSizeId })}
        >
          {Object.values(PAGE_SIZES).map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>
      <div className="pl-form-row">
        <label htmlFor="pl-margin-preset">Rand-Vorlage</label>
        <select
          id="pl-margin-preset"
          defaultValue=""
          onChange={(e) => {
            const preset = MARGIN_PRESETS[Number(e.target.value)];
            if (preset) onChange({ margins: { ...preset.margins } });
          }}
        >
          <option value="" disabled>Vorlage wählen…</option>
          {MARGIN_PRESETS.map((p, i) => (
            <option key={p.label} value={i}>{p.label}</option>
          ))}
        </select>
      </div>

      <div className="pl-section-title">Seitenränder (mm)</div>
      {(["top", "right", "bottom", "left"] as MarginKey[]).map((key) => (
        <div className="pl-form-row" key={key}>
          <label htmlFor={`pl-margin-${key}`}>
            {key === "top" ? "Oben" : key === "bottom" ? "Unten" : key === "left" ? "Links" : "Rechts"}
          </label>
          <input
            id={`pl-margin-${key}`}
            type="number"
            min={0}
            max={80}
            value={m[key]}
            onChange={(e) => setMargin(key, Number(e.target.value))}
          />
        </div>
      ))}

      <div className="pl-section-title">Kopfzeile</div>
      <div className="pl-form-row">
        <label htmlFor="pl-hf-header">Anzeigen</label>
        <input
          id="pl-hf-header"
          type="checkbox"
          checked={hf.headerEnabled}
          onChange={(e) => setHf({ headerEnabled: e.target.checked })}
        />
      </div>
      {hf.headerEnabled && (
        <>
          {(["headerLeft", "headerCenter", "headerRight"] as const).map((k) => (
            <div className="pl-form-row" key={k}>
              <label htmlFor={`pl-${k}`}>
                {k === "headerLeft" ? "Links" : k === "headerCenter" ? "Mitte" : "Rechts"}
              </label>
              <input
                id={`pl-${k}`}
                type="text"
                placeholder="{title} / {author}"
                value={hf[k]}
                onChange={(e) => setHf({ [k]: e.target.value })}
              />
            </div>
          ))}
        </>
      )}

      <div className="pl-section-title">Fußzeile</div>
      <div className="pl-form-row">
        <label htmlFor="pl-hf-footer">Anzeigen</label>
        <input
          id="pl-hf-footer"
          type="checkbox"
          checked={hf.footerEnabled}
          onChange={(e) => setHf({ footerEnabled: e.target.checked })}
        />
      </div>
      {hf.footerEnabled && (
        <>
          {(["footerLeft", "footerCenter", "footerRight"] as const).map((k) => (
            <div className="pl-form-row" key={k}>
              <label htmlFor={`pl-${k}`}>
                {k === "footerLeft" ? "Links" : k === "footerCenter" ? "Mitte" : "Rechts"}
              </label>
              <input
                id={`pl-${k}`}
                type="text"
                placeholder="{page} / {title}"
                value={hf[k]}
                onChange={(e) => setHf({ [k]: e.target.value })}
              />
            </div>
          ))}
          <div className="pl-form-row">
            <label htmlFor="pl-hf-size">Schriftgröße (pt)</label>
            <input
              id="pl-hf-size"
              type="number"
              min={6}
              max={14}
              value={hf.fontSizePt}
              onChange={(e) => setHf({ fontSizePt: Number(e.target.value) })}
            />
          </div>
        </>
      )}

      <p style={{ fontSize: 12, color: "var(--fg-dim, #777)" }}>
        Tokens: <code>{"{title}"}</code> Titel, <code>{"{author}"}</code> Autor, <code>{"{page}"}</code> Seitenzahl
        (wirkt im PDF-Export und in der Vorschau).
      </p>
    </div>
  );
}
