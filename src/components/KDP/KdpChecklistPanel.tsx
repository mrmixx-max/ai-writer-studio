// KDP-Checklist-Panel.
//
// Zeigt die KDP-Checkliste des aktiven Bookwriter-Laufs: Metadaten-Prüfung,
// Ampel pro Punkt und den KDP-Export (Paket-Download) direkt aus dem Panel.

import { useCallback, useEffect, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { loadActiveRun, loadArtifact } from "@/services/bookwriter/state";
import {
  buildKdpChecklist,
  validateKdpMetadata,
  type KdpChecklistItem,
} from "@/services/kdp/validation";
import { downloadKdpPackage } from "@/services/kdp/packaging";
import type { ChapterData } from "@/services/bookwriter/workflow";
import type { KdpMetadata } from "@/types/bookwriter";
import "./kdp.css";

type Notice = { text: string; kind: "ok" | "warn" | "err" } | null;

const STATUS_ICON: Record<KdpChecklistItem["status"], string> = {
  ok: "✔",
  warn: "⚠",
  err: "✘",
};

export function KdpChecklistPanel({ projectId }: { projectId: string | null }) {
  const proj = useProjectStore();
  const [metadata, setMetadata] = useState<KdpMetadata | null>(null);
  const [chapters, setChapters] = useState<ChapterData[]>([]);
  const [busy, setBusy] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const reload = useCallback(() => {
    setMetadata(null);
    setChapters([]);
    setNotice(null);
    if (!projectId) return;
    try {
      const run = loadActiveRun(projectId);
      if (!run) {
        setNotice({ text: "Kein Bookwriter-Lauf für dieses Projekt aktiv.", kind: "warn" });
        return;
      }
      const meta = loadArtifact<KdpMetadata>(run.id, "metadata") ?? loadArtifact<KdpMetadata>(run.id, "metadaten");
      if (!meta) {
        setNotice({ text: "Noch keine KDP-Metadaten — bitte zuerst die Metadaten-Phase ausführen.", kind: "warn" });
        return;
      }
      setMetadata(meta);
      const chs = loadArtifact<ChapterData[]>(run.id, "manuskript") ?? [];
      setChapters(chs);
    } catch {
      // DB noch nicht bereit.
    }
  }, [projectId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function exportPackage() {
    if (!metadata) return;
    if (chapters.length === 0) {
      setNotice({ text: "Keine Kapitel vorhanden — bitte zuerst die Manuskript-Phase ausführen.", kind: "err" });
      return;
    }
    const validation = validateKdpMetadata(metadata);
    if (!validation.isValid) {
      setNotice({ text: `Metadaten haben ${validation.errorCount} Fehler — Export blockiert.`, kind: "err" });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const authorName = metadata.authorBio.split(" ")[0]?.trim() || "Autor";
      const projName = proj.projects.find((p) => p.id === proj.activeProjectId)?.name ?? "Buch";
      const result = await downloadKdpPackage(
        chapters,
        metadata,
        projName,
        authorName,
        (_p, label) => setProgressLabel(label),
      );
      setNotice({
        text: `KDP-Paket exportiert: ${result.files.length} Dateien (${Math.round(result.totalSizeBytes / 1024)} KB) in "${result.folderName}".`,
        kind: "ok",
      });
    } catch (e) {
      setNotice({ text: (e as Error)?.message ?? String(e), kind: "err" });
    } finally {
      setBusy(false);
      setProgressLabel(null);
    }
  }

  if (!projectId) {
    return <div className="kdp mode-placeholder">Wähle links ein Projekt, um die KDP-Checkliste zu sehen.</div>;
  }

  const checklist = metadata ? buildKdpChecklist(metadata) : [];
  const doneCount = checklist.filter((c) => c.status !== "err").length;

  return (
    <div className="kdp">
      <div className="kdp-head">
        <h3>KDP-Checkliste</h3>
        <button className="kdp-reload" onClick={reload} title="Neu laden">↻</button>
      </div>

      {notice && (
        <div className={`kdp-notice kdp-notice-${notice.kind}`}>{notice.text}</div>
      )}

      {!metadata && !notice && (
        <div className="kdp-empty">Lädt…</div>
      )}

      {metadata && (
        <>
          <div className="kdp-summary">
            {doneCount}/{checklist.length} Punkte erfüllt
            <div className="kdp-bar">
              <div
                className="kdp-bar-fill"
                style={{ width: `${Math.round((doneCount / Math.max(checklist.length, 1)) * 100)}%` }}
              />
            </div>
          </div>

          <ul className="kdp-list">
            {checklist.map((item) => (
              <li key={item.id} className={`kdp-item kdp-item-${item.status}`}>
                <span className="kdp-item-icon">{STATUS_ICON[item.status]}</span>
                <span className="kdp-item-body">
                  <span className="kdp-item-label">{item.label}</span>
                  <span className="kdp-item-hint">{item.hint}</span>
                </span>
              </li>
            ))}
          </ul>

          {metadata.coverImage && (
            <div className="kdp-cover">
              <img src={metadata.coverImage} alt="Cover-Vorschau" />
            </div>
          )}

          <button
            className="kdp-export"
            onClick={exportPackage}
            disabled={busy || chapters.length === 0}
          >
            {busy ? (progressLabel ?? "Export läuft…") : "KDP-Paket exportieren"}
          </button>
          <p className="kdp-note">
            Enthält DOCX, PDF, EPUB, Cover und kdp-metadata.json in einem Ordner.
          </p>
        </>
      )}
    </div>
  );
}
