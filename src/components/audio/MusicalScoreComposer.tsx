// MusicalScoreComposer (Stub)

export interface MusicalScoreComposerProps {
  className?: string;
}

export function MusicalScoreComposer({ className }: MusicalScoreComposerProps) {
  return (
    <div
      className={className}
      data-testid="musical-score-composer"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎼 Musical Score Composer
      </h3>
      <p style={{ fontSize: 11, color: "var(--muted)" }}>Stub Implementation</p>
    </div>
  );
}