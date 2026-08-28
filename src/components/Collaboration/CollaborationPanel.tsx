// Collaboration-Panel: Tabbed Container für Kommentare, Track Changes, Vorschläge und Versionsdiff.
import { useState } from "react";
import type { Editor } from "@tiptap/core";
import { CommentsPanel } from "./CommentsPanel";
import { TrackChangesPanel } from "./TrackChangesPanel";
import { SuggestionsPanel } from "./SuggestionsPanel";
import { VersionDiff } from "./VersionDiff";
import { SharingPanel } from "./SharingPanel";
import "./collaboration.css";

type Tab = "comments" | "changes" | "suggestions" | "diff" | "sharing";

const TABS: { id: Tab; label: string }[] = [
  { id: "comments", label: "💬 Kommentare" },
  { id: "changes", label: "📝 Änderungen" },
  { id: "suggestions", label: "💡 Vorschläge" },
  { id: "diff", label: "🔍 Vergleich" },
  { id: "sharing", label: "📤 Teilen" },
];

interface CollaborationPanelProps {
  editor: Editor | null;
  chapterId: string;
  trackChangesEnabled: boolean;
  onToggleTrackChanges: (enabled: boolean) => void;
}

export function CollaborationPanel({ editor, chapterId, trackChangesEnabled, onToggleTrackChanges }: CollaborationPanelProps) {
  const [tab, setTab] = useState<Tab>("comments");
  const [refreshKey] = useState(0);

  return (
    <div className="collaboration-sidebar">
      <div className="collab-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={"collab-tab" + (tab === t.id ? " active" : "")}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "comments" && <CommentsPanel editor={editor} chapterId={chapterId} refreshKey={refreshKey} />}
      {tab === "changes" && (
        <TrackChangesPanel editor={editor} chapterId={chapterId} enabled={trackChangesEnabled} onToggleEnabled={onToggleTrackChanges} refreshKey={refreshKey} />
      )}
      {tab === "suggestions" && <SuggestionsPanel editor={editor} chapterId={chapterId} refreshKey={refreshKey} />}
      {tab === "diff" && <VersionDiff chapterId={chapterId} refreshKey={refreshKey} />}
      {tab === "sharing" && <SharingPanel />}
    </div>
  );
}
