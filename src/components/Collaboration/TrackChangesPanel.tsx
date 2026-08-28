// Track-Changes-Panel: Aufzeichnung umschalten, Änderungsliste, Annehmen/Ablehnen.
import { useCallback, useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import { listChanges, recordChange, clearChanges } from "@/services/collaboration";
import type { TrackChange } from "@/types/collaboration";
import type { Extension } from "@tiptap/core";

interface TrackChangesPanelProps {
  editor: Editor | null;
  chapterId: string;
  enabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  refreshKey?: number;
}

export function TrackChangesPanel({ editor, chapterId, enabled, onToggleEnabled, refreshKey = 0 }: TrackChangesPanelProps) {
  const [changes, setChanges] = useState<TrackChange[]>([]);

  const reload = useCallback(() => setChanges(listChanges(chapterId)), [chapterId]);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  const toggle = (next: boolean) => {
    if (editor) {
      const ext = editor.extensionManager.extensions.find((e) => e.name === "trackChanges") as Extension | undefined;
      if (ext) {
        const storage = ext.storage as {
          enabled: boolean;
          callbacks: {
            onInsert?: (position: number, text: string) => void;
            onDelete?: (position: number, text: string) => void;
          };
        };
        storage.enabled = next;
        storage.callbacks = {
          onInsert: (position, text) => void recordChange(chapterId, "insert", position, text, null).then(reload),
          onDelete: (position, text) => void recordChange(chapterId, "delete", position, text, null).then(reload),
        };
      }
    }
    onToggleEnabled(next);
  };

  const acceptAll = () => {
    if (!editor) return;
    editor.chain().focus().acceptTrackChanges().run();
    reload();
  };

  const rejectAll = () => {
    if (!editor) return;
    editor.chain().focus().rejectTrackChanges().run();
    void clearChanges(chapterId).then(reload);
  };

  return (
    <div className="collab-panel">
      <div className="collab-compose">
        <label className="collab-toggle">
          <input type="checkbox" checked={enabled} onChange={(e) => toggle(e.target.checked)} />
          Änderungen aufzeichnen
        </label>
        <div className="collab-actions">
          <button className="collab-btn small" onClick={acceptAll} disabled={!editor}>
            ✓ Alle annehmen
          </button>
          <button className="collab-btn small danger" onClick={rejectAll} disabled={!editor}>
            ✕ Alle verwerfen
          </button>
        </div>
      </div>

      {changes.length === 0 && <div className="collab-empty">Keine Änderungen aufgezeichnet.</div>}

      <ul className="collab-list">
        {changes.map((c) => (
          <li key={c.id} className={`collab-item change ${c.kind}`}>
            <div className="collab-body">
              {c.kind === "insert" ? "＋ Eingefügt: " : "－ Gelöscht: "}
              <span className={c.kind === "insert" ? "tc-insert" : "tc-delete"}>{c.text}</span>
            </div>
            <div className="collab-meta">
              Pos. {c.position} · {new Date(c.createdAt).toLocaleString("de-DE")}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
