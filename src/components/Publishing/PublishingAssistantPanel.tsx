// Publishing-Assistent: KDP-Upload-Checklist, KI-Metadaten,
// 3D-Cover-Mockup und Publishing-History in einem Panel.

import { useCallback, useEffect, useState } from "react";
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

const TABS: { id: Tab; label: string }[] = [
  { id: "checklist", label: "✅ Upload-Checklist" },
  { id: "metadata", label: "🪄 Metadaten-KI" },
  { id: "cover", label: "📕 Cover-Vorschau" },
  { id: "history", label: "🕒 History" },
];

export function PublishingAssistantPanel({ projectId }: { projectId: string | null }) {
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
        setNotice({ text: "Kein Bookwriter-Lauf für dieses Projekt aktiv.", kind: "warn" });
        return;
      }
      const meta =
        loadArtifact<KdpMetadata>(run.id, "metadata") ?? loadArtifact<KdpMetadata>(run.id, "metadaten");
      if (!meta) {
        setNotice({ text: "Noch keine KDP-Metadaten — bitte zuerst die Metadaten-Phase ausführen.", kind: "warn" });
        return;
      }
      setBaseMetadata(meta);
      setAuthorName(meta.authorBio.split(" ")[0]?.trim() || undefined);
      setChapters(loadArtifact<ChapterData[]>(run.id, "manuskript") ?? []);
    } catch {
      // DB noch nicht bereit.
    }
  }, [projectId]);

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
        text: `KDP-Paket exportiert: ${result.files.length} Dateien (${Math.round(result.totalSizeBytes / 1024)} KB) in "${result.folderName}".`,
        kind: "ok",
      });
    } catch (e) {
      setNotice({ text: (e as Error)?.message ?? String(e), kind: "err" });
    } finally {
      setBusy(false);
    }
  }

  if (!projectId) {
    return <div className="pub mode-placeholder">Wähle links ein Projekt, um den Publishing-Assistenten zu sehen.</div>;
  }

  return (
    <div className="pub">
      <div className="pub-head">
        <h3>Publishing-Assistent</h3>
        <button className="pub-reload" onClick={reload} title="Neu laden">↻</button>
      </div>

      {notice && <div className={`pub-notice pub-notice-${notice.kind}`}>{notice.text}</div>}

      {!metadata && !notice && <div className="pub-empty">Lädt…</div>}

      {metadata && (
        <>
          <div className="pub-tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={`pub-tab${tab === t.id ? " active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "checklist" && (
            <>
              <KdpUploadChecklist metadata={metadata} />
              <div className="pub-price-edit">
                <label>
                  Listenpreis (USD):
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
                {busy ? "Export läuft…" : "KDP-Paket exportieren"}
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
