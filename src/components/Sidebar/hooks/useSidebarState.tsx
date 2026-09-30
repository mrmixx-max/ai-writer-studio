import React from "react";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useI18n } from "@/i18n";
import { useProjectStore } from "@/store/projectStore";
import type { EditorMode } from "@/types/mode";
import type { RowActions, SidebarTab, SidebarState, SidebarActions } from "../types";
import { isStandaloneMode, requiresChapter } from "../modeRegistry";
import { renameProject, renameChapter, deleteProject, deleteChapter } from "@/services/project";
import { AppDialog } from "@/components/Dialog/AppDialog";

/**
 * Custom Hook für Sidebar-State-Management.
 * Extrahiert die gesamte State-Logik aus dem Sidebar-Hauptkomponenten.
 */
export function useSidebarState(): [SidebarState, SidebarActions, RowActions, React.ReactNode, { askPrompt: typeof askPrompt; askConfirm: typeof askConfirm }] {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<SidebarTab>("projects");
  const [mode, setMode] = useState<EditorMode>("editor");
  const [modesCollapsed, setModesCollapsed] = useState(false);

  // Stores
  const refresh = useProjectStore((s) => s.refresh);
  const openProject = useProjectStore((s) => s.openProject);
  const openChapter = useProjectStore((s) => s.openChapter);

  // Dialog State (Sprint 32: Ersatz für window.prompt/confirm)
  const [dlg, setDlg] = useState<DialogRequest | null>(null);

  type DialogRequest =
    | { kind: "prompt"; label: string; initial: string; resolve: (v: string | null) => void }
    | { kind: "confirm"; message: string; resolve: (v: boolean) => void };

  const askPrompt = useCallback(
    (label: string, initial = "") =>
      new Promise<string | null>((resolve) =>
        setDlg({ kind: "prompt", label, initial, resolve })
      ),
    []
  );

  const askConfirm = useCallback(
    (message: string) =>
      new Promise<boolean>((resolve) =>
        setDlg({ kind: "confirm", message, resolve })
      ),
    []
  );

  const dlgEl = <AppDialog request={dlg} onDone={() => setDlg(null)} />;

  // tRef-Trick: useI18n() liefert pro Render neue t-Identität.
  // Ref vermeidet Deps auf `t` in useCallback/useMemo.
  const tRef = useRef(t);
  tRef.current = t;

  // Row Actions — memoized, stabil über Renders
  const handleRenameProject = useCallback(
    (id: string, name: string) => {
      void (async () => {
        const n = await askPrompt(tRef.current("sidebar.promptNewName"), name);
        if (n) {
          renameProject(id, n);
          refresh();
        }
      })();
    },
    [refresh, lang, askPrompt]
  );

  const handleDeleteProject = useCallback(
    (id: string) => {
      void (async () => {
        if (await askConfirm(tRef.current("sidebar.confirmDeleteProject"))) {
          deleteProject(id);
          refresh();
        }
      })();
    },
    [refresh, lang, askConfirm]
  );

  const handleRenameChapter = useCallback(
    (pid: string, id: string, title: string) => {
      void (async () => {
        const n = await askPrompt(tRef.current("sidebar.promptNewName"), title);
        if (n) {
          renameChapter(id, n);
          openProject(pid);
        }
      })();
    },
    [openProject, lang, askPrompt]
  );

  const handleDeleteChapter = useCallback(
    (pid: string, id: string) => {
      void (async () => {
        if (await askConfirm(tRef.current("sidebar.confirmDeleteChapter"))) {
          deleteChapter(id);
          openProject(pid);
        }
      })();
    },
    [openProject, lang, askConfirm]
  );

  const rowActions = useMemo<RowActions>(
    () => ({
      onOpenProject: openProject,
      onOpenChapter: openChapter,
      onRenameProject: handleRenameProject,
      onDeleteProject: handleDeleteProject,
      onRenameChapter: handleRenameChapter,
      onDeleteChapter: handleDeleteChapter,
    }),
    [
      openProject,
      openChapter,
      handleRenameProject,
      handleDeleteProject,
      handleRenameChapter,
      handleDeleteChapter,
    ]
  );

  // BookWriter-Modus per Window-Event öffnen (Sprint 6, Agent 5)
  useEffect(() => {
    const onOpenMode = (e: Event) => {
      const target = (e as CustomEvent<string>).detail;
      if (typeof target === "string" && target) setMode(target as EditorMode);
    };
    window.addEventListener("bookwriter:open-mode", onOpenMode);
    return () => window.removeEventListener("bookwriter:open-mode", onOpenMode);
  }, []);

  // Initial refresh
  useEffect(() => {
    refresh();
  }, [refresh]);

  const sidebarState: SidebarState = { tab, mode, modesCollapsed };
  const sidebarActions: SidebarActions = {
    setTab,
    setMode,
    toggleModesCollapsed: () => setModesCollapsed((v) => !v),
  };

  return [sidebarState, sidebarActions, rowActions, dlgEl, { askPrompt, askConfirm }];
}

/**
 * Hook für Modus-Validierung: Prüft ob aktueller Modus gültig ist
 * (Projekt/Kapitel vorhanden, falls required).
 */
export function useModeValidation(
  mode: EditorMode,
  projectId: string | null,
  chapterId: string | null
): { valid: boolean; fallback: EditorMode | null } {
  if (isStandaloneMode(mode)) return { valid: true, fallback: null };
  if (!projectId) return { valid: false, fallback: "editor" };
  if (requiresChapter(mode) && !chapterId) return { valid: false, fallback: "editor" };
  return { valid: true, fallback: null };
}
