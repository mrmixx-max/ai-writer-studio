// GuestReviewModal (WP 42.2): Lektoren-Freigabe-Portal.
//
// Erstellt eine lokale Review-Session, zeigt Link + QR-Code und listet
// eingehende Kommentare zum Import in den Editor.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useCallback, useMemo, useState } from "react";
import {
  createReviewSession,
  generateReviewLink,
  importReviewComments,
  type ReviewChapter,
  type ReviewSession,
  type ReviewComment,
} from "@/services/collaboration/guestReviewPortal";

export interface GuestReviewModalProps {
  open: boolean;
  onClose: () => void;
  chapters: ReviewChapter[];
  /** Lokaler Host, z. B. "192.168.1.42:3000". */
  host?: string;
  /** Wird beim Import der Kommentare gerufen. */
  onImportComments?: (comments: ReviewComment[]) => void;
}

export function GuestReviewModal({
  open,
  onClose,
  chapters,
  host = "192.168.1.100:3000",
  onImportComments,
}: GuestReviewModalProps) {
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [mode, setMode] = useState<"readonly" | "commentable">("commentable");
  const [imported, setImported] = useState(0);

  const link = useMemo(() => {
    if (!session) return null;
    return generateReviewLink(session, host);
  }, [session, host]);

  const handleCreate = useCallback(() => {
    const s = createReviewSession(chapters, { mode, expiresInMinutes: 120 });
    setSession(s);
    setImported(0);
  }, [chapters, mode]);

  const handleImport = useCallback(() => {
    if (!session) return;
    const comments = importReviewComments(session);
    onImportComments?.(comments);
    setImported(comments.length);
  }, [session, onImportComments]);

  if (!open) return null;

  return (
    <div
      data-testid="guest-review-modal"
      className="modal-backdrop"
      onClick={onClose}
      style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: 18,
          width: "min(560px, 92vw)",
          maxHeight: "85vh",
          overflow: "auto",
          color: "var(--fg)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: "var(--accent)" }}>👥 Lektoren-Portal</h3>
          <button
            data-testid="guest-review-close"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--muted)",
              padding: "2px 8px",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            Schließen
          </button>
        </div>

        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
          {chapters.length} Kapitel werden freigegeben. Der Lektor öffnet den Link im
          Browser auf Tablet oder Handy — keine Installation nötig.
        </div>

        {/* Modus */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(["readonly", "commentable"] as const).map((m) => (
            <button
              key={m}
              data-testid={`guest-review-mode-${m}`}
              onClick={() => setMode(m)}
              style={{
                background: mode === m ? "var(--accent)" : "transparent",
                color: mode === m ? "var(--bg)" : "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "5px 12px",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              {m === "readonly" ? "Nur lesen" : "Kommentierbar"}
            </button>
          ))}
        </div>

        <button
          data-testid="guest-review-create"
          onClick={handleCreate}
          style={{
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            borderRadius: 4,
            padding: "8px 16px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: 14,
          }}
        >
          Session starten
        </button>

        {link && (
          <>
            <label style={{ display: "block", fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
              LEKTOREN-LINK
            </label>
            <div
              data-testid="guest-review-link"
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: 8,
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                wordBreak: "break-all",
                marginBottom: 12,
              }}
            >
              {link.url}
            </div>

            <label style={{ display: "block", fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
              QR-CODE (für Tablet/Handy)
            </label>
            <div
              data-testid="guest-review-qr"
              style={{
                background: "#fff",
                padding: 8,
                borderRadius: 4,
                display: "inline-block",
                marginBottom: 12,
              }}
              // Der QR-Code kommt als SVG-String aus dem Service.
              dangerouslySetInnerHTML={{ __html: link.qrCodeSvg }}
            />

            <div style={{ display: "flex", gap: 8 }}>
              <button
                data-testid="guest-review-import"
                onClick={handleImport}
                style={{
                  background: "transparent",
                  color: "var(--accent)",
                  border: "1px solid var(--accent)",
                  borderRadius: 4,
                  padding: "6px 14px",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Kommentare importieren
              </button>
            </div>

            {imported > 0 && (
              <div
                data-testid="guest-review-imported"
                style={{ fontSize: 11, color: "var(--success)", marginTop: 10 }}
              >
                ✓ {imported} Kommentar(e) übernommen.
              </div>
            )}

            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 12 }}>
              Session läuft ab: {new Date(session!.expiresAt).toLocaleTimeString("de-DE")}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
