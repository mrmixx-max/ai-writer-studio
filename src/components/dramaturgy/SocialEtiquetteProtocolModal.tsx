// SocialEtiquetteProtocolModal (WP 86.2 UI)
import { useState, useMemo } from "react";
import {
  createProtocol,
  checkGreeting,
  scanTextForViolations,
  calculateScandalIndex,
  createCourtCharacter,
  type TitleRank,
  type Taboo,
} from "@/services/dramaturgy/socialEtiquetteProtocol";

export interface SocialEtiquetteProtocolModalProps {
  className?: string;
}

const RANKS: TitleRank[] = ["kaiser", "könig", "erzherzog", "herzog", "markgraf", "graf", "freiherr", "ritter", "edelfrei", "bürger", "bäuerin", "diener"];

export function SocialEtiquetteProtocolModal({ className }: SocialEtiquetteProtocolModalProps) {
  const [protocolName, setProtocolName] = useState("Kaiserlicher Hof");
  const [seed, setSeed] = useState(42);
  const [speaker, setSpeaker] = useState("Ritter Falk");
  const [speakerRank, setSpeakerRank] = useState<TitleRank>("ritter");
  const [addressee, setAddressee] = useState("Herzog Aldric");
  const [addresseeRank, setAddresseeRank] = useState<TitleRank>("herzog");
  const [context, setContext] = useState<Taboo["context"]>("audienz");
  const [greetingAction, setGreetingAction] = useState("tiefer_bucks");
  const [greetingWords, setGreetingWords] = useState("Eure Gnaden");
  const [dialogueText, setDialogueText] = useState("Du bist ein Narr, Eure Gnaden!");

  const protocol = useMemo(() => createProtocol(protocolName, seed), [protocolName, seed]);
  const greetingCheck = useMemo(() => checkGreeting(protocol, speakerRank, addresseeRank, greetingAction, greetingWords.split(" ")), [protocol, speakerRank, addresseeRank, greetingAction, greetingWords]);
  const violations = useMemo(() => scanTextForViolations(protocol, dialogueText, speaker, speakerRank, addressee, addresseeRank, context), [protocol, dialogueText, speaker, speakerRank, addressee, addresseeRank, context]);
  const scandalIndex = useMemo(() => calculateScandalIndex(violations), [violations]);

  return (
    <div
      className={className}
      data-testid="social-etiquette-modal"
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
        👑 Hof-Etikette- & Protokoll-Wächter
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Protokoll: {protocol.name} · Seed: {seed} · Skandal-Index: {scandalIndex}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 180 }}>
          Protokoll-Name
          <input value={protocolName} onChange={e => setProtocolName(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Seed
          <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Sprecher
          <input value={speaker} onChange={e => setSpeaker(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Angeredeter
          <input value={addressee} onChange={e => setAddressee(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Sprecher-Rang
          <select value={speakerRank} onChange={e => setSpeakerRank(e.target.value as TitleRank)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}>
            {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Angeredeter-Rang
          <select value={addresseeRank} onChange={e => setAddresseeRank(e.target.value as TitleRank)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}>
            {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Kontext
          <select value={context} onChange={e => setContext(e.target.value as Taboo["context"])} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}>
            <option value="audienz">Audienz</option>
            <option value="tafel">Tafel</option>
            <option value="ball">Ball</option>
            <option value="rat">Rat</option>
            <option value="duell">Duell</option>
            <option value="allgemein">Allgemein</option>
          </select>
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🤝 GRUSS-PRÜFUNG
        </summary>
        <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 150 }}>
            Geste
            <select value={greetingAction} onChange={e => setGreetingAction(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}>
              <option value="kniefall">Kniefall</option>
              <option value="tiefer_bucks">Tiefer Bucks</option>
              <option value="leichter_bucks">Leichter Bucks</option>
              <option value="kopfnicken">Kopfnicken</option>
              <option value="handkuss">Handkuss</option>
              <option value="keine_geste">Keine Geste</option>
            </select>
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 200 }}>
            Anrede-Wörter
            <input value={greetingWords} onChange={e => setGreetingWords(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
          </label>
        </div>
        <div style={{ marginTop: 8, padding: 8, border: `1px solid ${greetingCheck.valid ? "var(--success)" : "var(--warn)"}`, borderRadius: 4, fontSize: 11 }}>
          <div style={{ color: greetingCheck.valid ? "var(--success)" : "var(--warn)", fontWeight: 700 }}>
            {greetingCheck.valid ? "✓ GRUSS KORREKT" : "✗ GRUSS FEHLERHAFT"}
          </div>
          {greetingCheck.errors.map((err, i) => (
            <div key={i} style={{ color: "var(--warn)", marginTop: 4 }}>{err}</div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📝 DIALOG-SCANNER
        </summary>
        <div style={{ marginTop: 8 }}>
          <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
            Dialog-Text:
            <textarea
              value={dialogueText}
              onChange={e => setDialogueText(e.target.value)}
              style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, fontFamily: "var(--font-mono)", minHeight: 60 }}
            />
          </label>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, fontSize: 11, maxHeight: 200, overflow: "auto" }}>
            {violations.length === 0 ? (
              <div style={{ color: "var(--success)" }}>✓ Keine Protokollverstöße erkannt.</div>
            ) : (
              violations.map((v, i) => (
                <div key={i} style={{ marginBottom: 8, padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>{v.violator} ({v.violatorRank}) → {v.victim} ({v.victimRank})</strong>
                    <span style={{ color: v.severity === "tödlich" ? "var(--error)" : v.severity === "schwer" ? "var(--warn)" : "var(--muted)" }}>
                      {v.severity.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                    Typ: {v.violationType} | Kontext: {v.context} | Score: {v.scandalScore} | Klatsch: {v.gossipSpread}% | Reputationsschaden: {v.reputationDamage}%
                  </div>
                  <div style={{ fontSize: 10, fontStyle: "italic", marginTop: 2 }}>{v.description}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📊 SKANDAL-INDEX: {scandalIndex}
        </summary>
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, fontSize: 11 }}>
          <div>Gesamt-Score: {scandalIndex} / 1000</div>
          <div>Verstöße: {violations.length}</div>
          <div>Max. Klatsch-Reichweite: {violations.length > 0 ? Math.max(...violations.map(v => v.gossipSpread)) : 0}%</div>
          <div>Max. Reputationsschaden: {violations.length > 0 ? Math.max(...violations.map(v => v.reputationDamage)) : 0}%</div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📜 TITEL & ANREDEFORMEN
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {Object.entries(protocol.titles).map(([rank, title]) => (
            <div key={rank} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <div><strong>{rank.toUpperCase()}</strong> — Anrede: {title.addressForm} | Bucks: {title.bowDepth}° | Handschuhe: {title.gloveRequired ? "Ja" : "Nein"} | Sitzordnung: {title.seatingOrder}</div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          ⚠️ TABUS & GRENZEN
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {protocol.taboos.map((taboo: Taboo, i: number) => (
            <div key={i} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <div><strong>{taboo.id}</strong> ({taboo.severity}) — {taboo.context}</div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>{taboo.description}</div>
              <div style={{ fontSize: 10 }}>Betroffene Ränge: {taboo.affectedRanks.join(", ")}</div>
            </div>
          ))}
        </div>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎭 BEISPIEL-CHARAKTER
        </summary>
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, fontSize: 11 }}>
          {(() => {
            const char = createCourtCharacter("Graf Valerius", "graf", "Haus Falkenhorst", 123);
            return (
              <>
                <div><strong>Name:</strong> {char.name}</div>
                <div><strong>Rang:</strong> {char.rank}</div>
                <div><strong>Haus:</strong> {char.house}</div>
                <div><strong>Reputation:</strong> {char.reputation}</div>
              </>
            );
          })()}
        </div>
      </details>
    </div>
  );
}