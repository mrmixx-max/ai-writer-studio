// AtmosphereProseGenerator (WP 55.1)
//
// Erzeugt Schauplatz-Einstiege (World Painting) mit erzwungener sensorischer
// Verankerung und stimmungsvollen Übergängen.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  generateAtmosphere,
  checkSensoryCoverage,
  generateTransition,
  type Mood,
  type TimeOfDay,
  type Weather,
  type Sense,
} from "@/services/ai/atmosphereProseGenerator";

export interface AtmosphereProseGeneratorProps {
  /** Vorbefüllter Ortsname. */
  initialLocation?: string;
  className?: string;
}

const MOODS: { value: Mood; label: string }[] = [
  { value: "threatening", label: "Bedrohlich" },
  { value: "melancholic", label: "Melancholisch" },
  { value: "sublime", label: "Erhaben" },
  { value: "claustrophobic", label: "Klaustrophobisch" },
  { value: "serene", label: "Gelassen" },
];

const TIMES: { value: TimeOfDay; label: string }[] = [
  { value: "dawn", label: "Dämmerung" },
  { value: "day", label: "Tag" },
  { value: "dusk", label: "Abendrot" },
  { value: "night", label: "Nacht" },
];

const WEATHERS: { value: Weather; label: string }[] = [
  { value: "clear", label: "Klar" },
  { value: "rain", label: "Regen" },
  { value: "fog", label: "Nebel" },
  { value: "storm", label: "Sturm" },
  { value: "snow", label: "Schnee" },
  { value: "heat", label: "Hitze" },
];

const SENSE_LABELS: Record<Sense, string> = {
  sight: "Sehen",
  sound: "Hören",
  smell: "Riechen",
  taste: "Schmecken",
  touch: "Fühlen",
};

export function AtmosphereProseGenerator({
  initialLocation = "Der Hafenkai",
  className,
}: AtmosphereProseGeneratorProps) {
  const [location, setLocation] = useState(initialLocation);
  const [mood, setMood] = useState<Mood>("threatening");
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("night");
  const [weather, setWeather] = useState<Weather>("rain");
  const [toLocation, setToLocation] = useState("");
  const [timeSkip, setTimeSkip] = useState("");

  const atmosphere = useMemo(
    () => generateAtmosphere({ location, mood, timeOfDay, weather }),
    [location, mood, timeOfDay, weather],
  );
  const coverage = useMemo(() => checkSensoryCoverage(atmosphere.text), [atmosphere.text]);
  const transition = useMemo(
    () => generateTransition({ timeSkip, mood, toLocation }),
    [timeSkip, mood, toLocation],
  );

  const selectStyle = {
    marginLeft: 6,
    padding: "2px 6px",
    background: "var(--panel)",
    color: "var(--fg)",
    border: "1px solid var(--border)",
    borderRadius: 3,
    fontSize: 11,
  } as const;

  return (
    <div
      className={className}
      data-testid="atmosphere-prose-generator"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🌫️ Schauplatz- & Sensorik-Generator
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        World Painting mit mindestens vier der fünf Sinne.
      </div>

      {/* Schauplatz-Parameter */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>
        Ort
        <input
          data-testid="atmosphere-location-input"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
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

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>
          Stimmung
          <select
            data-testid="atmosphere-mood-select"
            value={mood}
            onChange={(e) => setMood(e.target.value as Mood)}
            style={selectStyle}
          >
            {MOODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>
          Tageszeit
          <select
            data-testid="atmosphere-time-select"
            value={timeOfDay}
            onChange={(e) => setTimeOfDay(e.target.value as TimeOfDay)}
            style={selectStyle}
          >
            {TIMES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>
          Wetter
          <select
            data-testid="atmosphere-weather-select"
            value={weather}
            onChange={(e) => setWeather(e.target.value as Weather)}
            style={selectStyle}
          >
            {WEATHERS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Ergebnis */}
      <div
        data-testid="atmosphere-output"
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 12,
          fontSize: 12,
          lineHeight: 1.7,
          marginBottom: 14,
        }}
      >
        {atmosphere.text}
      </div>

      {/* Sensorische Abdeckung */}
      <div
        data-testid="atmosphere-coverage"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          SENSORISCHE VERANKERUNG
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          {(Object.keys(SENSE_LABELS) as Sense[]).map((sense) => {
            const active = coverage.senses.includes(sense);
            return (
              <span
                key={sense}
                data-testid={`atmosphere-sense-${sense}`}
                style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 10,
                  border: `1px solid ${active ? "var(--success)" : "var(--border)"}`,
                  color: active ? "var(--success)" : "var(--muted)",
                }}
              >
                {active ? "✓" : "✗"} {SENSE_LABELS[sense]}
              </span>
            );
          })}
        </div>
        <div
          data-testid="atmosphere-sense-count"
          style={{ color: coverage.meetsTarget ? "var(--success)" : "var(--warn)" }}
        >
          {coverage.senseCount}/5 Sinne · {coverage.meetsTarget ? "Ziel erreicht" : "Ziel verfehlt"}
        </div>
        {coverage.missing.length > 0 && (
          <div data-testid="atmosphere-missing-senses" style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
            Fehlend: {coverage.missing.map((s) => SENSE_LABELS[s]).join(", ")}
          </div>
        )}
      </div>

      {/* Übergangs-Generator */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          ÜBERGANGS-GENERATOR
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 140 }}>
            Zeitsprung
            <input
              data-testid="atmosphere-timeskip-input"
              type="text"
              value={timeSkip}
              placeholder="drei Tage später"
              onChange={(e) => setTimeSkip(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                background: "var(--panel)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "4px 8px",
                fontSize: 11,
              }}
            />
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 140 }}>
            Folgeszene
            <input
              data-testid="atmosphere-tolocation-input"
              type="text"
              value={toLocation}
              placeholder="Das Kloster"
              onChange={(e) => setToLocation(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                background: "var(--panel)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "4px 8px",
                fontSize: 11,
              }}
            />
          </label>
        </div>
        <div
          data-testid="atmosphere-transition"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          {transition}
        </div>
      </div>
    </div>
  );
}
