// Flagship70SovereignCockpitModal (WP 121.2 UI / Meilenstein 58.0 · v7.0.0)
import { useState, useMemo } from "react";
import {
  runAudit,
  generateObsidianSeal,
  buildObsidianArchive,
  createSampleAudit,
  createSampleObsidianSeal,
} from "@/services/publishing/flagship70SovereignCockpit";

export interface Flagship70SovereignCockpitModalProps {
  className?: string;
}

const SAMPLE_SERVICES: string[] = [
  "flagship50JubileeCockpit",
  "flagship60SingularityCockpit",
  "masterPublishingService",
  "polyglotBookBuilder",
  "distributionPipeline",
  "audiobookProductionSheet",
  "barcodeGenerator",
  "concordanceIndexMatrix",
  "omniverseReleaseService",
  "globalRoyaltyAggregator",
  "authorMediaKitPackager",
  "digitalMerchPackager",
];

const SAMPLE_LOCALE_KEYS = { de: 1780, en: 1780, es: 1780, fr: 1780 };

const SAMPLE_ENCYCLOPEDIA = [{ name: "Enzyklopädie der Sternenschmiede" }];
const SAMPLE_SCREENPLAYS = [{ title: "Der letzte Wächter" }];
const SAMPLE_AUDIO_CUES = [{ id: "cue-001" }, { id: "cue-002" }];
const SAMPLE_PRINT_PDFS = [{ title: "Hardcover-Edition" }];

export function Flagship70SovereignCockpitModal({ className }: Flagship70SovereignCockpitModalProps) {
  const [seed, setSeed] = useState(700);

  const audit = useMemo(
    () => runAudit(SAMPLE_SERVICES, SAMPLE_LOCALE_KEYS, seed),
    [seed]
  );

  const seal = useMemo(() => generateObsidianSeal(seed), [seed]);

  const archive = useMemo(
    () =>
      buildObsidianArchive(
        "Das Zwölfgestirn",
        SAMPLE_ENCYCLOPEDIA,
        SAMPLE_SCREENPLAYS,
        SAMPLE_AUDIO_CUES,
        SAMPLE_PRINT_PDFS,
        seed
      ),
    [seed]
  );

  const statusColor = (s: "pass" | "warn" | "fail") =>
    s === "pass" ? "var(--accent)" : s === "warn" ? "var(--warn)" : "var(--error)";

  const statusLabel = (s: "pass" | "warn" | "fail") =>
    s === "pass" ? "BESTANDEN" : s === "warn" ? "WARNUNG" : "FEHLGESCHLAGEN";

  const inputStyle = {
    width: "100%",
    marginTop: 4,
    padding: "4px 8px",
    fontSize: 11,
    background: "var(--panel)",
    color: "var(--fg)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    fontFamily: "var(--font-mono)",
  } as const;

  const cellStyle = {
    display: "flex",
    justifyContent: "space-between",
    padding: 6,
    border: "1px solid var(--border)",
    borderRadius: 4,
    background: "var(--panel)",
  } as const;

  return (
    <div
      className={className}
      data-testid="flagship70-cockpit-modal"
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
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🏆 Flaggschiff 7.0 Cockpit &amp; Obsidian-Siegel
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Version {seal.version} · {seal.certificateId} · Seed {seed}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
        <button
          onClick={() => {
            const a = createSampleAudit();
            const s = createSampleObsidianSeal();
            setSeed(700);
            void a;
            void s;
          }}
          style={{
            alignSelf: "flex-end",
            padding: "6px 12px",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            cursor: "pointer",
            color: "var(--fg)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
          }}
        >
          🎲 BEISPIEL LADEN
        </button>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔍 7.0-GESAMT-AUDIT
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
          <div style={{ padding: 10, border: `2px solid ${statusColor(audit.status)}`, borderRadius: 8, background: "var(--panel)", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: statusColor(audit.status) }}>
              {statusLabel(audit.status)}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
              {audit.totalTests} Tests · Coverage {(audit.coverage * 100).toFixed(1)}% · {audit.responseTimeMs} ms
            </div>
          </div>
          <div style={cellStyle}>
            <span>Services</span>
            <span style={{ color: "var(--muted)", fontSize: 10 }}>{audit.serviceCount}</span>
          </div>
          <div style={cellStyle}>
            <span>Locale-Schlüssel (de/en/es/fr)</span>
            <span style={{ color: "var(--muted)", fontSize: 10 }}>
              {audit.localeKeys.de}/{audit.localeKeys.en}/{audit.localeKeys.es}/{audit.localeKeys.fr}
            </span>
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          💎 OBSIDIAN-SIEGEL
        </summary>
        <div
          style={{ marginTop: 8, display: "flex", justifyContent: "center", padding: 12, border: "1px solid var(--border)", borderRadius: 8, background: "var(--panel)" }}
          dangerouslySetInnerHTML={{ __html: seal.svg }}
        />
        <div style={{ marginTop: 8, fontSize: 10, color: "var(--muted)" }}>
          {seal.description}
        </div>
        <div style={{ marginTop: 4, fontSize: 10, color: "var(--muted)", wordBreak: "break-all" }}>
          SHA-512-Signatur: {seal.sha512.substring(0, 64)}…
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📦 OBSIDIAN-ARCHIV
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {archive.contents.map((c, i) => (
            <div key={i} style={cellStyle}>
              <span>{c.name}</span>
              <span style={{ color: "var(--muted)", fontSize: 10 }}>{c.type}</span>
            </div>
          ))}
          <div style={{ padding: 6, fontSize: 10, color: "var(--muted)" }}>
            Gesamt: {(archive.sizeBytes / 1024).toFixed(0)} KB · ID {archive.archiveId}
          </div>
          <div style={{ padding: 6, fontSize: 10, color: "var(--muted)", wordBreak: "break-all" }}>
            Prüfsumme: {archive.checksum.substring(0, 64)}…
          </div>
          <div style={{ padding: 6, fontSize: 10, color: "var(--muted)" }}>
            {archive.description}
          </div>
        </div>
      </details>
    </div>
  );
}
