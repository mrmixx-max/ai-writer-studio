// FilmAndForeignRightsPitchModal (Meilenstein 61.0 / v7.3.0)
//
// UI für das Film-, TV- & Auslandsrechte-Pitch-Deck: 1-Seiter-Dossier,
// Auslandsrechte-Leitfaden und druckfertiger PDF-Export. Nur Design-Tokens.

import { useMemo, useState } from "react";
import {
  buildFilmRightsDossier,
  buildForeignRightsGuide,
  generateRightsPitchPdf,
  createSampleRightsProject,
} from "@/services/publishing/filmAndForeignRightsPitch";

export interface FilmAndForeignRightsPitchModalProps {
  className?: string;
}

const inputStyle: React.CSSProperties = {
  background: "var(--panel)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "3px 6px",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
};

export function FilmAndForeignRightsPitchModal({ className }: FilmAndForeignRightsPitchModalProps) {
  const sample = useMemo(() => createSampleRightsProject(), []);

  const [seed, setSeed] = useState(42);
  const [title, setTitle] = useState(sample.title);
  const [genre, setGenre] = useState(sample.genre);

  const project = useMemo(() => ({ title, genre }), [title, genre]);

  const dossier = useMemo(() => buildFilmRightsDossier(project, seed), [project, seed]);
  const guide = useMemo(() => buildForeignRightsGuide(project, seed), [project, seed]);
  const pdf = useMemo(() => generateRightsPitchPdf(project, seed), [project, seed]);

  return (
    <div
      data-testid="rights-pitch-modal"
      className={className}
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
      }}
    >
      <h2 style={{ margin: "0 0 12px" }}>🎬 Film-, TV- &amp; Auslandsrechte-Pitch-Deck</h2>

      <section style={{ marginBottom: 16 }}>
        <label style={{ marginRight: 12 }}>
          Seed{" "}
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            style={inputStyle}
          />
        </label>
        <label style={{ marginRight: 12 }}>
          Titel{" "}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          Genre{" "}
          <input
            type="text"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            style={inputStyle}
          />
        </label>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px", color: "var(--accent)" }}>FILM-DOSSIER</h3>
        <p style={{ margin: "0 0 6px" }}>
          <strong>Logline:</strong> {dossier.logline}
        </p>
        <p style={{ margin: "0 0 6px" }}>
          <strong>Marktvergleich:</strong> {dossier.marketComparison}
        </p>
        <p style={{ margin: "0 0 4px" }}>
          <strong>Casting-Vorschläge:</strong>
        </p>
        <ul style={{ margin: "0 0 6px", paddingLeft: 18 }}>
          {dossier.castingSuggestions.map((c, i) => (
            <li key={i}>
              {c.role} ({c.actorType}): {c.description}
            </li>
          ))}
        </ul>
        <p style={{ margin: "0 0 6px" }}>
          <strong>Tonale Referenz:</strong> {dossier.tonalReference}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Serienpotenzial:</strong> {dossier.seriesPotential}
        </p>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px", color: "var(--accent)" }}>AUSLANDSRECHTE</h3>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {guide.territories.map((t, i) => (
            <li
              key={i}
              style={{ border: "1px solid var(--border)", padding: 8, marginBottom: 6 }}
            >
              <strong>
                {t.territory} ({t.language})
              </strong>
              <div style={{ color: "var(--muted)" }}>{t.marketTrend}</div>
              <div style={{ color: "var(--muted)" }}>Ansprache: {t.pitchAngle}</div>
            </li>
          ))}
        </ul>
        <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>{guide.salesData}</p>
        <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>{guide.fairStrategy}</p>
      </section>

      <section>
        <h3 style={{ margin: "0 0 8px", color: "var(--accent)" }}>PDF-EXPORT</h3>
        <p style={{ margin: "0 0 6px", color: "var(--muted)" }}>
          {pdf.title} · {pdf.pageCount} Seite(n) ·{" "}
          {pdf.printReady ? "druckfertig" : "nicht druckfertig"}
        </p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {pdf.sections.map((s, i) => (
            <li key={i}>
              <strong>{s.heading}</strong>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
