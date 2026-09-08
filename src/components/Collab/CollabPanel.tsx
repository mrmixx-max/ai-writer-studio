// CollabPanel: Kommentar-Liste + Eingabe + Review-Requests (Sprint 20, Agent 3).
//
// Standalone-Panel — bewusst KEINE Abhaengigkeit zu bestehenden
// Collaboration-Komponenten (weder Import noch Aenderung dort).
// Arbeitet gegen `@/services/collab/collabManager`; die API ist ueber die
// `api`-Prop injizierbar (Mock in Tests, Default: echter Manager).
//
// Bloomberg-Terminal-Stil: bg #000, accent #ffa028, border #333,
// monospace (IBM Plex Mono). Inline-Stile, keine geteilte CSS-Datei.

import { useCallback, useEffect, useState } from "react";
import {
  addComment,
  approveReview,
  createReviewRequest,
  getComments,
  rejectReview,
  resolveComment,
  type Comment,
  type ReviewRequest,
} from "@/services/collab/collabManager";

export interface CollabApi {
  getComments: typeof getComments;
  addComment: typeof addComment;
  resolveComment: typeof resolveComment;
  createReviewRequest: typeof createReviewRequest;
  approveReview: typeof approveReview;
  rejectReview: typeof rejectReview;
}

const defaultApi: CollabApi = {
  getComments,
  addComment,
  resolveComment,
  createReviewRequest,
  approveReview,
  rejectReview,
};

export interface CollabPanelProps {
  projectId?: string;
  /** Injizierbare API (Mock in Tests, Default: echter CollabManager). */
  api?: CollabApi;
  className?: string;
}

const ACCENT = "#ffa028";

const rootStyle: React.CSSProperties = {
  background: "#000",
  color: "#e8e8e8",
  border: "1px solid #333",
  borderRadius: 4,
  padding: 12,
  fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
  fontSize: 13,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const sectionTitle: React.CSSProperties = {
  color: ACCENT,
  fontWeight: 700,
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const inputStyle: React.CSSProperties = {
  background: "#0a0a0a",
  color: "#e8e8e8",
  border: "1px solid #333",
  borderRadius: 3,
  padding: "6px 8px",
  fontFamily: "inherit",
  fontSize: 12,
  width: "100%",
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  background: "#000",
  color: ACCENT,
  border: `1px solid ${ACCENT}`,
  borderRadius: 3,
  padding: "6px 12px",
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const ghostButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  color: "#e8e8e8",
  border: "1px solid #333",
  fontWeight: 400,
};

const commentStyle: React.CSSProperties = {
  border: "1px solid #333",
  borderLeft: `3px solid ${ACCENT}`,
  borderRadius: 3,
  padding: "6px 8px",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

/** Liest die aktuelle Textselektion im Dokument (Start/Ende als Offsets). */
function readDocumentSelection(): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  return { start: range.startOffset, end: range.endOffset };
}

export function CollabPanel({ projectId, api, className }: CollabPanelProps) {
  const collab = api ?? defaultApi;
  const [comments, setComments] = useState<Comment[]>([]);
  const [review, setReview] = useState<ReviewRequest | null>(null);
  const [text, setText] = useState("");
  const [selStart, setSelStart] = useState("");
  const [selEnd, setSelEnd] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setComments([]);
      return;
    }
    try {
      setComments(await collab.getComments(projectId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleAdd = async () => {
    if (!projectId || !text.trim()) return;
    const selection =
      selStart !== "" && selEnd !== ""
        ? { start: Number(selStart), end: Number(selEnd) }
        : undefined;
    try {
      await collab.addComment(projectId, text.trim(), selection);
      setText("");
      setSelStart("");
      setSelEnd("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await collab.resolveComment(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleTakeSelection = () => {
    const s = readDocumentSelection();
    if (s) {
      setSelStart(String(s.start));
      setSelEnd(String(s.end));
    }
  };

  const handleCreateReview = async () => {
    if (!projectId) return;
    try {
      setReview(await collab.createReviewRequest(projectId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleApprove = async () => {
    if (!review) return;
    try {
      await collab.approveReview(review.id);
      setReview({ ...review, status: "approved" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleReject = async () => {
    if (!review) return;
    try {
      await collab.rejectReview(review.id);
      setReview({ ...review, status: "rejected" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div data-testid="collab-panel" className={className} style={rootStyle}>
      <div style={sectionTitle}>👥 Collaboration</div>
      {!projectId && (
        <div data-testid="collab-no-project">
          Bitte ein Projekt auswählen.
        </div>
      )}

      {/* Kommentar-Liste */}
      <div style={sectionTitle}>Kommentare ({comments.length})</div>
      <div
        data-testid="collab-comment-list"
        style={{ display: "flex", flexDirection: "column", gap: 6 }}
      >
        {comments.length === 0 && (
          <div
            data-testid="collab-comment-empty"
            style={{ color: "#888", fontSize: 12 }}
          >
            Noch keine Kommentare.
          </div>
        )}
        {comments.map((c) => (
          <div key={c.id} data-testid="collab-comment" style={commentStyle}>
            <div style={{ fontSize: 11, color: "#999" }}>
              <span style={{ color: ACCENT, fontWeight: 700 }}>
                {c.author}
              </span>{" "}
              · {formatTime(c.timestamp)}
              {c.selection && (
                <span>
                  {" "}
                  · @{c.selection.start}–{c.selection.end}
                </span>
              )}
              {c.resolved && <span> · ✓ erledigt</span>}
            </div>
            <div>{c.text}</div>
            {!c.resolved && (
              <div>
                <button
                  type="button"
                  data-testid={`collab-resolve-${c.id}`}
                  style={ghostButtonStyle}
                  onClick={() => void handleResolve(c.id)}
                >
                  Resolve
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Kommentar-Eingabe */}
      <div style={sectionTitle}>Neuer Kommentar</div>
      <textarea
        data-testid="collab-comment-input"
        style={{ ...inputStyle, minHeight: 56, resize: "vertical" }}
        placeholder="Kommentar schreiben…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div style={{ display: "flex", gap: 6 }}>
        <input
          data-testid="collab-selection-start"
          style={inputStyle}
          type="number"
          min={0}
          placeholder="Start"
          aria-label="Selektion Start"
          value={selStart}
          onChange={(e) => setSelStart(e.target.value)}
        />
        <input
          data-testid="collab-selection-end"
          style={inputStyle}
          type="number"
          min={0}
          placeholder="Ende"
          aria-label="Selektion Ende"
          value={selEnd}
          onChange={(e) => setSelEnd(e.target.value)}
        />
        <button
          type="button"
          data-testid="collab-take-selection"
          style={ghostButtonStyle}
          onClick={handleTakeSelection}
          title="Aktuelle Textmarkierung im Editor übernehmen"
        >
          Markierung
        </button>
      </div>
      <div>
        <button
          type="button"
          data-testid="collab-add-btn"
          style={buttonStyle}
          disabled={!projectId || !text.trim()}
          onClick={() => void handleAdd()}
        >
          Hinzufügen
        </button>
      </div>

      {/* Review-Requests */}
      <div style={sectionTitle}>Review</div>
      <div>
        <button
          type="button"
          data-testid="collab-review-btn"
          style={buttonStyle}
          disabled={!projectId}
          onClick={() => void handleCreateReview()}
        >
          Review anfordern
        </button>
      </div>
      {review && (
        <div data-testid="collab-review-status" style={commentStyle}>
          <div>
            Status:{" "}
            <strong data-testid="collab-review-state" style={{ color: ACCENT }}>
              {review.status}
            </strong>
          </div>
          {review.status === "open" && (
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                data-testid="collab-approve-btn"
                style={buttonStyle}
                onClick={() => void handleApprove()}
              >
                Genehmigen
              </button>
              <button
                type="button"
                data-testid="collab-reject-btn"
                style={ghostButtonStyle}
                onClick={() => void handleReject()}
              >
                Ablehnen
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div data-testid="collab-error" style={{ color: "#ff5555" }}>
          {error}
        </div>
      )}
    </div>
  );
}
