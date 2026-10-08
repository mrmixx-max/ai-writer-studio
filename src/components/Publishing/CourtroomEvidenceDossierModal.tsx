// CourtroomEvidenceDossierModal (WP 115.2 UI)
import { useState, useMemo } from "react";
import {
  addCustodyEntry,
  validateEvidenceAdmissibility,
  generateCourtDossier,
  verifyChainOfCustody,
} from "@/services/publishing/courtroomEvidenceDossier";

export interface CourtroomEvidenceDossierModalProps {
  className?: string;
}

export function CourtroomEvidenceDossierModal({ className }: CourtroomEvidenceDossierModalProps) {
  const [caseNumber, setCaseNumber] = useState("2026/1234");
  const [evidenceDesc, setEvidenceDesc] = useState("Blutiger Handschuh");
  const [foundLocation, setFoundLocation] = useState("Küche, Tatort");
  const [securingOfficer, setSecuringOfficer] = useState("Kriminalhauptkommissar Weber");
  const [acquisitionMethod, setAcquisitionMethod] = useState<"searchWarrant" | "consent" | "plainView" | "illegalSearch" | "wiretap">("searchWarrant");
  const [warrantNumber, setWarrantNumber] = useState("HB 456/2026");
  const [chainOfCustodyComplete, setChainOfCustodyComplete] = useState(true);
  const [seed, setSeed] = useState(42);

  const custodyRecord = useMemo(
    () => addCustodyEntry({ id: "EV-001", description: evidenceDesc, foundLocation, securingOfficer }, seed),
    [evidenceDesc, foundLocation, securingOfficer, seed]
  );
  const admissibility = useMemo(
    () => validateEvidenceAdmissibility({ id: "EV-001", acquisitionMethod, warrantNumber: warrantNumber || null, chainOfCustodyComplete }),
    [acquisitionMethod, warrantNumber, chainOfCustodyComplete]
  );
  const dossier = useMemo(
    () => generateCourtDossier(caseNumber, [{ id: "EV-001", description: evidenceDesc, type: "Sachbeweis" }], ["Mord § 212 StGB"], "Staatsanwalt Schmitt", "Max Mustermann", seed),
    [caseNumber, evidenceDesc, seed]
  );
  const chainVerification = useMemo(
    () => verifyChainOfCustody(custodyRecord.chainOfCustody),
    [custodyRecord]
  );

  return (
    <div
      className={className}
      data-testid="courtroom-evidence-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        ⚖️ Asservatenkammer &amp; Gerichtssaal-Dossier
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {dossier.exhibitCount} Asservate · {custodyRecord.chainOfCustody.length} Ketten-Einträge · {admissibility.admissible ? "Verwertbar" : "Unverwertbar"}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Aktenzeichen
          <input value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 140 }}>
          Asservat
          <input value={evidenceDesc} onChange={(e) => setEvidenceDesc(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 140 }}>
          Fundort
          <input value={foundLocation} onChange={(e) => setFoundLocation(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 140 }}>
          Sichernder Beamter
          <input value={securingOfficer} onChange={(e) => setSecuringOfficer(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 140 }}>
          Erwerb
          <select value={acquisitionMethod} onChange={(e) => setAcquisitionMethod(e.target.value as typeof acquisitionMethod)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}>
            <option value="searchWarrant">Richterbeschluss</option>
            <option value="consent">Einwilligung</option>
            <option value="plainView">Offensichtlich</option>
            <option value="illegalSearch">Illegale Durchsuchung</option>
            <option value="wiretap">Abhöranordnung</option>
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 120 }}>
          Beschluss-Nr.
          <input value={warrantNumber} onChange={(e) => setWarrantNumber(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 120 }}>
          Ketten vollständig
          <input type="checkbox" checked={chainOfCustodyComplete} onChange={(e) => setChainOfCustodyComplete(e.target.checked)} style={{ marginLeft: 8, accentColor: "var(--accent)" }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 80 }}>
          Seed
          <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }} />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📦 ASSERVATEN-HAUPTBUCH
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {custodyRecord.chainOfCustody.map((entry, i) => (
            <div key={i} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong style={{ color: "var(--accent)" }}>{entry.action}</strong>
                <span style={{ fontSize: 9, color: "var(--muted)" }}>{entry.timestamp}</span>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                {entry.officer} · {entry.location} · Siegel {entry.sealNumber}
              </div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🛡️ BEWEISVERWERTUNGS-WÄCHTER
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: `1px solid ${admissibility.admissible ? "var(--success)" : "var(--error)"}`, borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Verwertbar:</strong> {admissibility.admissible ? "Ja" : "Nein"}</div>
          <div><strong>Grund:</strong> {admissibility.reason}</div>
          <div><strong>Verwertungsrisiko:</strong> {admissibility.exclusionRisk}</div>
          {admissibility.notes.length > 0 && (
            <ul style={{ margin: "4px 0 0", paddingLeft: 16, fontSize: 10, color: "var(--muted)" }}>
              {admissibility.notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          )}
        </div>
      </details>

      <details open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📄 GERICHTSAKTEN-DOSSIER
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "2px solid var(--accent)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Aktenzeichen:</strong> {dossier.caseNumber}</div>
          <div><strong>Angeklagter:</strong> {dossier.defendant}</div>
          <div><strong>Staatsanwalt:</strong> {dossier.prosecutor}</div>
          <div><strong>Anklage:</strong> {dossier.charges.join(", ")}</div>
          <div><strong>Asservate:</strong> {dossier.exhibitCount}</div>
          <div style={{ marginTop: 4, fontSize: 10, color: "var(--muted)" }}>Ketten-Integrität: {chainVerification.intact ? "Intakt" : "Unterbrochen"}</div>
        </div>
        <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 9, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)", lineHeight: 1.4, maxHeight: 300, overflow: "auto" }}>
          {dossier.dossierMarkdown}
        </pre>
      </details>
    </div>
  );
}
