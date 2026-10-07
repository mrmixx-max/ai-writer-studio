// CryptographicCopyrightNotaryModal (WP 93.2 UI)
import { useState } from "react";
import {
  notarizeDocument,
  verifyNotaryCertificate,
  formatCertificate,
  createSampleCertificate as _createSampleCertificate,
  type NotaryCertificate,
  type VerificationResult,
} from "@/services/security/cryptographicCopyrightNotary";

export interface CryptographicCopyrightNotaryModalProps {
  className?: string;
}

export function CryptographicCopyrightNotaryModal({ className }: CryptographicCopyrightNotaryModalProps) {
  const [documentText, setDocumentText] = useState("Kapitel 1: Es war einmal ein heldenhafter Autor...\n\nDer Text geht weiter mit vielen Worten.");
  const [author, setAuthor] = useState("Max Mustermann");
  const [title, setTitle] = useState("Das große Werk");
  const [seed, setSeed] = useState(42);
  const [notarized, setNotarized] = useState(false);
  const [certificate, setCertificate] = useState<NotaryCertificate | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleNotarize = async () => {
    setLoading(true);
    try {
      const cert = await notarizeDocument(documentText, author, title, seed);
      setCertificate(cert);
      setNotarized(true);
      
      // Automatisch verifizieren
      const result = await verifyNotaryCertificate(cert);
      setVerification(result);
    } catch (error) {
      console.error("Notarization failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!certificate) return;
    setLoading(true);
    try {
      const result = await verifyNotaryCertificate(certificate);
      setVerification(result);
    } catch (error) {
      console.error("Verification failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={className}
      data-testid="copyright-notary-modal"
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
        📜 Gerichtsfester Urheberrechts-Notar (RFC 3161)
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        SHA-512 Merkle-Baum · ECDSA P-384 · RFC 3161 TSA · Zero-Knowledge
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary data-testid="summary-eingabe" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📝 DOKUMENT-EINGABE
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8, fontSize: 11 }}>
          <label style={{ flex: 1, minWidth: 200 }}>
            Autor
            <input value={author} onChange={e => setAuthor(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
          </label>
          <label style={{ flex: 1, minWidth: 200 }}>
            Titel
            <input value={title} onChange={e => setTitle(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
          </label>
          <label style={{ flex: 1, minWidth: 100 }}>
            Seed
            <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
          </label>
        </div>
        <label style={{ display: "block", marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
          Manuskript-Text
          <textarea
            value={documentText}
            onChange={e => setDocumentText(e.target.value)}
            rows={8}
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
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <button
            onClick={handleNotarize}
            disabled={loading || !documentText.trim() || !author.trim() || !title.trim()}
            style={{
              padding: "8px 16px",
              background: loading ? "var(--panel)" : "var(--accent)",
              color: loading ? "var(--fg)" : "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 11,
            }}
          >
            {loading ? "⏳ Notarisieren..." : "📜 Notarisieren (RFC 3161)"}
          </button>
          <button
            onClick={handleVerify}
            disabled={loading || !notarized}
            style={{
              padding: "8px 16px",
              background: notarized ? "var(--success)" : "var(--panel)",
              color: notarized ? "var(--bg)" : "var(--muted)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              cursor: notarized ? "pointer" : "not-allowed",
              fontSize: 11,
            }}
          >
            ✅ Verifizieren
          </button>
          <button
            onClick={() => { setNotarized(false); setCertificate(null); setVerification(null); }}
            disabled={loading || !notarized}
            style={{
              padding: "8px 16px",
              background: "var(--panel)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              cursor: notarized ? "pointer" : "not-allowed",
              fontSize: 11,
            }}
          >
            🔄 Zurücksetzen
          </button>
        </div>
      </details>

      {notarized && certificate && (
        <details style={{ marginBottom: 12 }} open>
          <summary data-testid="summary-zertifikat" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
            📜 NOTARIATS-ZERTIFIKAT
          </summary>
          <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--success)", borderRadius: 4, fontSize: 9, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "rgba(0,255,0,0.05)", maxHeight: 400, overflow: "auto" }}>
            {formatCertificate(certificate)}
          </pre>
        </details>
      )}

      {verification && (
        <details style={{ marginBottom: 12 }} open>
          <summary data-testid="summary-verifikation" style={{ fontSize: 11, color: verification.valid ? "var(--success)" : "var(--error)", cursor: "pointer", fontWeight: 700 }}>
            {verification.valid ? "✅ VERIFIKATION ERFOLGREICH" : "❌ VERIFIKATION FEHLGESCHLAGEN"}
          </summary>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
            <div style={{ padding: 8, border: `1px solid ${verification.documentHashMatches ? "var(--success)" : "var(--error)"}`, borderRadius: 4, background: verification.documentHashMatches ? "rgba(0,255,0,0.1)" : "rgba(255,0,0,0.1)" }}>
              <strong>Dokument-Hash = Merkle-Root:</strong> {verification.documentHashMatches ? "✅ JA" : "❌ NEIN"}
            </div>
            <div style={{ padding: 8, border: `1px solid ${verification.signatureValid ? "var(--success)" : "var(--error)"}`, borderRadius: 4, background: verification.signatureValid ? "rgba(0,255,0,0.1)" : "rgba(255,0,0,0.1)" }}>
              <strong>ECDSA P-384 Signatur:</strong> {verification.signatureValid ? "✅ GÜLTIG" : "❌ UNGÜLTIG"}
            </div>
            <div style={{ padding: 8, border: `1px solid ${verification.timestampValid ? "var(--success)" : "var(--error)"}`, borderRadius: 4, background: verification.timestampValid ? "rgba(0,255,0,0.1)" : "rgba(255,0,0,0.1)" }}>
              <strong>RFC 3161 Zeitstempel:</strong> {verification.timestampValid ? "✅ GÜLTIG" : "❌ UNGÜLTIG/ABGELAUFEN"}
            </div>
            <div style={{ padding: 8, border: `1px solid ${verification.merkleValid ? "var(--success)" : "var(--error)"}`, borderRadius: 4, background: verification.merkleValid ? "rgba(0,255,0,0.1)" : "rgba(255,0,0,0.1)" }}>
              <strong>Merkle-Baum / TSA Token:</strong> {verification.merkleValid ? "✅ GÜLTIG" : "❌ UNGÜLTIG"}
            </div>
            {verification.errors.length > 0 && (
              <div style={{ padding: 8, border: "1px solid var(--error)", borderRadius: 4, background: "rgba(255,0,0,0.1)", color: "var(--error)" }}>
                <strong>Fehler:</strong>
                <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                  {verification.errors.map((e, i) => <li key={i} style={{ fontSize: 10 }}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-beispiel" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎲 BEISPIEL-DOKUMENTE
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            ["Kapitel 1: Der Anfang", "Max Mustermann", "Das große Abenteuer"],
            ["Kapitel 1: Der Fall", "Erika Musterfrau", "Der letzte Zeuge"],
            ["Kapitel 1: Der Aufbruch", "Dr. Hans Dampf", "Sterne über Eldoria"],
          ].map(([text, auth, tit], i) => (
            <button
              key={i}
              onClick={() => { setDocumentText(text); setAuthor(auth); setTitle(tit); setSeed(i + 1); }}
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
              {tit} von {auth}
            </button>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-architektur" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🏗️ ARCHITEKTUR & SICHERHEIT
        </summary>
        <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, color: "var(--fg)" }}>
          <div style={{ marginBottom: 8 }}>
            <strong>SHA-512 Merkle-Baum:</strong> Dokument in 1KB-Chunks → Hashes → Baum → Root = Dokument-Fingerprint
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>ECDSA P-384:</strong> Asymmetrische Signatur (Private Key nur lokal, Public Key im Zertifikat)
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>RFC 3161 TSA:</strong> Vertrauenswürdiger Zeitstempel-Server (simuliert) für gerichtsfeste Zeit
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Zero-Knowledge:</strong> Private Key verlässt nie das Gerät. Kein Cloud-Upload.
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Offline-Prüfung:</strong> Anwalt/Richter öffnet Zertifikat im Browser → kryptografische Verifikation ohne Internet
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Export:</strong> Zertifikat als Text kopierbar → .aiwsnotary Datei für Archivierung
          </div>
          <div>
            <strong>Rechtliche Hinweise:</strong> Simulierte TSA (tsa.example.com). Für echte Gerichtsfestigkeit echte TSA (z.B. D-Trust, SwissSign) konfigurieren.
          </div>
        </div>
      </details>

      <details>
        <summary data-testid="summary-merkle" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🌳 MERKLE-BAUM & BEWEIS
        </summary>
        <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, color: "var(--fg)" }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Merkle-Proof Struktur:</strong>
          </div>
          <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 9, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)" }}>
{JSON.stringify({
  leafHash: "sha512(chunk_0)",
  siblings: [
    { hash: "sha512(chunk_1)", position: "right" },
    { hash: "sha512(parent_0_1)", position: "left" }
  ],
  root: "merkleRoot == documentHash"
}, null, 2)}
          </pre>
          <div style={{ marginTop: 8, fontSize: 9, color: "var(--muted)" }}>
            Prüfer kann jeden Chunk einzeln hashen und Pfad zum Root rekonstruieren → Manipulationsnachweis.
          </div>
        </div>
      </details>
    </div>
  );
}