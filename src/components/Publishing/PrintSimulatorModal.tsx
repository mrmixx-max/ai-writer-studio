// PrintSimulatorModal (WP 45.2): Buchrücken-Kalkulator & 3D-Druck-Simulator.
//
// Berechnet die millimetergenaue Rückenbreite aus Seitenzahl, Papier und
// Bindung und zeigt eine schematische 3D-Hardcover-Vorschau.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useMemo, useState } from "react";
import {
  calculateSpineWidth,
  calculateCoverDimensions,
  simulate3dHardcover,
  listPaperPresets,
  type PaperType,
  type BindingType,
  type TrimSize,
} from "@/services/publishing/physicalPrintSimulator";

export interface PrintSimulatorModalProps {
  open: boolean;
  onClose: () => void;
  defaultPageCount?: number;
}

const TRIM_SIZES: TrimSize[] = [
  { widthMm: 120, heightMm: 190, label: 'Taschenbuch 12×19 cm' },
  { widthMm: 135, heightMm: 215, label: 'Format 13,5×21,5 cm' },
  { widthMm: 148, heightMm: 210, label: 'A5 14,8×21 cm' },
  { widthMm: 152, heightMm: 229, label: '6×9 Zoll' },
];

export function PrintSimulatorModal({
  open,
  onClose,
  defaultPageCount = 320,
}: PrintSimulatorModalProps) {
  const [pageCount, setPageCount] = useState(defaultPageCount);
  const [paper, setPaper] = useState<PaperType>("offset80");
  const [binding, setBinding] = useState<BindingType>("softcover");
  const [trimIndex, setTrimIndex] = useState(1);
  const [flaps, setFlaps] = useState(false);

  const presets = useMemo(() => listPaperPresets(), []);
  const trim = TRIM_SIZES[trimIndex];

  const spine = useMemo(
    () => calculateSpineWidth(pageCount, paper, binding),
    [pageCount, paper, binding],
  );
  const dims = useMemo(() => calculateCoverDimensions(spine, trim), [spine, trim]);
  const sim = useMemo(
    () => simulate3dHardcover(dims, { dustjacketFlaps: flaps, roundedSpine: binding === "hardcover" }),
    [dims, flaps, binding],
  );

  if (!open) return null;

  return (
    <div
      data-testid="print-simulator-modal"
      className="modal-backdrop"
      onClick={onClose}
      style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: 18,
          width: "min(680px, 94vw)",
          maxHeight: "88vh",
          overflow: "auto",
          color: "var(--fg)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: "var(--accent)" }}>
            📐 Buchrücken-Kalkulator
          </h3>
          <button
            data-testid="print-sim-close"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--muted)",
              padding: "2px 8px",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            Schließen
          </button>
        </div>

        {/* Eingaben */}
        <div style={{ display: "grid", gap: 10, marginBottom: 16, maxWidth: 520 }}>
          <label style={{ fontSize: 11, color: "var(--muted)" }}>
            Seitenzahl
            <input
              data-testid="print-sim-pages"
              type="number"
              min={8}
              max={2000}
              value={pageCount}
              onChange={(e) => setPageCount(Number(e.target.value) || 8)}
              style={{
                display: "block",
                width: "100%",
                marginTop: 3,
                background: "var(--bg)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 3,
                padding: "5px 7px",
                fontSize: 12,
                boxSizing: "border-box",
              }}
            />
          </label>

          <label style={{ fontSize: 11, color: "var(--muted)" }}>
            Papier
            <select
              data-testid="print-sim-paper"
              value={paper}
              onChange={(e) => setPaper(e.target.value as PaperType)}
              style={{
                display: "block",
                width: "100%",
                marginTop: 3,
                background: "var(--bg)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 3,
                padding: "5px 7px",
                fontSize: 12,
              }}
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} — {p.grammage} g/m², Vol. {p.volume}
                </option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: 11, color: "var(--muted)" }}>
            Bindung
            <select
              data-testid="print-sim-binding"
              value={binding}
              onChange={(e) => setBinding(e.target.value as BindingType)}
              style={{
                display: "block",
                width: "100%",
                marginTop: 3,
                background: "var(--bg)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 3,
                padding: "5px 7px",
                fontSize: 12,
              }}
            >
              <option value="softcover">Softcover (Taschenbuch)</option>
              <option value="hardcover">Hardcover</option>
            </select>
          </label>

          <label style={{ fontSize: 11, color: "var(--muted)" }}>
            Buchformat
            <select
              data-testid="print-sim-trim"
              value={trimIndex}
              onChange={(e) => setTrimIndex(Number(e.target.value))}
              style={{
                display: "block",
                width: "100%",
                marginTop: 3,
                background: "var(--bg)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 3,
                padding: "5px 7px",
                fontSize: 12,
              }}
            >
              {TRIM_SIZES.map((t, i) => (
                <option key={t.label} value={i}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: 11, color: "var(--muted)", display: "flex", gap: 6, alignItems: "center" }}>
            <input
              data-testid="print-sim-flaps"
              type="checkbox"
              checked={flaps}
              onChange={(e) => setFlaps(e.target.checked)}
            />
            Klappentext-Einschläge (Dustjacket Flaps)
          </label>
        </div>

        {/* Ergebnis */}
        <div
          data-testid="print-sim-result"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 12,
            marginBottom: 14,
          }}
        >
          <div style={{ fontSize: 13, color: "var(--accent)", marginBottom: 8 }}>
            Rückenbreite:{" "}
            <strong data-testid="print-sim-spine">{spine.spineWidthMm.toFixed(2)} mm</strong>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
            <div data-testid="print-sim-allowance">
              Umschlagzugabe: {spine.coverAllowanceMm.toFixed(2)} mm
            </div>
            <div data-testid="print-sim-total-width">
              Umschlag gesamt: {dims.totalWidthMm.toFixed(2)} × {dims.totalHeightMm.toFixed(2)} mm
            </div>
            <div data-testid="print-sim-parts">
              Vorderseite {dims.frontWidthMm.toFixed(1)} + Rücken {dims.spineWidthMm.toFixed(2)} +
              Rückseite {dims.backWidthMm.toFixed(1)} mm
            </div>
            <div>Beschnittzugabe (Bleed): {dims.bleedMm} mm</div>
          </div>
        </div>

        {/* 3D-Simulation */}
        <div data-testid="print-sim-3d" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
            3D-HARDCOVER-SIMULATION
          </div>
          <div style={{ fontSize: 11, color: "var(--fg)", lineHeight: 1.6 }}>
            <div data-testid="print-sim-joint">Scharnierfalz (Joint): {sim.jointMm.toFixed(2)} mm</div>
            <div data-testid="print-sim-depth">Gesamttiefe: {sim.totalDepthMm.toFixed(2)} mm</div>
            {sim.flapWidthMm > 0 && (
              <div data-testid="print-sim-flap-width">
                Klappentext-Einschlag: {sim.flapWidthMm.toFixed(1)} mm je Seite
              </div>
            )}
          </div>

          {/* Rückenkurve als SVG-Schema */}
          {sim.spineCurve.length > 0 && (
            <svg
              data-testid="print-sim-spine-curve"
              viewBox="0 0 200 60"
              style={{
                width: "100%",
                maxWidth: 400,
                height: 60,
                marginTop: 8,
                border: "1px solid var(--border)",
                borderRadius: 4,
              }}
            >
              <polyline
                points={sim.spineCurve
                  .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
                  .join(" ")}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={2}
              />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
