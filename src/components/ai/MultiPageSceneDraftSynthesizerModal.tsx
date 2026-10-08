// MultiPageSceneDraftSynthesizerModal (WP 95.2 UI)
import { useState, useMemo } from "react";
import {
  createMultiPageSceneProfile,
  type ScenePage,
} from "@/services/ai/multiPageSceneDraftSynthesizer";

export interface MultiPageSceneDraftSynthesizerModalProps {
  className?: string;
}

export function MultiPageSceneDraftSynthesizerModal({ className }: MultiPageSceneDraftSynthesizerModalProps) {
  const [seedPointsText, setSeedPointsText] = useState(
    "Ein Brief wird gefunden\nDer Absender ist seit Jahren tot\nDer Inhalt verändert alles"
  );
  const [protagonistName, setProtagonistName] = useState("Elias");
  const [targetWords, setTargetWords] = useState(1800);
  const [seed, setSeed] = useState(42);

  const seedPoints = seedPointsText.split("\n").filter(p => p.trim().length > 0);

  const profile = useMemo(
    () => createMultiPageSceneProfile(seedPoints, protagonistName, targetWords, seed),
    [seedPoints, protagonistName, targetWords, seed]
  );

  const FOCUS_LABELS: Record<ScenePage["focus"], string> = {
    opening: "📖 ERÖFFNUNG",
    rising: "📈 STEIGEND",
    climax: "🔥 KLIMAX",
    falling: "📉 FALLEND",
    resolution: "✅ AUFLÖSUNG",
  };

  const FOCUS_COLORS: Record<ScenePage["focus"], string> = {
    opening: "var(--accent)",
    rising: "var(--warning)",
    climax: "var(--error)",
    falling: "var(--info)",
    resolution: "var(--success)",
  };

  return (
    <div
      className={className}
      data-testid="multi-page-scene-modal"
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
        📄 Autonomer Mehrseiten-Szenen-Synthesizer
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Seed: {seed} · ID: {profile.id} · Seiten: {profile.scenePages.length} · Wörter: {profile.sceneWordCount} · Ziel: {targetWords}
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary data-testid="summary-eingabe" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📝 EINGABE
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8, fontSize: 11 }}>
          <label style={{ flex: 1, minWidth: 200 }}>
            Protagonist
            <input value={protagonistName} onChange={e => setProtagonistName(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
          </label>
          <label style={{ flex: 1, minWidth: 100 }}>
            Ziel-Wortzahl
            <input type="number" value={targetWords} onChange={e => setTargetWords(Math.max(500, Number(e.target.value) || 500))} min="500" style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
          </label>
          <label style={{ flex: 1, minWidth: 80 }}>
            Seed
            <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
          </label>
        </div>
        <label style={{ display: "block", marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
          Stichpunkte (je Zeile einer)
          <textarea
            value={seedPointsText}
            onChange={e => setSeedPointsText(e.target.value)}
            rows={5}
            style={{
              width: "100%",
              marginTop: 4,
              padding: "8px",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--fg)",
            }}
          />
        </label>
        <div style={{ marginTop: 8, fontSize: 10, color: "var(--muted)" }}>
          Eigenschaften (automatisch abgeleitet): {profile.protagonistTraits.join(", ")}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary data-testid="summary-konsistenz" style={{ fontSize: 11, color: profile.consistencyReport.povConsistent ? "var(--success)" : "var(--error)", cursor: "pointer", fontWeight: 700 }}>
          📋 KONSISTENZ-PRÜFUNG
        </summary>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
          <div style={{ padding: 8, border: `1px solid ${profile.consistencyReport.povConsistent ? "var(--success)" : "var(--error)"}`, borderRadius: 4, background: profile.consistencyReport.povConsistent ? "rgba(0,255,0,0.1)" : "rgba(255,0,0,0.1)" }}>
            <div style={{ color: "var(--muted)", fontSize: 10 }}>POV-Konsistenz</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{profile.consistencyReport.povConsistent ? "✅" : "❌"}</div>
          </div>
          <div style={{ padding: 8, border: `1px solid ${profile.consistencyReport.traitAdherence > 0.5 ? "var(--success)" : "var(--warning)"}`, borderRadius: 4, background: profile.consistencyReport.traitAdherence > 0.5 ? "rgba(0,255,0,0.1)" : "rgba(255,165,0,0.1)" }}>
            <div style={{ color: "var(--muted)", fontSize: 10 }}>Eigenschaften-Einhaltung</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{(profile.consistencyReport.traitAdherence * 100).toFixed(0)}%</div>
          </div>
          <div style={{ padding: 8, border: `1px solid ${profile.consistencyReport.sensoryCoverage > 0.66 ? "var(--success)" : "var(--warning)"}`, borderRadius: 4, background: profile.consistencyReport.sensoryCoverage > 0.66 ? "rgba(0,255,0,0.1)" : "rgba(255,165,0,0.1)" }}>
            <div style={{ color: "var(--muted)", fontSize: 10 }}>Sinnesabdeckung</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{(profile.consistencyReport.sensoryCoverage * 100).toFixed(0)}%</div>
          </div>
          <div style={{ padding: 8, border: `1px solid ${profile.consistencyReport.knowledgeBoundariesRespected ? "var(--success)" : "var(--error)"}`, borderRadius: 4, background: profile.consistencyReport.knowledgeBoundariesRespected ? "rgba(0,255,0,0.1)" : "rgba(255,0,0,0.1)" }}>
            <div style={{ color: "var(--muted)", fontSize: 10 }}>Wissensgrenzen</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{profile.consistencyReport.knowledgeBoundariesRespected ? "✅" : "❌"}</div>
          </div>
        </div>
        {profile.consistencyReport.issues.length > 0 && (
          <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--warning)", borderRadius: 4, background: "rgba(255,165,0,0.1)", color: "var(--warning)", fontSize: 10 }}>
            <strong>Probleme:</strong>
            <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
              {profile.consistencyReport.issues.map((issue, i) => <li key={i}>{issue}</li>)}
            </ul>
          </div>
        )}
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary data-testid="summary-seiten" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📄 SEITENÜBERSICHT ({profile.scenePages.length} Seiten, {profile.sceneWordCount} Wörter)
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8, fontSize: 11 }}>
          {profile.scenePages.map(page => (
            <details key={page.pageNumber} style={{ border: `1px solid ${FOCUS_COLORS[page.focus]}`, borderRadius: 4, background: "var(--panel)" }} open={page.pageNumber <= 2}>
              <summary style={{ padding: 8, cursor: "pointer", fontWeight: 700, color: FOCUS_COLORS[page.focus] }}>
                Seite {page.pageNumber} – {FOCUS_LABELS[page.focus]} – {page.wordCount} Wörter
              </summary>
              <div style={{ padding: 8, fontSize: 10, maxHeight: 200, overflow: "auto" }}>
                <div style={{ marginBottom: 6 }}>
                  <strong>Sinne:</strong> {page.sensoryDetails.map(s => `${s.sense} (${s.intensity}/10)`).join(", ")}
                </div>
                <div style={{ marginBottom: 6 }}>
                  <strong>POV-Marker:</strong> {page.povMarkers.length} ({page.povMarkers.map(p => p.type).join(", ")})
                </div>
                <div style={{ fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: 9, color: "var(--fg)" }}>
                  {page.text}
                </div>
              </div>
            </details>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-volltext" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📖 VOLLTEXT ({profile.fullText.length} Zeichen)
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 11, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)", lineHeight: 1.6, maxHeight: 400, overflow: "auto" }}>
          {profile.fullText}
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-beispiel" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎲 BEISPIEL-SZENARIEN
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            ["Ein Brief wird gefunden\nDer Absender ist seit Jahren tot\nDer Inhalt verändert alles", "Elias"],
            ["Ein alter Koffer auf dem Dachboden\nEin Tagebuch aus dem Krieg\nEin Name, den niemand kennt", "Mara"],
            ["Der letzte Zug fährt ohne sie\nEin versprochenes Treffen\n20 Jahre Schweigen", "Thomas"],
            ["Ein Anruf um 3 Uhr morgens\nEine Stimme aus der Vergangenheit\nEine Lüge, die alles erklärt", "Sarah"],
          ].map(([points, name], i) => (
            <button
              key={i}
              onClick={() => { setSeedPointsText(points); setProtagonistName(name); setTargetWords(1800); setSeed(i + 40); }}
              style={{
                padding: "6px 10px",
                textAlign: "left",
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                cursor: "pointer",
                color: "var(--fg)",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
              }}
            >
              {name}: {points.split("\n")[0]}...
            </button>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-deep-pov" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎯 DEEP POV & SENSORY WRITING
        </summary>
        <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, color: "var(--fg)" }}>
          <strong>Deep POV (Tiefe Perspektive):</strong> Die Szene bleibt strikt in der Wahrnehmung
          des Protagonisten – keine allwissenden Erzählerkommentare, nur das, was die Figur
          sieht, hört, riecht, schmeckt, fühlt, denkt, erinnert, bewertet, nicht weiß.<br/><br/>
          <strong>6 Sinne:</strong> Sehen, Hören, Riechen, Tasten, Schmecken, Propriozeption (Körperlage).<br/>
          Jede Seite deckt 2–5 Sinne ab mit Intensität 1–10.<br/><br/>
          <strong>POV-Marker-Typen:</strong>
          <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
            <li>Thought: Bewusster Gedanke</li>
            <li>Memory: Flashback/Erinnerung</li>
            <li>Sensation: Körperliche Empfindung</li>
            <li>Judgment: Bewertung/Urteil</li>
            <li>Limitation: Wissenslücke/Blindheit</li>
          </ul>
          <br/>
          <strong>Struktur (6-Seiten-Bogen):</strong>
          <ol style={{ margin: "4px 0 0 16px", padding: 0, fontSize: 9 }}>
            <li>Opening: Atmosphärischer Einstieg, Status Quo</li>
            <li>Rising 1: Konflikt deutet sich an</li>
            <li>Rising 2: Eskalation, Komplikation</li>
            <li>Climax: Höhepunkt, Entscheidung, Konfrontation</li>
            <li>Falling: Folgen, Nachbeben</li>
            <li>Resolution: Neuer Status, nachhallendes Bild</li>
          </ol>
        </div>
      </details>

      <details>
        <summary data-testid="summary-injektion" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          💉 1-KLICK-INJEKTION IN EDITOR
        </summary>
        <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, color: "var(--fg)" }}>
          Der generierte Szenenentwurf kann per 1-Klick an der Cursor-Position im TipTap-Editor
          eingefügt werden. Die 6 Seiten werden mit doppeltem Zeilenumbruch getrennt,
          sodass sie als natürliche Absätze/Szenenabschnitte wirken.<br/><br/>
          <strong>Wortzahl-Ziel:</strong> 1.500–2.500 Wörter (ca. 6–8 Buchseiten bei Standard-Satz).<br/>
          <strong>Konsistenz-Garantie:</strong> Protagonist-Name, Eigenschaften, Wissensgrenzen
          und sensorische Durchgängigkeit werden algorithmisch geprüft.<br/>
          <strong>Export:</strong> Volltext kopierbar für externe Nutzung.
        </div>
      </details>
    </div>
  );
}