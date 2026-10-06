// SceneCameraBlockingModal (Stub)

export interface SceneCameraBlockingModalProps {
  className?: string;
}

export function SceneCameraBlockingModal({ className }: SceneCameraBlockingModalProps) {
  return (
    <div
      className={className}
      data-testid="scene-camera-blocking-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎬 Scene Camera Blocking
      </h3>
      <p style={{ fontSize: 11, color: "var(--muted)" }}>Stub Implementation</p>
    </div>
  );
}