/**
 * Teleprompter-Service — WP 27.1 (Bühnen-Teleprompter & Lesungs-Coach)
 *
 * Lokaler, deterministischer Service zur Erkennung von Performance-Markup,
 * Berechnung von Scroll-Dauer und Formatierung für Bühnen-Ansicht.
 * Keine LLM-Aufrufe.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type Emphasis = 'bold' | 'italic' | 'highlight';
export type Modulation = 'quieter' | 'louder' | 'threatening' | 'faster' | 'slower';

export interface PerformanceLine {
  text: string;
  emphasis?: Emphasis;
  pause?: number; // Sekunden
  modulation?: Modulation;
}

// ─── Konstanten ──────────────────────────────────────────────────────────────

const PAUSE_PATTERN = /\[(?:pause|pausa|pause\s*:\s*(\d+)s?)\]/i;
const MODULATION_PATTERN = /\[(leiser\s*werden|drohend|schneller|langlouder|modulation:\s*(?:quieter|louder|threatening|faster|slower)|quieter|louder|threatening|faster|slower)\]/i;
const EMPHASIS_BOLD = /\*\*(.+?)\*\*/g;
const EMPHASIS_ITALIC = /\*(.+?)\*/g;
const EMPHASIS_HIGHLIGHT = /==(.+?)==/g;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Parst Performance-Markup und erkennt Betonungen, Pausen und Modulationen.
 */
export function parsePerformanceMarkup(text: string): PerformanceLine[] {
  if (!text || typeof text !== 'string') return [];

  const lines: PerformanceLine[] = [];
  const rawLines = text.split('\n');

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) continue;

    const result: PerformanceLine = { text: line };

    // Pause erkennen
    const pauseMatch = line.match(PAUSE_PATTERN);
    if (pauseMatch) {
      result.pause = pauseMatch[1] ? parseInt(pauseMatch[1], 10) : 2;
      result.text = line.replace(PAUSE_PATTERN, '').trim();
    }

    // Modulation erkennen
    const modMatch = line.match(MODULATION_PATTERN);
    if (modMatch) {
      const mod = modMatch[1]?.toLowerCase();
      if (mod === 'quieter' || mod === 'leiser werden') result.modulation = 'quieter';
      else if (mod === 'louder') result.modulation = 'louder';
      else if (mod === 'threatening' || mod === 'drohend') result.modulation = 'threatening';
      else if (mod === 'faster' || mod === 'schneller') result.modulation = 'faster';
      else if (mod === 'slower' || mod === 'langlouder') result.modulation = 'slower';
      result.text = result.text.replace(MODULATION_PATTERN, '').trim();
    }

    // Emphasis erkennen
    if (EMPHASIS_BOLD.test(result.text)) {
      result.emphasis = 'bold';
      result.text = result.text.replace(EMPHASIS_BOLD, '$1');
    } else if (EMPHASIS_HIGHLIGHT.test(result.text)) {
      result.emphasis = 'highlight';
      result.text = result.text.replace(EMPHASIS_HIGHLIGHT, '$1');
    } else if (EMPHASIS_ITALIC.test(result.text)) {
      result.emphasis = 'italic';
      result.text = result.text.replace(EMPHASIS_ITALIC, '$1');
    }

    if (result.text) {
      lines.push(result);
    }
  }

  return lines;
}

/**
 * Berechnet die Scroll-Dauer in Sekunden basierend auf Wörtern pro Minute.
 */
export function calculateScrollDuration(text: string, wpm: number): number {
  if (!text || typeof text !== 'string') return 0;
  const safeWpm = Math.max(1, wpm || 150);
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.round((words / safeWpm) * 60 * 100) / 100;
}

/**
 * Formatiert Performance-Lines für die Bühnen-Ansicht (Stage Mode).
 */
export function formatStageMode(lines: PerformanceLine[]): string {
  if (!lines || lines.length === 0) return '';

  const formatted: string[] = [];

  for (const line of lines) {
    let text = line.text;

    // Emphasis → HTML
    if (line.emphasis === 'bold') {
      text = `<strong>${text}</strong>`;
    } else if (line.emphasis === 'italic') {
      text = `<em>${text}</em>`;
    } else if (line.emphasis === 'highlight') {
      text = `<mark>${text}</mark>`;
    }

    // Modulation → data-Attribut
    if (line.modulation) {
      text = `<span data-modulation="${line.modulation}">${text}</span>`;
    }

    // Pause → data-Attribut
    if (line.pause) {
      text = `<span data-pause="${line.pause}">${text}</span>`;
    }

    formatted.push(`<div class="stage-line">${text}</div>`);
  }

  return formatted.join('\n');
}
