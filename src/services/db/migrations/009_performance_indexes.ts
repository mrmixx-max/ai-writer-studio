// Migration 009 — Performance-Indizes
// Behebt Full-Table-Scans auf häufig abgefragten Tabellen.

import type { Database } from "sql.js";

export function migration009(d: Database): void {
  // Migration 001 — Basistabellen
  d.run("CREATE INDEX IF NOT EXISTS idx_chapters_project ON chapters(project_id);");
  d.run("CREATE INDEX IF NOT EXISTS idx_chapters_project_order ON chapters(project_id, order_index);");
  d.run("CREATE INDEX IF NOT EXISTS idx_fragments_chapter ON fragments(chapter_id);");
  d.run("CREATE INDEX IF NOT EXISTS idx_semantic_nodes_project ON semantic_nodes(project_id);");
  d.run("CREATE INDEX IF NOT EXISTS idx_semantic_edges_project ON semantic_edges(project_id);");
  d.run("CREATE INDEX IF NOT EXISTS idx_chapter_dialogues_chapter ON chapter_dialogues(chapter_id);");
  d.run("CREATE INDEX IF NOT EXISTS idx_literary_versions_chapter ON literary_versions(chapter_id);");
  d.run("CREATE INDEX IF NOT EXISTS idx_whisper_chapter ON whisper_transcriptions(chapter_id);");

  // Migration 002 — Knowledge & Diagnostics
  d.run("CREATE INDEX IF NOT EXISTS idx_cr_project ON consistency_reports(project_id);");
  d.run("CREATE INDEX IF NOT EXISTS idx_sf_project ON style_findings(project_id);");
  d.run("CREATE INDEX IF NOT EXISTS idx_sf_chapter ON style_findings(chapter_id);");
  d.run("CREATE INDEX IF NOT EXISTS idx_pfreports_project ON preflight_reports(project_id);");
  d.run("CREATE INDEX IF NOT EXISTS idx_cp_project ON character_profiles(project_id);");
  d.run("CREATE INDEX IF NOT EXISTS idx_lp_project ON location_profiles(project_id);");
  d.run("CREATE INDEX IF NOT EXISTS idx_pn_project ON project_notes(project_id);");

  // Migration 004 — Bookwriter
  d.run("CREATE INDEX IF NOT EXISTS idx_bwp_run_phase ON bookwriter_phases(run_id, phase);");
  d.run("CREATE INDEX IF NOT EXISTS idx_bwa_run_type ON bookwriter_artifacts(run_id, artifact_type);");
  d.run("CREATE INDEX IF NOT EXISTS idx_bwap_run_phase ON bookwriter_approvals(run_id, phase);");

  // Migration 007 — Characters
  d.run("CREATE INDEX IF NOT EXISTS idx_characters_project ON characters(project_id);");

  // Migration 008 — Timeline
  d.run("CREATE INDEX IF NOT EXISTS idx_timeline_project ON timeline_events(project_id);");
}
