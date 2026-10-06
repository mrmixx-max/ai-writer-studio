// GrandCenturySentinelModal (Stub)

export interface GrandCenturySentinelModalProps {
  className?: string;
}

export function GrandCenturySentinelModal({ className }: GrandCenturySentinelModalProps) {
  return (
    <div
      className={className}
      data-testid="grand-century-sentinel-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🏛️ Grand Century Sentinel
      </h3>
      <p style={{ fontSize: 11, color: "var(--muted)" }}>Stub Implementation</p>
    </div>
  );
}