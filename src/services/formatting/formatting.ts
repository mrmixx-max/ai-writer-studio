// Erweiterte Formatierungs-Engine (Sprint 24, Agent 5) — Markdown-Toolbar + Shortcuts.
//
// Reine Funktionen, keine Seiteneffekte. Arbeitet auf Plaintext/Markdown
// (editor-unabhängig, testbar). Ergänzt die bestehende Engine aus Sprint 14
// (`textFormat.ts`: Smart Quotes, Dashes, Kapitel-Erkennung) — diese Datei
// bleibt unangetastet.
export interface FormatAction {
  id: string;
  label: string;
  shortcut?: string;
  icon: string;
  action: (selection: string) => string;
}

export interface FormatCategory {
  id: string;
  label: string;
  actions: FormatAction[];
}

/** Platzhalter, wenn eine Aktion ohne Selektion aufgerufen wird. */
export const EMPTY_SELECTION_PLACEHOLDER = "Text";

function withPlaceholder(selection: string): string {
  return selection.length > 0 ? selection : EMPTY_SELECTION_PLACEHOLDER;
}

const TABLE_TEMPLATE = "| Spalte 1 | Spalte 2 |\n| --- | --- |\n|  |  |";

const CATEGORIES: FormatCategory[] = [
  {
    id: "basis",
    label: "Basis",
    actions: [
      { id: "bold", label: "Fett", shortcut: "Ctrl+B", icon: "𝐁", action: (s) => `**${withPlaceholder(s)}**` },
      { id: "italic", label: "Kursiv", shortcut: "Ctrl+I", icon: "𝐼", action: (s) => `*${withPlaceholder(s)}*` },
      { id: "strikethrough", label: "Durchgestrichen", shortcut: "Ctrl+Shift+X", icon: "𝐒", action: (s) => `~~${withPlaceholder(s)}~~` },
      { id: "code", label: "Code", shortcut: "Ctrl+E", icon: "⌨", action: (s) => `\`${withPlaceholder(s)}\`` },
    ],
  },
  {
    id: "headings",
    label: "Überschriften",
    actions: [
      { id: "h1", label: "H1", shortcut: "Ctrl+1", icon: "𝐇𝟏", action: (s) => `# ${withPlaceholder(s)}` },
      { id: "h2", label: "H2", shortcut: "Ctrl+2", icon: "𝐇𝟐", action: (s) => `## ${withPlaceholder(s)}` },
      { id: "h3", label: "H3", shortcut: "Ctrl+3", icon: "𝐇𝟑", action: (s) => `### ${withPlaceholder(s)}` },
    ],
  },
  {
    id: "lists",
    label: "Listen",
    actions: [
      {
        id: "unordered",
        label: "Aufzählung",
        shortcut: "Ctrl+L",
        icon: "•",
        action: (s) =>
          withPlaceholder(s)
            .split("\n")
            .map((line) => (line.trim().length > 0 ? `- ${line}` : line))
            .join("\n"),
      },
      {
        id: "ordered",
        label: "Nummeriert",
        shortcut: "Ctrl+Shift+L",
        icon: "𝟏.",
        action: (s) =>
          withPlaceholder(s)
            .split("\n")
            .map((line, i) => (line.trim().length > 0 ? `${i + 1}. ${line}` : line))
            .join("\n"),
      },
      {
        id: "task",
        label: "Aufgabe",
        shortcut: "Ctrl+Shift+T",
        icon: "☐",
        action: (s) =>
          withPlaceholder(s)
            .split("\n")
            .map((line) => (line.trim().length > 0 ? `- [ ] ${line}` : line))
            .join("\n"),
      },
    ],
  },
  {
    id: "links",
    label: "Links",
    actions: [
      { id: "link", label: "Link", shortcut: "Ctrl+K", icon: "🔗", action: (s) => `[${withPlaceholder(s)}](url)` },
      { id: "image", label: "Bild", shortcut: "Ctrl+Shift+I", icon: "🖼", action: (s) => `![${withPlaceholder(s)}](url)` },
      { id: "footnote", label: "Fußnote", shortcut: "Ctrl+Shift+F", icon: "‡", action: (s) => `${withPlaceholder(s)}[^1]` },
    ],
  },
  {
    id: "quotes",
    label: "Zitate",
    actions: [
      {
        id: "blockquote",
        label: "Zitat",
        shortcut: "Ctrl+Q",
        icon: "❝",
        action: (s) =>
          withPlaceholder(s)
            .split("\n")
            .map((line) => (line.trim().length > 0 ? `> ${line}` : line))
            .join("\n"),
      },
      { id: "pullquote", label: "Pull Quote", icon: "💬", action: (s) => `> **${withPlaceholder(s)}**` },
    ],
  },
  {
    id: "tables",
    label: "Tabellen",
    actions: [
      {
        id: "table",
        label: "Tabelle einfügen",
        shortcut: "Ctrl+T",
        icon: "▦",
        action: (s) => (s.length > 0 ? `| ${s} |  |\n| --- | --- |\n|  |  |` : TABLE_TEMPLATE),
      },
    ],
  },
  {
    id: "separators",
    label: "Trenner",
    actions: [
      { id: "hr", label: "Trennlinie", shortcut: "Ctrl+Shift+H", icon: "―", action: (s) => (s.length > 0 ? `${s}\n\n---\n\n` : `\n\n---\n\n`) },
      {
        id: "pagebreak",
        label: "Seitenumbruch",
        icon: "⏏",
        action: (s) =>
          s.length > 0
            ? `${s}\n\n<div style="page-break-after: always"></div>\n\n`
            : `\n\n<div style="page-break-after: always"></div>\n\n`,
      },
    ],
  },
];

/** Gibt alle Format-Kategorien (7) mit ihren Aktionen zurück. */
export function getFormatCategories(): FormatCategory[] {
  return CATEGORIES;
}

/** Wendet die Aktion mit der gegebenen ID auf die Selektion an. Wirft bei unbekannter ID. */
export function applyFormat(actionId: string, selection: string): string {
  for (const category of CATEGORIES) {
    const found = category.actions.find((a) => a.id === actionId);
    if (found) return found.action(selection);
  }
  throw new Error(`Unbekannte Format-Aktion: ${actionId}`);
}

/** Wrappt Text mit dem gegebenen Wrapper (z. B. "**" für Fett). */
export function wrapText(text: string, wrapper: string): string {
  return `${wrapper}${text}${wrapper}`;
}

/** Fügt `insertion` an `cursorPos` in `text` ein; Position wird geclampt. */
export function insertAtCursor(
  text: string,
  insertion: string,
  cursorPos: number,
): { text: string; newCursor: number } {
  const pos = Math.max(0, Math.min(cursorPos, text.length));
  return {
    text: `${text.slice(0, pos)}${insertion}${text.slice(pos)}`,
    newCursor: pos + insertion.length,
  };
}

/** Gibt alle Tastaturkürzel (Taste → Aktions-ID) zurück. */
export function getKeyboardShortcuts(): { key: string; action: string }[] {
  const out: { key: string; action: string }[] = [];
  for (const category of CATEGORIES) {
    for (const a of category.actions) {
      if (a.shortcut) out.push({ key: a.shortcut, action: a.id });
    }
  }
  return out;
}

/**
 * Entfernt Markdown-Formatierung (für den "Alle entfernen"-Button im Panel).
 * Bewusst heuristisch: Bold/Italic/Strike/Code-Wrapper, Heading-Präfixe,
 * Listen-/Task-/Quote-Präfixe, Link-/Bild-Syntax, Fußnoten-Marker,
 * Tabellen-Trennzeilen und Trenner werden aufgelöst bzw. entfernt.
 */
export function stripFormatting(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      let l = line;
      l = l.replace(/^#{1,3}\s+/, "");
      l = l.replace(/^>\s?/, "");
      l = l.replace(/^(\d+\.\s+|- \[ [ xX]?\]\s+|-\s+)/, "");
      if (/^\|?[\s:|-]+\|[\s:|.-]*$/.test(l.trim()) && l.includes("|")) return "";
      l = l.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
      l = l.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
      l = l.replace(/\[\^[^\]]+\]/g, "");
      l = l.replace(/~~(.+?)~~/g, "$1");
      l = l.replace(/\*\*(.+?)\*\*/g, "$1");
      l = l.replace(/(^|\W)\*(?=\S)(.+?)(?<=\S)\*(?=\W|$)/g, "$1$2");
      l = l.replace(/`(.+?)`/g, "$1");
      if (/^---+$/.test(l.trim())) return "";
      if (/<div style="page-break-after[^>]*><\/div>/.test(l)) return "";
      return l;
    })
    .filter((l, i, arr) => !(l === "" && (i === 0 || arr[i - 1] === "")))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
