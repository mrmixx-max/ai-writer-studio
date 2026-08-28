/**
 * AI Writer Studio — Werbebroschüre PDF Generator
 * Nutzt pdf-lib (bereits als Dependency vorhanden).
 * ACHTUNG: Standard-Fonts (Helvetica) unterstuetzen nur WinAnsi.
 * Keine Unicode-Sonderzeichen verwenden!
 */
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Farben ────────────────────────────────────────────────────────────────
const COLORS = {
  primary: rgb(0.13, 0.18, 0.26),
  accent: rgb(0.96, 0.56, 0.14),
  accentLight: rgb(1, 0.72, 0.32),
  text: rgb(0.2, 0.2, 0.2),
  textLight: rgb(0.4, 0.4, 0.4),
  white: rgb(1, 1, 1),
  bgLight: rgb(0.97, 0.97, 0.98),
  bgDark: rgb(0.1, 0.14, 0.2),
  success: rgb(0.2, 0.7, 0.3),
  border: rgb(0.85, 0.85, 0.88),
};

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────
function drawCenteredText(page, text, font, size, y, color = COLORS.text) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: (page.getWidth() - width) / 2,
    y,
    size,
    font,
    color,
  });
}

function wrapText(text, font, size, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawWrappedText(page, text, font, size, x, y, maxWidth, lineHeight, color = COLORS.text) {
  const lines = wrapText(text, font, size, maxWidth);
  let cy = y;
  for (const line of lines) {
    page.drawText(line, { x, y: cy, size, font, color });
    cy -= lineHeight;
  }
  return lines.length * lineHeight;
}

function drawFeatureBox(page, x, y, w, h, title, desc, icon, font, bold) {
  page.drawRectangle({
    x, y, width: w, height: h,
    color: COLORS.bgLight,
    borderColor: COLORS.border,
    borderWidth: 0.5,
  });
  page.drawText(icon, { x: x + 8, y: y + h - 18, size: 14, font: bold, color: COLORS.accent });
  page.drawText(title, { x: x + 30, y: y + h - 18, size: 10, font: bold, color: COLORS.primary });
  drawWrappedText(page, desc, font, 8, x + 8, y + h - 32, w - 16, 10, COLORS.textLight);
}

// ─── Hauptprogramm ──────────────────────────────────────────────────────────
async function main() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const W = 595.28;
  const H = 841.89;
  const MARGIN = 40;

  // ═══════════════════════════════════════════════════════════════════════════
  // SEITE 1 — Cover
  // ═══════════════════════════════════════════════════════════════════════════
  let page = pdf.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: COLORS.bgDark });
  page.drawRectangle({ x: 0, y: H - 8, width: W, height: 8, color: COLORS.accent });

  drawCenteredText(page, "AI WRITER STUDIO", bold, 42, H - 120, COLORS.white);
  drawCenteredText(page, "Dein lokales Manuskriptstudio", font, 18, H - 170, COLORS.accent);
  drawCenteredText(page, "Schreiben. Wissen aufbauen. Konsistenz pruefen. Exportieren.", font, 12, H - 210, rgb(0.7, 0.7, 0.75));

  const features = [
    { icon: "[*]", title: "Lokal-first", desc: "Keine Cloud, kein Abo. Deine Daten bleiben auf deinem Rechner." },
    { icon: "[*]", title: "KI-Assistent", desc: "Ollama, LM Studio, OpenAI -- oder ganz ohne." },
    { icon: "[*]", title: "KDP-Ready", desc: "DOCX, PDF, EPUB mit Preflight und Validierung." },
    { icon: "[*]", title: "574 Tests", desc: "Professionelle Qualitaet, die sich bezahlt macht." },
  ];

  let fy = H - 280;
  for (const f of features) {
    page.drawText(f.icon, { x: MARGIN + 40, y: fy, size: 14, font: bold, color: COLORS.accent });
    page.drawText(f.title, { x: MARGIN + 60, y: fy, size: 12, font: bold, color: COLORS.white });
    drawWrappedText(page, f.desc, font, 10, MARGIN + 60, fy - 16, 300, 14, rgb(0.7, 0.7, 0.75));
    fy -= 50;
  }

  page.drawRectangle({ x: (W - 200) / 2, y: 100, width: 200, height: 40, color: COLORS.accent });
  drawCenteredText(page, "Jetzt herunterladen", bold, 14, 114, COLORS.bgDark);
  drawCenteredText(page, "Version 0.1.0  |  Apache-2.0 License", font, 8, 60, rgb(0.5, 0.5, 0.55));

  // ═══════════════════════════════════════════════════════════════════════════
  // SEITE 2 — Schreiben & Projektstruktur
  // ═══════════════════════════════════════════════════════════════════════════
  page = pdf.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: COLORS.white });
  page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: COLORS.accent });
  drawCenteredText(page, "Schreiben & Projektstruktur", bold, 24, H - 60, COLORS.primary);

  const writeFeatures = [
    { icon: "[+]", title: "Rich-Text-Editor", desc: "TipTap 2 mit Ueberschriften, Listen, Zitaten, Fokusmodus (F11)." },
    { icon: "[>]", title: "Automatisches Speichern", desc: "Aenderungen werden automatisch persistiert." },
    { icon: "[*]", title: "Custom Extensions", desc: "Character-Tags, Scene-Markers, Kapitel-Uebersicht direkt im Editor." },
    { icon: "[#]", title: "Figuren- & Ortsprofile", desc: "Name, Alias, Alter, Beruf, Aeusseres, Eigenschaften, Beziehungen." },
    { icon: "[~]", title: "Timeline-Visualisierung", desc: "Interaktive Canvas/SVG-Ansicht mit Zoom, Pan und Event-Details." },
    { icon: "[O]", title: "Beziehungsgraph", desc: "Kraftlinien-Simulation mit Kanten-Labels und Filter." },
  ];

  let y = H - 100;
  for (let i = 0; i < writeFeatures.length; i++) {
    const f = writeFeatures[i];
    const boxH = 55;
    drawFeatureBox(page, MARGIN + (i % 2) * 255, y - boxH, 245, boxH, f.title, f.desc, f.icon, font, bold);
    if (i % 2 === 1) y -= boxH + 10;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEITE 3 — KI-Funktionen
  // ═══════════════════════════════════════════════════════════════════════════
  page = pdf.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: COLORS.white });
  page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: COLORS.accent });
  drawCenteredText(page, "KI-Funktionen", bold, 24, H - 60, COLORS.primary);

  const aiFeatures = [
    { icon: "[->]", title: "Weiterschreiben & Umschreiben", desc: "KI schreibt weiter, wo du aufhoerst -- im gleichen Stil." },
    { icon: "[.]", title: "Auto-Complete", desc: "Kontextbasierte Vorschlaege waehrend des Tippens mit 700ms-Debounce." },
    { icon: "[T]", title: "Style Transfer", desc: "Text in Stile von Juenger, Hemingway, Kerouac, Wolf umschreiben." },
    { icon: "[!]", title: "Dialog-Generator", desc: "Realistische Dialoge zwischen Charakteren mit individuellen Sprechweisen." },
    { icon: "[?]", title: "Prompt-Templates", desc: "12 kuratierte Genre-Vorlagen fuer sofort startende Kreativitaet." },
    { icon: "[M]", title: "Multi-Modell", desc: "Verschiedene Provider gleichzeitig -- Ollama, OpenAI, OpenRouter." },
  ];

  y = H - 100;
  for (let i = 0; i < aiFeatures.length; i++) {
    const f = aiFeatures[i];
    const boxH = 55;
    drawFeatureBox(page, MARGIN + (i % 2) * 255, y - boxH, 245, boxH, f.title, f.desc, f.icon, font, bold);
    if (i % 2 === 1) y -= boxH + 10;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEITE 4 — Export & KDP
  // ═══════════════════════════════════════════════════════════════════════════
  page = pdf.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: COLORS.white });
  page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: COLORS.accent });
  drawCenteredText(page, "Export & KDP-Integration", bold, 24, H - 60, COLORS.primary);

  const exportFeatures = [
    { icon: "[D]", title: "DOCX / PDF / EPUB", desc: "Professionelle Exporte mit Styles, Seitenzahlen, CSS, Metadaten." },
    { icon: "[v]", title: "Export-Preflight", desc: "Struktur, Frontmatter, Formate, Zeichen -- alles vor dem Export geprueft." },
    { icon: "[R]", title: "KDP-Checkliste", desc: "Fortschrittsbalken, Statusliste, Cover-Vorschau, KDP-Paket-Export." },
    { icon: "[i]", title: "Metadaten-Validierung", desc: "Title, Beschreibung, Keywords, Kategorien -- KDP-konform." },
    { icon: "[<]", title: "Import", desc: "Scrivener (.scrivx), DOCX, Markdown -- alles konvertierbar." },
    { icon: "[W]", title: "Multi-Platform", desc: "Smashwords, Draft2Digital, Kobo -- ein Klick, viele Plattformen." },
  ];

  y = H - 100;
  for (let i = 0; i < exportFeatures.length; i++) {
    const f = exportFeatures[i];
    const boxH = 55;
    drawFeatureBox(page, MARGIN + (i % 2) * 255, y - boxH, 245, boxH, f.title, f.desc, f.icon, font, bold);
    if (i % 2 === 1) y -= boxH + 10;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEITE 5 — Collaboration, Research, Analytics
  // ═══════════════════════════════════════════════════════════════════════════
  page = pdf.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: COLORS.white });
  page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: COLORS.accent });
  drawCenteredText(page, "Zusammenarbeit & Analyse", bold, 24, H - 60, COLORS.primary);

  const collabFeatures = [
    { icon: "[C]", title: "Inline-Kommentare", desc: "Textpassagen kommentieren, diskuten, verbessern." },
    { icon: "[/]", title: "Track Changes", desc: "Aenderungen verfolgen, annehmen oder ablehnen." },
    { icon: "[S]", title: "Research-Manager", desc: "Web-Notizen, Screenshots, Links -- alles an einem Ort." },
    { icon: "[Q]", title: "Zitate & Quellen", desc: "APA, MLA, Chicago -- professionelle Zitierstile." },
    { icon: "[Z]", title: "Writing-Analytics", desc: "Wortziel, Streaks, Sitzungs-Statistiken, Produktivitaet." },
    { icon: "[P]", title: "Plugin-System", desc: "Erweiterbar mit Hooks, Events und eigenem Store." },
  ];

  y = H - 100;
  for (let i = 0; i < collabFeatures.length; i++) {
    const f = collabFeatures[i];
    const boxH = 55;
    drawFeatureBox(page, MARGIN + (i % 2) * 255, y - boxH, 245, boxH, f.title, f.desc, f.icon, font, bold);
    if (i % 2 === 1) y -= boxH + 10;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEITE 6 — Technik & Kontakt
  // ═══════════════════════════════════════════════════════════════════════════
  page = pdf.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: COLORS.bgDark });
  page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: COLORS.accent });
  drawCenteredText(page, "Technik", bold, 24, H - 60, COLORS.white);

  const techLines = [
    "Tauri 2 + React 18 + TypeScript + Zustand",
    "SQLite (sql.js) mit 13+ Migrationen",
    "TipTap 2 Rich-Text-Editor mit Custom Extensions",
    "574 Tests mit Vitest -- alles gruen",
    "Inno Setup Installer mit Code-Signing",
    "Auto-Update via tauri-plugin-updater",
    "Portable-Version und Delta-Updates",
  ];

  let ty = H - 100;
  for (const line of techLines) {
    page.drawText(">", { x: MARGIN + 20, y: ty, size: 12, font: bold, color: COLORS.accent });
    page.drawText(line, { x: MARGIN + 40, y: ty, size: 11, font, color: rgb(0.8, 0.8, 0.85) });
    ty -= 22;
  }

  ty -= 30;
  drawCenteredText(page, "Kontakt", bold, 18, ty, COLORS.accent);
  ty -= 30;
  drawCenteredText(page, "Autor: Erik Gieske", font, 12, ty, COLORS.white);
  ty -= 20;
  drawCenteredText(page, "GitHub: github.com/mrmixx-max/ai-writer-studio", font, 10, ty, rgb(0.7, 0.7, 0.75));
  ty -= 20;
  drawCenteredText(page, "E-Mail: erikgieske@gmail.com", font, 10, ty, rgb(0.7, 0.7, 0.75));
  ty -= 40;
  drawCenteredText(page, "Apache-2.0 License  |  Open Source  |  Lokal-first", font, 9, ty, rgb(0.5, 0.5, 0.55));

  // ─── Speichern ────────────────────────────────────────────────────────────
  const outDir = `${__dirname}/../docs`;
  mkdirSync(outDir, { recursive: true });
  const outPath = `${outDir}/AI-Writer-Studio-Brochure.pdf`;
  const bytes = await pdf.save();
  writeFileSync(outPath, bytes);
  console.log(`PDF erstellt: ${outPath} (${(bytes.length / 1024).toFixed(1)} KB)`);
}

main().catch((e) => {
  console.error("Fehler:", e);
  process.exit(1);
});
