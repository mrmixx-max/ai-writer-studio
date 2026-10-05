// Genre-Tropen- & Archetypen-Kompass (WP 53.2)
//
// UI für die Genre-Konventionen-Analyse: Zeigt Tropen-Checkliste,
// Erfüllungsgrad und Subversions-Score an.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import type { Genre } from "@/services/analytics/genreArchetypeCompass";
import {
  getGenreTropes,
  checkTropeFulfillment,
  calculateSubversionScore,
  type Manuscript,
} from "@/services/analytics/genreArchetypeCompass";

export interface GenreArchetypeCompassProps {
  /** Das Manuskript mit Kapitel-Daten */
  manuscript?: Manuscript;
  /** Anfangs-genre (default: whodunit) */
  initialGenre?: Genre;
  className?: string;
}

export function GenreArchetypeCompass({
  manuscript,
  initialGenre = "whodunit",
  className,
}: GenreArchetypeCompassProps) {
  const [selectedGenre, setSelectedGenre] = useState<Genre>(initialGenre);

  const tropesData = useMemo(() => getGenreTropes(selectedGenre), [selectedGenre]);
  const fulfillment = useMemo(() => {
    if (!manuscript) return null;
    return checkTropeFulfillment(selectedGenre, manuscript);
  }, [selectedGenre, manuscript]);
  const subVersionScore = useMemo(() => {
    if (!fulfillment) return null;
    return calculateSubversionScore(fulfillment);
  }, [fulfillment]);

  const fulfillmentRate = fulfillment?.fulfillmentRate ?? 0;
  const missingCount = fulfillment?.missing.length ?? tropesData.tropes.length;
  const fulfilledCount = fulfillment?.fulfilled.length ?? 0;

  const warningColor =
    missingCount > 3 ? "var(--error)" : missingCount > 0 ? "var(--warn)" : "var(--success)";
  const subVersionColor =
    subVersionScore === null
      ? "var(--fg)"
      : subVersionScore > 0.5
        ? "var(--error)"
        : subVersionScore > 0.25
          ? "var(--warn)"
          : "var(--success)";
  const barColor =
    fulfillmentRate > 0.9
      ? "var(--success)"
      : fulfillmentRate > 0.7
        ? "var(--accent)"
        : "var(--warn)";

  return (
    <div
      className={className}
      data-testid="genre-archetype-compass"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 8px", fontSize: 16, color: "var(--accent)" }}>
        🧭 Genre-Tropen-Kompass
      </h3>

      {/* Genre-Auswahl */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>
          Genre
          <select
            data-testid="genre-select"
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value as Genre)}
            style={{
              marginLeft: 8,
              padding: "2px 6px",
              background: "var(--bg)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 3,
            }}
          >
            <option value="whodunit">Whodunit</option>
            <option value="heist">Heist</option>
            <option value="enemies-to-lovers">Enemies to Lovers</option>
            <option value="first-contact">First Contact</option>
            <option value="coming-of-age">Coming of Age</option>
          </select>
        </label>
      </div>

      {/* Fehlende Tropen-Hinweis */}
      {manuscript && (
        <div
          data-testid="trope-missing-warning"
          style={{
            background: "var(--card)",
            border: `1px solid ${warningColor}`,
            borderRadius: 4,
            padding: 8,
            marginBottom: 12,
            fontSize: 11,
          }}
        >
          <strong style={{ color: warningColor }}>⚠️ Fehlende Tropen:</strong> {missingCount} von{" "}
          {tropesData.tropes.length}
          {missingCount > 3 ? " – Gefahr der Genre-Abweichung!" : missingCount > 0 ? " – Verbessern Sie das Genre-Format." : " – Perfekt abgestimmt!"}
        </div>
      )}

      {/* Tropen-Checkliste */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          TROPEN-CHECKLISTE ({tropesData.coreCount} Kern-Tropen)
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.6 }}>
          {tropesData.tropes.map((trope) => {
            const isFulfilled = fulfillment?.fulfilled.includes(trope.id) ?? false;
            const isCore = trope.isCore;
            return (
              <div
                key={trope.id}
                data-testid={`trope-${trope.id}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{ marginTop: 2, color: isFulfilled ? "var(--success)" : "var(--muted)" }}
                >
                  {isFulfilled ? "✓" : "✗"}
                </span>
                <span>
                  <strong style={{ color: isCore ? "var(--accent)" : "var(--muted)" }}>
                    {trope.name}
                  </strong>
                  {isCore ? " (Kern)" : " (Optional)"}: {trope.description}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Subversions-Score */}
      {subVersionScore !== null && (
        <div data-testid="subversion-score" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
            SUBVERSIONS-SCORE: Wie stark übertrifft das Manuskript die Genre-Erwartungen?
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: subVersionColor,
              textAlign: "center",
              padding: 8,
              background: "var(--card)",
              borderRadius: 6,
              border: `2px solid ${subVersionColor}`,
            }}
          >
            {Math.round(subVersionScore * 100)}%
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", marginTop: 4 }}>
            {subVersionScore > 0.7
              ? "Maximale Subversivität – Genre-Konventionen kippen!"
              : subVersionScore > 0.4
                ? "Teilweise subversiv – Erwartungen teils erfüllt"
                : subVersionScore > 0.1
                  ? "Fast konventionell – starke Genre-Erwartungen"
                  : "Vollständig konventionell – Format perfekt passend"}
          </div>
        </div>
      )}

      {/* Erfüllungsrate als Balken */}
      <div data-testid="fulfillment-visualization">
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
          Erfüllungsrate: {Math.round(fulfillmentRate * 100)}%
        </div>
        <div
          style={{
            height: 8,
            background: "var(--border)",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${fulfillmentRate * 100}%`,
              background: barColor,
            }}
          />
        </div>
        <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>
          {fulfilledCount}/{tropesData.tropes.length} Tropen erfüllt
        </div>
      </div>
    </div>
  );
}