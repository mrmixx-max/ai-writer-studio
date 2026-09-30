import { Suspense } from "react";
import { useI18n } from "@/i18n";
import { PromptGenerator } from "@/components/PromptGenerator/PromptGenerator";
import { usePromptStore } from "@/store/promptStore";

interface PromptTabProps {
  onSwitchToProjects: () => void;
}

/**
 * PromptTab — rendert den Prompts-Tab mit Generator.
 * Extrahiert aus Sidebar.tsx.
 */
export function PromptTab({ onSwitchToProjects }: PromptTabProps) {
  const { t } = useI18n();
  const prompt = usePromptStore();

  return (
    <aside id="app-sidebar" tabIndex={-1} aria-label={t("sidebar.listLabel")} className="sidebar">
      <nav className="sidebar-tabs">
        <button onClick={onSwitchToProjects}>{t("sidebar.projectsTab")}</button>
        <button
          className="active"
          aria-current="page"
          onClick={() => prompt.set("tab", "generate")}
        >
          {t("sidebar.promptsTab")}
        </button>
      </nav>
      <div className="sidebar-content">
        <Suspense fallback={<div className="mode-placeholder">{t("sidebar.loading")}</div>}>
          <PromptGenerator />
        </Suspense>
      </div>
    </aside>
  );
}