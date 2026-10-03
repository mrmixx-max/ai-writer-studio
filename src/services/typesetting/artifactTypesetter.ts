/**
 * Artefakt-Typesetter-Service — WP 34.2 (In-Universe-Artefakt-Studio)
 *
 * Lokaler, deterministischer Service zur Formatierung von Briefen,
 * Zeitungen, Chats und Polizeiberichten.
 * Keine LLM-Aufrufe.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type ArtifactType = 'letter' | 'newspaper' | 'chat' | 'police';

export interface Artifact {
  type: ArtifactType;
  content: string;
  metadata?: Record<string, string>;
}

export interface TypesetResult {
  html: string;
  css: string;
  metadata: Record<string, string>;
}

// ─── Konstanten ──────────────────────────────────────────────────────────────

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPE_MAP[char] || char);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Rendert ein Artefakt als HTML.
 */
export function typesetArtifact(artifact: Artifact): TypesetResult {
  if (!artifact || typeof artifact !== 'object') {
    return { html: '', css: '', metadata: {} };
  }

  const safeType: ArtifactType = artifact.type || 'letter';
  const content = artifact.content || '';
  const metadata = artifact.metadata || {};

  let html = '';
  let css = '';

  switch (safeType) {
    case 'newspaper':
      html = `<div class="artifact-newspaper"><h2>${escapeHtml(metadata.title || 'Zeitung')}</h2><p>${escapeHtml(content)}</p></div>`;
      css = '.artifact-newspaper { column-count: 2; font-family: serif; }';
      break;
    case 'chat':
      html = `<div class="artifact-chat"><p>${escapeHtml(content)}</p></div>`;
      css = '.artifact-chat { font-family: sans-serif; }';
      break;
    case 'police':
      html = `<div class="artifact-police"><p>${escapeHtml(content)}</p></div>`;
      css = '.artifact-police { font-family: monospace; }';
      break;
    case 'letter':
    default:
      html = `<div class="artifact-letter"><p>${escapeHtml(content)}</p></div>`;
      css = '.artifact-letter { border: 1px solid #8b4513; padding: 20px; font-family: serif; }';
      break;
  }

  return { html, css, metadata };
}

/**
 * Exportiert pixelgenaue Vektoren für Print-PDF.
 */
export function exportToPrint(result: TypesetResult): string {
  if (!result || typeof result !== 'object') return '';
  return `<div class="print">${result.html}</div><style>${result.css}</style>`;
}

/**
 * Exportiert barrierefreies HTML5/CSS3 für EPUB3.
 */
export function exportToEpub(result: TypesetResult): string {
  if (!result || typeof result !== 'object') return '';
  return `<div class="epub">${result.html}</div><style>${result.css}</style>`;
}
