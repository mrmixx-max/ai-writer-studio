// Print & Layout-Panel: Sammel-Dialog mit vier Tabs —
// 1) Print-Vorschau (Seitenansicht, Umbrüche, Zoom)
// 2) PDF-Layout (Seitenformat, Ränder, Kopf-/Fußzeilen)
// 3) Typografie (Schrift, Zeilenabstand, Ausrichtung)
// 4) Buch-Layout (Hardcover/Softcover/Paperback-Vorschau)
// Einstellungen werden über den PrintLayout-Service persistiert und vom
// PDF-Export übernommen.
import { useState } from "react";
import {
  loadPrintLayout,
  savePrintLayout,
  type PrintLayout,
} from "@/services/printlayout";
import { PrintPreview } from "./PrintPreview";
import { PdfLayoutEditor } from "./PdfLayoutEditor";
import { TypographyPanel } from "./TypographyPanel";
import { BookLayoutPreview } from "./BookLayoutPreview";
import "./printLayout.css";

type Tab = "preview" | "pdflayout" | "typography" | "book";

const TABS: { id: Tab; label: string }[] = [
  { id: "preview", label: "Vorschau" },
  { id: "pdflayout", label: "PDF-Layout" },
  { id: "typography", label: "Typografie" },
  { id: "book", label: "Buch-Layout" },
];

export function PrintLayoutPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("preview");
  const [layout, setLayout] = useState<PrintLayout>(() => loadPrintLayout());
  const [scope, setScope] = useState<"chapter" | "project">("project");
  const [zoom, setZoom] = useState(1);

  const update = (patch: Partial<PrintLayout>) => {
    setLayout((prev) => {
      const next = { ...prev, ...patch };
      savePrintLayout(next);
      return next;
    });
  };

  return (
    <div className="pl-overlay" role="dialog" aria-label="Print und Layout" onClick={onClose}>
      <div className="pl-panel" onClick={(e) => e.stopPropagation()}>
        <div className="pl-header">
          <h2>Print &amp; Layout</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              aria-label="Bereich"
              value={scope}
              onChange={(e) => setScope(e.target.value as "chapter" | "project")}
              style={{ padding: "4px 8px" }}
            >
              <option value="project">Ganzes Projekt</option>
              <option value="chapter">Aktuelles Kapitel</option>
            </select>
            <button onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="pl-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="pl-body">
          {tab === "preview" && (
            <div>
              <div className="pl-zoom-row">
                <label htmlFor="pl-zoom">Zoom ({Math.round(zoom * 100)} %)</label>
                <input
                  id="pl-zoom"
                  type="range"
                  min={0.6}
                  max={2}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
              </div>
              <PrintPreview layout={layout} scope={scope} zoom={zoom} />
            </div>
          )}
          {tab === "pdflayout" && <PdfLayoutEditor layout={layout} onChange={update} />}
          {tab === "typography" && <TypographyPanel layout={layout} onChange={update} />}
          {tab === "book" && <BookLayoutPreview layout={layout} scope={scope} onChange={update} />}
        </div>
      </div>
    </div>
  );
}
