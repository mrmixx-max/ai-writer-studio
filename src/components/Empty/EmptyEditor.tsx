// Leerer Editor: kein Kapitel gewählt.
//
// Zwei Fälle werden unterschieden, weil sie unterschiedliche nächste Schritte
// haben: gar keine Projekte (echter Erststart) oder Projekte vorhanden, aber
// kein Kapitel geöffnet.

import { EmptyState, EmptySteps } from "./EmptyState";

interface Props {
  hasProjects: boolean;
  onShowSetup: () => void;
}

export function EmptyEditor({ hasProjects, onShowSetup }: Props) {
  if (!hasProjects) {
    return (
      <div className="empty">
        <div className="empty-inner">
          <div className="empty-rule" />
          <h2 className="empty-title">Noch kein Manuskript</h2>
          <p className="empty-text">
            Ein Projekt bündelt Kapitel, Figuren, Notizen und das Projektwissen
            eines Buches. So fängst du an:
          </p>

          <EmptySteps
            steps={[
              {
                title: "Projekt anlegen",
                text: 'links in der Seitenleiste über „+ Projekt“ — der Name lässt sich später ändern.',
              },
              {
                title: "Erstes Kapitel erstellen",
                text: "jedes Kapitel ist ein eigenes Dokument mit eigener Versionsgeschichte.",
              },
              {
                title: "Schreiben",
                text: "gespeichert wird laufend und automatisch, ohne Zutun.",
              },
            ]}
          />

          <div className="empty-actions">
            <button className="wbtn wbtn-quiet" onClick={onShowSetup}>
              Einrichtung erneut öffnen
            </button>
          </div>

          <div className="empty-hint">
            Die KI-Funktionen sind optional. Ohne Ollama, LM Studio oder OpenAI
            bleiben Editor, Projektverwaltung, Konsistenzprüfung und Export
            vollständig nutzbar.
          </div>
        </div>
      </div>
    );
  }

  return (
    <EmptyState
      title="Kein Kapitel geöffnet"
      text="Wähle links ein Kapitel aus, um zu schreiben, oder lege ein neues an."
      hint={
        <>
          <kbd>Strg</kbd> + <kbd>S</kbd> speichert von Hand · <kbd>F11</kbd>{" "}
          Fokusmodus · <kbd>F1</kbd> Über diese Anwendung
        </>
      }
    />
  );
}
