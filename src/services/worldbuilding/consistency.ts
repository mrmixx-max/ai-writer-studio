// Konsistenz-Checker: prüft Kapiteltexte auf konsistente Verwendung von
// Figuren und Orten (unerwähnte Elemente, unbekannte Namen, Projektion).
import { listCharacters } from "@/services/characters/characters";
import { listLocations } from "./locations";
import { getDb } from "@/services/db";

export interface ConsistencyFinding {
  severity: "info" | "warning" | "error";
  kind: "character" | "location";
  name: string;
  chapterTitle: string;
  chapterId: string;
  message: string;
}

export interface ConsistencyReport {
  projectId: string;
  checkedAt: string;
  chaptersChecked: number;
  findings: ConsistencyFinding[];
  mentions: {
    characters: { name: string; total: number; chapters: string[] }[];
    locations: { name: string; total: number; chapters: string[] }[];
  };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countMatches(text: string, name: string, caseSensitive = true): number {
  if (!name.trim()) return 0;
  const re = new RegExp(`\\b${escapeRe(name)}\\b`, caseSensitive ? "g" : "gi");
  return (text.match(re) || []).length;
}

/**
 * Prüft alle Kapitel eines Projekts:
 * - Figuren/Orte, die definiert, aber nirgends erwähnt werden (info).
 * - Kapitel, in denen Figuren-Namen mit abweichender Großschreibung auftauchen
 *   (mögliche Tippfehler, warning).
 */
export function checkWorldConsistency(projectId: string): ConsistencyReport {
  const db = getDb();
  const characters = listCharacters(projectId);
  const locations = listLocations(projectId);

  const chapterRes = db.exec(
    `SELECT id, title, content FROM chapters WHERE project_id = ? ORDER BY order_index`,
    [projectId],
  );
  const chapters: { id: string; title: string; content: string }[] = chapterRes.length
    ? chapterRes[0].values.map((v) => ({
        id: v[0] as string, title: (v[1] as string) || "(ohne Titel)",
        content: (v[2] as string) || "",
      }))
    : [];

  const findings: ConsistencyFinding[] = [];
  const charMentions = new Map<string, { total: number; chapters: Set<string> }>();
  const locMentions = new Map<string, { total: number; chapters: Set<string> }>();
  for (const c of characters) charMentions.set(c.name, { total: 0, chapters: new Set() });
  for (const l of locations) locMentions.set(l.name, { total: 0, chapters: new Set() });

  for (const ch of chapters) {

    for (const c of characters) {
      const names = [c.name, ...c.aliases].filter((n) => n.trim());
      let found = 0;
      for (const n of names) {
        const count = countMatches(ch.content, n, false);
        if (count > 0) {
          found += count;
          // Tippfehler-Check: Name kleingeschrieben im Text, aber im Lexikon groß.
          if (n[0] === n[0].toUpperCase()) {
            const correctCase = countMatches(ch.content, n);
            if (found > correctCase) {
              findings.push({
                severity: "warning", kind: "character", name: n,
                chapterId: ch.id, chapterTitle: ch.title,
                message: `"${n}" kommt ${found - correctCase}× kleingeschrieben vor — möglicher Tippfehler.`,
              });
            }
          }
        }
      }
      if (found > 0) {
        const m = charMentions.get(c.name)!;
        m.total += found;
        m.chapters.add(ch.title);
      }
    }

    for (const l of locations) {
      const count = countMatches(ch.content, l.name);
      if (count > 0) {
        const m = locMentions.get(l.name)!;
        m.total += count;
        m.chapters.add(ch.title);
      }
    }
  }

  for (const c of characters) {
    const m = charMentions.get(c.name)!;
    if (m.total === 0) {
      findings.push({
        severity: "info", kind: "character", name: c.name,
        chapterId: "", chapterTitle: "",
        message: `Figur "${c.name}" ist definiert, aber in keinem Kapitel erwähnt.`,
      });
    }
  }
  for (const l of locations) {
    const m = locMentions.get(l.name)!;
    if (m.total === 0) {
      findings.push({
        severity: "info", kind: "location", name: l.name,
        chapterId: "", chapterTitle: "",
        message: `Ort "${l.name}" ist definiert, aber in keinem Kapitel erwähnt.`,
      });
    }
  }

  return {
    projectId,
    checkedAt: new Date().toISOString(),
    chaptersChecked: chapters.length,
    findings,
    mentions: {
      characters: [...charMentions.entries()]
        .map(([name, m]) => ({ name, total: m.total, chapters: [...m.chapters] }))
        .sort((a, b) => b.total - a.total),
      locations: [...locMentions.entries()]
        .map(([name, m]) => ({ name, total: m.total, chapters: [...m.chapters] }))
        .sort((a, b) => b.total - a.total),
    },
  };
}

/** Report als Markdown. */
export function reportToMarkdown(report: ConsistencyReport): string {
  const lines: string[] = [
    `# Konsistenz-Report`,
    ``,
    `- Geprüft: ${report.checkedAt}`,
    `- Kapitel: ${report.chaptersChecked}`,
    `- Figuren: ${report.mentions.characters.length}`,
    `- Orte: ${report.mentions.locations.length}`,
    ``,
    `## Erwähnungen — Figuren`,
    ``,
    `| Figur | Gesamt | Kapitel |`,
    `|---|---|---|`,
    ...report.mentions.characters.map(
      (m) => `| ${m.name} | ${m.total} | ${m.chapters.join(", ") || "—" } |`,
    ),
    ``,
    `## Erwähnungen — Orte`,
    ``,
    `| Ort | Gesamt | Kapitel |`,
    `|---|---|---|`,
    ...report.mentions.locations.map(
      (m) => `| ${m.name} | ${m.total} | ${m.chapters.join(", ") || "—" } |`,
    ),
    ``,
    `## Befunde`,
    ``,
  ];
  if (!report.findings.length) lines.push("Keine Befunde. ✅");
  const icon = { info: "ℹ️", warning: "⚠️", error: "❌" } as const;
  for (const f of report.findings) {
    lines.push(`- ${icon[f.severity]} [${f.kind}] ${f.message}${f.chapterTitle ? ` (Kapitel: ${f.chapterTitle})` : ""}`);
  }
  return lines.join("\n");
}
