/**
 * Universal-Archive-Service — WP 35.2 (50-Jahre-Zukunftsarchiv .aiwsopen)
 *
 * Lokaler, deterministischer Service zur Archivierung in .aiwsopen
 * und Export als Obsidian-Vault.
 * Keine LLM-Aufrufe.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ArchiveProject {
  title: string;
  author: string;
  chapters: string[];
  metadata: Record<string, string>;
}

export interface AiwopenArchive {
  markdown: string;
  yaml: string;
  jsonLd: string;
}

export interface ObsidianVault {
  files: { name: string; content: string }[];
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Exportiert als .aiwsopen-Archiv.
 */
export function exportToAiwopen(project: ArchiveProject): AiwopenArchive {
  if (!project || typeof project !== 'object') {
    return { markdown: '', yaml: '', jsonLd: '' };
  }

  const title = project.title || 'Unbekannt';
  const author = project.author || 'Unbekannt';
  const chapters = project.chapters || [];
  const metadata = project.metadata || {};

  // Markdown
  const markdown = `# ${title}\n\n**Autor:** ${author}\n\n${chapters.map((c, i) => `## Kapitel ${i + 1}\n\n${c}`).join('\n\n')}`;

  // YAML
  const yaml = `title: ${title}\nauthor: ${author}\nchapters: ${chapters.length}\n${Object.entries(metadata).map(([k, v]) => `${k}: ${v}`).join('\n')}`;

  // JSON-LD
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: title,
    author: { '@type': 'Person', name: author },
    numberOfPages: chapters.length,
  });

  return { markdown, yaml, jsonLd };
}

/**
 * Importiert aus .aiwsopen.
 */
export function importFromAiwopen(archive: AiwopenArchive): ArchiveProject {
  if (!archive || typeof archive !== 'object') {
    return { title: '', author: '', chapters: [], metadata: {} };
  }

  const title = archive.markdown.match(/^# (.+)$/m)?.[1] || 'Unbekannt';
  const author = archive.markdown.match(/\*\*Autor:\*\* (.+)/)?.[1] || 'Unbekannt';
  const chapters = archive.markdown.split(/## Kapitel \d+/).slice(1).map((c) => c.trim());

  return { title, author, chapters, metadata: {} };
}

/**
 * Exportiert als Obsidian-Vault mit Wiki-Links.
 */
export function exportToObsidianVault(project: ArchiveProject): ObsidianVault {
  if (!project || typeof project !== 'object') {
    return { files: [] };
  }

  const title = project.title || 'Unbekannt';
  const author = project.author || 'Unbekannt';
  const chapters = project.chapters || [];

  const files: { name: string; content: string }[] = [];

  // Index
  files.push({
    name: 'Index.md',
    content: `# ${title}\n\n**Autor:** ${author}\n\n${chapters.map((_, i) => `[[Kapitel ${i + 1}]]`).join('\n')}`,
  });

  // Kapitel
  chapters.forEach((chapter, i) => {
    files.push({
      name: `Kapitel ${i + 1}.md`,
      content: `# Kapitel ${i + 1}\n\n${chapter}`,
    });
  });

  return { files };
}
