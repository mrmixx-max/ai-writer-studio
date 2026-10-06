// ComicPanelOrchestrator (WP 77.1)
//
// Zerlegt Prosa in Comic-Seiten und Panels, kategorisiert Sprechblasen
// und generiert ein branchenübliches Comic-Skript.
// Deterministisch: FNV-1a + mulberry32. Keine Node-Module.

export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sprechblasen-Typ. */
export type BalloonType = "speech" | "thought" | "whisper" | "shout" | "caption";

/** Ein Panel. */
export interface ComicPanel {
  id: string;
  page: number;
  panel: number;
  type: "splash" | "standard" | "closeup" | "wide";
  description: string;
  balloon: BalloonType | null;
  dialogue: string;
}

/** Eine Comic-Seite. */
export interface ComicPage {
  page: number;
  panels: ComicPanel[];
}

/** Ein Comic-Skript. */
export interface ComicScript {
  title: string;
  pages: ComicPage[];
  totalPanels: number;
  format: "dark-horse" | "image" | "manga";
}

/** Balloon-Typ-Labels. */
export const BALLOON_LABELS: Record<BalloonType, string> = {
  speech: "Sprechblase",
  thought: "Gedankenblase",
  whisper: "Flüstern",
  shout: "Schreien",
  caption: "Caption",
};

/** Zerlegt Prosa in Panels. */
export function parseProseToPanels(text: string): ComicPanel[] {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const panels: ComicPanel[] = [];

  let page = 1;
  let panelNum = 1;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    if (sentence.length === 0) continue;

    // Bestimme Panel-Typ
    let type: ComicPanel["type"] = "standard";
    if (i === 0) type = "splash";
    else if (sentence.length < 30) type = "closeup";
    else if (sentence.length > 100) type = "wide";

    // Bestimme Balloon-Typ
    let balloon: BalloonType | null = null;
    if (sentence.includes("?") || sentence.includes("!")) balloon = "shout";
    else if (sentence.length < 20) balloon = "whisper";
    else if (sentence.startsWith("Er dachte") || sentence.startsWith("Sie dachte")) balloon = "thought";
    else if (sentence.length > 10) balloon = "speech";

    panels.push({
      id: `p-${page}-${panelNum}`,
      page,
      panel: panelNum,
      type,
      description: sentence,
      balloon,
      dialogue: balloon ? sentence : "",
    });

    panelNum++;
    if (panelNum > 4) {
      page++;
      panelNum = 1;
    }
  }

  return panels;
}

/** Gruppiert Panels in Seiten. */
export function groupPanelsIntoPages(panels: ComicPanel[]): ComicPage[] {
  const pages: ComicPage[] = [];
  let currentPage: ComicPage = { page: 1, panels: [] };

  for (const panel of panels) {
    if (panel.page > currentPage.page) {
      pages.push(currentPage);
      currentPage = { page: panel.page, panels: [] };
    }
    currentPage.panels.push(panel);
  }
  if (currentPage.panels.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

/** Erstellt ein vollständiges Comic-Skript. */
export function createComicScript(title: string, text: string, format: ComicScript["format"] = "dark-horse"): ComicScript {
  const panels = parseProseToPanels(text);
  const pages = groupPanelsIntoPages(panels);

  return {
    title,
    pages,
    totalPanels: panels.length,
    format,
  };
}

/** Formatiert ein Comic-Skript als Text. */
export function formatComicScript(script: ComicScript): string {
  const lines: string[] = [];
  lines.push(`=== COMIC-SKRIPT: ${script.title} ===`);
  lines.push(`Format: ${script.format}`);
  lines.push(`Seiten: ${script.pages.length}`);
  lines.push(`Panels: ${script.totalPanels}`);
  lines.push("");

  for (const page of script.pages) {
    lines.push(`PAGE ${page.page}`);
    for (const panel of page.panels) {
      lines.push(`  PANEL ${panel.panel} (${panel.type.toUpperCase()})`);
      if (panel.balloon) {
        lines.push(`    [${BALLOON_LABELS[panel.balloon]}] ${panel.dialogue}`);
      } else {
        lines.push(`    ${panel.description}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

/** Exportiert das Skript als Markdown. */
export function exportAsMarkdown(script: ComicScript): string {
  const lines: string[] = [];
  lines.push(`# ${script.title}`);
  lines.push("");
  lines.push(`**Format:** ${script.format}`);
  lines.push(`**Seiten:** ${script.pages.length}`);
  lines.push(`**Panels:** ${script.totalPanels}`);
  lines.push("");

  for (const page of script.pages) {
    lines.push(`## Seite ${page.page}`);
    lines.push("");
    for (const panel of page.panels) {
      lines.push(`### Panel ${panel.panel} (${panel.type})`);
      if (panel.balloon) {
        lines.push(`> **[${BALLOON_LABELS[panel.balloon]}]** ${panel.dialogue}`);
      } else {
        lines.push(panel.description);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

/** Erstellt ein Beispiel-Skript. */
export function createSampleScript(): ComicScript {
  const text = "Der Held stand auf dem Dach. Die Stadt brannte unter ihm. Er dachte an seine Familie. Er musste handeln. Der Feind kam näher. Ein letzter Kampf begann. Die Sonne ging auf. Die Rettung kam.";
  return createComicScript("Die Chroniken der Aetherie", text, "dark-horse");
}
