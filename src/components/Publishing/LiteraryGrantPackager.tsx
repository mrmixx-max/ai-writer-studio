// LiteraryGrantPackager (WP 51.2): Literatur-Stipendien- & Jury-Dossier.
//
// Jury-Leseprobe mit Zeilennummern, Bewerbungsmappen-Builder und Norm-Profile.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useCallback, useMemo, useState } from "react";
import {
  generateReadingSample,
  buildApplicationDossier,
  listGrantProfiles,
  type DossierConfig,
} from "@/services/publishing/literaryGrantPackager";

export interface LiteraryGrantPackagerProps {
  className?: string;
  defaultText?: string;
}

const DEFAULT_TEXT = `Der letzte Winter kam leise. Sie stand am Fenster und sah den Schnee über die Stadt fallen. "Niemand wird uns reisen", flüsterte sie. Doch er wusste, dass das Unmögliche möglich war. Die Kälte biss in ihre Wangen, aber in ihrem Herzen brannte ein Feuer, das niemand löschen konnte. Die Stadt war verlassen, die Straßen leer. Nur ihr Atem war zu sehen, ein weißer Schleier in der Dunkelheit.`;

const DEFAULT_DOSSIER: DossierConfig = {
  title: "Der letzte Winter",
  author: "Erik Gieske",
  expose: "Ein Roman über Liebe und Verlust in einer postapokalyptischen Welt.",
  motivation: "Ich schreibe seit 10 Jahren und möchte meine erste Veröffentlichung realisieren.",
  timeline: "12 Monate: 6 Monate Schreiben, 3 Monate Lektorat, 3 Monate Produktion.",
  budget: "5.000 € für Lektorat, Coverdesign und Marketing.",
  biography: "Erik Gieske, geboren 1985, Autor und Softwareentwickler.",
};

export function LiteraryGrantPackager({
  className,
  defaultText = DEFAULT_TEXT,
}: LiteraryGrantPackagerProps) {
  const [text] = useState(defaultText);
  const [sampleTitle, setSampleTitle] = useState("Der letzte Winter");
  const [sampleAuthor, setSampleAuthor] = useState("Erik Gieske");
  const [lineNumbers, setLineNumbers] = useState(true);
  const [dossierConfig, setDossierConfig] = useState(DEFAULT_DOSSIER);
  const [dossier, setDossier] = useState<ReturnType<typeof buildApplicationDossier> | null>(null);

  const profiles = useMemo(() => listGrantProfiles(), []);

  const sample = useMemo(
    () =>
      generateReadingSample(text, {
        title: sampleTitle,
        author: sampleAuthor,
        lineNumbers,
      }),
    [text, sampleTitle, sampleAuthor, lineNumbers],
  );

  const handleGenerateDossier = useCallback(() => {
    setDossier(buildApplicationDossier(dossierConfig));
  }, [dossierConfig]);

  return (
    <div
      className={className}
      data-testid="literary-grant-packager"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        📚 Stipendien-Dossier
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {profiles.length} Profile · {sample.lines.length} Zeilen · {dossier?.sections.length ?? 0} Sektionen
      </div>

      {/* Grant-Profile */}
      <div data-testid="grant-profiles" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>NORM-PROFILE</div>
        {profiles.map((p) => (
          <div
            key={p.id}
            data-testid={`grant-profile-${p.id}`}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "8px 12px",
              marginBottom: 6,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>{p.name}</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>{p.organization}</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>Frist: {p.deadline}</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>Max. {p.maxPages} Seiten</div>
          </div>
        ))}
      </div>

      {/* Leseprobe */}
      <div data-testid="grant-sample" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>LESEPROBE</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <input
            data-testid="grant-sample-title"
            value={sampleTitle}
            onChange={(e) => setSampleTitle(e.target.value)}
            style={{
              flex: 1,
              background: "var(--bg)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "4px 6px",
              fontSize: 10,
            }}
          />
          <input
            data-testid="grant-sample-author"
            value={sampleAuthor}
            onChange={(e) => setSampleAuthor(e.target.value)}
            style={{
              flex: 1,
              background: "var(--bg)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "4px 6px",
              fontSize: 10,
            }}
          />
          <label style={{ fontSize: 10, color: "var(--muted)", display: "flex", gap: 4, alignItems: "center" }}>
            <input
              data-testid="grant-line-numbers"
              type="checkbox"
              checked={lineNumbers}
              onChange={(e) => setLineNumbers(e.target.checked)}
            />
            Zeilennummern
          </label>
        </div>
        <div
          data-testid="grant-sample-output"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 8,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            maxHeight: 150,
            overflow: "auto",
          }}
        >
          {sample.lines.map((line) => (
            <div key={line.lineNumber} style={{ display: "flex", gap: 8 }}>
              {lineNumbers && (
                <span style={{ color: "var(--muted)", minWidth: 30, textAlign: "right" }}>
                  {line.lineNumber}
                </span>
              )}
              <span>{line.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dossier */}
      <div data-testid="grant-dossier" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>BEWERBUNGSMAPPEN</div>
        <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
          {[
            { key: "title", label: "Titel", testid: "grant-dossier-title" },
            { key: "author", label: "Autor", testid: "grant-dossier-author" },
            { key: "expose", label: "Exposé", testid: "grant-dossier-expose" },
            { key: "motivation", label: "Motivation", testid: "grant-dossier-motivation" },
            { key: "timeline", label: "Zeitplan", testid: "grant-dossier-timeline" },
            { key: "budget", label: "Budget", testid: "grant-dossier-budget" },
            { key: "biography", label: "Biografie", testid: "grant-dossier-biography" },
          ].map((f) => (
            <label key={f.key} style={{ fontSize: 10, color: "var(--muted)" }}>
              {f.label}
              <input
                data-testid={f.testid}
                value={dossierConfig[f.key as keyof DossierConfig]}
                onChange={(e) =>
                  setDossierConfig({ ...dossierConfig, [f.key]: e.target.value })
                }
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 2,
                  background: "var(--bg)",
                  color: "var(--fg)",
                  border: "1px solid var(--border)",
                  borderRadius: 3,
                  padding: "4px 6px",
                  fontSize: 10,
                  boxSizing: "border-box",
                }}
              />
            </label>
          ))}
        </div>
        <button
          data-testid="grant-dossier-generate"
          onClick={handleGenerateDossier}
          style={{
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            borderRadius: 4,
            padding: "6px 14px",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Dossier erstellen
        </button>
      </div>

      {dossier && (
        <div
          data-testid="grant-dossier-result"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 12,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", marginBottom: 6 }}>
            📄 {dossier.title} — {dossier.sections.length} Sektionen
          </div>
          {dossier.sections.map((s) => (
            <div key={s.id} data-testid={`grant-dossier-section-${s.id}`} style={{ fontSize: 11, marginBottom: 4 }}>
              <strong>{s.title}</strong>
              <span style={{ color: "var(--muted)" }}> · Seite {s.pageNumber}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
