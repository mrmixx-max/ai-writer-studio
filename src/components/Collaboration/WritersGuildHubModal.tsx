// WritersGuildHubModal (WP 100.2 UI)
import { useState, useMemo } from "react";
import {
  buildRoster,
  createSampleGuildSession,
  encryptDelta,
  decryptDelta,
  ROLE_DEFINITIONS,
} from "@/services/collaboration/writersGuildHub";

export interface WritersGuildHubModalProps {
  className?: string;
}

export function WritersGuildHubModal({ className }: WritersGuildHubModalProps) {
  const [session] = useState(() => createSampleGuildSession());
  const [deltaText, setDeltaText] = useState("Lyra trat in die Schenke ein.");
  const [key, setKey] = useState("gilde-geheim");

  const roster = useMemo(() => buildRoster(session), [session]);
  const ciphertext = useMemo(() => encryptDelta(`insert|0|${deltaText}`, key), [deltaText, key]);
  const roundtrip = useMemo(() => decryptDelta(ciphertext, key), [ciphertext, key]);

  return (
    <div
      className={className}
      data-testid="writers-guild-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        👥 Lokale Autoren-Gilde &amp; Multi-Seat-Hub
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Sitzung {session.id} · {session.projectName} · {session.encrypted ? "🔒 Ende-zu-Ende verschlüsselt" : "offen"}
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🪑 FARBCODIERTE PRÄSENZ ({roster.length} Sitze)
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {roster.map((r) => (
            <div key={r.seatId} style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: `var(${r.color})`, display: "inline-block" }} />
              <span style={{ flex: 1 }}>{r.displayName}</span>
              <span style={{ color: r.roleLabel === "Hauptautor" ? "var(--accent)" : "var(--muted)", fontSize: 10 }}>{r.roleLabel}</span>
              <span style={{ color: r.online ? "var(--success)" : "var(--muted)", fontSize: 10 }}>{r.online ? "● online" : "○ offline"}</span>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎭 ROLLEN- & BERECHTIGUNGS-TIERS
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
          {ROLE_DEFINITIONS.map((r) => (
            <div key={r.role} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <div style={{ fontWeight: 700, color: "var(--accent)" }}>{r.label}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{r.permissions.join(" · ")}</div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔐 CRDT-DELTA (ENDE-ZU-ENDE VERSCHLÜSSELT)
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ fontSize: 11, color: "var(--muted)" }}>
            Delta-Text
            <input
              value={deltaText}
              onChange={(e) => setDeltaText(e.target.value)}
              style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
            />
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)" }}>
            Schlüssel
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
            />
          </label>
          <div style={{ fontSize: 10 }}>
            <div style={{ color: "var(--muted)" }}>Ciphertext:</div>
            <pre style={{ margin: "4px 0 0", padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", whiteSpace: "pre-wrap", wordBreak: "break-all", fontSize: 10 }}>{ciphertext}</pre>
          </div>
          <div style={{ fontSize: 10 }}>
            <div style={{ color: "var(--muted)" }}>Entschlüsselt (Roundtrip):</div>
            <div style={{ padding: 8, marginTop: 4, border: "1px solid var(--success)", borderRadius: 4, background: "var(--panel)" }}>{roundtrip}</div>
          </div>
        </div>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🖱️ LIVE-CURSOR-POSITIONEN ({session.cursors.length})
        </summary>
        <div style={{ marginTop: 8, fontSize: 11 }}>
          {session.cursors.map((c, i) => (
            <div key={i} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              {c.seatId} → {c.chapterId} @ {c.offset}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
