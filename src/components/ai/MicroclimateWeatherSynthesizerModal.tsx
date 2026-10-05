// MicroclimateWeatherSynthesizerModal (WP 65.1)
//
// Multisensorische Prosa für 6 extreme Lagen mit barometrischem Druck
// und Körperempfinden.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  synthesizeMicroclimate,
  analyzeBarometricPressure,
  embedScene,
  CLIMATE_LABELS,
  type MicroclimateType,
} from "@/services/ai/microclimateWeatherSynthesizer";

export interface MicroclimateWeatherSynthesizerModalProps {
  className?: string;
}

const CLIMATES: MicroclimateType[] = [
  "swamp-mist",
  "thin-air",
  "catacomb-heat",
  "coastal-fog",
  "desert-scorch",
  "arctic-wind",
];

const SENSE_ICONS: Record<string, string> = {
  sight: "👁️",
  sound: "👂",
  smell: "👃",
  taste: "👅",
  touch: "✋",
};

export function MicroclimateWeatherSynthesizerModal({
  className,
}: MicroclimateWeatherSynthesizerModalProps) {
  const [climate, setClimate] = useState<MicroclimateType>("swamp-mist");
  const [existingText, setExistingText] = useState("");

  const scene = useMemo(() => synthesizeMicroclimate(climate), [climate]);
  const pressure = useMemo(
    () => analyzeBarometricPressure(scene.pressureHpa, climate),
    [scene, climate],
  );
  const embedded = useMemo(
    () => embedScene(scene, existingText),
    [scene, existingText],
  );

  return (
    <div
      className={className}
      data-testid="microclimate-weather-synthesizer-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🌡️ Mikroklima- & Sensorik-Wetter-Synthesizer
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {scene.label} · {scene.senseCount} Sinne aktiv · {scene.pressureHpa} hPa
      </div>

      {/* Lagen-Auswahl */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Atmosphärische Lage
        <select
          data-testid="microclimate-select"
          value={climate}
          onChange={(e) => setClimate(e.target.value as MicroclimateType)}
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
        >
          {CLIMATES.map((c) => (
            <option key={c} value={c}>
              {CLIMATE_LABELS[c]}
            </option>
          ))}
        </select>
      </label>

      {/* Sensorische Eindrücke */}
      <div
        data-testid="microclimate-impressions"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          MULTISENSORISCHE EINDRÜCKE
        </div>
        {scene.impressions.map((imp, i) => (
          <div
            key={i}
            data-testid={`microclimate-sense-${imp.sense}`}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
              marginBottom: 4,
              fontSize: 11,
            }}
          >
            <span style={{ fontSize: 14 }}>{SENSE_ICONS[imp.sense]}</span>
            <span>
              <strong style={{ color: "var(--accent)" }}>{imp.sense}:</strong>{" "}
              {imp.description}
            </span>
          </div>
        ))}
      </div>

      {/* Barometrischer Druck */}
      <div
        data-testid="microclimate-pressure"
        style={{
          border: `1px solid ${pressure.category === "low" ? "var(--error)" : pressure.category === "high" ? "var(--warn)" : "var(--success)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          BAROMETRISCHER DRUCK & KÖRPEREMPFINDEN
        </div>
        <div>
          Druck:{" "}
          <strong data-testid="microclimate-pressure-value">
            {pressure.pressureHpa} hPa
          </strong>{" "}
          ({pressure.category})
        </div>
        <div data-testid="microclimate-body-feeling" style={{ marginTop: 4 }}>
          {pressure.bodyFeeling}
        </div>
        <div
          data-testid="microclimate-foreboding"
          style={{ marginTop: 4, color: "var(--muted)", fontStyle: "italic" }}
        >
          {pressure.foreboding}
        </div>
      </div>

      {/* Szenen-Einbettung */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Bestehender Text (optional)
        <textarea
          data-testid="microclimate-text-input"
          value={existingText}
          onChange={(e) => setExistingText(e.target.value)}
          rows={3}
          style={{
            display: "block",
            width: "100%",
            marginTop: 4,
            background: "var(--panel)",
            color: "var(--fg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 8,
            fontSize: 12,
            resize: "vertical",
          }}
        />
      </label>

      {/* Ergebnis */}
      <div data-testid="microclimate-result">
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          EINGEBETTETE SZENE
        </div>
        <div
          data-testid="microclimate-prose"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 12,
            fontSize: 12,
            lineHeight: 1.7,
          }}
        >
          {embedded || "—"}
        </div>
      </div>
    </div>
  );
}
