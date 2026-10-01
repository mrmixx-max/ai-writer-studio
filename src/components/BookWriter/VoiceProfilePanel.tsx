// VoiceProfilePanel: Charakter-Stimmen-Analyse (WP 6.2).
//
// Standalone-Panel — zeigt Voice-Profile und Abweichungen für Figuren
// aus einem Text. Nutzt `@/services/dialogue/voiceProfiling`.
// Dark Theme: bg #0a0e14, panel #11161f, border #232b3a,
// amber #ffb000, cyan #00e5ff, text #d5dbe5, dim #8a93a6.

import { useMemo } from "react";
import {
  analyzeVoiceProfiles,
  type VoiceAnalysis,
} from "@/services/dialogue/voiceProfiling";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#232b3a";
const AMBER = "#ffb000";
const CYAN = "#00e5ff";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";

export interface VoiceProfilePanelProps {
  /** Text für die Voice-Analyse. */
  text: string;
  className?: string;
}

function severityColor(severity: number): string {
  if (severity >= 0.7) return "#e5484d";
  if (severity >= 0.4) return AMBER;
  return CYAN;
}

function severityLabel(severity: number): string {
  if (severity >= 0.7) return "HOCH";
  if (severity >= 0.4) return "MITTEL";
  return "NIEDRIG";
}

export function VoiceProfilePanel({ text, className }: VoiceProfilePanelProps) {
  const analysis: VoiceAnalysis = useMemo(
    () => analyzeVoiceProfiles(text),
    [text],
  );

  const hasProfiles = analysis.profiles.length > 0;
  const hasDeviations = analysis.deviations.length > 0;

  return (
    <div
      className={className ?? "voice-profile-panel"}
      data-testid="voice-profile-panel"
      style={{
        background: BG,
        color: TEXT,
        fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
        padding: 16,
        border: `1px solid ${BORDER}`,
        borderRadius: 6,
      }}
    >
      <h3 style={{ color: AMBER, margin: "0 0 12px 0", fontSize: 16, fontWeight: 700 }}>
        🎭 Voice-Profile
      </h3>

      {!text.trim() && (
        <p style={{ color: DIM, fontSize: 13 }} data-testid="voice-profile-empty">
          Kein Text vorhanden — Voice-Analyse nicht möglich.
        </p>
      )}

      {text.trim() && !hasProfiles && (
        <p style={{ color: DIM, fontSize: 13 }} data-testid="voice-profile-no-characters">
          Keine Dialoge gefunden — Figuren können nicht analysiert werden.
        </p>
      )}

      {hasProfiles && (
        <div
          data-testid="voice-profile-list"
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          {analysis.profiles.map((profile) => (
            <div
              key={profile.character}
              data-testid={`voice-profile-${profile.character}`}
              style={{
                background: PANEL,
                border: `1px solid ${BORDER}`,
                borderRadius: 4,
                padding: "10px 12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <span style={{ color: CYAN, fontSize: 14, fontWeight: 700 }}>
                  {profile.character}
                </span>
                <span style={{ color: DIM, fontSize: 11 }}>
                  {profile.totalLines} Zeilen · {profile.totalWords} Wörter
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "4px 12px",
                  fontSize: 12,
                }}
              >
                <div>
                  <span style={{ color: DIM }}>Ø Satzlänge: </span>
                  <span style={{ color: TEXT }}>{profile.averageSentenceLength}</span>
                </div>
                <div>
                  <span style={{ color: DIM }}>Füllwort-Quote: </span>
                  <span style={{ color: TEXT }}>
                    {Math.round(profile.fillerWordRatio * 100)}%
                  </span>
                </div>
                <div>
                  <span style={{ color: DIM }}>Formalität: </span>
                  <span style={{ color: TEXT }}>
                    {Math.round(profile.formalityScore * 100)}%
                  </span>
                </div>
                <div>
                  <span style={{ color: DIM }}>Dialekt: </span>
                  <span style={{ color: TEXT }}>
                    {Math.round(profile.dialectScore * 100)}%
                  </span>
                </div>
              </div>

              {profile.characteristicWords.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 11 }}>
                  <span style={{ color: DIM }}>Typische Wörter: </span>
                  <span style={{ color: AMBER }}>
                    {profile.characteristicWords.join(", ")}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {hasDeviations && (
        <div data-testid="voice-profile-deviations" style={{ marginTop: 16 }}>
          <h4 style={{ color: AMBER, margin: "0 0 8px 0", fontSize: 13, fontWeight: 700 }}>
            ⚠️ Abweichungen
          </h4>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {analysis.deviations.map((dev, i) => (
              <li
                key={i}
                data-testid={`voice-deviation-${dev.character}-${dev.type}`}
                style={{
                  background: PANEL,
                  border: `1px solid ${BORDER}`,
                  borderLeft: `3px solid ${severityColor(dev.severity)}`,
                  borderRadius: 4,
                  padding: "6px 10px",
                  fontSize: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 2,
                  }}
                >
                  <span style={{ color: CYAN, fontWeight: 700 }}>{dev.character}</span>
                  <span
                    style={{
                      color: severityColor(dev.severity),
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {severityLabel(dev.severity)} ({Math.round(dev.severity * 100)}%)
                  </span>
                </div>
                <div style={{ color: TEXT }}>{dev.message}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
