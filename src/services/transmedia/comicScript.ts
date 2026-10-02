/**
 * Comic-Skript-Service — WP 26.1 (Transmedia Franchise & Comic-Skript-Studio)
 *
 * Lokaler, deterministischer Service zur Erkennung von Panels, Sprechblasen,
 * Gedankenblasen und Onomatopoesie in Manuskripten. Verknüpft Figuren-Fakten
 * mediumübergreifend und exportiert Standard-Comic-Skripte.
 * Keine LLM-Aufrufe.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type BalloonType = 'dialogue' | 'thought' | 'shout';

export interface DialogueBalloon {
  type: BalloonType;
  character: string;
  text: string;
}

export interface ComicPanel {
  id: string;
  pageNumber: number;
  panelNumber: number;
  description: string;
  dialogue: DialogueBalloon[];
  sfx: string[];
}

export interface FranchiseSyncResult {
  character: string;
  fact: string;
  oldValue: string;
  newValue: string;
  affectedMedia: string[];
}

// ─── Konstanten ──────────────────────────────────────────────────────────────

const SFX_PATTERN = /\b(KRAKK|ZISCH|BAM|KNALL|KRACH|ZACK|PUFF|SPLATSCH|KLIRR|BRUMM|ZISCH|WUMM|KLOPF|KLATSCH|RIESSEL|SCHMATZ)\b/g;
const THOUGHT_PATTERN = /^(?:gedanke|thought|inneres|innerer\s+monolog):\s*(.+)/i;
const DIALOGUE_PATTERN = /^([A-ZÄÖÜ][a-zäöüß]+):\s*(.+)/i;
const SHOUT_PATTERN = /^([A-ZÄÖÜ][a-zäöüß]+)\s+(?:schreit|brüllt|schreit\s+los):\s*(.+)/i;
const PANEL_PATTERN = /^(?:(?:panel|seite|page)\s*)?(\d+)(?:\/(\d+))?:\s*(.*)/i;
const PAGE_BREAK = /^---\s*(?:seite|page)\s*(\d+)\s*---$/i;

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

let panelCounter = 0;

function nextPanelId(): string {
  panelCounter++;
  return `panel-${panelCounter}`;
}

function resetCounter(): void {
  panelCounter = 0;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Parst einen Comic-Skript-Text und erkennt Panels, Sprechblasen,
 * Gedankenblasen und Onomatopoesie.
 */
export function parseComicScript(text: string): ComicPanel[] {
  if (!text || typeof text !== 'string') return [];

  resetCounter();
  const panels: ComicPanel[] = [];
  const lines = text.split('\n');

  let currentPage = 1;
  let currentPanel = 0;
  let currentDescription = '';
  let currentDialogue: DialogueBalloon[] = [];
  let currentSfx: string[] = [];

  const flushPanel = () => {
    if (currentPanel > 0 || currentDescription || currentDialogue.length > 0 || currentSfx.length > 0) {
      panels.push({
        id: nextPanelId(),
        pageNumber: currentPage,
        panelNumber: currentPanel,
        description: currentDescription,
        dialogue: [...currentDialogue],
        sfx: [...currentSfx],
      });
    }
    currentDescription = '';
    currentDialogue = [];
    currentSfx = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Seitenumbruch
    const pageMatch = line.match(PAGE_BREAK);
    if (pageMatch) {
      flushPanel();
      currentPage = parseInt(pageMatch[1], 10) || currentPage + 1;
      currentPanel = 0;
      continue;
    }

    // Panel-Header
    const panelMatch = line.match(PANEL_PATTERN);
    if (panelMatch) {
      flushPanel();
      currentPanel = parseInt(panelMatch[2] || panelMatch[1], 10) || currentPanel + 1;
      if (panelMatch[2]) {
        currentPage = parseInt(panelMatch[1], 10) || currentPage;
      }
      currentDescription = panelMatch[3]?.trim() || '';
      continue;
    }

    // SFX (Onomatopoesie)
    const sfxMatches = line.match(SFX_PATTERN);
    if (sfxMatches) {
      currentSfx.push(...sfxMatches);
      continue;
    }

    // Gedankenblase
    const thoughtMatch = line.match(THOUGHT_PATTERN);
    if (thoughtMatch) {
      currentDialogue.push({ type: 'thought', character: 'Erzähler', text: thoughtMatch[1].trim() });
      continue;
    }

    // Schrei
    const shoutMatch = line.match(SHOUT_PATTERN);
    if (shoutMatch) {
      currentDialogue.push({ type: 'shout', character: shoutMatch[1], text: shoutMatch[2].trim() });
      continue;
    }

    // Dialog
    const dialogueMatch = line.match(DIALOGUE_PATTERN);
    if (dialogueMatch) {
      currentDialogue.push({ type: 'dialogue', character: dialogueMatch[1], text: dialogueMatch[2].trim() });
      continue;
    }

    // Beschreibung (Fallback)
    if (!currentDescription) {
      currentDescription = line;
    }
  }

  flushPanel();
  return panels;
}

/**
 * Synchronisiert eine Figur-Eigenschaft mediumübergreifend.
 */
export function syncFranchiseFact(character: string, fact: string, value: string): FranchiseSyncResult {
  const safeCharacter = character?.trim() || 'Unbekannt';
  const safeFact = fact?.trim() || 'unbekannt';
  const safeValue = value?.trim() || '';

  return {
    character: safeCharacter,
    fact: safeFact,
    oldValue: '',
    newValue: safeValue,
    affectedMedia: ['comic', 'novel', 'script', 'game'],
  };
}

/**
 * Exportiert Panels als formatiertes Standard-Comic-Skript.
 */
export function exportToStandardScript(panels: ComicPanel[]): string {
  if (!panels || panels.length === 0) return '';

  const lines: string[] = [];
  lines.push('=== STANDARD COMIC SCRIPT ===');
  lines.push('');

  for (const panel of panels) {
    lines.push(`SEITE ${panel.pageNumber}, PANEL ${panel.panelNumber}`);
    lines.push('─'.repeat(40));

    if (panel.description) {
      lines.push(`BESCHREIBUNG: ${panel.description}`);
    }

    for (const balloon of panel.dialogue) {
      const prefix = balloon.type === 'thought' ? '💭' : balloon.type === 'shout' ? '💥' : '💬';
      lines.push(`${prefix} ${balloon.character}: ${balloon.text}`);
    }

    if (panel.sfx.length > 0) {
      lines.push(`SFX: ${panel.sfx.join(', ')}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}
