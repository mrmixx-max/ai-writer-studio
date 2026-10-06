// GrandJubileeArchiveModal (Stub)

export interface GrandJubileeArchiveModalProps {
  className?: string;
}

export function GrandJubileeArchiveModal({ className }: GrandJubileeArchiveModalProps) {
  return (
    <div
      className={className}
      data-testid="grand-jubilee-archive-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🏛️ Grand Jubilee Archive
      </h3>
      <p style={{ fontSize: 11, color: "var(--muted)" }}>Stub Implementation</p>
    </div>
  );
}