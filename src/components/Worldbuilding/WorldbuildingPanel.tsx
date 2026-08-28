// Worldbuilding-Panel: World-Bible, Orte, Lore/Glossenar, Konsistenz-Checker.
import { useEffect, useState } from "react";
import { WorldBibleTab } from "./WorldBibleTab";
import { LocationsTab } from "./LocationsTab";
import { LoreTab } from "./LoreTab";
import { ConsistencyTab } from "./ConsistencyTab";

type Tab = "bible" | "locations" | "lore" | "consistency";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "bible", label: "Welt-Bible", icon: "🌍" },
  { id: "locations", label: "Orte", icon: "📍" },
  { id: "lore", label: "Lore & Glossar", icon: "📜" },
  { id: "consistency", label: "Konsistenz", icon: "🔎" },
];

export function WorldbuildingPanel({ projectId }: { projectId: string }) {
  const [tab, setTab] = useState<Tab>("bible");
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => { setTab("bible"); }, [projectId]);

  return (
    <div className="worldbuilding-panel">
      <nav className="worldbuilding-tabs" style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </nav>
      {tab === "bible" && <WorldBibleTab key={"b" + projectId + reloadKey} projectId={projectId} />}
      {tab === "locations" && <LocationsTab key={"l" + projectId + reloadKey} projectId={projectId} />}
      {tab === "lore" && <LoreTab key={"g" + projectId + reloadKey} projectId={projectId} />}
      {tab === "consistency" && <ConsistencyTab key={"c" + projectId + reloadKey} projectId={projectId} onChanged={() => setReloadKey((k) => k + 1)} />}
    </div>
  );
}
