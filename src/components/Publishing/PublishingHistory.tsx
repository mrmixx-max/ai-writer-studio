// Publishing-History: Verlauf aller KDP-Uploads/Exporte.

import { useEffect, useState } from "react";
import {
  clearPublishingHistory,
  loadPublishingHistory,
  type PublishingHistoryEntry,
} from "@/services/kdp/history";
import { AppDialog, type DialogRequest } from "@/components/Dialog/AppDialog";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

export function PublishingHistory({ refreshKey }: { refreshKey: number }) {
  const [entries, setEntries] = useState<PublishingHistoryEntry[]>([]);
  const [dlg, setDlg] = useState<DialogRequest | null>(null);

  useEffect(() => {
    setEntries(loadPublishingHistory());
  }, [refreshKey]);

  async function clearAll() {
    const ok = await new Promise<boolean>((resolve) =>
      setDlg({ kind: "confirm", message: "Publishing-Verlauf wirklich löschen?", resolve }),
    );
    if (!ok) return;
    await clearPublishingHistory();
    setEntries([]);
  }

  return (
    <section className="pub-section" data-testid="pub-history">
      <AppDialog request={dlg} onDone={() => setDlg(null)} />
      {entries.length === 0 ? (
        <div className="pub-empty">Noch keine Uploads oder Exporte verzeichnet.</div>
      ) : (
        <>
          <ul className="pub-history">
            {entries.map((e) => (
              <li key={e.id} className="pub-history-item">
                <span className="pub-history-date">{formatDate(e.publishedAt)}</span>
                <span className="pub-history-body">
                  <strong>{e.bookTitle}</strong>
                  <span className="pub-history-meta">
                    {e.kind === "upload" ? "Upload" : "Export"} · {e.fileCount} Dateien ·{" "}
                    {Math.round(e.totalSizeBytes / 1024)} KB · {e.metaSummary.keywordCount} Keywords ·{" "}
                    {e.metaSummary.categoryCount} Kategorien{e.metaSummary.hasCover ? " · mit Cover" : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className="pub-actions">
            <button onClick={clearAll}>🗑 Verlauf löschen</button>
          </div>
        </>
      )}
    </section>
  );
}
