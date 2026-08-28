// Scrivener-Import: .scrivx (Binder-XML) → ImportedDocument.
// Eine .scrivx beschreibt die Binder-Struktur eines Scrivener-Projekts
// (Ordner/Texte, Reihenfolge). Die eigentlichen Texte liegen als .rtf/.txt im
// Projekt-Ordner (Files/Docs/<UUID>.rtf). Da .scriv ein Paket ist, akzeptieren
// wir beide Wege:
//   a) .scrivx-Datei + zugehöriger Ordner mit Files/Docs (Dateisystem-Zugriff)
//   b) nur .scrivx → Struktur-Import mit Platzhalter-Inhalten
// RTF wird vereinfacht entparst (Plain-Text-Extraktion, keine Formatierung).

import { ImportError, type ImportedChapter, type ImportedDocument, type ImportProgress } from "./types";
import { blocksToTipTap, type ImportBlock } from "./tiptap";

export interface ScrivenerImportOptions {
  /** Fortschritt-Callback. */
  onProgress?: ImportProgress;
  /**
   * Löst Binder-UUID → Text: Funktion, die die Rohdaten eines Docs liefert
   * (aus dem .scriv-Paket / Ordner). Optional: ohne Resolver nur Struktur.
   */
  docResolver?: (uuid: string) => Promise<string | null> | string | null;
  /** Nur Ordner mit IncludeInCompile berücksichtigen? Standard: alles. */
  onlyCompileIncluded?: boolean;
}

interface BinderNode {
  title: string;
  uuid: string;
  type: "folder" | "text";
  include: boolean;
  children: BinderNode[];
}

/** Parst .scrivx-XML-String zu einer Binder-Struktur. */
export function parseScrivx(xml: string): { title: string; root: BinderNode | null } {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new ImportError("Ungültige .scrivx-Datei (XML-Fehler).");
  }
  const binder = doc.getElementsByTagName("Binder")[0];
  const projectName =
    doc.getElementsByTagName("ProjectTitle")[0]?.textContent?.trim() ||
    doc.getElementsByTagName("Binding")[0]?.textContent?.trim() ||
    "Scrivener-Import";

  let root: BinderNode | null = null;
  const binderChildren = binder?.getElementsByTagName("BinderChildren")[0];
  if (binderChildren) {
    root = parseNode(binderChildren);
  }
  return { title: projectName, root };
}

function parseNode(container: Element): BinderNode {
  // Struktur: <BinderChildren>/<Children> enthält direkt <BinderItem>-Kinder.
  const items = Array.from(container.children).filter((el) => el.localName === "BinderItem");
  const nodes: BinderNode[] = items.map((item) => {
    const node: BinderNode = {
      title: item.getElementsByTagName("Title")[0]?.textContent?.trim() || "Ohne Titel",
      uuid: item.getAttribute("UUID") || "",
      type: item.getAttribute("Type") === "Folder" ? "folder" : "text",
      include: (item.getElementsByTagName("IncludeInCompile")[0]?.textContent?.trim() || "true") !== "false",
      children: [],
    };
    const childContainer = Array.from(item.children).find((el) => el.localName === "Children");
    if (childContainer) node.children = parseNode(childContainer).children;
    return node;
  });
  return { title: "", uuid: "", type: "folder", include: true, children: nodes };
}

/** Flacht den Binder in Kapitel-Ordnung (Tiefensuche, nur Compile-inkludierte). */
export function flattenBinder(root: BinderNode | null, onlyCompile = true): Array<{ title: string; uuid: string; isFolder: boolean }> {
  const out: Array<{ title: string; uuid: string; isFolder: boolean }> = [];
  const walk = (node: BinderNode, depth: number) => {
    if (!node.include && onlyCompile) return;
    if (node.type === "text") {
      out.push({ title: node.title, uuid: node.uuid, isFolder: false });
    } else if (depth > 0) {
      // Ordner werden als Kapitel-Trenner gemappt, wenn sie keine Text-Kinder haben
      const hasTextChildren = node.children.some((c) => c.type === "text" && (!onlyCompile || c.include));
      if (!hasTextChildren) out.push({ title: node.title, uuid: "", isFolder: true });
    }
    for (const child of node.children) walk(child, depth + 1);
  };
  if (root) {
    for (const child of root.children) walk(child, 0);
  }
  return out;
}

/** Einfache RTF→Text-Extraktion (Steuerwörter werden entfernt). */
export function rtfToText(rtf: string): string {
  // Hex-Escapes und Gruppen entfernen, \par zu Zeilenumbruch
  let s = rtf
    .replace(/\\'([0-9a-fA-F]{2})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\par[d]?\b/g, "\n")
    .replace(/\\line\b/g, "\n")
    .replace(/\\tab\b/g, "\t");
  // Gruppen mit ignorierten Zielen (\fonttbl, \colortbl, \stylesheet …) rauswerfen
  s = s.replace(/\{\\(?:\*|fonttbl|colortbl|stylesheet|info|pict|object)[^{}]*\}/g, "");
  s = s.replace(/\\[a-zA-Z]+-?\d*\s?/g, "");
  s = s.replace(/[{}]/g, "");
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n\n");
}

/** Konvertiert extrahierten Rohtext in Blöcke (Absätze, Schrägstrich-Titel). */
function textToBlocks(text: string): ImportBlock[] {
  return text
    .split(/\n{1,}/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => ({ type: "p" as const, text: l }));
}

/** Importiert ein Scrivener-Projekt aus .scrivx-Inhalt (+ optionalem Doc-Resolver). */
export async function importScrivener(
  scrivxXml: string,
  options: ScrivenerImportOptions = {},
): Promise<ImportedDocument> {
  const { onProgress, docResolver, onlyCompileIncluded = true } = options;
  onProgress?.(10, "Scrivener-Binder wird gelesen…");
  const { title, root } = parseScrivx(scrivxXml);
  const flat = flattenBinder(root, onlyCompileIncluded);
  if (flat.length === 0) {
    throw new ImportError("Binder enthält keine Dokumente.");
  }

  const chapters: ImportedChapter[] = [];
  for (let i = 0; i < flat.length; i++) {
    const entry = flat[i];
    onProgress?.(Math.round((i / flat.length) * 85), `„${entry.title}“ wird importiert…`);
    if (entry.isFolder && entry.uuid === "") {
      // Ordner ohne Text-Kinder: als Kapitel-Überschrift ohne Inhalt? Überspringen,
      // sofern kein nachfolgender Text folgt — der Resolver liefert nichts.
      if (!docResolver) continue;
    }
    let body = "";
    if (docResolver && entry.uuid) {
      const raw = await docResolver(entry.uuid);
      if (raw != null) {
        body = raw.trimStart().startsWith("{\\rtf") ? rtfToText(raw) : raw;
      }
    }
    const blocks = body ? textToBlocks(body) : [];
    chapters.push({
      title: entry.title,
      content: blocksToTipTap(blocks),
      orderIndex: chapters.length,
    });
  }
  if (chapters.length === 0) {
    throw new ImportError("Keine importierbaren Dokumente im Binder gefunden.");
  }
  onProgress?.(100, "Scrivener-Import fertig.");
  return { title, chapters };
}

/**
 * Import aus einer .scrivx-Datei + Liste der Docs-Dateien (z. B. aus dem
 * .scriv-Paket via JSZip geladen). Dateinamen im Format <UUID>.rtf/.txt.
 */
export async function importScrivenerWithFiles(
  scrivxXml: string,
  docFiles: Record<string, string>,
  options: Omit<ScrivenerImportOptions, "docResolver"> = {},
): Promise<ImportedDocument> {
  return importScrivener(scrivxXml, {
    ...options,
    docResolver: (uuid) => {
      const key = Object.keys(docFiles).find(
        (k) => k.toLowerCase().replace(/^.*\//, "").startsWith(uuid.toLowerCase()) ||
               k.includes(uuid),
      );
      return key ? docFiles[key] : null;
    },
  });
}
