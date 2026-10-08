// BallisticsForensicsStudioModal (WP 114.2 UI)
import { useState, useMemo } from "react";
import {
  calculateImpactAngle,
  classifyBloodstainPattern,
  analyzeGunshotDistance,
  reconstructShotOrigin,
  generateSpatterCanvas,
} from "@/services/worldbuilding/ballisticsForensicsStudio";

export interface BallisticsForensicsStudioModalProps {
  className?: string;
}

export function BallisticsForensicsStudioModal({ className }: BallisticsForensicsStudioModalProps) {
  const [dropletWidth, setDropletWidth] = useState(5);
  const [dropletLength, setDropletLength] = useState(10);
  const [pattern, setPattern] = useState("spatter");
  const [gunshotDistance, setGunshotDistance] = useState(50);

  const impactAngle = useMemo(() => {
    try {
      return calculateImpactAngle(dropletWidth, dropletLength);
    } catch {
      return null;
    }
  }, [dropletWidth, dropletLength]);
  const bloodstain = useMemo(() => classifyBloodstainPattern(pattern), [pattern]);
  const gunshot = useMemo(() => analyzeGunshotDistance(gunshotDistance), [gunshotDistance]);
  const shotOrigin = useMemo(
    () => reconstructShotOrigin([{ widthMm: dropletWidth, lengthMm: dropletLength }], { x: 0, y: 0, z: 1 }),
    [dropletWidth, dropletLength]
  );
  const spatterCanvas = useMemo(
    () => generateSpatterCanvas([{ x: 100, y: 100, widthMm: dropletWidth, lengthMm: dropletLength, angle: impactAngle?.angleDegrees ?? 45 }], 400, 300),
    [dropletWidth, dropletLength, impactAngle]
  );

  return (
    <div
      className={className}
      data-testid="ballistics-forensics-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🔬 Blutspuren-Geometrie &amp; Ballistik-Studio
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {bloodstain.pattern} · {gunshot.category} · Einschlagwinkel {impactAngle?.angleDegrees.toFixed(1)}°
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 100 }}>
          Tropfenbreite (mm)
          <input type="number" min={0} value={dropletWidth} onChange={(e) => setDropletWidth(Math.max(0, Number(e.target.value) || 0))} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 100 }}>
          Tropfenlänge (mm)
          <input type="number" min={0} value={dropletLength} onChange={(e) => setDropletLength(Math.max(0, Number(e.target.value) || 0))} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 120 }}>
          Blutspuren-Muster
          <select value={pattern} onChange={(e) => setPattern(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}>
            <option value="passive">Passiv</option>
            <option value="transfer">Abrieb</option>
            <option value="spatter">Spritzer</option>
            <option value="castoff">Schleuder</option>
            <option value="void">Leerstelle</option>
            <option value="saturation">Sättigung</option>
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 100 }}>
          Schussdistanz (cm)
          <input type="number" min={0} value={gunshotDistance} onChange={(e) => setGunshotDistance(Math.max(0, Number(e.target.value) || 0))} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }} />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📐 ELLIPTISCHER AUFTREFFWINKEL
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          {impactAngle ? (
            <>
              <div><strong>Winkel:</strong> {impactAngle.angleDegrees.toFixed(1)}° ({impactAngle.angleRadians.toFixed(3)} rad)</div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>{impactAngle.description}</div>
            </>
          ) : (
            <div style={{ color: "var(--error)" }}>Fehler: Breite darf nicht größer als Länge sein.</div>
          )}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🩸 BLUTSPUREN-MUSTER
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Muster:</strong> {bloodstain.pattern}</div>
          <div><strong>Beschreibung:</strong> {bloodstain.description}</div>
          <div><strong>Ursprung:</strong> {bloodstain.origin}</div>
          <div><strong>Gewaltlevel:</strong> {bloodstain.forceLevel}</div>
          <div><strong>Rekonstruierbar:</strong> {bloodstain.reconstructPossible ? "Ja" : "Nein"}</div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔫 SCHUSSDISTANZ &amp; SCHMAUCH
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Kategorie:</strong> {gunshot.category}</div>
          <div><strong>Mündungsabdruck:</strong> {gunshot.muzzleMark ? "Ja" : "Nein"}</div>
          <div><strong>Pulverschmauch:</strong> {gunshot.powderResidue ? "Ja" : "Nein"}</div>
          <div><strong>Verbrennungsring:</strong> {gunshot.burnRing ? "Ja" : "Nein"}</div>
          <div><strong>Rußablagerung:</strong> {gunshot.sootDeposit ? "Ja" : "Nein"}</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{gunshot.description}</div>
        </div>
      </details>

      <details open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎯 REKONSTRUKTION &amp; SVG-CANVAS
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Ursprungspunkt:</strong> ({shotOrigin.originX.toFixed(1)}, {shotOrigin.originY.toFixed(1)}, {shotOrigin.originZ.toFixed(1)})</div>
          <div><strong>Kegelwinkel:</strong> {shotOrigin.coneAngle.toFixed(1)}°</div>
          <div><strong>Konfidenz:</strong> {shotOrigin.confidence.toFixed(2)}</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{shotOrigin.description}</div>
        </div>
        <div style={{ marginTop: 8, padding: 8, border: "2px solid var(--accent)", borderRadius: 8, background: "var(--panel)", overflow: "auto" }} dangerouslySetInnerHTML={{ __html: spatterCanvas }} />
      </details>
    </div>
  );
}
