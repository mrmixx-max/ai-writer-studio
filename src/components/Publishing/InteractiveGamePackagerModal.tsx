// InteractiveGamePackagerModal (WP 69.2)
//
// Solo-Spielbuch-Packager: Paragraphen-Scrambler, Würfeltabellen,
// Charakterbogen, A5-PDF und Standalone-Webgame-ZIP.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  scrambleGamebook,
  validateGamebook,
  buildDiceTables,
  buildCharacterSheet,
  buildGamebookPdf,
  buildWebgameHtml,
  buildWebgameZip,
} from "@/services/publishing/interactiveGamePackager";

export interface InteractiveGamePackagerModalProps {
  initialStory?: string;
  className?: string;
}

const SAMPLE_STORY = `# Der Wald
Du stehst am Rand des Waldes. Hinter dir liegt das Dorf, vor dir das Dunkel.
-> Fliehen | Die Lichtung
-> Kämpfen | Der Kampf

---

# Die Lichtung
Ein offener Platz. Sonnenlicht fällt durch die Kronen.
-> Weiter | Das Ende

---

# Der Kampf
Ein Gegner tritt aus dem Schatten, das Schwert gezogen.
-> Angreifen | Das Ende

---

# Das Ende
Du hast überlebt. Das Abenteuer ist vorbei.`;

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

export function InteractiveGamePackagerModal({
  initialStory = SAMPLE_STORY,
  className,
}: InteractiveGamePackagerModalProps) {
  const [story, setStory] = useState(initialStory);
  const [title, setTitle] = useState("Die Schatten des Waldes");
  const [seed, setSeed] = useState(42);
  const [view, setView] = useState<"pdf" | "html" | "tables">("tables");

  const book = useMemo(() => scrambleGamebook(story, title, seed), [story, title, seed]);
  const validation = useMemo(() => validateGamebook(book), [book]);
  const tables = useMemo(() => buildDiceTables(), []);
  const sheet = useMemo(() => buildCharacterSheet(), []);

  const pdf = useMemo(() => buildGamebookPdf(book), [book]);
  const html = useMemo(() => buildWebgameHtml(book), [book]);

  const zipSize = useMemo(() => {
    try {
      return buildWebgameZip(book).length;
    } catch {
      return 0;
    }
  }, [book]);

  const preview = view === "pdf" ? pdf : view === "html" ? html : "";

  return (
    <div
      className={className}
      data-testid="interactive-game-packager-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        📖 Solo-Spielbuch-Packager
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {book.sectionCount} Abschnitte · {book.linkCount} Verweise · Seed {book.seed} · ZIP{" "}
        {Math.round(zipSize / 1024)} KB
      </div>

      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Titel
        <input
          data-testid="gb-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={inputStyle}
        />
      </label>

      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Geschichte (Abschnitte mit --- trennen, Verweise als „-&gt; Label | Ziel")
        <textarea
          data-testid="gb-story-input"
          value={story}
          onChange={(e) => setStory(e.target.value)}
          rows={8}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 11 }}
        />
      </label>

      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 14 }}>
        Scrambler-Seed: {seed}
        <input
          data-testid="gb-seed-input"
          type="range"
          min={1}
          max={999}
          value={seed}
          onChange={(e) => setSeed(Number(e.target.value))}
          style={{ width: "100%", marginTop: 4 }}
        />
      </label>

      {/* Prüfung */}
      <div
        data-testid="gb-validation"
        style={{
          border: `1px solid ${validation.valid ? "var(--success)" : "var(--error)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>SPIELBUCH-PRÜFUNG</div>
        <div
          data-testid="gb-valid"
          style={{ fontWeight: 700, color: validation.valid ? "var(--success)" : "var(--error)" }}
        >
          {validation.valid ? "✓ Jedes Ende erreichbar, keine Schleife ohne Ende" : `✗ ${validation.errors.length} Fehler`}
        </div>
        {validation.errors.map((e, i) => (
          <div key={i} data-testid={`gb-error-${i}`} style={{ marginTop: 4, color: "var(--error)" }}>
            {e}
          </div>
        ))}
        {validation.warnings.map((w, i) => (
          <div key={i} data-testid={`gb-warning-${i}`} style={{ marginTop: 4, color: "var(--warn)" }}>
            {w}
          </div>
        ))}
      </div>

      {/* Abschnitts-Übersicht */}
      <div
        data-testid="gb-sections"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
          maxHeight: 200,
          overflow: "auto",
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          GEMISCHTE ABSCHNITTE
        </div>
        {book.sections.map((s) => (
          <div
            key={s.scrambledNumber}
            data-testid={`gb-section-${s.scrambledNumber}`}
            style={{
              borderLeft: "3px solid var(--accent)",
              paddingLeft: 8,
              marginBottom: 5,
              fontSize: 10,
            }}
          >
            <strong style={{ color: "var(--accent)" }}>{s.scrambledNumber}.</strong> {s.title}
            {s.scrambledTargets.length > 0 && (
              <span style={{ color: "var(--muted)" }}> → {s.scrambledTargets.join(", ")}</span>
            )}
          </div>
        ))}
      </div>

      {/* Export-Ansicht */}
      <div data-testid="gb-export" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          {([
            { k: "tables" as const, label: "Würfel & Bogen" },
            { k: "pdf" as const, label: "A5-PDF" },
            { k: "html" as const, label: "Webgame-HTML" },
          ]).map((v) => (
            <button
              key={v.k}
              data-testid={`gb-view-${v.k}`}
              onClick={() => setView(v.k)}
              aria-pressed={view === v.k}
              style={{
                fontSize: 11,
                padding: "4px 12px",
                borderRadius: 4,
                cursor: "pointer",
                background: view === v.k ? "var(--accent)" : "var(--panel)",
                color: view === v.k ? "var(--bg)" : "var(--fg)",
                border: "1px solid var(--border)",
              }}
            >
              {v.label}
            </button>
          ))}
        </div>

        {view === "tables" ? (
          <div data-testid="gb-tables">
            <pre
              data-testid="gb-dice-text"
              style={{
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: 10,
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                whiteSpace: "pre-wrap",
                marginBottom: 8,
              }}
            >
              {tables
                .map((t) => [`=== ${t.label} ===`, ...t.rows.map((r) => `  ${r.roll}: ${r.result}`)].join("\n"))
                .join("\n\n")}
            </pre>
            <pre
              data-testid="gb-sheet-text"
              style={{
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: 10,
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                whiteSpace: "pre-wrap",
              }}
            >
              {sheet}
            </pre>
          </div>
        ) : (
          <pre
            data-testid="gb-preview"
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: 10,
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              whiteSpace: "pre-wrap",
              maxHeight: 240,
              overflow: "auto",
            }}
          >
            {preview}
          </pre>
        )}
      </div>
    </div>
  );
}
