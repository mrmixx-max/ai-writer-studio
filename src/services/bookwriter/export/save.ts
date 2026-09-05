// Tauri-Speichern (C3): Export-Ergebnis per Tauri-Dialog an einen vom Nutzer
// gewählten Ort schreiben. Fallback im Browser/vitest: Blob-Download.
//
// Reine JS/Tauri-Implementierung — keine Rust-Anpassung nötig: plugin-dialog
// (save) + plugin-fs (writeFile) sind bereits Dependencies und konfiguriert.

export interface SaveExportResult {
  /** true, wenn gespeichert (Tauri oder Browser-Download). */
  saved: boolean;
  /** Zielpfad (Tauri) oder Dateiname (Browser-Download). */
  path: string | null;
  /** false = Nutzer hat den Dialog abgebrochen. */
  cancelled: boolean;
  error: string | null;
}

/** true, wenn die App im Tauri-Desktop-Kontext läuft. */
function hasTauri(): boolean {
  return typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
}

/**
 * Speichert einen Export-Blob.
 * Tauri: Save-Dialog (Titel/Filters je Format) → writeFile.
 * Browser: klassischer Download (Fallback, u.a. für Tests).
 */
export async function saveExportBlob(
  blob: Blob,
  defaultFilename: string,
  format: "md" | "docx" | "epub" | "opml",
  onProgress?: (percent: number, label: string) => void,
): Promise<SaveExportResult> {
  const filters = [
    format === "md"
      ? { name: "Markdown", extensions: ["md"] }
      : format === "docx"
        ? { name: "Word-Dokument", extensions: ["docx"] }
        : format === "opml"
          ? { name: "OPML-Outline (Scrivener)", extensions: ["opml"] }
          : { name: "EPUB", extensions: ["epub"] },
  ];

  if (hasTauri()) {
    try {
      onProgress?.(10, "Speichern-Dialog wird geöffnet…");
      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({
        defaultPath: defaultFilename,
        filters,
      });
      if (!path) return { saved: false, path: null, cancelled: true, error: null };

      onProgress?.(50, "Datei wird geschrieben…");
      const { writeFile } = await import("@tauri-apps/plugin-fs");
      const data = new Uint8Array(await blob.arrayBuffer());
      await writeFile(path, data);

      onProgress?.(100, "Gespeichert.");
      return { saved: true, path, cancelled: false, error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { saved: false, path: null, cancelled: false, error: msg };
    }
  }

  // Browser-Fallback: Download auslösen.
  onProgress?.(50, "Download wird gestartet…");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  onProgress?.(100, "Download gestartet.");
  return { saved: true, path: defaultFilename, cancelled: false, error: null };
}