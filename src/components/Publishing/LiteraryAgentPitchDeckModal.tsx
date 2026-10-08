// LiteraryAgentPitchDeckModal (WP 103.2 UI)
import { useState, useMemo } from "react";
import {
  buildSubmissionDossier,
  createSampleManuscriptMeta,
  GENRE_PROFILES,
  type GenreId,
} from "@/services/publishing/literaryAgentPitchDeck";

export interface LiteraryAgentPitchDeckModalProps {
  className?: string;
}

export function LiteraryAgentPitchDeckModal({ className }: LiteraryAgentPitchDeckModalProps) {
  const [meta, setMeta] = useState(() => createSampleManuscriptMeta());
  const [seed, setSeed] = useState(42);

  const dossier = useMemo(() => buildSubmissionDossier(meta, seed), [meta, seed]);

  const update = (patch: Partial<typeof meta>) => setMeta((m) => ({ ...m, ...patch }));

  return (
    <div
      className={className}
      data-testid="literary-pitch-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        📮 Agentur-Pitch-Deck &amp; Query-Letter-Studio
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Dossier {dossier.id} · {dossier.genreLabel} · {meta.wordCount.toLocaleString("de-DE")} Wörter
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>
          Titel
          <input
            value={meta.title}
            onChange={(e) => update({ title: e.target.value })}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>
          Genre
          <select
            value={meta.genre}
            onChange={(e) => update({ genre: e.target.value as GenreId })}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          >
            {GENRE_PROFILES.map((g) => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>
          Wortzahl
          <input
            type="number"
            value={meta.wordCount}
            onChange={(e) => update({ wordCount: Number(e.target.value) || 0 })}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>
          Protagonist
          <input
            value={meta.protagonist}
            onChange={(e) => update({ protagonist: e.target.value })}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>
          Antagonist
          <input
            value={meta.antagonist}
            onChange={(e) => update({ antagonist: e.target.value })}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>
          Autor
          <input
            value={meta.authorName}
            onChange={(e) => update({ authorName: e.target.value })}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
      </div>

      <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
        Zentraler Konflikt
        <input
          value={meta.centralConflict}
          onChange={(e) => update({ centralConflict: e.target.value })}
          style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
        />
      </label>

      <div style={{ marginBottom: 12 }}>
        <div style={{ padding: 8, border: `1px solid ${dossier.normPage.valid ? "var(--success)" : "var(--error)"}`, borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
          <strong>Normseiten-Konformität:</strong> {dossier.normPage.valid ? "✓ konform" : "✗ nicht konform"} — {dossier.normPage.deviation}
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
            Genre-Bandbreite: {dossier.normPage.expectedRange[0].toLocaleString("de-DE")}–{dossier.normPage.expectedRange[1].toLocaleString("de-DE")} Wörter
          </div>
        </div>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          ✉️ QUERY LETTER ({dossier.queryLetter.wordCount} Wörter)
        </summary>
        <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)", maxHeight: 260, overflow: "auto" }}>
          {dossier.queryLetter.fullText}
        </pre>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📚 COMP-TITLE-POSITIONIERUNG
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {dossier.comps.titles.map((t, i) => (
            <div key={i} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
              {t}
            </div>
          ))}
          <div style={{ fontSize: 10, color: "var(--muted)" }}>{dossier.comps.rationale}</div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📎 1-KLICK-EINREICHUNGS-DOSSIER
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {dossier.attachments.map((a, i) => (
            <div key={i} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              {i + 1}. {a}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>PDF-Gliederung:</div>
        <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 3, fontSize: 10 }}>
          {dossier.pdfOutline.map((p, i) => (
            <div key={i} style={{ color: "var(--muted)" }}>• {p}</div>
          ))}
        </div>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📧 E-MAIL-VORLAGE
        </summary>
        <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)", maxHeight: 200, overflow: "auto" }}>
          {dossier.emailTemplate}
        </pre>
        <button
          onClick={() => {
            const s = createSampleManuscriptMeta();
            setMeta(s);
            setSeed(42);
          }}
          style={{ marginTop: 8, padding: "6px 12px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 11 }}
        >
          🎲 BEISPIEL LADEN
        </button>
      </details>
    </div>
  );
}
