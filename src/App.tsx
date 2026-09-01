// Hauptkomponente: Startablauf, Fensteraufbau, globale Dialoge.
//
// Startablauf:
//   1. Splash zeigen, während sql.js sein WASM lädt und Migrationen laufen
//   2. Erststart-Assistent, falls noch nicht durchlaufen
//   3. Arbeitsfläche
//
// Das Tauri-Fenster startet mit "visible": false und wird erst eingeblendet,
// wenn dieser Ablauf steht — so gibt es kein weisses Aufblitzen.

import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { Sidebar } from "@/components/Sidebar/Sidebar";
import { Editor } from "@/components/Editor/Editor";
import { WordCountBar } from "@/components/Editor/WordCountBar";
import { KIPanel } from "@/components/KIPanel/KIPanel";
import { ExportBar } from "@/components/Export/ExportBar";

// Dialoge/Panel-Modals nur bei Bedarf laden — sie sind initial nicht sichtbar
// und würden sonst die Startup-Zeit des Main-Bundles verlängern.
const PrintLayoutPanel = lazy(() =>
  import("@/components/PrintLayout/PrintLayoutPanel").then((m) => ({ default: m.PrintLayoutPanel }))
);
const SettingsPanel = lazy(() =>
  import("@/components/Settings/SettingsPanel").then((m) => ({ default: m.SettingsPanel }))
);
const WelcomeWizard = lazy(() =>
  import("@/components/Welcome/WelcomeWizard").then((m) => ({ default: m.WelcomeWizard }))
);
const AboutDialog = lazy(() =>
  import("@/components/Welcome/AboutDialog").then((m) => ({ default: m.AboutDialog }))
);
const EmptyEditor = lazy(() =>
  import("@/components/Empty/EmptyEditor").then((m) => ({ default: m.EmptyEditor }))
);
const AnalyticsPanel = lazy(() =>
  import("@/components/Analytics/AnalyticsPanel").then((m) => ({ default: m.AnalyticsPanel }))
);
const AnalyticsTracker = lazy(() =>
  import("@/components/Analytics/AnalyticsTracker").then((m) => ({ default: m.AnalyticsTracker }))
);

import { Splash } from "@/components/Welcome/Splash";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { I18nProvider, useI18n } from "@/i18n";
import { AriaLiveRegion, SkipLink, announce } from "@/i18n/a11y";
import { ShortcutsHelp } from "@/i18n/ShortcutsHelp";
import { useGlobalShortcuts, focusLandmark } from "@/i18n/shortcuts";
import {
  applyHighContrast,
  getHighContrastPreference,
} from "@/i18n/highContrast";
import "@/i18n/accessibility.css";
import { PluginProvider, PluginBadges, PluginStore } from "@/plugins";
import { runHookSafe, emitPluginEvent } from "@/plugins";
// Zentrale ErrorBoundary (Fallback-UI, Reset, Crash-Report) — ersetzt die
// früher hier lokal definierte Minimalversion.
import { ErrorBoundary } from "@/components/ErrorBoundary/ErrorBoundary";
import { initDb, isPersistent } from "@/services/db";
import { updateChapter } from "@/services/project";
import { isSetupCompleted, resetSetup } from "@/services/setup/state";
import "@/components/Sidebar/sidebar.css";
import "@/components/KIPanel/ki.css";
import "@/components/Export/export.css";
import "@/components/Settings/settings.css";
import "@/components/Fragment/fragment.css";
import "@/components/VoiceLab/voice.css";
import "@/components/Avantgarde/avantgarde.css";
import "@/components/Analytics/analytics.css";
import "@/components/Empty/empty.css";
import "./app.css";

/**
 * Fängt Renderfehler ab und zeigt sie in verständlichem Deutsch.
 * Zusätzlich wird der Fehler in die Protokolldatei geschrieben, damit er
 * in einem Bugreport auftauchen kann.
 */
// Die frühere lokale ErrorBoundary-Klasse wurde durch die zentrale
// Komponente unter src/components/ErrorBoundary/ ersetzt (siehe Import oben).

type Phase = "loading" | "setup" | "ready";

/** Minimaler Ladeplatzhalter innerhalb von Modal-Rahmen. */
function ModalFallback() {
  return <div className="mode-placeholder">Lädt…</div>;
}

/** Wurzel: stellt I18n-Kontext für die gesamte App bereit. */
export function App() {
  return (
    <I18nProvider>
      <AppInner />
    </I18nProvider>
  );
}

function AppInner() {
  const focusMode = useEditorStore((s) => s.focusMode);
  const toggleFocusMode = useEditorStore((s) => s.toggleFocusMode);
  const setContent = useEditorStore((s) => s.setContent);
  const activeChapterId = useProjectStore((s) => s.activeChapterId);
  const activeContent = useProjectStore((s) => s.activeContent);
  const refresh = useProjectStore((s) => s.refresh);
  const openProject = useProjectStore((s) => s.openProject);
  const projects = useProjectStore((s) => s.projects);

  const [phase, setPhase] = useState<Phase>("loading");
  const [loadNote, setLoadNote] = useState("Manuskriptverwaltung wird geladen…");
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showPluginStore, setShowPluginStore] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showPrintLayout, setShowPrintLayout] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
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
        refresh();

        const saved = localStorage.getItem("theme");
        if (saved === "light" || saved === "dark") {
          document.documentElement.setAttribute("data-theme", saved);
        }

        // Hochkontrast: gespeicherte Einstellung oder Systempräferenz.
        applyHighContrast(getHighContrastPreference());

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
  // NOTE: Removed .show() call — tauri.conf.json has visible: true, and
  // programmatic show() fails silently in release builds on Windows WebView2.
  useEffect(() => {
    if (phase === "loading") return;
    // Window is already visible via tauri.conf.json. Splash screen covers loading.
  }, [phase]);

  useEffect(() => {
    if (activeChapterId) setContent(activeContent);
  }, [activeChapterId, activeContent]);

  // Globale Tastaturkürzel (ersetzt den früheren reinen F1-Handler).
  const { t } = useI18n();
  const shortcuts = useMemo(
    () => ({
      save: () => {
        if (activeChapterId) updateChapter(activeChapterId, activeContent);
        announce(t("shortcuts.save"));
      },
      focusSidebar: () => focusLandmark('#app-sidebar'),
      focusEditor: () => focusLandmark('#app-editor'),
      focusAI: () => focusLandmark('#app-ai-panel'),
      openSettings: () => setShowSettings(true),
      toggleFocusMode: () => {
        toggleFocusMode();
        announce(t("shortcuts.focusMode"));
      },
      openAbout: () => setShowAbout(true),
      showHelp: () => setShowShortcutsHelp(true),
    }),
    [activeChapterId, activeContent, toggleFocusMode, t],
  );
  useGlobalShortcuts(shortcuts);

  function handleChange(json: string) {
    // Plugin-Hook zuerst: Inhalt kann beobachtet/angereichert werden.
    runHookSafe("editor:content-change", json);
    setContent(json);
    emitPluginEvent("wordcount:changed", { content: json.length });
    if (activeChapterId) void updateChapter(activeChapterId, json);
  }

  function handleWizardDone(createdProjectId: string | null) {
    refresh();
    // Beispielprojekt direkt öffnen, damit der Nutzer nicht vor einer
    // leeren Fläche steht.
    if (createdProjectId) openProject(createdProjectId);
    setPhase("ready");
  }

  if (phase === "loading") {
    return <Splash note={loadNote} />;
  }

  return (
    <ErrorBoundary>
      <PluginProvider>
        {phase === "setup" && (
          <Suspense fallback={<Splash note="Assistent wird geladen…" />}>
            <WelcomeWizard onDone={handleWizardDone} />
          </Suspense>
        )}

        <div className="app-root">
          <SkipLink targetId="app-editor" label={t("header.skipToEditor")} />
          <AriaLiveRegion />
          <header className="app-header">
            <span className="logo">{t("app.name")}</span>
            <div className="header-actions">
              <ExportBar />
              <button onClick={() => setShowPrintLayout(true)} aria-label={t("header.layout")}>
                {t("header.layout")}
              </button>
              <button onClick={() => setShowAnalytics(true)} aria-label={t("header.analytics")}>
                {t("header.analytics")}
              </button>
              <button onClick={() => setShowPluginStore(true)} aria-label={t("header.plugins")}>
                {t("header.plugins")}
              </button>
              <button onClick={() => setShowSettings(true)} aria-label={t("header.settings")}>
                {t("header.settings")}
              </button>
              <button onClick={toggleFocusMode} aria-label={focusMode ? t("header.focus.on") : t("header.focus.off")}>
                {focusMode ? t("header.focus.on") : t("header.focus.off")}
              </button>
              <button
                onClick={() => setShowAbout(true)}
                title={`${t("header.about")} (F1)`}
                aria-label={t("header.about")}
              >
                ?
              </button>
            </div>
          </header>

        {/* Persistenzwarnung: darf niemals stillschweigend bleiben. */}
        {(dbError || !isPersistent()) && (
          <div className="app-warning" role="alert">
            {dbError
              ? t("warning.dbError", { error: dbError })
              : t("warning.memoryOnly")}
          </div>
        )}

        <main className="app-main" id="app-main">
          <Sidebar />
          <section className="editor-pane" id="app-editor" tabIndex={-1}>
            {activeChapterId ? (
              <>
                <Editor
                  focusMode={focusMode}
                  onChange={handleChange}
                  initialContent={activeContent}
                />
                <PluginBadges />
                <WordCountBar />
{/* ModelStatusBar entfernt — war redundant mit ModelPicker */}
              </>
            ) : (
              <Suspense fallback={<Splash note="Editor wird geladen…" />}>
                <EmptyEditor
                  hasProjects={projects.length > 0}
                  onShowSetup={() => {
                    resetSetup();
                    setPhase("setup");
                  }}
                />
              </Suspense>
            )}
          </section>
          <KIPanel />
        </main>

        {showSettings && (
          <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
            <div onClick={(e) => e.stopPropagation()}>
              <Suspense fallback={<ModalFallback />}>
                <SettingsPanel />
              </Suspense>
            </div>
          </div>
        )}

        {showAnalytics && (
          <div className="modal-backdrop" onClick={() => setShowAnalytics(false)}>
            <div onClick={(e) => e.stopPropagation()}>
              <Suspense fallback={<ModalFallback />}>
                <AnalyticsPanel />
              </Suspense>
            </div>
          </div>
        )}

        <Suspense fallback={null}>
          <AnalyticsTracker />
        </Suspense>

        {showAbout && (
          <Suspense fallback={<ModalFallback />}>
            <AboutDialog onClose={() => setShowAbout(false)} />
          </Suspense>
        )}

        {showPrintLayout && (
          <Suspense fallback={<ModalFallback />}>
            <PrintLayoutPanel onClose={() => setShowPrintLayout(false)} />
          </Suspense>
        )}

        {showPluginStore && <PluginStore onClose={() => setShowPluginStore(false)} />}

        {showShortcutsHelp && (
          <ShortcutsHelp onClose={() => setShowShortcutsHelp(false)} />
        )}
      </div>
      </PluginProvider>
    </ErrorBoundary>
  );
}
