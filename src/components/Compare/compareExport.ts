// Vergleichs-Export: PDF mit Markup (rot durchgestrichen = gelöscht, grün = hinzugefügt, gelb/amber = geändert).
// Nutzt pdf-lib (bereits im Projekt für den Hauptexport).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { diffLines, diffStats, type DiffLine, type DiffSegment } from "./diff";

const FONT_SIZE = 10;
const LINE_HEIGHT = FONT_SIZE + 4;
const MARGIN = 50;
const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const TEXT_X = MARGIN + 34; // Einzug nach Zeilennummern

const RED = rgb(0.8, 0.1, 0.1);
const GREEN = rgb(0.05, 0.55, 0.2);
const AMBER = rgb(0.75, 0.55, 0);
const BLACK = rgb(0.1, 0.1, 0.12);
const GRAY = rgb(0.45, 0.45, 0.5);

interface RenderSeg {
  text: string;
  color: ReturnType<typeof rgb>;
  strike: boolean;
}

function segToRender(seg: DiffSegment, lineOp: DiffLine["op"]): RenderSeg {
  if (seg.op === "delete" || lineOp === "delete") return { text: seg.text, color: RED, strike: true };
  if (seg.op === "insert" || lineOp === "insert") return { text: seg.text, color: GREEN, strike: false };
  if (lineOp === "changed") return { text: seg.text, color: AMBER, strike: false };
  return { text: seg.text, color: BLACK, strike: false };
}

function sanitize(text: string): string {
  // WinAnsi-Font: nicht darstellbare Zeichen ersetzen
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\u0020-\u00FF]/g, "?");
}

/**
 * Erzeugt ein PDF mit Markup-Diff zweier Versionen.
 * Gibt die PDF-Bytes zurück (Uint8Array) — der Aufrufer speichert/downloadet sie.
 */
export async function buildComparePdf(
  labelA: string,
  labelB: string,
  textA: string,
  textB: string,
  chapterTitle: string,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const lines = diffLines(textA, textB);
  const stats = diffStats(lines);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  let curX = TEXT_X;

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
    curX = TEXT_X;
  };

  const breakLine = () => {
    if (y - LINE_HEIGHT < MARGIN) newPage();
    else y -= LINE_HEIGHT;
    curX = TEXT_X;
  };

  const drawRun = (text: string, color: any, strike: boolean) => {
    for (const chunk of text.split("\n")) {
      if (chunk === "") continue;
      const w = font.widthOfTextAtSize(chunk, FONT_SIZE);
      if (curX + w > PAGE_W - MARGIN) breakLine();
      page.drawText(chunk, { x: curX, y, size: FONT_SIZE, font, color });
      if (strike) {
        page.drawLine({
          start: { x: curX, y: y + FONT_SIZE * 0.32 },
          end: { x: curX + w, y: y + FONT_SIZE * 0.32 },
          thickness: 0.7,
          color,
        });
      }
      curX += w;
    }
  };

  const drawHeaderRow = (t: string, size: number, boldFont: any, color: any) => {
    page.drawText(sanitize(t), { x: MARGIN, y, size, font: boldFont, color });
  };

  // Kopf
  drawHeaderRow("Vergleichs-Export — AI Writer Studio", 14, await pdf.embedFont(StandardFonts.HelveticaBold), BLACK);
  y -= 18;
  drawHeaderRow(`Kapitel: ${chapterTitle}`, 10, font, GRAY);
  y -= 14;
  drawHeaderRow(`A: ${labelA}   →   B: ${labelB}`, 10, await pdf.embedFont(StandardFonts.HelveticaBold), BLACK);
  y -= 14;
  drawHeaderRow(
    `Wörter hinzugefügt: ${stats.added}   gelöscht: ${stats.deleted}   geänderte Zeilen: ${stats.changedLines}   von ${stats.totalLines}`,
    9,
    font,
    GRAY,
  );
  y -= 14;
  // Legende
  page.drawText("gelöscht", { x: MARGIN, y, size: 9, font, color: RED });
  page.drawLine({ start: { x: MARGIN + 44, y: y + 3 }, end: { x: MARGIN + 82, y: y + 3 }, thickness: 0.7, color: RED });
  page.drawText("hinzugefügt", { x: MARGIN + 92, y, size: 9, font, color: GREEN });
  page.drawText("geändert", { x: MARGIN + 152, y, size: 9, font, color: AMBER });
  y -= 20;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: GRAY });
  y -= LINE_HEIGHT;

  for (const line of lines) {
    const drawNos = () => {
      const s = `${line.leftNo ?? ""} ${line.rightNo ?? ""}`.trim();
      if (s) page.drawText(s, { x: MARGIN, y, size: 8, font, color: GRAY });
    };
    let first = true;
    for (const seg of line.segments) {
      const r = segToRender(seg, line.op);
      const clean = sanitize(r.text);
      if (!clean) continue;
      if (first) {
        if (y - LINE_HEIGHT < MARGIN) newPage();
        drawNos();
        first = false;
      }
      drawRun(clean, r.color, r.strike);
    }
    if (!first) breakLine();
  }

  return await pdf.save();
}

/** Baut das Markup-PDF und löst den Download aus. */
export async function downloadComparePdf(
  labelA: string,
  labelB: string,
  textA: string,
  textB: string,
  chapterTitle: string,
): Promise<void> {
  const bytes = await buildComparePdf(labelA, labelB, textA, textB, chapterTitle);
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vergleich-${new Date().toISOString().slice(0, 10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
