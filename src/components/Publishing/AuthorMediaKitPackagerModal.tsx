// AuthorMediaKitPackagerModal (WP 77.2)
//
// Interaktiver Pressemappen- & Media-One-Sheet-Packager.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  createMediaOneSheet,
  formatMediaOneSheet,
  generateBio,
  generateInterviewQuestions,
  type BioLength,
} from "@/services/publishing/authorMediaKitPackager";

export interface AuthorMediaKitPackagerModalProps {
  className?: string;
}

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: 4,
  background: "var(--panel)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 12,
} as const;

export function AuthorMediaKitPackagerModal({ className }: AuthorMediaKitPackagerModalProps) {
  const [title, setTitle] = useState("Die Chroniken der Aetherie");
  const [logline, setLogline] = useState(
    "In einer Welt aus Licht und Schatten kämpft ein junger Held gegen eine uralte Dunkelheit.",
  );
  const [author, setAuthor] = useState("Erik Gieske");
  const [isbn, setIsbn] = useState("978-3-123456-78-9");
  const [price, setPrice] = useState(14.99);
  const [bioLength, setBioLength] = useState<BioLength>("medium");

  const sheet = useMemo(
    () => createMediaOneSheet(title, logline, author, isbn, price),
    [title, logline, author, isbn, price],
  );

  const bio = useMemo(() => generateBio(author, bioLength), [author, bioLength]);
  const questions = useMemo(() => generateInterviewQuestions(title), [title]);

  return (
    <div
      className={className}
      data-testid="author-media-kit-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        📰 Pressemappen- & Media-One-Sheet-Packager
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {sheet.title} · {sheet.isbn} · {sheet.price} EUR
      </div>

      {/* Eingabe */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Titel
          <input
            data-testid="media-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Autor
          <input
            data-testid="media-author-input"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Logline
        <textarea
          data-testid="media-logline-input"
          value={logline}
          onChange={(e) => setLogline(e.target.value)}
          rows={2}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 11 }}
        />
      </label>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          ISBN
          <input
            data-testid="media-isbn-input"
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Preis (EUR)
          <input
            data-testid="media-price-input"
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
      </div>

      {/* Bio-Länge */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {(["short", "medium", "long"] as const).map((len) => (
          <button
            key={len}
            data-testid={`media-bio-${len}`}
            onClick={() => setBioLength(len)}
            style={{
              fontSize: 11,
              padding: "4px 12px",
              borderRadius: 4,
              cursor: "pointer",
              background: bioLength === len ? "var(--accent)" : "var(--panel)",
              color: bioLength === len ? "var(--bg)" : "var(--fg)",
              border: "1px solid var(--border)",
            }}
          >
            {len === "short" ? "50 Wörter" : len === "medium" ? "100 Wörter" : "300 Wörter"}
          </button>
        ))}
      </div>

      {/* One-Sheet */}
      <div
        data-testid="media-one-sheet"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>MEDIA ONE-SHEET</div>
        <div style={{ color: "var(--accent)", fontWeight: 700 }}>{sheet.title}</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>{sheet.logline}</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>ISBN: {sheet.isbn}</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>Preis: {sheet.price} EUR</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>Zielgruppe: {sheet.targetAudience}</div>
      </div>

      {/* Bio */}
      <div
        data-testid="media-bio"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>BIO</div>
        <div style={{ lineHeight: 1.6 }}>{bio}</div>
      </div>

      {/* Interview-Fragen */}
      <div
        data-testid="media-interview"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>INTERVIEW-FRAGEN</div>
        {questions.map((q, i) => (
          <div key={i} data-testid={`media-question-${i}`} style={{ marginBottom: 4 }}>
            <span style={{ color: "var(--accent)" }}>●</span> {q.question}
          </div>
        ))}
      </div>

      {/* Vollständige Ausgabe */}
      <details data-testid="media-report">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständiger Bericht
        </summary>
        <pre
          data-testid="media-report-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            marginTop: 6,
            maxHeight: 200,
            overflow: "auto",
          }}
        >
          {formatMediaOneSheet(sheet)}
        </pre>
      </details>
    </div>
  );
}
