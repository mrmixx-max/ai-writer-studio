// HighConvertingAdCopySynthesizerModal (Meilenstein 61.0 / v7.3.0 UI)
// Klappentext-Architektur, Meta-Ad-Winkel und Amazon Sponsored Ads.
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  AD_ANGLES,
  buildBlurbArchitecture,
  generateMetaAds,
  generateAmazonAds,
  createSampleAdBrief,
  createSampleAdSet,
} from "@/services/marketing/highConvertingAdCopySynthesizer";

export interface HighConvertingAdCopySynthesizerModalProps {
  className?: string;
}

export function HighConvertingAdCopySynthesizerModal({
  className,
}: HighConvertingAdCopySynthesizerModalProps) {
  const sampleBrief = useMemo(() => createSampleAdBrief(), []);
  const sampleSet = useMemo(() => createSampleAdSet(), []);

  const [seed, setSeed] = useState(42);
  const [title, setTitle] = useState(sampleBrief.title);
  const [genre, setGenre] = useState(sampleBrief.genre);
  const [protagonist, setProtagonist] = useState(sampleBrief.protagonist);

  const brief = useMemo(
    () => ({ title, genre, protagonist }),
    [title, genre, protagonist]
  );

  const blurb = useMemo(() => buildBlurbArchitecture(brief, seed), [brief, seed]);
  const metaAds = useMemo(() => generateMetaAds(brief, seed), [brief, seed]);
  const amazonAds = useMemo(() => generateAmazonAds(brief, seed), [brief, seed]);

  const inputStyle = {
    width: "100%",
    marginTop: 4,
    padding: "4px 8px",
    fontSize: 11,
    background: "var(--panel)",
    color: "var(--fg)",
    border: "1px solid var(--border)",
    borderRadius: 4,
  } as const;
  const labelStyle = { fontSize: 11, color: "var(--muted)" } as const;
  const summaryStyle = {
    fontSize: 11,
    color: "var(--accent)",
    cursor: "pointer",
    fontWeight: 700,
  } as const;
  const panelStyle = {
    marginTop: 8,
    padding: 10,
    border: "1px solid var(--border)",
    borderRadius: 4,
    background: "var(--panel)",
    fontSize: 11,
    lineHeight: 1.7,
  } as const;
  const preStyle = {
    marginTop: 8,
    padding: 10,
    border: "1px solid var(--border)",
    borderRadius: 4,
    fontSize: 10,
    fontFamily: "var(--font-mono)",
    whiteSpace: "pre-wrap",
    background: "var(--panel)",
    lineHeight: 1.5,
    color: "var(--text)",
  } as const;

  return (
    <div
      className={className}
      data-testid="ad-copy-modal"
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
        📣 Hochkonvertierender Ad- &amp; Blurb-Synthesizer
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {title || "Ohne Titel"} · {genre || "default"} · {protagonist || "Protagonist"} ·
        Muster &bdquo;{sampleSet.brief.title}&ldquo; ({sampleSet.blurb.wordCount} Wörter)
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ ...labelStyle, minWidth: 80 }}>
          Seed
          <input
            data-testid="ad-copy-seed"
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
        <label style={{ ...labelStyle, flex: 1, minWidth: 160 }}>
          Titel
          <input
            data-testid="ad-copy-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ ...labelStyle, flex: 1, minWidth: 140 }}>
          Genre
          <input
            data-testid="ad-copy-genre"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ ...labelStyle, flex: 1, minWidth: 140 }}>
          Protagonist
          <input
            data-testid="ad-copy-protagonist"
            value={protagonist}
            onChange={(e) => setProtagonist(e.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={summaryStyle}>📝 KLAPPENTEXT-ARCHITEKTUR</summary>
        <div style={panelStyle}>
          <div data-testid="ad-copy-blurb-hook">
            <strong>Hook:</strong> {blurb.hook}
          </div>
          <div data-testid="ad-copy-blurb-conflict">
            <strong>Konflikt:</strong> {blurb.characterConflict}
          </div>
          <div data-testid="ad-copy-blurb-dilemma">
            <strong>Dilemma:</strong> {blurb.dilemma}
          </div>
          <div style={{ marginTop: 4 }}>
            <strong>Tropen:</strong>
            <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
              {blurb.tropeBullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
          <div style={{ marginTop: 4 }}>
            <strong>Call-to-Action:</strong> {blurb.callToAction}
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: "var(--muted)" }}>
            {blurb.wordCount} Wörter
          </div>
          <pre style={preStyle}>{blurb.fullBlurb}</pre>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={summaryStyle}>🎯 META-ADS ({AD_ANGLES.length} Winkel)</summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {AD_ANGLES.map((angle) => {
            const ad = metaAds.find((m) => m.angleId === angle.id);
            return (
              <div
                key={angle.id}
                data-testid={`ad-copy-angle-${angle.id}`}
                style={{
                  padding: 8,
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  background: "var(--panel)",
                  fontSize: 11,
                }}
              >
                <div style={{ fontWeight: 700, color: "var(--accent)" }}>{angle.name}</div>
                <div style={{ color: "var(--muted)", marginTop: 2 }}>{angle.description}</div>
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                  Zielgruppe: {angle.targetAudience}
                </div>
                {ad && (
                  <div
                    data-testid={`ad-copy-meta-${angle.id}`}
                    style={{ marginTop: 6, lineHeight: 1.7 }}
                  >
                    <div>
                      <strong>Headline:</strong> {ad.headline}
                    </div>
                    <div>
                      <strong>Primary Text:</strong> {ad.primaryText}
                    </div>
                    <div>
                      <strong>Beschreibung:</strong> {ad.description}
                    </div>
                    <div>
                      <strong>CTA:</strong> {ad.callToAction}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </details>

      <details open>
        <summary style={summaryStyle}>🛒 AMAZON-ADS ({amazonAds.length})</summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {amazonAds.map((ad, i) => (
            <div
              key={i}
              data-testid="ad-copy-amazon"
              style={{
                padding: 8,
                border: "1px solid var(--border)",
                borderRadius: 4,
                background: "var(--panel)",
                fontSize: 11,
              }}
            >
              <div style={{ fontWeight: 700, color: "var(--accent)" }}>{ad.headline}</div>
              <div style={{ color: "var(--muted)", marginTop: 2 }}>{ad.description}</div>
              <div style={{ fontSize: 10, marginTop: 4 }}>
                <strong>Match:</strong> {ad.matchType} · <strong>Keywords:</strong>{" "}
                {ad.keywords.map((k) => (
                  <span
                    key={k}
                    style={{
                      display: "inline-block",
                      margin: "2px 4px 2px 0",
                      padding: "2px 6px",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 3,
                      fontSize: 9,
                    }}
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
