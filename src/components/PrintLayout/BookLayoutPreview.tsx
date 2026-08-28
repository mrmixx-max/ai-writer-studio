// Buch-Layout: Hardcover-/Softcover-/Paperback-Vorschau mit Buchrücken-
// berechnung, Beschnitt und Cover-Mockup (Maßstabsgetreu gerendert).
import { useMemo } from "react";
import {
  BOOK_FORMAT_LABELS,
  PAGE_SIZES,
  calcSpineWidthMm,
  calcCoverWidthMm,
  calcCoverHeightMm,
  estimatePageCount,
  type BookFormat,
  type PrintLayout,
} from "@/services/printlayout";
import { countWords } from "./PrintPreview";
import { useProjectStore } from "@/store/projectStore";
import { useEditorStore } from "@/store/editorStore";

interface BookLayoutPanelProps {
  layout: PrintLayout;
  scope: "chapter" | "project";
  onChange: (patch: Partial<PrintLayout>) => void;
}

const PX_PER_MM = 0.55;

export function BookLayoutPreview({ layout, scope, onChange }: BookLayoutPanelProps) {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const projects = useProjectStore((s) => s.projects);
  const content = useEditorStore((s) => s.content);

  const b = layout.book;
  const wordCount = useMemo(
    () => countWords(scope, content, activeProjectId ?? undefined),
    [scope, content, activeProjectId],
  );
  const estimatedPages = estimatePageCount(wordCount, b.trim);
  const pageCount = b.pageCount || estimatedPages;
  const spineMm = calcSpineWidthMm({ ...b, pageCount });
  const coverW = calcCoverWidthMm({ ...b, pageCount });
  const coverH = calcCoverHeightMm({ ...b, pageCount });
  const page = PAGE_SIZES[b.trim];

  const set = (patch: Partial<PrintLayout["book"]>) =>
    onChange({ book: { ...b, ...patch } });

  const spineW = Math.max(spineMm * PX_PER_MM, 6);
  const blockH = page.heightMm * PX_PER_MM;
  const coverWpx = coverW * PX_PER_MM;
  const coverHpx = coverH * PX_PER_MM;

  const title = b.title || projects.find((p) => p.id === activeProjectId)?.name || "Ohne Titel";
  const author = b.author || "Autor";

  return (
    <div>
      <div className="pl-section-title">Einband</div>
      <div className="pl-form-row">
        {(Object.keys(BOOK_FORMAT_LABELS) as BookFormat[]).map((f) => (
          <label key={f} style={{ minWidth: "auto" }}>
            <input
              type="radio"
              name="pl-book-format"
              checked={b.format === f}
              onChange={() => set({ format: f })}
            />{" "}
            {BOOK_FORMAT_LABELS[f]}
          </label>
        ))}
      </div>
      <div className="pl-form-row">
        <label htmlFor="pl-book-trim">Zuschnitt</label>
        <select
          id="pl-book-trim"
          value={b.trim}
          onChange={(e) => set({ trim: e.target.value as PrintLayout["book"]["trim"] })}
        >
          {(Object.keys(PAGE_SIZES) as (keyof typeof PAGE_SIZES)[]).map((id) => (
            <option key={id} value={id}>{PAGE_SIZES[id].label}</option>
          ))}
        </select>
      </div>
      <div className="pl-form-row">
        <label htmlFor="pl-book-pages">Seitenzahl</label>
        <input
          id="pl-book-pages"
          type="number"
          min={1}
          value={b.pageCount || estimatedPages}
          onChange={(e) => set({ pageCount: Math.max(1, Number(e.target.value)) })}
        />
        <span style={{ fontSize: 12, color: "var(--fg-dim, #777)" }}>
          (geschätzt: {estimatedPages} aus {wordCount.toLocaleString("de-DE")} Wörtern)
        </span>
      </div>
      <div className="pl-form-row">
        <label htmlFor="pl-book-bleed">Beschnitt (mm)</label>
        <input
          id="pl-book-bleed"
          type="number"
          min={0}
          max={10}
          value={b.bleedMm}
          onChange={(e) => set({ bleedMm: Math.max(0, Math.min(10, Number(e.target.value))) })}
        />
      </div>
      <div className="pl-form-row">
        <label htmlFor="pl-book-title">Titel (Rücken/Cover)</label>
        <input
          id="pl-book-title"
          type="text"
          value={b.title}
          placeholder={title}
          onChange={(e) => set({ title: e.target.value })}
        />
      </div>
      <div className="pl-form-row">
        <label htmlFor="pl-book-author">Autor</label>
        <input
          id="pl-book-author"
          type="text"
          value={b.author}
          placeholder={author}
          onChange={(e) => set({ author: e.target.value })}
        />
      </div>

      <div className="pl-book-scene">
        <div className="pl-book-wrap" style={{ height: blockH }}>
          <div
            className="pl-book-spine"
            style={{ width: spineW, lineHeight: `${blockH}px` }}
            title={`Rücken: ${spineMm.toFixed(1)} mm`}
          >
            {title} · {author}
          </div>
          <div
            className={`pl-book-cover ${b.format}`}
            style={{ width: `${coverWpx - spineW}px`, height: coverHpx }}
          >
            <div className="pl-book-title" style={{ fontSize: Math.max(10, coverWpx * 0.055) }}>{title}</div>
            <div className="pl-book-author">{author}</div>
            {b.format === "hardcover" && (
              <div style={{ position: "absolute", top: 10, right: 12, fontSize: 9, opacity: 0.7 }}>
                Schutzumschlag
              </div>
            )}
          </div>
        </div>
        <div className="pl-book-meta">
          <div><strong>{BOOK_FORMAT_LABELS[b.format]}</strong></div>
          <div>Zuschnitt: {page.widthMm.toFixed(0)} × {page.heightMm.toFixed(0)} mm</div>
          <div>Seiten: {pageCount}</div>
          <div>Buchrücken: {spineMm.toFixed(1)} mm</div>
          <div>Umschlag: {coverW.toFixed(0)} × {coverH.toFixed(0)} mm (inkl. {b.bleedMm} mm Beschnitt)</div>
        </div>
      </div>
    </div>
  );
}
