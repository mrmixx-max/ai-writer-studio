// Vorschlags-Panel: Lektor-Vorschläge erstellen (aus Auswahl), annehmen/ablehnen.
import { useCallback, useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import { addSuggestion, listSuggestions, setSuggestionStatus } from "@/services/collaboration";
import type { Suggestion } from "@/types/collaboration";
import { textOffsetToPos } from "./textPos";

interface SuggestionsPanelProps {
  editor: Editor | null;
  chapterId: string;
  refreshKey?: number;
}

export function SuggestionsPanel({ editor, chapterId, refreshKey = 0 }: SuggestionsPanelProps) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [proposed, setProposed] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<{ text: string; start: number; end: number } | null>(null);

  const reload = useCallback(() => setItems(listSuggestions(chapterId, !showHistory)), [chapterId, showHistory]);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  // Auswahl beobachten
  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const { from, to, empty } = editor.state.selection;
      if (empty) {
        setSelected(null);
        return;
      }
      const before = editor.state.doc.textBetween(0, from, "\n", "\n");
      const text = editor.state.doc.textBetween(from, to, "\n");
      setSelected({ text, start: before.length, end: before.length + text.length });
    };
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [editor]);

  const handleAdd = async () => {
    if (!proposed.trim()) return;
    const kind = selected && selected.text ? "replace" : selected ? "delete" : "insert";
    // "delete" nur wenn Vorschlag leer ist; Auswahl ohne Vorschlagstext = Löschung
    await addSuggestion(
      chapterId,
      kind,
      selected?.start ?? (editor ? editor.state.doc.textBetween(0, editor.state.selection.from, "\n", "\n").length : 0),
      selected?.end ?? 0,
      selected?.text ?? "",
      proposed.trim(),
      note.trim(),
    );
    setProposed("");
    setNote("");
    reload();
  };

  /** Wendet einen Vorschlag auf den Editor an: Originaltext am Anker ersetzen. */
  const apply = (s: Suggestion) => {
    if (!editor) return;
    const from = textOffsetToPos(editor, s.anchorStart);
    const to = s.kind === "insert" ? from : textOffsetToPos(editor, s.anchorEnd);
    if (s.kind === "insert") {
      editor.chain().focus().insertContentAt(from, s.proposedText).run();
    } else {
      editor.chain().focus().insertContentAt({ from, to }, s.proposedText).run();
    }
    void setSuggestionStatus(s.id, "accepted").then(reload);
  };

  const reject = async (s: Suggestion) => {
    await setSuggestionStatus(s.id, "rejected");
    reload();
  };

  return (
    <div className="collab-panel">
      <div className="collab-compose">
        <div className="collab-compose-hint">
          {selected?.text
            ? <>Auswahl: „{selected.text.length > 60 ? selected.text.slice(0, 60) + "…" : selected.text}“ → Ersatzvorschlag</>
            : selected
              ? "Leerer Vorschlagstext = Löschvorschlag der Auswahl."
              : "Ohne Auswahl: Einfügevorschlag an Cursorposition."}
        </div>
        <textarea
          className="collab-input"
          placeholder="Vorgeschlagener Text…"
          value={proposed}
          rows={2}
          onChange={(e) => setProposed(e.target.value)}
        />
        <input
          className="collab-input"
          placeholder="Begründung (optional)…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className="collab-btn primary" disabled={!proposed.trim()} onClick={handleAdd}>
          💡 Vorschlag einreichen
        </button>
      </div>

      <label className="collab-toggle">
        <input type="checkbox" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)} />
        Entscheidene anzeigen
      </label>

      {items.length === 0 && <div className="collab-empty">Keine offenen Vorschläge.</div>}

      <ul className="collab-list">
        {items.map((s) => (
          <li key={s.id} className={`collab-item suggestion status-${s.status}`}>
            <div className="collab-diff-inline">
              {s.originalText && <del className="tc-delete">{s.originalText}</del>}
              {s.proposedText && <ins className="tc-insert">{s.proposedText}</ins>}
            </div>
            {s.note && <div className="collab-note">{s.note}</div>}
            <div className="collab-meta">
              {s.author} · {s.kind === "insert" ? "Einfügen" : s.kind === "replace" ? "Ersetzen" : "Löschen"} ·{" "}
              {new Date(s.createdAt).toLocaleString("de-DE")}
              {s.status !== "pending" && ` · ${s.status === "accepted" ? "angenommen" : "abgelehnt"}`}
            </div>
            {s.status === "pending" && (
              <div className="collab-actions">
                <button className="collab-btn small" onClick={() => apply(s)}>
                  ✓ Annehmen
                </button>
                <button className="collab-btn small danger" onClick={() => reject(s)}>
                  ✕ Ablehnen
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
