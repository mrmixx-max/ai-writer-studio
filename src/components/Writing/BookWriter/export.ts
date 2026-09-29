// BookWriterPanel Export Logic - Export handling extracted from God Object

import { useCallback, useState } from "react";
import { exportBook, checkExportGate, formatNeedsRevisionWarning, saveExportBlob } from "@/services/bookwriter/export";
import { logger } from "@/services/logger";
import type { BookWriterState, BookWriterActions } from "./types";

/**
 * Hook for export functionality
 * Handles export progress, errors, and file download
 */
export function useExport(
  state: BookWriterState,
  actions: BookWriterActions,
  activeProjectId: string | null,
  storeChapters: Array<{ status: string; title: string; content: string; number: number }>,
  topic: string,
) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    if (!activeProjectId) return;

    // Filter chapters that can be exported (draft, completed, needs_revision)
    const exportable = storeChapters.filter(
      (ch) => ch.status === "draft" || ch.status === "completed" || ch.status === "needs_revision",
    );
    if (exportable.length === 0) {
      actions.setExportError("Keine exportierbaren Kapitel");
      return;
    }

    const gate = checkExportGate(
      exportable.map((ch) => ({
        number: ch.number,
        title: ch.title,
        content: ch.content,
        status: ch.status,
      })),
    );
    if (!gate.allowed) {
      actions.setExportError(
        `Export blockiert: ${gate.blocking.map((c) => `${c.number} (${c.status})`).join(", ")}`,
      );
      return;
    }
    if (gate.needsRevision.length > 0) {
      logger.warn(formatNeedsRevisionWarning(gate.needsRevision), "BookWriterPanel.export");
    }

    actions.setIsExporting(true);
    actions.setExportError(null);
    actions.setExportStatus("Export vorbereiten...");
    actions.setExportProgress(0);

    try {
      const result = await exportBook(
        {
          title: topic.trim() || "Unbenanntes Buch",
          author: "Autor",
          language: "de",
          chapters: exportable.map((ch) => ({
            number: ch.number,
            title: ch.title,
            content: ch.content,
            status: ch.status,
          })),
        },
        state.exportFormat,
        (pct, label) => {
          actions.setExportProgress(pct);
          actions.setExportStatus(label);
        },
      );
      const save = await saveExportBlob(
        result.blob,
        result.filename,
        state.exportFormat === "markdown" ? "md" : state.exportFormat,
        (pct, label) => {
          actions.setExportProgress(pct);
          actions.setExportStatus(label);
        },
      );
      if (save.cancelled) {
        actions.setExportStatus("Export abgebrochen");
      } else if (save.error) {
        actions.setExportError(`Speichern fehlgeschlagen: ${save.error}`);
        logger.error(`Export-Speichern fehlgeschlagen: ${save.error}`, "BookWriterPanel.export");
      } else {
        const warn = gate.needsRevision.length > 0
          ? ` ${formatNeedsRevisionWarning(gate.needsRevision)}`
          : "";
        actions.setExportStatus(
          `Export fertig → ${save.path ?? result.filename}${warn}`,
        );
        logger.info(
          `Book-Export ${state.exportFormat} → ${save.path ?? result.filename}`,
          "BookWriterPanel.export",
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      actions.setExportError(msg);
      logger.error("Export fehlgeschlagen", "BookWriterPanel.export", e);
    } finally {
      actions.setIsExporting(false);
      actions.setExportProgress(null);
    }
  }, [state, actions, activeProjectId, storeChapters, topic]);

  const handleCancelExport = useCallback(() => {
    actions.setIsExporting(false);
    actions.setExportProgress(null);
    actions.setExportStatus(null);
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }
  }, [actions, downloadUrl]);

  return {
    handleExport,
    handleCancelExport,
    downloadUrl,
  };
}