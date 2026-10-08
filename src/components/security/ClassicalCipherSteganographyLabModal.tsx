// ClassicalCipherSteganographyLabModal (Meilenstein 57.0 UI, v6.9.0)
import { useState, useMemo } from "react";
import {
  encryptOneTimePad,
  decryptOneTimePad,
  encryptBookCipher,
  decryptBookCipher,
  hideMessage,
  extractMessage,
  createSampleOTP,
  createSampleSteganogram,
} from "@/services/security/classicalCipherSteganographyLab";

export interface ClassicalCipherSteganographyLabModalProps {
  className?: string;
}

type OTPResult = { ciphertext: string; key: number[]; blocks: string[] };
type BookRef = { page: number; line: number; word: number };
type BookResult = { ciphertext: string; references: BookRef[]; key: string };
type StegResult = { steganogram: string; positions: number[]; key: string };

const sectionStyle = {
  marginBottom: 12,
} as const;

const summaryStyle = {
  fontSize: 11,
  color: "var(--accent)",
  cursor: "pointer",
  fontWeight: 700,
} as const;

const inputStyle = {
  width: "100%",
  marginTop: 4,
  padding: "4px 8px",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  color: "var(--fg)",
} as const;

const textareaStyle = {
  width: "100%",
  marginTop: 4,
  padding: "8px",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  color: "var(--fg)",
} as const;

const preStyle = {
  marginTop: 8,
  padding: 10,
  border: "1px solid var(--border)",
  borderRadius: 4,
  fontSize: 9,
  fontFamily: "var(--font-mono)",
  whiteSpace: "pre-wrap",
  background: "var(--panel)",
  color: "var(--fg)",
  maxHeight: 260,
  overflow: "auto",
} as const;

const buttonStyle = {
  padding: "8px 16px",
  background: "var(--accent)",
  color: "var(--bg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 11,
} as const;

export function ClassicalCipherSteganographyLabModal({
  className,
}: ClassicalCipherSteganographyLabModalProps) {
  // Gemeinsame Eingaben
  const [plaintext, setPlaintext] = useState("Hallo Welt");
  const [coverText, setCoverText] = useState(
    "Der schnelle braune Fuchs springt über den faulen Hund im Garten und läuft weiter"
  );
  const [secretMessage, setSecretMessage] = useState("Hallo");
  const [interval, setIntervalValue] = useState(3);
  const [seed, setSeed] = useState(42);

  // Buch-Dimensionen (Buch-Chiffre)
  const [bookPages, setBookPages] = useState(200);
  const [bookLinesPerPage, setBookLinesPerPage] = useState(40);
  const [bookWordsPerPage, setBookWordsPerPage] = useState(12);

  // Ergebnisse
  const [otp, setOtp] = useState<OTPResult | null>(null);
  const [otpDecrypted, setOtpDecrypted] = useState<string>("");
  const [book, setBook] = useState<BookResult | null>(null);
  const [bookDecrypted, setBookDecrypted] = useState<string>("");
  const [steg, setSteg] = useState<StegResult | null>(null);
  const [stegExtracted, setStegExtracted] = useState<string>("");
  const [error, setError] = useState<string>("");

  const sampleOTP = useMemo(() => createSampleOTP(), []);
  const sampleSteganogram = useMemo(() => createSampleSteganogram(), []);

  const bookConfig = useMemo(
    () => ({
      pages: Math.max(1, bookPages),
      linesPerPage: Math.max(1, bookLinesPerPage),
      wordsPerPage: Math.max(1, bookWordsPerPage),
    }),
    [bookPages, bookLinesPerPage, bookWordsPerPage]
  );

  // ----- One-Time-Pad -----
  const handleOtpEncrypt = () => {
    setError("");
    try {
      const result = encryptOneTimePad(plaintext);
      setOtp(result);
      setOtpDecrypted("");
    } catch (e) {
      setError(String(e));
    }
  };

  const handleOtpDecrypt = () => {
    setError("");
    try {
      if (!otp) return;
      setOtpDecrypted(decryptOneTimePad(otp.ciphertext, otp.key));
    } catch (e) {
      setError(String(e));
    }
  };

  // ----- Buch-Chiffre -----
  const handleBookEncrypt = () => {
    setError("");
    try {
      const result = encryptBookCipher(plaintext, bookConfig, seed);
      setBook(result);
      setBookDecrypted("");
    } catch (e) {
      setError(String(e));
    }
  };

  const handleBookDecrypt = () => {
    setError("");
    try {
      if (!book) return;
      setBookDecrypted(decryptBookCipher(book.ciphertext, book.references));
    } catch (e) {
      setError(String(e));
    }
  };

  // ----- Steganografie -----
  const handleHide = () => {
    setError("");
    try {
      const result = hideMessage(coverText, secretMessage, interval);
      setSteg(result);
      setStegExtracted("");
    } catch (e) {
      setError(String(e));
    }
  };

  const handleExtract = () => {
    setError("");
    try {
      if (!steg) return;
      setStegExtracted(extractMessage(steg.steganogram, interval, steg.positions));
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div
      className={className}
      data-testid="cipher-steganography-modal"
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
        🔐 Klassisches Chiffrier- & Steganografie-Labor
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        One-Time-Pad · Buch-Chiffre · Null-Chiffre / Steganografie · 100% lokal
      </div>

      {error && (
        <div
          data-testid="cipher-error"
          style={{
            marginBottom: 12,
            padding: 8,
            border: "1px solid var(--error)",
            borderRadius: 4,
            color: "var(--error)",
            fontSize: 10,
            whiteSpace: "pre-wrap",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Gemeinsame Eingaben                                               */}
      {/* ----------------------------------------------------------------- */}
      <details style={sectionStyle} open>
        <summary data-testid="summary-eingaben" style={summaryStyle}>
          📝 EINGABEN
        </summary>
        <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
            Intervall (jedes N-te Wort)
            <input
              data-testid="input-interval"
              type="number"
              min="1"
              value={interval}
              onChange={(e) => setIntervalValue(Math.max(1, Number(e.target.value) || 1))}
              style={inputStyle}
            />
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
            Seed
            <input
              data-testid="input-seed"
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value) || 0)}
              style={inputStyle}
            />
          </label>
        </div>
        <label style={{ display: "block", marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
          Plaintext
          <textarea
            data-testid="input-plaintext"
            value={plaintext}
            onChange={(e) => setPlaintext(e.target.value)}
            rows={3}
            style={textareaStyle}
          />
        </label>
      </details>

      {/* ----------------------------------------------------------------- */}
      {/* ONE-TIME-PAD                                                      */}
      {/* ----------------------------------------------------------------- */}
      <details style={sectionStyle} open>
        <summary data-testid="summary-otp" style={summaryStyle}>
          🎲 ONE-TIME-PAD
        </summary>
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            data-testid="btn-otp-encrypt"
            onClick={handleOtpEncrypt}
            style={buttonStyle}
          >
            🔒 Verschlüsseln
          </button>
          <button
            data-testid="btn-otp-decrypt"
            onClick={handleOtpDecrypt}
            disabled={!otp}
            style={{
              ...buttonStyle,
              background: otp ? "var(--success)" : "var(--panel)",
              color: otp ? "var(--bg)" : "var(--muted)",
              cursor: otp ? "pointer" : "not-allowed",
            }}
          >
            🔓 Entschlüsseln
          </button>
        </div>

        {otp && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>
              Ciphertext ({otp.blocks.length} Blöcke)
            </div>
            <pre data-testid="otp-ciphertext" style={preStyle}>
              {otp.ciphertext}
            </pre>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 8 }}>
              Schlüssel (Byte-Array)
            </div>
            <pre data-testid="otp-key" style={preStyle}>
              {JSON.stringify(otp.key)}
            </pre>
            {otpDecrypted && (
              <>
                <div style={{ fontSize: 10, color: "var(--success)", marginTop: 8 }}>
                  Entschlüsselt
                </div>
                <pre data-testid="otp-decrypted" style={preStyle}>
                  {otpDecrypted}
                </pre>
              </>
            )}
          </div>
        )}

        <details style={{ marginTop: 8 }}>
          <summary data-testid="summary-otp-sample" style={summaryStyle}>
            🎁 Beispiel-OTP
          </summary>
          <pre data-testid="otp-sample" style={preStyle}>
            {`Ciphertext: ${sampleOTP.ciphertext}\nSchlüssel:  ${JSON.stringify(sampleOTP.key)}`}
          </pre>
        </details>
      </details>

      {/* ----------------------------------------------------------------- */}
      {/* BUCH-CHIFFRE                                                      */}
      {/* ----------------------------------------------------------------- */}
      <details style={sectionStyle} open>
        <summary data-testid="summary-book" style={summaryStyle}>
          📖 BUCH-CHIFFRE
        </summary>
        <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
            Seiten
            <input
              data-testid="input-book-pages"
              type="number"
              min="1"
              value={bookPages}
              onChange={(e) => setBookPages(Math.max(1, Number(e.target.value) || 1))}
              style={inputStyle}
            />
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
            Zeilen/Seite
            <input
              data-testid="input-book-lines"
              type="number"
              min="1"
              value={bookLinesPerPage}
              onChange={(e) => setBookLinesPerPage(Math.max(1, Number(e.target.value) || 1))}
              style={inputStyle}
            />
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
            Wörter/Seite
            <input
              data-testid="input-book-words"
              type="number"
              min="1"
              value={bookWordsPerPage}
              onChange={(e) => setBookWordsPerPage(Math.max(1, Number(e.target.value) || 1))}
              style={inputStyle}
            />
          </label>
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            data-testid="btn-book-encrypt"
            onClick={handleBookEncrypt}
            style={buttonStyle}
          >
            🔒 Verschlüsseln
          </button>
          <button
            data-testid="btn-book-decrypt"
            onClick={handleBookDecrypt}
            disabled={!book}
            style={{
              ...buttonStyle,
              background: book ? "var(--success)" : "var(--panel)",
              color: book ? "var(--bg)" : "var(--muted)",
              cursor: book ? "pointer" : "not-allowed",
            }}
          >
            🔓 Entschlüsseln
          </button>
        </div>

        {book && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>
              Buch-Schlüssel: {book.key}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 8 }}>
              Referenzen (Seite/Zeile/Wort)
            </div>
            <pre data-testid="book-references" style={preStyle}>
              {book.references
                .map((r, i) => `${i + 1}: ${r.page}/${r.line}/${r.word}`)
                .join("\n")}
            </pre>
            {bookDecrypted && (
              <>
                <div style={{ fontSize: 10, color: "var(--success)", marginTop: 8 }}>
                  Entschlüsselt
                </div>
                <pre data-testid="book-decrypted" style={preStyle}>
                  {bookDecrypted}
                </pre>
              </>
            )}
          </div>
        )}
      </details>

      {/* ----------------------------------------------------------------- */}
      {/* STEGANOGRAFIE                                                     */}
      {/* ----------------------------------------------------------------- */}
      <details style={sectionStyle} open>
        <summary data-testid="summary-steg" style={summaryStyle}>
          🕵️ STEGANOGRAFIE
        </summary>
        <label style={{ display: "block", marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
          Cover-Text
          <textarea
            data-testid="input-covertext"
            value={coverText}
            onChange={(e) => setCoverText(e.target.value)}
            rows={3}
            style={textareaStyle}
          />
        </label>
        <label style={{ display: "block", marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
          Geheime Nachricht
          <textarea
            data-testid="input-secretmessage"
            value={secretMessage}
            onChange={(e) => setSecretMessage(e.target.value)}
            rows={2}
            style={textareaStyle}
          />
        </label>
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            data-testid="btn-steg-hide"
            onClick={handleHide}
            style={buttonStyle}
          >
            🫥 Verstecken
          </button>
          <button
            data-testid="btn-steg-extract"
            onClick={handleExtract}
            disabled={!steg}
            style={{
              ...buttonStyle,
              background: steg ? "var(--success)" : "var(--panel)",
              color: steg ? "var(--bg)" : "var(--muted)",
              cursor: steg ? "pointer" : "not-allowed",
            }}
          >
            🔍 Extrahieren
          </button>
        </div>

        {steg && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>
              Steganogramm (Positionen: {steg.positions.join(", ")})
            </div>
            <pre data-testid="steg-steganogram" style={preStyle}>
              {steg.steganogram}
            </pre>
            {stegExtracted && (
              <>
                <div style={{ fontSize: 10, color: "var(--success)", marginTop: 8 }}>
                  Extrahierte Nachricht
                </div>
                <pre data-testid="steg-extracted" style={preStyle}>
                  {stegExtracted}
                </pre>
              </>
            )}
          </div>
        )}

        <details style={{ marginTop: 8 }}>
          <summary data-testid="summary-steg-sample" style={summaryStyle}>
            🎁 Beispiel-Steganogramm
          </summary>
          <pre data-testid="steg-sample" style={preStyle}>
            {`${sampleSteganogram.steganogram}\n\nPositionen: ${sampleSteganogram.positions.join(
              ", "
            )}\nSchlüssel:  ${sampleSteganogram.key}`}
          </pre>
        </details>
      </details>

      {/* ----------------------------------------------------------------- */}
      {/* ERKLÄRUNG                                                         */}
      {/* ----------------------------------------------------------------- */}
      <details>
        <summary data-testid="summary-architektur" style={summaryStyle}>
          📚 VERFAHREN & HINTERGRUND
        </summary>
        <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, color: "var(--fg)" }}>
          <div style={{ marginBottom: 8 }}>
            <strong>One-Time-Pad:</strong> XOR auf Zeichencodes mit deterministischem
            Schlüssel. Ciphertext als 5-stellige numerische Blöcke.
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Buch-Chiffre:</strong> Jedes Zeichen wird als Seite/Zeile/Wort-Referenz
            eines Buches kodiert. Deterministisch bei gleichem Seed.
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Null-Chiffre / Steganografie:</strong> Die Nachricht wird Buchstabe für
            Buchstabe an jedes N-te Wort des Cover-Textes angehängt.
          </div>
          <div>
            <strong>Hinweis:</strong> Klassische Verfahren – lehrreich für Spionageromane,
            nicht für echte Kryptografie.
          </div>
        </div>
      </details>
    </div>
  );
}
