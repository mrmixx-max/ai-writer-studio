// Publishing-Assistent: KDP-Upload-Checklist, KI-Metadaten,
// 3D-Cover-Mockup und Publishing-History in einem Panel.

import { useCallback, useEffect, useState } from "react";
import { useI18n, type TranslationKey } from "@/i18n";
import { useProjectStore } from "@/store/projectStore";
import { loadActiveRun, loadArtifact } from "@/services/bookwriter/state";
import { validateKdpMetadata } from "@/services/kdp/validation";
import { downloadKdpPackage } from "@/services/kdp/packaging";
import { addPublishingEntry } from "@/services/kdp/history";
import type { ChapterData } from "@/services/bookwriter/workflow";
import type { KdpMetadata } from "@/types/bookwriter";
import { KdpUploadChecklist } from "./KdpUploadChecklist";
import { MetadataGenerator } from "./MetadataGenerator";
import { CoverMockup } from "./CoverMockup";
import { PublishingHistory } from "./PublishingHistory";
import "./publishing.css";

type Tab = "checklist" | "metadata" | "cover" | "history";
type Notice = { text: string; kind: "ok" | "warn" | "err" } | null;

const TABS: { id: Tab; key: TranslationKey }[] = [
  { id: "checklist", key: "pub.tab.checklist" },
  { id: "metadata", key: "pub.tab.metadata" },
  { id: "cover", key: "pub.tab.cover" },
  { id: "history", key: "pub.tab.history" },
];

export function PublishingAssistantPanel({ projectId }: { projectId: string | null }) {
  const { t } = useI18n();
  const proj = useProjectStore();
  const [tab, setTab] = useState<Tab>("checklist");
  const [baseMetadata, setBaseMetadata] = useState<KdpMetadata | null>(null);
  const [overrides, setOverrides] = useState<Partial<KdpMetadata>>({});
  const [chapters, setChapters] = useState<ChapterData[]>([]);
  const [authorName, setAuthorName] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [historyKey, setHistoryKey] = useState(0);

  const reload = useCallback(() => {
    setBaseMetadata(null);
    setOverrides({});
    setChapters([]);
    setNotice(null);
    if (!projectId) return;
    try {
      const run = loadActiveRun(projectId);
      if (!run) {
        setNotice({ text: t("pub.noRun"), kind: "warn" });
        return;
      }
      const meta =
        loadArtifact<KdpMetadata>(run.id, "metadata") ?? loadArtifact<KdpMetadata>(run.id, "metadaten");
      if (!meta) {
        setNotice({ text: t("pub.noMeta"), kind: "warn" });
        return;
      }
      setBaseMetadata(meta);
      setAuthorName(meta.authorBio.split(" ")[0]?.trim() || undefined);
      setChapters(loadArtifact<ChapterData[]>(run.id, "manuskript") ?? []);
    } catch {
      // DB noch nicht bereit.
    }
  }, [projectId, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  const metadata: KdpMetadata | null = baseMetadata ? { ...baseMetadata, ...overrides } : null;

  const applyPatch = useCallback(
    (patch: Partial<KdpMetadata>) => setOverrides((o) => ({ ...o, ...patch })),
    [],
  );

  async function exportPackage() {
    if (!metadata) return;
    if (chapters.length === 0) {
      setNotice({ text: t("pub.noChapters"), kind: "err" });
      return;
    }
    const validation = validateKdpMetadata(metadata);
    if (!validation.isValid) {
      setNotice({ text: t("pub.invalidMeta", { count: validation.errorCount }), kind: "err" });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const projName = proj.projects.find((p) => p.id === proj.activeProjectId)?.name ?? "Buch";
      const result = await downloadKdpPackage(
        chapters,
        metadata,
        projName,
        metadata.authorBio.split(" ")[0]?.trim() || "Autor",
      );
      await addPublishingEntry({
        projectTitle: projName,
        bookTitle: metadata.title,
        kind: "export",
        fileCount: result.files.length,
        totalSizeBytes: result.totalSizeBytes,
        metaSummary: {
          keywordCount: metadata.keywords.filter((k) => k.trim()).length,
          categoryCount: metadata.categories.filter((c) => c.trim()).length,
          descriptionChars: metadata.blurbVariants.join(" ").length,
          hasCover: Boolean(metadata.coverImage),
        },
      });
      setHistoryKey((k) => k + 1);
      setNotice({
        text: t("pub.exported", {
          files: result.files.length,
          kb: Math.round(result.totalSizeBytes / 1024),
          folder: result.folderName,
        }),
        kind: "ok",
      });
    } catch (e) {
      setNotice({ text: (e as Error)?.message ?? String(e), kind: "err" });
    } finally {
      setBusy(false);
    }
  }

  if (!projectId) {
    return <div className="pub mode-placeholder">{t("pub.noProject")}</div>;
  }

  return (
    <div className="pub">
      <div className="pub-head">
        <h3>{t("pub.title")}</h3>
        <button className="pub-reload" onClick={reload} title={t("pub.reloadTitle")}>↻</button>
      </div>

      {notice && <div className={`pub-notice pub-notice-${notice.kind}`}>{notice.text}</div>}

      {!metadata && !notice && <div className="pub-empty">{t("pub.loading")}</div>}

      {metadata && (
        <>
          <div className="pub-tabs" role="tablist">
            {TABS.map((tb) => (
              <button
                key={tb.id}
                role="tab"
                aria-selected={tab === tb.id}
                className={`pub-tab${tab === tb.id ? " active" : ""}`}
                onClick={() => setTab(tb.id)}
              >
                {t(tb.key)}
              </button>
            ))}
          </div>

          {tab === "checklist" && (
            <>
              <KdpUploadChecklist metadata={metadata} />
              <div className="pub-price-edit">
                <label>
                  {t("pub.priceLabel")}
                  <input
                    type="number"
                    min={0.99}
                    max={200}
                    step={0.01}
                    value={metadata.priceUsd ?? ""}
                    onChange={(e) =>
                      applyPatch({ priceUsd: e.target.value === "" ? null : Number(e.target.value) })
                    }
                  />
                </label>
              </div>
              <button className="pub-export" onClick={exportPackage} disabled={busy || chapters.length === 0}>
                {busy ? t("pub.exporting") : t("pub.exportBtn")}
              </button>
            </>
          )}

          {tab === "metadata" && <MetadataGenerator metadata={metadata} authorName={authorName} onApply={applyPatch} />}

          {tab === "cover" && <CoverMockup metadata={metadata} title={metadata.title} />}

          {tab === "history" && <PublishingHistory refreshKey={historyKey} />}
        </>
      )}
    </div>
  );
}
