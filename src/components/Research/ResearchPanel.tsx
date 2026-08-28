// Research-Panel: Quellen, Zitate, Notizen, Web-Clipper als Tabs.
import { useState } from "react";
import { SourcesTab } from "./SourcesTab";
import { QuotesTab } from "./QuotesTab";
import { NotesTab } from "./NotesTab";
import { WebClipperTab } from "./WebClipperTab";
import "./research.css";

interface Props {
  projectId: string | null;
}

type Tab = "sources" | "quotes" | "notes" | "clips";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "sources", label: "Quellen", icon: "📖" },
  { id: "quotes", label: "Zitate", icon: "❝" },
  { id: "notes", label: "Notizen", icon: "🗒️" },
  { id: "clips", label: "Web-Clipper", icon: "🔗" },
];

export function ResearchPanel({ projectId }: Props) {
  const [tab, setTab] = useState<Tab>("sources");

  if (!projectId) {
    return (
      <div className="research">
        <div className="research-notice">
          Wähle links ein Projekt. Recherche wird je Projekt getrennt verwaltet.
        </div>
      </div>
    );
  }

  return (
    <div className="research">
      <div className="research-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <div className="research-body">
        {tab === "sources" && <SourcesTab projectId={projectId} />}
        {tab === "quotes" && <QuotesTab projectId={projectId} />}
        {tab === "notes" && <NotesTab projectId={projectId} />}
        {tab === "clips" && <WebClipperTab projectId={projectId} />}
      </div>
    </div>
  );
}
