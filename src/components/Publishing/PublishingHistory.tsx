// Publishing-History: Verlauf aller KDP-Uploads/Exporte.

import { useEffect, useState } from "react";
import {
  clearPublishingHistory,
  loadPublishingHistory,
  type PublishingHistoryEntry,
} from "@/services/kdp/history";
import { AppDialog, type DialogRequest } from "@/components/Dialog/AppDialog";
import { useI18n, type Lang } from "@/i18n";

const DATE_LOCALE: Record<Lang, string> = {
  de: "de-DE",
  en: "en-GB",
  es: "es-ES",
  fr: "fr-FR",
};

function formatDate(iso: string, lang: Lang): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(DATE_LOCALE[lang], { dateStyle: "medium", timeStyle: "short" });
}

export function PublishingHistory({ refreshKey }: { refreshKey: number }) {
  const { t, lang } = useI18n();
  const [entries, setEntries] = useState<PublishingHistoryEntry[]>([]);
  const [dlg, setDlg] = useState<DialogRequest | null>(null);

  useEffect(() => {
    setEntries(loadPublishingHistory());
  }, [refreshKey]);

  async function clearAll() {
    const ok = await new Promise<boolean>((resolve) =>
      setDlg({ kind: "confirm", message: t("pub.historyClearConfirm"), resolve }),
    );
    if (!ok) return;
    await clearPublishingHistory();
    setEntries([]);
  }

  return (
    <section className="pub-section" data-testid="pub-history">
      <AppDialog request={dlg} onDone={() => setDlg(null)} />
      {entries.length === 0 ? (
        <div className="pub-empty">{t("pub.historyEmpty")}</div>
      ) : (
        <>
          <ul className="pub-history">
            {entries.map((e) => (
              <li key={e.id} className="pub-history-item">
                <span className="pub-history-date">{formatDate(e.publishedAt, lang)}</span>
                <span className="pub-history-body">
                  <strong>{e.bookTitle}</strong>
                  <span className="pub-history-meta">
                    {e.kind === "upload" ? t("pub.kindUpload") : t("pub.kindExport")} · {t("pub.files", { count: e.fileCount })} ·{" "}
                    {t("kdp.package.sizeKb", { kb: Math.round(e.totalSizeBytes / 1024) })} · {t("pub.keywords", { count: e.metaSummary.keywordCount })} ·{" "}
                    {t("pub.categories", { count: e.metaSummary.categoryCount })}{e.metaSummary.hasCover ? ` · ${t("pub.withCover")}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className="pub-actions">
            <button onClick={clearAll}>{t("pub.historyClear")}</button>
          </div>
        </>
      )}
    </section>
  );
}
