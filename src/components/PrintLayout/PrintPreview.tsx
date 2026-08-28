// Print-Vorschau: seitengetreue Seitenansicht mit geschätzten Umbrüchen.
//
// Baut aus dem aktuellen Editor-Inhalt (oder allen Kapiteln des Projekts)
// Blöcke, paginiert sie mit paginateBlocks() und rendert sie als skalierte
// "Papierseiten" inkl. Ränder-Overlay und Kopf-/Fußzeilen. Die Schätzung ist
// bewusst approximativ — das verbindliche Layout erzeugt der PDF-Export.
import { useMemo } from "react";
import { toBlocks } from "@/services/export";
import { listChapters } from "@/services/project";
import {
  paginateBlocks,
  PAGE_SIZES,
  type PrintLayout,
  type PreviewPage,
} from "@/services/printlayout";
import { useProjectStore } from "@/store/projectStore";
import { useEditorStore } from "@/store/editorStore";

interface PrintPreviewProps {
  layout: PrintLayout;
  scope: "chapter" | "project";
  zoom: number;
}

const FONT_STACKS: Record<string, string> = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "Helvetica, Arial, sans-serif",
  mono: "'Courier New', monospace",
};

/** Wörter im Editor-Inhalt bzw. im Projekt zählen (für Buch-Layout-Schätzung). */
export function countWords(scope: "chapter" | "project", chapterContent: string, projectId?: string): number {
  const count = (text: string) => (text.trim().match(/\S+/g) ?? []).length;
  if (scope === "chapter" || !projectId) return count(chapterContent);
  return listChapters(projectId).reduce((sum, ch) => sum + count(ch.content), 0);
}

export function PrintPreview({ layout, scope, zoom }: PrintPreviewProps) {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const projects = useProjectStore((s) => s.projects);
  const content = useEditorStore((s) => s.content);

  const blocks = useMemo(() => {
    if (scope === "chapter" || !activeProjectId) return toBlocks(content);
    const out: { type: string; text: string }[] = [];
    for (const ch of listChapters(activeProjectId)) {
      out.push({ type: "h1", text: ch.title });
      out.push(...toBlocks(ch.content));
    }
    return out;
  }, [scope, content, activeProjectId]);

  const pages: PreviewPage[] = useMemo(
    () =>
      paginateBlocks(blocks, {
        page: PAGE_SIZES[layout.pageSize],
        margins: layout.margins,
        typography: layout.typography,
      }),
    [blocks, layout],
  );

  const page = PAGE_SIZES[layout.pageSize];
  // 0.3 CSS-px pro mm Papier, skaliert mit Zoom.
  const pxPerMm = 0.3 * zoom;
  const cssW = page.widthMm * pxPerMm;
  const cssH = page.heightMm * pxPerMm;
  const m = layout.margins;
  const t = layout.typography;
  // Schriftgröße im gleichen Maßstab: pt → px (×96/72), dann Skalierung.
  const fontScale = cssW / (page.widthMm * (96 / 25.4));
  const fontSizePx = t.fontSizePt * (96 / 72) * fontScale;
  const hf = layout.headerFooter;
  const projectTitle = projects.find((p) => p.id === activeProjectId)?.name ?? "Dokument";

  const token = (tpl: string) =>
    tpl.replace(/\{title\}/g, projectTitle).replace(/\{page\}/g, "").trim();

  return (
    <div>
      <div className="pl-zoom-row">
        <span>
          {pages.length} Seite(n) · {page.label} · Umbrüche geschätzt
        </span>
      </div>
      <div className="pl-preview-area">
        {pages.map((pg) => (
          <div key={pg.pageNumber} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div
              className="pl-page"
              style={{
                width: cssW,
                height: cssH,
                fontFamily: FONT_STACKS[t.fontFamily],
                fontSize: fontSizePx,
              }}
            >
              {hf.headerEnabled && (
                <div className="pl-page-hf top" style={{ fontSize: Math.max(5, fontSizePx * 0.75) }}>
                  <span>{token(hf.headerLeft)}</span>
                  <span>{token(hf.headerCenter)}</span>
                  <span>{token(hf.headerRight)}</span>
                </div>
              )}
              {hf.footerEnabled && (
                <div className="pl-page-hf bottom" style={{ fontSize: Math.max(5, fontSizePx * 0.75) }}>
                  <span>{token(hf.footerLeft)}</span>
                  <span>{token(hf.footerCenter) || String(pg.pageNumber)}</span>
                  <span>{token(hf.footerRight)}</span>
                </div>
              )}
              <div
                className="pl-page-content"
                style={
                  {
                    top: m.top * pxPerMm,
                    left: m.left * pxPerMm,
                    width: (page.widthMm - m.left - m.right) * pxPerMm,
                    height: (page.heightMm - m.top - m.bottom) * pxPerMm,
                    "--pl-align": t.paragraphAlign === "justify" ? "justify" : "left",
                    "--pl-indent": `${t.firstLineIndentMm * pxPerMm}px`,
                    "--pl-par-spacing": `${t.paragraphSpacingPt * (96 / 72) * fontScale}px`,
                  } as React.CSSProperties
                }
              >
                {pg.blocks.map((b, i) => {
                  if (b.type === "h1") return <h1 key={i} style={{ fontSize: fontSizePx * t.headingScale }}>{b.text}</h1>;
                  if (b.type === "h2") return <h2 key={i} style={{ fontSize: fontSizePx * ((t.headingScale + 0.6) / 1.5) }}>{b.text}</h2>;
                  if (b.type === "h3") return <h3 key={i} style={{ fontSize: fontSizePx * ((t.headingScale + 0.3) / 1.5) }}>{b.text}</h3>;
                  if (b.type === "quote") return <blockquote key={i}>{b.text}</blockquote>;
                  if (b.type === "code") return <pre key={i}>{b.text}</pre>;
                  return <p key={i}>{b.text}</p>;
                })}
              </div>
            </div>
            <div className="pl-page-num">
              {pg.pageNumber}
              {pg.breakMidParagraph && <span className="pl-break-marker"> · Umbruch</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
