// FormatToolbar: eigenständige Textformatierungs-Toolbar (Sprint 14, Agent 2).
//
// Bewusst NICHT in die bestehende Editor-Toolbar (Editor.tsx, .editor-toolbar)
// integriert — diese Datei bleibt unangetastet. Die Toolbar arbeitet auf
// Plaintext (getText/onApply) und delegiert jede Aktion an den
// Formatierungs-Service von Agent 1 (`@/services/formatting/textFormat`).
// Der Service wird per Default lazily geladen; per `actions`-Prop lassen sich
// alle vier Aktionen injizieren (Tests, Storybook, abweichende Services).
import "./FormatToolbar.css";
import {
  applySmartQuotes,
  convertDashes,
  findChapterHeadings,
  formatDocument,
} from "@/services/formatting/textFormat";

export type FormatActionId =
  | "smart-quotes"
  | "auto-paragraph"
  | "fix-dashes"
  | "detect-chapters";

export type FormatFn = (text: string) => string;

export type FormatActions = Record<FormatActionId, FormatFn>;

// Default-Verdrahtung auf den Agent-1-Service (Sprint 14,
// `src/services/formatting/textFormat.ts`):
// - Smart Quotes → applySmartQuotes (de-Default: „…")
// - Auto-Paragraph → formatDocument (absatzweise Normalisierung + Formatierung)
// - Fix Dashes → convertDashes (–/—)
// - Detect Chapter Headings → findChapterHeadings; erkannte Zeilen werden als
//   Markdown-Headings markiert (`# …`), der Rest bleibt unverändert.
function markChapterHeadings(text: string): string {
  const found = new Set(
    findChapterHeadings(text).map((a) => a.lineIndex),
  );
  if (found.size === 0) return text;
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line, i) =>
      found.has(i) && !/^#{1,3}\s/.test(line) ? `# ${line.trim()}` : line,
    )
    .join("\n");
}

const DEFAULT_ACTIONS: FormatActions = {
  "smart-quotes": (text) => applySmartQuotes(text),
  "auto-paragraph": (text) => formatDocument(text),
  "fix-dashes": (text) => convertDashes(text),
  "detect-chapters": (text) => markChapterHeadings(text),
};

export interface FormatToolbarProps {
  /** Liefert den zu formatierenden Text (z. B. Editor-Selektion/Absatz). */
  getText: () => string;
  /** Empfängt (Aktions-ID, formatierter Text) — der Host wendet das Ergebnis an. */
  onApply: (actionId: FormatActionId, formatted: string) => void;
  /** Optionale Overrides/Injektion aller oder einzelner Aktionen. */
  actions?: Partial<FormatActions>;
  /**
   * Optionale Injektion des Service-Loaders (Default: Lazy-Load von Agent 1).
   * Primär ein Test-Seam — damit hängt kein Test vom realen Modul-Import ab.
   */
  serviceLoader?: () => Promise<Partial<FormatActions>>;
  /** Wird bei fehlendem/lädiertem Service oder Host-Fehlern aufgerufen. */
  onError?: (actionId: FormatActionId, error: unknown) => void;
  /** Deaktiviert alle Buttons (z. B. während KI-Operationen). */
  disabled?: boolean;
}

// Default-Auflösung: statisch importierte Agent-1-Funktionen (s. oben).
// Der `serviceLoader`-Seam erlaubt Overrides in Tests/Hosts; ohne ihn und
// ohne `actions`-Eintrag greifen die DEFAULT_ACTIONS — fehlt eine Aktion,
// meldet die Toolbar via onError statt zu crashen.

const BUTTONS: { id: FormatActionId; label: string; title: string }[] = [
  {
    id: "smart-quotes",
    label: "Smart Quotes",
    title: "Gerade Anführungszeichen in typografische umwandeln („…“)",
  },
  {
    id: "auto-paragraph",
    label: "Auto-Paragraph",
    title: "Leerzeilen in Absatz-Trennungen normalisieren",
  },
  {
    id: "fix-dashes",
    label: "Fix Dashes",
    title: "Bindestriche/Gedankenstriche typografisch korrigieren (–/—)",
  },
  {
    id: "detect-chapters",
    label: "Detect Chapter Headings",
    title: "Kapitelüberschriften im Text erkennen und markieren",
  },
];

export function FormatToolbar({
  getText,
  onApply,
  actions,
  serviceLoader,
  onError,
  disabled = false,
}: FormatToolbarProps) {
  const handleAction = async (actionId: FormatActionId) => {
    try {
      let fn = actions?.[actionId];
      if (!fn) {
        const service = serviceLoader
          ? await serviceLoader()
          : DEFAULT_ACTIONS;
        fn = service[actionId];
      }
      if (!fn) {
        throw new Error(
          `Formatierungs-Service nicht verfügbar (Aktion: ${actionId})`,
        );
      }
      const formatted = fn(getText());
      onApply(actionId, formatted);
    } catch (error) {
      onError?.(actionId, error);
    }
  };

  return (
    <div
      className="format-toolbar"
      role="toolbar"
      aria-label="Textformatierung"
    >
      {BUTTONS.map(({ id, label, title }) => (
        <button
          key={id}
          type="button"
          className="format-toolbar__button"
          title={title}
          aria-label={label}
          disabled={disabled}
          onClick={() => void handleAction(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
