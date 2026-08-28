// Vorlagen-Import/Export.
//
// Vorlagenpakete sind JSON-Dateien mit festem Format-Tag. Import ist
// defensiv: Alles, was nicht dem Schema entspricht, wird abgelehnt —
// nie stillschweigend repariert.

import type {
  BookTemplate,
  CharacterTemplate,
  PlotTemplate,
  TemplateBundle,
} from "./types";
import { bookTemplates } from "./bookTemplates";
import { characterTemplates } from "./characterTemplates";
import { plotTemplates } from "./plotTemplates";

export const TEMPLATE_FILE_EXTENSION = ".awtemplates.json";

const FORMAT = "ai-writer-studio/templates";

/** Serialisiert eine Auswahl von Vorlagen in ein Paket. */
export function buildBundle(selection: {
  bookId?: string;
  characterIds?: string[];
  plotId?: string;
}): TemplateBundle | null {
  const bundle: TemplateBundle = {
    format: FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
  };
  if (selection.bookId) {
    bundle.book = bookTemplates.find((t) => t.id === selection.bookId);
  }
  if (selection.characterIds?.length) {
    bundle.characters = characterTemplates.filter((t) =>
      selection.characterIds!.includes(t.id),
    );
  }
  if (selection.plotId) {
    bundle.plot = plotTemplates.find((t) => t.id === selection.plotId);
  }
  const empty = !bundle.book && !bundle.characters?.length && !bundle.plot;
  return empty ? null : bundle;
}

/** Lädt einen Vorlagen-String (JSON) und validiert das Paket. */
export function parseBundle(text: string): TemplateBundle {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Die Datei enthält kein gültiges JSON.");
  }
  const b = raw as TemplateBundle;
  if (!b || typeof b !== "object") {
    throw new Error("Die Datei enthält kein Vorlagen-Paket.");
  }
  if (b.format !== FORMAT) {
    throw new Error(
      `Unbekanntes Format "${String(b.format)}". Erwartet: ${FORMAT}.`,
    );
  }
  if (b.version !== 1) {
    throw new Error(`Nicht unterstützte Paketversion: ${String(b.version)}.`);
  }

  const hasBook = isBookTemplate(b.book);
  const characters = Array.isArray(b.characters)
    ? b.characters.filter(isCharacterTemplate)
    : undefined;
  const hasPlot = isPlotTemplate(b.plot);

  if (!hasBook && !characters?.length && !hasPlot) {
    throw new Error(
      "Das Paket enthält keine verwendbaren Vorlagen (Buch, Figuren oder Plot).",
    );
  }

  return {
    format: FORMAT,
    version: 1,
    exportedAt: typeof b.exportedAt === "string" ? b.exportedAt : "",
    book: hasBook ? (b.book as BookTemplate) : undefined,
    characters: characters?.length ? characters : undefined,
    plot: hasPlot ? (b.plot as PlotTemplate) : undefined,
  };
}

/** Lädt ein Paket aus einer Datei (Browser-File-API). */
export async function loadBundleFile(file: File): Promise<TemplateBundle> {
  return parseBundle(await file.text());
}

// ---- Strukturprüfungen ----

function isBookTemplate(v: unknown): boolean {
  const t = v as BookTemplate | undefined;
  return (
    !!t &&
    typeof t === "object" &&
    typeof t.id === "string" &&
    typeof t.name === "string" &&
    Array.isArray(t.chapters) &&
    t.chapters.every(
      (c) => typeof c?.title === "string" && typeof c?.description === "string",
    )
  );
}

function isCharacterTemplate(v: unknown): boolean {
  const t = v as CharacterTemplate | undefined;
  return (
    !!t &&
    typeof t === "object" &&
    typeof t.id === "string" &&
    typeof t.name === "string" &&
    typeof t.fields === "object" &&
    t.fields !== null
  );
}

function isPlotTemplate(v: unknown): boolean {
  const t = v as PlotTemplate | undefined;
  return (
    !!t &&
    typeof t === "object" &&
    typeof t.id === "string" &&
    typeof t.name === "string" &&
    Array.isArray(t.beats) &&
    t.beats.every(
      (b) => typeof b?.title === "string" && typeof b?.description === "string",
    )
  );
}

/** Löst die Buch-Vorlage aus einem Paket auf, falls vorhanden. */
export function resolveBookTemplate(
  bundle: TemplateBundle,
): BookTemplate | undefined {
  return bundle.book;
}
