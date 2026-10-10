// VintageTelegramFabricatorModal (Meilenstein 62.0 / v7.4.0 UI)
import { useState, useMemo } from "react";
import {
  TELEGRAM_ERAS,
  fabricateTelegram,
  generateUrgencyStamp,
  exportTelegramPdf,
  createSampleTelegram,
  createSampleEra,
} from "@/services/publishing/vintageTelegramFabricator";

export interface VintageTelegramFabricatorModalProps {
  className?: string;
}

export function VintageTelegramFabricatorModal({ className }: VintageTelegramFabricatorModalProps) {
  const sample = useMemo(() => createSampleTelegram(), []);
  const sampleEra = useMemo(() => createSampleEra(), []);

  const [seed, setSeed] = useState(42);
  const [recipient, setRecipient] = useState("Herrn Dr. Arthur Conan Doyle, London");
  const [sender, setSender] = useState("Redaktion, Strand Magazine");
  const [message, setMessage] = useState(sample.body);
  const [eraId, setEraId] = useState(sampleEra.id);

  const era = useMemo(
    () => TELEGRAM_ERAS.find((e) => e.id === eraId) ?? TELEGRAM_ERAS[0],
    [eraId]
  );

  const fabrication = useMemo(
    () =>
      fabricateTelegram(
        { recipient, sender, message, eraId },
        seed
      ),
    [recipient, sender, message, eraId, seed]
  );

  const stamp = useMemo(
    () => generateUrgencyStamp(eraId, seed),
    [eraId, seed]
  );

  const pdfExport = useMemo(
    () =>
      exportTelegramPdf(
        { recipient, sender, message, eraId },
        seed
      ),
    [recipient, sender, message, eraId, seed]
  );

  const inputStyle = {
    width: "100%",
    marginTop: 4,
    padding: "4px 8px",
    fontSize: 11,
    background: "var(--panel)",
    color: "var(--fg)",
    border: "1px solid var(--border)",
    borderRadius: 4,
  } as const;

  const labelStyle = {
    fontSize: 11,
    color: "var(--muted)",
    flex: 1,
    minWidth: 180,
  } as const;

  const sectionStyle = {
    marginBottom: 12,
  } as const;

  const summaryStyle = {
    fontSize: 11,
    color: "var(--accent)",
    cursor: "pointer",
    fontWeight: 700,
  } as const;

  return (
    <div
      className={className}
      data-testid="telegram-fabricator-modal"
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
        📨 Historischer Telegramm- &amp; Telex-Fabrikator
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {era.name} · {era.year} · {fabrication.strips.length} Bänder · {stamp.stamps.length} Stempel
      </div>

      {/* EPOCHE */}
      <details style={sectionStyle} open>
        <summary style={summaryStyle}>🏛️ EPOCHE</summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {TELEGRAM_ERAS.map((e) => (
            <label
              key={e.id}
              style={{
                padding: 6,
                border: e.id === eraId ? "2px solid var(--accent)" : "1px solid var(--border)",
                borderRadius: 4,
                background: "var(--panel)",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="telegram-era"
                value={e.id}
                checked={e.id === eraId}
                onChange={() => setEraId(e.id)}
                style={{ marginRight: 6 }}
              />
              <span style={{ fontWeight: 700, color: "var(--accent)" }}>{e.name}</span>
              <span style={{ fontSize: 10, color: "var(--muted)" }}> · {e.year}</span>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{e.description}</div>
            </label>
          ))}
        </div>
      </details>

      {/* TELEGRAMM */}
      <details style={sectionStyle} open>
        <summary style={summaryStyle}>📝 TELEGRAMM</summary>
        <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ ...labelStyle, minWidth: 80 }}>
            Seed
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value) || 0)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Empfänger
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Absender
            <input
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ ...labelStyle, minWidth: 280 }}>
            Depesche
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={inputStyle}
            />
          </label>
        </div>
        <div
          style={{
            marginTop: 8,
            padding: 8,
            border: "2px solid var(--accent)",
            borderRadius: 8,
            background: "var(--panel)",
            overflow: "auto",
          }}
          dangerouslySetInnerHTML={{ __html: fabrication.svg }}
        />
      </details>

      {/* STEMPEL & DRINGLICHKEIT */}
      <details style={sectionStyle} open>
        <summary style={summaryStyle}>🔴 STEMPEL &amp; DRINGLICHKEIT</summary>
        <div
          style={{
            marginTop: 8,
            padding: 8,
            border: "1px solid var(--border)",
            borderRadius: 4,
            background: "var(--panel)",
            fontSize: 11,
          }}
        >
          <div>
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>Dringlichkeit:</span>{" "}
            {stamp.urgency}
          </div>
          <div style={{ marginTop: 4 }}>
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>Stempel:</span>{" "}
            {stamp.stamps.join(" · ")}
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
            Morse: {stamp.morseHeader}
          </div>
        </div>
      </details>

      {/* 300-DPI-EXPORT */}
      <details style={sectionStyle} open>
        <summary style={summaryStyle}>🖨️ 300-DPI-EXPORT</summary>
        <div
          style={{
            marginTop: 8,
            padding: 8,
            border: "1px solid var(--border)",
            borderRadius: 4,
            background: "var(--panel)",
            fontSize: 11,
          }}
        >
          <div>
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>Format:</span>{" "}
            {pdfExport.width}×{pdfExport.height} px
          </div>
          <div style={{ marginTop: 2 }}>
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>Auflösung:</span>{" "}
            {pdfExport.dpi} DPI
          </div>
          <div style={{ marginTop: 2 }}>
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>Druckfertig:</span>{" "}
            {pdfExport.printReady ? "✅ ja" : "❌ nein"}
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
            Das SVG wird bei {pdfExport.dpi} DPI gerendert und ist für den Druck optimiert.
          </div>
        </div>
      </details>
    </div>
  );
}
