"""Erweitert Sidebar und Modus-Typ um Preflight und Snapshots."""

from __future__ import annotations

import pathlib

# 1. Modus-Typ
p = pathlib.Path("src/types/mode.ts")
s = p.read_text(encoding="utf-8")
if "preflight" not in s:
    s = s.replace(
        '  | "diagnostics"',
        '  | "diagnostics"\n  | "preflight"\n  | "snapshots"',
    )
    p.write_text(s, encoding="utf-8")
    print("mode.ts: preflight + snapshots ergaenzt")

# 2. Sidebar
q = pathlib.Path("src/components/Sidebar/Sidebar.tsx")
t = q.read_text(encoding="utf-8")

# Importe
if "PreflightPanel" not in t:
    t = t.replace(
        'import { DiagnosticsPanel } from "@/components/Diagnostics/DiagnosticsPanel";',
        'import { DiagnosticsPanel } from "@/components/Diagnostics/DiagnosticsPanel";\n'
        'import { PreflightPanel } from "@/components/Preflight/PreflightPanel";\n'
        'import { SnapshotPanel } from "@/components/Preflight/SnapshotPanel";',
    )

# MODES-Eintrag
if '"preflight"' not in t:
    t = t.replace(
        '  { id: "diagnostics", label: "Manuskriptpruefung", icon: "\U0001F50D" },\n',
        '  { id: "diagnostics", label: "Manuskriptpruefung", icon: "\U0001F50D" },\n'
        '  { id: "preflight", label: "Exportpruefung", icon: "\u2705" },\n'
        '  { id: "snapshots", label: "Snapshots", icon: "\U0001F5C2\uFE0F" },\n',
    )

# ModePanel-Verdrahtung
if "PreflightPanel projectId" not in t:
    t = t.replace(
        '  if (mode === "diagnostics") {\n'
        '    return <DiagnosticsPanel projectId={projectId} chapterId={chapterId} />;\n'
        '  }',
        '  if (mode === "diagnostics") {\n'
        '    return <DiagnosticsPanel projectId={projectId} chapterId={chapterId} />;\n'
        '  }\n'
        '  if (mode === "preflight") {\n'
        '    return <PreflightPanel projectId={projectId} chapterId={chapterId} />;\n'
        '  }\n'
        '  if (mode === "snapshots") {\n'
        '    return <SnapshotPanel projectId={projectId} />;\n'
        '  }',
    )

# Breite
t = t.replace(
    'mode === "knowledge" || mode === "diagnostics" ? " wide" : ""',
    'mode === "knowledge" || mode === "diagnostics" || mode === "preflight" || mode === "snapshots" ? " wide" : ""',
)

q.write_text(t, encoding="utf-8")
print("Sidebar: Preflight + Snapshots verdrahtet")
