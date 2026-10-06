// VoiceMemoModal (Stub)

export interface VoiceMemoModalProps {
  className?: string;
}

export function VoiceMemoModal({ className }: VoiceMemoModalProps) {
  return (
    <div
      className={className}
      data-testid="voice-memo-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎙️ Voice Memo
      </h3>
      <p style={{ fontSize: 11, color: "var(--muted)" }}>Stub Implementation</p>
    </div>
  );
}