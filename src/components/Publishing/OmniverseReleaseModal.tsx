// OmniverseReleaseModal (WP 63.2)
//
// Das finale Release-Cockpit: Universum-Preflight, `.aiwsomni`-Archiv mit
// Masterpiece Seal und VG-Wort-Verlagsnormseite.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  runOmniversePreflight,
  buildOmniverseArchive,
  verifyOmniverseArchive,
  buildVgWortNormPage,
  formatPreflightReport,
  formatArchiveManifest,
} from "@/services/publishing/omniverseReleaseService";

export interface OmniverseReleaseModalProps {
  /** Vorbefüllter Manuskript-Ausschnitt (eine Zeile je Kapitel). */
  initialChapters?: string;
  /** Version. */
  version?: string;
  className?: string;
}

const SAMPLE_CHAPTERS = [
  "Mira wacht im kalten Zimmer auf und hört das Wasser gegen den Kai schlagen, während der Morgen grau über den Dächern steht und niemand auf der Straße ist",
  "Der Wirt stellt die falsche Frage, und Mira antwortet mit einer Lüge, die sie später bereuen wird, weil sie weiß, dass er es merkt",
  "Die Tür fliegt auf und der Wächter steht darin, und alles, was Mira in den letzten Stunden aufgebaut hat, bricht in einer Sekunde zusammen",
  "Mira bleibt allein zurück und sieht dem Licht zu, wie es über den Boden wandert, und sie weiß, dass sie morgen weitermachen muss",
].join("\n");

const STATUS_COLORS: Record<string, string> = {
  ok: "var(--success)",
  warn: "var(--warn)",
  fail: "var(--error)",
};

export function OmniverseReleaseModal({
  initialChapters = SAMPLE_CHAPTERS,
  version = "4.0.0",
  className,
}: OmniverseReleaseModalProps) {
  const [chaptersText, setChaptersText] = useState(initialChapters);
  const [characterCount, setCharacterCount] = useState(12);
  const [conlangWords, setConlangWords] = useState(25);
  const [locationCount, setLocationCount] = useState(8);
  const [hasBarcode, setHasBarcode] = useState(true);

  const chapters = useMemo(
    () =>
      chaptersText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0),
    [chaptersText],
  );

  const input = useMemo(
    () => ({
      chapters,
      characterCount,
      conlangWords,
      locationCount,
      hasBarcode,
      localeCount: 4,
    }),
    [chapters, characterCount, conlangWords, locationCount, hasBarcode],
  );

  const preflight = useMemo(() => runOmniversePreflight(input), [input]);
  const archive = useMemo(() => buildOmniverseArchive(input, version), [input, version]);
  const verified = useMemo(() => verifyOmniverseArchive(archive), [archive]);
  const normPage = useMemo(() => buildVgWortNormPage(input), [input]);
  const report = useMemo(() => formatPreflightReport(preflight), [preflight]);
  const manifest = useMemo(() => formatArchiveManifest(archive), [archive]);

  return (
    <div
      className={className}
      data-testid="omniverse-release-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🌌 Omniverse 4.0 Master Release Cockpit
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {preflight.passed}/{preflight.checks.length} Prüfpunkte · Gesamtscore{" "}
        {Math.round(preflight.overallScore * 100)}%
      </div>

      {/* Manuskript */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Manuskript (eine Zeile je Kapitel)
        <textarea
          data-testid="omni-chapters-input"
          value={chaptersText}
          onChange={(e) => setChaptersText(e.target.value)}
          rows={4}
          style={{
            display: "block",
            width: "100%",
            marginTop: 4,
            background: "var(--panel)",
            color: "var(--fg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 8,
            fontSize: 11,
            resize: "vertical",
          }}
        />
      </label>

      {/* Lexikon-Zähler */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        {[
          { id: "characters", label: "Figuren", value: characterCount, set: setCharacterCount },
          { id: "conlang", label: "Conlang", value: conlangWords, set: setConlangWords },
          { id: "locations", label: "Orte", value: locationCount, set: setLocationCount },
        ].map((f) => (
          <label key={f.id} style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 90 }}>
            {f.label}
            <input
              data-testid={`omni-${f.id}-input`}
              type="number"
              min={0}
              value={f.value}
              onChange={(e) => f.set(Number(e.target.value) || 0)}
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                background: "var(--panel)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "4px 8px",
                fontSize: 12,
              }}
            />
          </label>
        ))}
        <label style={{ fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "flex-end", gap: 5 }}>
          <input
            data-testid="omni-barcode-input"
            type="checkbox"
            checked={hasBarcode}
            onChange={(e) => setHasBarcode(e.target.checked)}
          />
          Barcode
        </label>
      </div>

      {/* Release-Status */}
      <div
        data-testid="omni-release-status"
        style={{
          border: `2px solid ${preflight.releaseReady ? "var(--success)" : "var(--error)"}`,
          borderRadius: 6,
          padding: 14,
          marginBottom: 14,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 24, marginBottom: 4 }}>{preflight.releaseReady ? "✅" : "⛔"}</div>
        <div
          data-testid="omni-release-verdict"
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: preflight.releaseReady ? "var(--success)" : "var(--error)",
          }}
        >
          {preflight.releaseReady ? "RELEASE FREIGEGEBEN" : "RELEASE GESPERRT"}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
          {preflight.failed} Fehler · {preflight.checks.length - preflight.passed - preflight.failed} Warnungen
        </div>
      </div>

      {/* Preflight-Prüfpunkte */}
      <div
        data-testid="omni-preflight"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          UNIVERSUM-PREFLIGHT
        </div>
        {preflight.checks.map((c) => (
          <div
            key={c.name}
            data-testid={`omni-check-${c.name}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 3,
              fontSize: 10,
            }}
          >
            <span style={{ color: STATUS_COLORS[c.status] }}>
              [{c.status.toUpperCase()}] {c.name}
            </span>
            <span style={{ color: "var(--muted)" }}>{c.detail}</span>
          </div>
        ))}
      </div>

      {/* Archiv */}
      <div
        data-testid="omni-archive"
        style={{
          border: `1px solid ${verified ? "var(--success)" : "var(--error)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          OMNIVERSE-ARCHIV
        </div>
        <div data-testid="omni-archive-name" style={{ fontWeight: 700, color: "var(--accent)" }}>
          {archive.filename}
        </div>
        <div style={{ marginTop: 4 }}>
          {archive.entries.length} Einträge · {Math.round(archive.totalBytes / 1024)} KB ·{" "}
          {archive.totalWords.toLocaleString("de-DE")} Wörter
        </div>
        <div
          data-testid="omni-archive-seal"
          style={{
            marginTop: 6,
            color: verified ? "var(--success)" : "var(--error)",
            fontWeight: 700,
          }}
        >
          {verified ? "✓ Masterpiece Seal verifiziert" : "✗ Seal ungültig"}
        </div>
        <div
          data-testid="omni-archive-hash"
          style={{ fontSize: 9, color: "var(--muted)", fontFamily: "var(--font-mono)", marginTop: 4 }}
        >
          {archive.hash.slice(0, 32)}…
        </div>
      </div>

      {/* VG-Wort-Normseite */}
      <div
        data-testid="omni-normpage"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 12,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          VERLAGSNORMSEITE (VG WORT, 30 × 60)
        </div>
        <div>
          {normPage.pageCount} Seiten ·{" "}
          <strong data-testid="omni-normpage-count">{normPage.normPageCount}</strong> Normseiten ·{" "}
          {normPage.totalCharacters.toLocaleString("de-DE")} Anschläge
        </div>
        <div
          data-testid="omni-normpage-fee"
          style={{ marginTop: 6, color: "var(--accent)", fontWeight: 700 }}
        >
          Honorar-Schätzung: {normPage.estimatedFee.toFixed(2)} €
        </div>
        {normPage.pages[0] && (
          <pre
            data-testid="omni-normpage-preview"
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: 8,
              marginTop: 8,
              fontSize: 9,
              fontFamily: "var(--font-mono)",
              whiteSpace: "pre-wrap",
              maxHeight: 100,
              overflow: "auto",
            }}
          >
            {normPage.pages[0].join("\n")}
          </pre>
        )}
      </div>

      <details data-testid="omni-report">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständiger Preflight-Bericht
        </summary>
        <pre
          data-testid="omni-report-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            marginTop: 6,
          }}
        >
          {report}
        </pre>
      </details>

      <details data-testid="omni-manifest" style={{ marginTop: 8 }}>
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Archiv-Inhaltsverzeichnis
        </summary>
        <pre
          data-testid="omni-manifest-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            marginTop: 6,
          }}
        >
          {manifest}
        </pre>
      </details>
    </div>
  );
}
