// PrintPreflightPanel: Buch-Titelei & Print-Layout-Prüfung (WP 8.1) — UI.
//
// Zeigt typografische Prüfungen (Anführungszeichen, Gedankenstrich,
// Schusterjungen/Hurenkinder) für einen Manuskripttext und erzeugt die
// Titelei-Bausteine (Impressum, Titelblatt) über den lokalen Service
// `@/services/bookwriter/printPreflight`.
//
// Rein präsentational + lokal, kein LLM-Aufruf, deterministisch.
// Dark Theme: bg #0a0e14, panel #11161f, border #232b3a,
// amber #ffb000, cyan #00e5ff, text #d5dbe5, dim #8a93a6.

import { useState } from "react";
import {
  checkTypography,
  checkWidowsAndOrphans,
  generateImpressum,
  generateTitlePage,
} from "@/services/bookwriter/printPreflight";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#232b3a";
const AMBER = "#ffb000";
const CYAN = "#00e5ff";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";
const RED = "#e5484d";

export interface PrintPreflightPanelProps {
  /** Manuskripttext für die typografische Prüfung. */
  text?: string;
  /** Autor (Default-Init der Titelei-Felder). */
  author?: string;
  /** Buchtitel (Default-Init der Titelei-Felder). */
  title?: string;
  /** Untertitel (optional). */
  subtitle?: string;
  /** Erscheinungsjahr (optional, Default: aktuelles Jahr im Service). */
  year?: number;
  className?: string;
}

/** Label für einen Widow/Orphan-Befund. */
function widowOrphanLabel(type: "widow" | "orphan"): string {
  return type === "widow" ? "Schusterjunge" : "Hurenkind";
}

export function PrintPreflightPanel({
  text = "",
  author = "",
  title = "",
  subtitle = "",
  year,
  className,
}: PrintPreflightPanelProps) {
  const typographyIssues = useMemo(() => checkTypography(text), [text]);
  const widowOrphanIssues = useMemo(() => checkWidowsAndOrphans(text), [text]);
  const hasText = text.trim().length > 0;

  // --- Titelei-Formular (lokal, initial aus Props) ---------------------------
  const [formTitle, setFormTitle] = useState(title);
  const [formAuthor, setFormAuthor] = useState(author);
  const [formSubtitle, setFormSubtitle] = useState(subtitle);
  const [formYear, setFormYear] = useState(year !== undefined ? String(year) : "");
  const [titlePage, setTitlePage] = useState<string | null>(null);
  const [impressum, setImpressum] = useState<string | null>(null);

  useEffect(() => setFormTitle(title), [title]);
  useEffect(() => setFormAuthor(author), [author]);
  useEffect(() => setFormSubtitle(subtitle), [subtitle]);
  useEffect(() => setFormYear(year !== undefined ? String(year) : ""), [year]);

  const parsedYear = useMemo(() => {
    const n = Number.parseInt(formYear, 10);
    return Number.isFinite(n) ? n : undefined;
  }, [formYear]);

  const handleGenerateTitlePage = () => {
    setTitlePage(generateTitlePage(formTitle, formAuthor, formSubtitle));
  };

  const handleGenerateImpressum = () => {
    setImpressum(generateImpressum(formAuthor, formTitle, parsedYear));
  };

  const inputStyle: CSSProperties = {
    background: BG,
    color: TEXT,
    border: `1px solid ${BORDER}`,
    borderRadius: 3,
    padding: "4px 6px",
    fontSize: 12,
    fontFamily: "inherit",
    width: "100%",
    boxSizing: "border-box",
  };

  const buttonStyle: CSSProperties = {
    background: "transparent",
    color: AMBER,
    border: `1px solid ${AMBER}`,
    borderRadius: 3,
    padding: "4px 10px",
    fontSize: 12,
    fontFamily: "inherit",
    cursor: "pointer",
  };

  const sectionTitleStyle: CSSProperties = {
    color: AMBER,
    margin: "0 0 8px 0",
    fontSize: 13,
    fontWeight: 700,
  };

  return (
    <div
      className={className ?? "print-preflight-panel"}
      data-testid="print-preflight-panel"
      style={{
        background: BG,
        color: TEXT,
        fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
        padding: 16,
        border: `1px solid ${BORDER}`,
        borderRadius: 6,
      }}
    >
      <h3 style={{ color: AMBER, margin: "0 0 4px 0", fontSize: 16, fontWeight: 700 }}>
        🖨️ Print-Preflight
      </h3>
      <p
        data-testid="print-preflight-summary"
        style={{ color: DIM, margin: "0 0 16px 0", fontSize: 12 }}
      >
        {typographyIssues.length} typografische Befunde ·{" "}
        {widowOrphanIssues.length} Satzfehler (Schusterjungen/Hurenkinder)
      </p>

      {/* --- Typografie ----------------------------------------------------- */}
      <section data-testid="print-preflight-typography" style={{ marginBottom: 20 }}>
        <h4 style={sectionTitleStyle}>Typografie</h4>

        {!hasText && (
          <p
            data-testid="print-preflight-typography-empty"
            style={{ color: DIM, fontSize: 12, margin: 0 }}
          >
            Kein Text vorhanden — typografische Prüfung nicht möglich.
          </p>
        )}

        {hasText && typographyIssues.length === 0 && (
          <p
            data-testid="print-preflight-typography-clean"
            style={{ color: CYAN, fontSize: 12, margin: 0 }}
          >
            ✓ Keine typografischen Fehler gefunden.
          </p>
        )}

        {typographyIssues.length > 0 && (
          <ul
            data-testid="print-preflight-typography-list"
            style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}
          >
            {typographyIssues.map((issue, i) => (
              <li
                key={`${issue.type}-${issue.position}-${i}`}
                data-testid={`print-preflight-typography-issue-${i}`}
                data-issue-type={issue.type}
                style={{
                  background: PANEL,
                  border: `1px solid ${BORDER}`,
                  borderLeft: `3px solid ${AMBER}`,
                  borderRadius: 4,
                  padding: "6px 10px",
                  fontSize: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ color: TEXT }}>{issue.message}</span>
                  <span style={{ color: DIM, fontSize: 10 }}>@{issue.position}</span>
                </div>
                <div style={{ color: CYAN, fontSize: 11, marginTop: 2 }}>
                  → {issue.suggestion}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --- Schusterjungen / Hurenkinder ---------------------------------- */}
      <section data-testid="print-preflight-widow-orphan" style={{ marginBottom: 20 }}>
        <h4 style={sectionTitleStyle}>Schusterjungen &amp; Hurenkinder</h4>

        {!hasText && (
          <p
            data-testid="print-preflight-widow-orphan-empty"
            style={{ color: DIM, fontSize: 12, margin: 0 }}
          >
            Kein Text vorhanden — Satzprüfung nicht möglich.
          </p>
        )}

        {hasText && widowOrphanIssues.length === 0 && (
          <p
            data-testid="print-preflight-widow-orphan-clean"
            style={{ color: CYAN, fontSize: 12, margin: 0 }}
          >
            ✓ Keine allein stehenden Zeilen gefunden.
          </p>
        )}

        {widowOrphanIssues.length > 0 && (
          <ul
            data-testid="print-preflight-widow-orphan-list"
            style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}
          >
            {widowOrphanIssues.map((issue, i) => (
              <li
                key={`${issue.type}-${issue.lineNumber}-${i}`}
                data-testid={`print-preflight-widow-orphan-${i}`}
                data-issue-type={issue.type}
                style={{
                  background: PANEL,
                  border: `1px solid ${BORDER}`,
                  borderLeft: `3px solid ${RED}`,
                  borderRadius: 4,
                  padding: "6px 10px",
                  fontSize: 12,
                }}
              >
                <div style={{ color: AMBER, fontWeight: 700, fontSize: 11 }}>
                  {widowOrphanLabel(issue.type)} · Zeile {issue.lineNumber}
                </div>
                <div style={{ color: TEXT, marginTop: 2 }}>„{issue.text}“</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --- Titelei -------------------------------------------------------- */}
      <section data-testid="print-preflight-titlelei">
        <h4 style={sectionTitleStyle}>Titelei erzeugen</h4>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <label style={{ color: DIM, fontSize: 11, display: "flex", flexDirection: "column", gap: 2 }}>
            Titel
            <input
              data-testid="print-preflight-input-title"
              aria-label="Titel"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ color: DIM, fontSize: 11, display: "flex", flexDirection: "column", gap: 2 }}>
            Autor
            <input
              data-testid="print-preflight-input-author"
              aria-label="Autor"
              value={formAuthor}
              onChange={(e) => setFormAuthor(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ color: DIM, fontSize: 11, display: "flex", flexDirection: "column", gap: 2 }}>
            Untertitel (optional)
            <input
              data-testid="print-preflight-input-subtitle"
              aria-label="Untertitel"
              value={formSubtitle}
              onChange={(e) => setFormSubtitle(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ color: DIM, fontSize: 11, display: "flex", flexDirection: "column", gap: 2 }}>
            Jahr (optional)
            <input
              data-testid="print-preflight-input-year"
              aria-label="Jahr"
              value={formYear}
              onChange={(e) => setFormYear(e.target.value)}
              style={inputStyle}
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            data-testid="print-preflight-generate-title"
            onClick={handleGenerateTitlePage}
            style={buttonStyle}
          >
            Titelblatt erzeugen
          </button>
          <button
            type="button"
            data-testid="print-preflight-generate-impressum"
            onClick={handleGenerateImpressum}
            style={buttonStyle}
          >
            Impressum erzeugen
          </button>
        </div>

        {titlePage !== null && (
          <div data-testid="print-preflight-title-page" style={{ marginBottom: 12 }}>
            <div style={{ color: DIM, fontSize: 11, marginBottom: 4 }}>Titelblatt</div>
            <pre
              data-testid="print-preflight-title-page-output"
              style={{
                color: TEXT,
                fontSize: 12,
                whiteSpace: "pre-wrap",
                margin: 0,
                padding: 10,
                background: PANEL,
                border: `1px solid ${BORDER}`,
                borderRadius: 4,
              }}
            >
              {titlePage}
            </pre>
          </div>
        )}

        {impressum !== null && (
          <div data-testid="print-preflight-impressum">
            <div style={{ color: DIM, fontSize: 11, marginBottom: 4 }}>Impressum</div>
            <pre
              data-testid="print-preflight-impressum-output"
              style={{
                color: TEXT,
                fontSize: 12,
                whiteSpace: "pre-wrap",
                margin: 0,
                padding: 10,
                background: PANEL,
                border: `1px solid ${BORDER}`,
                borderRadius: 4,
              }}
            >
              {impressum}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
}

export default PrintPreflightPanel;
