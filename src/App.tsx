// Hauptkomponente: Startablauf, Fensteraufbau, globale Dialoge.
//
// Startablauf:
//   1. Splash zeigen, während sql.js sein WASM lädt und Migrationen laufen
//   2. Erststart-Assistent, falls noch nicht durchlaufen
//   3. Arbeitsfläche
//
// Das Tauri-Fenster startet mit "visible": false und wird erst eingeblendet,
// wenn dieser Ablauf steht — so gibt es kein weisses Aufblitzen.

import { useState, useEffect, Component, type ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar/Sidebar";
import { Editor } from "@/components/Editor/Editor";
import { WordCountBar } from "@/components/Editor/WordCountBar";
import { KIPanel } from "@/components/KIPanel/KIPanel";
import { ExportBar } from "@/components/Export/ExportBar";
import { SettingsPanel } from "@/components/Settings/SettingsPanel";
import { Splash } from "@/components/Welcome/Splash";
import { WelcomeWizard } from "@/components/Welcome/WelcomeWizard";
import { AboutDialog } from "@/components/Welcome/AboutDialog";
import { EmptyEditor } from "@/components/Empty/EmptyEditor";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { initDb, isPersistent } from "@/services/db";
import { updateChapter } from "@/services/project";
import { isSetupCompleted, resetSetup } from "@/services/setup/state";
import { APP_NAME } from "@/version";
import "@/components/Sidebar/sidebar.css";
import "@/components/KIPanel/ki.css";
import "@/components/Export/export.css";
import "@/components/Settings/settings.css";
import "@/components/Fragment/fragment.css";
import "@/components/VoiceLab/voice.css";
import "@/components/Avantgarde/avantgarde.css";
import "@/components/Empty/empty.css";
import "./app.css";

/**
 * Fängt Renderfehler ab und zeigt sie in verständlichem Deutsch.
 * Zusätzlich wird der Fehler in die Protokolldatei geschrieben, damit er
 * in einem Bugreport auftauchen kann.
 */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }

  componentDidCatch(error: Error) {
    void import("@tauri-apps/api/core")
      .then((c) =>
        c.invoke("log_message", {
          level: "ui/ERROR",
          message: `Renderfehler: ${error.message}`,
        }),
      )
      .catch(() => {});
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fatal">
          <h1 className="fatal-title">Die Oberfläche konnte nicht geladen werden</h1>
          <p className="fatal-text">
            Es liegt ein Fehler in der Anwendung vor. Deine Projekte sind davon
            nicht betroffen — sie liegen in einer separaten Datei.
          </p>
          <pre className="fatal-detail selectable">{this.state.error}</pre>
          <p className="fatal-text">
            Bitte melde diesen Text zusammen mit der Protokolldatei aus dem
            Ordner <code>logs</code> im Anwendungsdatenverzeichnis.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

type Phase = "loading" | "setup" | "ready";

export function App() {
  const focusMode = useEditorStore((s) => s.focusMode);
  const toggleFocusMode = useEditorStore((s) => s.toggleFocusMode);
  const setContent = useEditorStore((s) => s.setContent);
  const proj = useProjectStore();

  const [phase, setPhase] = useState<Phase>("loading");
  const [loadNote, setLoadNote] = useState("Manuskriptverwaltung wird geladen…");
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // --- Startablauf ---------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setLoadNote("Datenbank wird geöffnet…");
        await initDb();
        if (cancelled) return;

        setLoadNote("Projekte werden gelesen…");
        proj.refresh();

        const saved = localStorage.getItem("theme");
        if (saved === "light" || saved === "dark") {
          document.documentElement.setAttribute("data-theme", saved);
        }

        setPhase(isSetupCompleted() ? "ready" : "setup");
      } catch (e) {
        if (cancelled) return;
        const msg = (e as Error)?.message ?? String(e);
        setDbError(msg);
        void import("@tauri-apps/api/core")
          .then((c) =>
            c.invoke("log_message", {
              level: "app/ERROR",
              message: `initDb fehlgeschlagen: ${msg}`,
            }),
          )
          .catch(() => {});
        // Trotz Fehler weiterlaufen: Der Nutzer soll die App sehen und die
        // Meldung lesen können, statt vor einem Splash zu warten.
        setPhase("ready");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Fenster einblenden, sobald der Startablauf entschieden ist.
  useEffect(() => {
    if (phase === "loading") return;
    void import("@tauri-apps/api/webviewWindow")
      .then(({ getCurrentWebviewWindow }) => getCurrentWebviewWindow().show())
      .catch(() => {});
  }, [phase]);

  useEffect(() => {
    if (proj.activeChapterId) setContent(proj.activeContent);
  }, [proj.activeChapterId, proj.activeContent]);

  // F1 öffnet den About-Dialog, F11 schaltet den Fokusmodus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        setShowAbout(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleChange(json: string) {
    setContent(json);
    if (proj.activeChapterId) void updateChapter(proj.activeChapterId, json);
  }

  function handleWizardDone(createdProjectId: string | null) {
    proj.refresh();
    // Beispielprojekt direkt öffnen, damit der Nutzer nicht vor einer
    // leeren Fläche steht.
    if (createdProjectId) proj.openProject(createdProjectId);
    setPhase("ready");
  }

  if (phase === "loading") {
    return <Splash note={loadNote} />;
  }

  return (
    <ErrorBoundary>
      {phase === "setup" && <WelcomeWizard onDone={handleWizardDone} />}

      <div className="app-root">
        <header className="app-header">
          <span className="logo">{APP_NAME}</span>
          <div className="header-actions">
            <ExportBar />
            <button onClick={() => setShowSettings(true)}>Einstellungen</button>
            <button onClick={toggleFocusMode}>
              {focusMode ? "Fokus aus" : "Fokusmodus"}
            </button>
            <button
              onClick={() => setShowAbout(true)}
              title="Über diese Anwendung (F1)"
              aria-label="Über diese Anwendung"
            >
              ?
            </button>
          </div>
        </header>

        {/* Persistenzwarnung: darf niemals stillschweigend bleiben. */}
        {(dbError || !isPersistent()) && (
          <div className="app-warning" role="alert">
            {dbError
              ? `Die Datenbank konnte nicht geöffnet werden: ${dbError} — Änderungen werden nicht gespeichert.`
              : "Änderungen werden derzeit nur im Arbeitsspeicher gehalten und beim Schließen verworfen."}
          </div>
        )}

        <main className="app-main">
          <Sidebar />
          <section className="editor-pane">
            {proj.activeChapterId ? (
              <>
                <Editor
                  focusMode={focusMode}
                  onChange={handleChange}
                  initialContent={proj.activeContent}
                />
                <WordCountBar />
              </>
            ) : (
              <EmptyEditor
                hasProjects={proj.projects.length > 0}
                onShowSetup={() => {
                  resetSetup();
                  setPhase("setup");
                }}
              />
            )}
          </section>
          <KIPanel />
        </main>

        {showSettings && (
          <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
            <div onClick={(e) => e.stopPropagation()}>
              <SettingsPanel />
            </div>
          </div>
        )}

        {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
      </div>
    </ErrorBoundary>
  );
}
