// Publishing-History: Verlauf aller KDP-Uploads/Exporte.

import { useEffect, useState } from "react";
import {
  clearPublishingHistory,
  loadPublishingHistory,
  type PublishingHistoryEntry,
} from "@/services/kdp/history";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

export function PublishingHistory({ refreshKey }: { refreshKey: number }) {
  const [entries, setEntries] = useState<PublishingHistoryEntry[]>([]);

  useEffect(() => {
    setEntries(loadPublishingHistory());
  }, [refreshKey]);

  async function clearAll() {
    if (!window.confirm("Publishing-Verlauf wirklich löschen?")) return;
    await clearPublishingHistory();
    setEntries([]);
  }

  return (
    <section className="pub-section" data-testid="pub-history">
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
