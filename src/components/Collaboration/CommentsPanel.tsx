// Kommentare-Panel: Text-Auswahl → Kommentar anhängen, auflösen, löschen, springen.
import { useCallback, useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import { addComment, listComments, setCommentStatus, deleteComment } from "@/services/collaboration";
import type { Comment } from "@/types/collaboration";
import { selectionRange, findCommentRange } from "./textPos";

interface CommentsPanelProps {
  editor: Editor | null;
  chapterId: string;
  refreshKey?: number;
}

export function CommentsPanel({ editor, chapterId, refreshKey = 0 }: CommentsPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => setComments(listComments(chapterId)), [chapterId]);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  // Auswahl beobachten → Kommentar-Eingabe aktivieren
  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const sel = selectionRange(editor);
      setSelectedText(sel ? editor.state.doc.textBetween(sel.pm.from, sel.pm.to, "\n") : null);
    };
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [editor]);

  const handleAdd = async () => {
    if (!editor || !body.trim()) return;
    const sel = selectionRange(editor);
    setBusy(true);
    try {
      if (sel) {
        const text = editor.state.doc.textBetween(sel.pm.from, sel.pm.to, "\n");
        const c = await addComment(chapterId, sel.text.start, sel.text.end, text.slice(0, 200), body.trim());
        editor.chain().focus().setComment(c.id).run();
      } else {
        // Kommentar ohne Auswahl: an Cursorposition als Textanker
        const pos = editor.state.selection.from;
        const beforeText = editor.state.doc.textBetween(0, pos, "\n", "\n");
        await addComment(chapterId, beforeText.length, beforeText.length, "", body.trim());
      }
      setBody("");
      reload();
    } finally {
      setBusy(false);
    }
  };

  const jumpTo = (c: Comment) => {
    if (!editor) return;
    const range = findCommentRange(editor, c.id);
    if (range) editor.chain().focus().setTextSelection(range).run();
  };

  return (
    <div className="collab-panel">
      <div className="collab-compose">
        <div className="collab-compose-hint">
          {selectedText
            ? <>Kommentar zu: „{selectedText.length > 60 ? selectedText.slice(0, 60) + "…" : selectedText}“</>
            : "Text markieren, um einen Kommentar anzuhängen."}
        </div>
        <textarea
          className="collab-input"
          placeholder="Kommentar schreiben…"
          value={body}
          rows={2}
          onChange={(e) => setBody(e.target.value)}
        />
        <button className="collab-btn primary" disabled={busy || !body.trim()} onClick={handleAdd}>
          💬 Kommentar anhängen
        </button>
      </div>

      {comments.length === 0 && <div className="collab-empty">Keine Kommentare vorhanden.</div>}

      <ul className="collab-list">
        {comments.map((c) => (
          <li key={c.id} className={`collab-item comment ${c.status === "resolved" ? "resolved" : ""}`}>
            {c.anchorText && (
              <blockquote className="collab-quote" onClick={() => jumpTo(c)} title="Zum Text springen">
                „{c.anchorText}“
              </blockquote>
            )}
            <div className="collab-body">{c.body}</div>
            <div className="collab-meta">
              {c.author} · {new Date(c.createdAt).toLocaleString("de-DE")}
            </div>
            <div className="collab-actions">
              {c.status === "open" ? (
                <button className="collab-btn small" onClick={async () => { await setCommentStatus(c.id, "resolved"); reload(); }}>
                  ✓ Auflösen
                </button>
              ) : (
                <button className="collab-btn small" onClick={async () => { await setCommentStatus(c.id, "open"); reload(); }}>
                  ↺ Wieder öffnen
                </button>
              )}
              <button className="collab-btn small danger" onClick={async () => { await deleteComment(c.id); reload(); }}>
                🗑 Löschen
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
