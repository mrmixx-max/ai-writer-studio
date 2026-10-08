// PortolanNauticalChartModal (WP 109.2 UI)
import { useState, useMemo } from "react";
import {
  analyzePortolanChart,
  COMPASS_DIRECTIONS,
  VIGNETTE_KINDS,
} from "@/services/publishing/portolanNauticalChart";

export interface PortolanNauticalChartModalProps {
  className?: string;
}

export function PortolanNauticalChartModal({ className }: PortolanNauticalChartModalProps) {
  const [title, setTitle] = useState("Das Zwölfgestirn-Meer");
  const [roseCount, setRoseCount] = useState(2);
  const [vignetteCount, setVignetteCount] = useState(4);
  const [seed, setSeed] = useState(42);

  const report = useMemo(
    () => analyzePortolanChart({ title, roseCount, vignetteCount, seed }),
    [title, roseCount, vignetteCount, seed]
  );
  const chart = report.chart;

  return (
    <div
      className={className}
      data-testid="portolan-chart-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🧭 Historisches Portolan-Seekarten-Studio
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {chart.id} · {chart.width}×{chart.height} px · {report.roseCount} Rosen · {report.rhumbLineCount} Loxodromen
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 180 }}>
          Kartentitel
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 80 }}>
          Kompassrosen
          <input
            type="number"
            min={1}
            max={4}
            value={roseCount}
            onChange={(e) => setRoseCount(Math.max(1, Math.min(4, Number(e.target.value) || 1)))}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 80 }}>
          Vignetten
          <input
            type="number"
            min={0}
            max={6}
            value={vignetteCount}
            onChange={(e) => setVignetteCount(Math.max(0, Math.min(6, Number(e.target.value) || 0)))}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 80 }}>
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🗺️ PORTOLAN-SEEKARTE (VEKTOR)
        </summary>
        <div
          style={{ marginTop: 8, padding: 8, border: "2px solid var(--accent)", borderRadius: 8, background: "var(--panel)", overflow: "auto" }}
          dangerouslySetInnerHTML={{ __html: chart.svg }}
        />
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📐 LOXODROMEN-NETZ ({report.rhumbLineCount} Strahlen)
        </summary>
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
          <div>Von {chart.roses.length} Kompassrose{chart.roses.length === 1 ? "" : "n"} mit je {COMPASS_DIRECTIONS.length} Richtungen.</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
            Richtungen: {COMPASS_DIRECTIONS.join(" · ")}
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🐙 MARITIME VIGNETTEN ({chart.vignettes.length})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {chart.vignettes.map((v, i) => {
            const kind = VIGNETTE_KINDS.find((k) => k.id === v.kind);
            return (
              <div key={i} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
                <span style={{ color: "var(--accent)", fontWeight: 700 }}>{kind?.name}</span>
                <span style={{ fontSize: 10, color: "var(--muted)" }}> · bei ({v.x}, {v.y}) · Skalierung {v.scale}</span>
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{kind?.description}</div>
              </div>
            );
          })}
        </div>
      </details>

      <details open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🖨️ 300-DPI-DRUCKEXPORT
        </summary>
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Auflösung:</strong> {report.printSheet.dpi} DPI</div>
          <div><strong>Blattgröße:</strong> {report.printSheet.widthInches}″ × {report.printSheet.heightInches}″</div>
          <div><strong>Pixel mit Beschnitt:</strong> {report.printSheet.pixelWidth} × {report.printSheet.pixelHeight}</div>
          <div><strong>Beschnittzugabe:</strong> {report.printSheet.bleedInches}″ rundum</div>
          <div style={{ marginTop: 6, fontSize: 10, color: "var(--muted)" }}>Druckhinweise:</div>
          <ul style={{ margin: "4px 0 0", paddingLeft: 16, fontSize: 10, color: "var(--muted)" }}>
            {report.printSheet.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}
