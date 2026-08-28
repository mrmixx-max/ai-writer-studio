// Investigative Journalism Types
export type ArticleType = 'news-report' | 'feature' | 'investigation' | 'fact-check' | 'opinion';
export type Zielmedium = 'blog' | 'magazin' | 'newsletter' | 'x-thread' | 'x-single-post';
export type Ton = 'nüchtern' | 'analytisch' | 'enthüllend' | 'kritisch' | 'erklärend';
export type QuellenTyp = 'Dokument' | 'Interview' | 'Datenbank' | 'öffentlicher Datensatz' | 'Medienbericht';

export interface Quelle {
  type: QuellenTyp;
  label: string;
  datum?: string;
  url?: string;
  glaubwürdigkeit?: 'hoch' | 'mittel' | 'niedrig';
}

export interface Akteur {
  name: string;
  rolle: string;
  quelle?: string;
}

export interface Ereignis {
  datum: string;
  beschreibung: string;
  quelle?: string;
}

export interface InvestigateInput {
  titel: string;
  these: string;
  artikelTyp: ArticleType;
  zielmedium: Zielmedium;
  sprache: string;
  ton: Ton;
  kernfakten: string[];
  quellen: Quelle[];
  akteure: Akteur[];
  ereignisse: Ereignis[];
  offeneFragen: string[];
  rechtlicheSensibilität: boolean;
  maxLaenge: number;
  threadLaenge: number;
  claims?: string[];
}

export interface FactRow {
  behauptung: string;
  quelle: string;
  status: 'belegt' | 'offen' | 'widerlegt';
}

export interface TimelineEvent {
  datum: string;
  beschreibung: string;
  quelle?: string;
}

export interface InvestigateWarning {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  fix?: string;
}

export interface ResearchPlan {
  offeneFragen: string[];
  benoetigteDokumente: string[];
  moeglicheGespraechspartner: string[];
  ifgAnfrage?: string;
}

export interface XThreadPost {
  nummer: number;
  text: string;
  zeichen: number;
}

export interface XThreadResult {
  posts: XThreadPost[];
  hookAlternatives: string[];
  hashtags: string[];
  pinnedPost: string;
  consistencyCheck: { passed: boolean; issues: string[] };
}

export interface ArticleResult {
  headline: string;
  teaser: string;
  nutGraf: string;
  article: string;
  factTable: FactRow[];
  timeline: TimelineEvent[];
  openQuestions: string[];
  warnings: string[];
  rationale: string;
}

// Hilfsfunktionen
function belegt(quelle?: string): string {
  return quelle ? `[BELEGT: ${quelle}]` : '[BELEGT]';
}

function unbelegt(): string {
  return '[UNBESTÄTIGT]';
}

function einschaetzung(): string {
  return '[EINSCHÄTZUNG]';
}

function marker(text: string, quelle?: string): string {
  if (quelle) return `${text} ${belegt(quelle)}`;
  return `${text} ${unbelegt()}`;
}

// Artikel-Generator
export function generateArticle(input: InvestigateInput): ArticleResult {
  const warnings: string[] = [];
  const factTable: FactRow[] = [];
  const timeline: TimelineEvent[] = [];
  const openQuestions: string[] = [];

  // Headline generieren
  const headline = generateHeadline(input);
  
  // Teaser generieren
  const teaser = generateTeaser(input);
  
  // Nut-Graf generieren
  const nutGraf = generateNutGraf(input);

  // Hauptteil generieren
  const hauptteil = generateHauptteil(input, factTable, timeline, openQuestions, warnings);

  // Zusammenbauen
  const article = [
    `# ${headline}`,
    '',
    `> ${teaser}`,
    '',
    `**Warum das jetzt wichtig ist:** ${nutGraf}`,
    '',
    '## Hauptteil',
    '',
    hauptteil,
    '',
    '## Was offen bleibt',
    '',
    openQuestions.length > 0 
      ? openQuestions.map(q => `- ${q}`).join('\n')
      : '- Alle Fakten sind geprüft und bestätigt.',
    '',
    '---',
    `*Artikeltyp: ${input.artikelTyp} | Sprache: ${input.sprache} | Ton: ${input.ton}*`,
  ].join('\n');

  return {
    headline,
    teaser,
    nutGraf,
    article,
    factTable,
    timeline,
    openQuestions,
    warnings,
    rationale: generateRationale(input),
  };
}

function generateHeadline(input: InvestigateInput): string {
  // Sachliche Headline ohne Clickbait
  const typen: Record<ArticleType, string> = {
    'news-report': 'Bericht',
    'feature': 'Reportage',
    'investigation': 'Recherche',
    'fact-check': 'Faktenprüfung',
    'opinion': 'Meinung',
  };
  
  const typ = typen[input.artikelTyp];
  
  // Aus der These ableiten
  if (input.these.length > 10) {
    return `${typ}: ${input.these}`;
  }
  
  return `${typ}: ${input.titel}`;
}

function generateTeaser(input: InvestigateInput): string {
  // Wichtigste Information zuerst — mit Quellen-Markierung
  if (input.kernfakten.length > 0) {
    const fakt = input.kernfakten[0];
    const quelle = input.quellen.find(q => fakt.includes(q.label));
    return quelle ? `${fakt} [BELEGT: ${quelle.label}]` : fakt;
  }
  
  if (input.these) {
    return input.these;
  }
  
  return 'Eine Recherche zu den aktuellen Entwicklungen.';
}

function generateNutGraf(input: InvestigateInput): string {
  // Warum die Geschichte jetzt relevant ist
  if (input.offeneFragen.length > 0) {
    return `Offene Fragen erfordern eine schnelle Klärung: ${input.offeneFragen[0]}`;
  }
  
  return 'Die Entwicklungen haben unmittelbare Auswirkungen auf die öffentliche Debatte.';
}

function generateHauptteil(
  input: InvestigateInput,
  factTable: FactRow[],
  timeline: TimelineEvent[],
  openQuestions: string[],
  warnings: string[],
): string {
  const absätze: string[] = [];

  // Fakten chronologisch oder thematisch
  if (input.ereignisse.length > 0) {
    absätze.push('## Chronologie');
    input.ereignisse
      .sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime())
      .forEach((ereignis) => {
        const text = `${ereignis.datum}: ${ereignis.beschreibung}`;
        const markiert = marker(text, ereignis.quelle);
        absätze.push(markiert);
        
        timeline.push({
          datum: ereignis.datum,
          beschreibung: ereignis.beschreibung,
          quelle: ereignis.quelle,
        });
        
        factTable.push({
          behauptung: ereignis.beschreibung,
          quelle: ereignis.quelle || 'unbekannt',
          status: ereignis.quelle ? 'belegt' : 'offen',
        });
      });
    absätze.push('');
  }

  // Kernfakten
  if (input.kernfakten.length > 0) {
    absätze.push('## Kernfakten');
    input.kernfakten.forEach((fakt, index) => {
      // Wenn eine Quelle mit passendem Index existiert → belegt, sonst unbelegt
      const quelle = input.quellen[index] || input.quellen.find(q => fakt.includes(q.label));
      const markiert = marker(fakt, quelle?.label);
      absätze.push(`- ${markiert}`);
      
      factTable.push({
        behauptung: fakt,
        quelle: quelle?.label || 'unbekannt',
        status: quelle ? 'belegt' : 'offen',
      });
    });
    absätze.push('');
  }

  // Claims (unbelegte Behauptungen) — als solche markiert
  if (input.claims?.length) {
    absätze.push('## Behauptungen');
    input.claims.forEach((claim) => {
      const quelle = input.quellen.find(q => claim.includes(q.label) || q.label.includes(claim.slice(0, 30)));
      const markiert = quelle ? marker(claim, quelle.label) : `${claim} [UNBESTÄTIGT]`;
      absätze.push(`- ${markiert}`);
      factTable.push({
        behauptung: claim,
        quelle: quelle?.label || 'unbekannt',
        status: quelle ? 'belegt' : 'offen',
      });
    });
    absätze.push('');
  }

  // Akteure
  if (input.akteure.length > 0) {
    absätze.push('## Beteiligte');
    input.akteure.forEach((akteur) => {
      const text = `${akteur.name} (${akteur.rolle})`;
      const markiert = akteur.quelle 
        ? `${text} ${belegt(akteur.quelle)}`
        : `${text} ${unbelegt()}`;
      absätze.push(`- ${markiert}`);
    });
    absätze.push('');
  }

  // Offene Fragen
  if (input.offeneFragen.length > 0) {
    absätze.push('## Ungeklärt');
    input.offeneFragen.forEach((frage) => {
      absätze.push(`- ${frage} ${unbelegt()}`);
      openQuestions.push(frage);
    });
    absätze.push('');
  }

  // Rechtliche Warnungen
  if (input.rechtlicheSensibilität) {
    warnings.push('Rechtliche Sensibilität: Tatsachenbehauptungen über Personen erfordern besondere Sorgfalt');
    absätze.push(`> **Hinweis:** ${einschaetzung()} Dieser Artikel enthält potentiell rechtlich relevante Aussagen.`);
  }

  return absätze.join('\n');
}

function generateRationale(input: InvestigateInput): string {
  return `Artikel basiert auf ${input.quellen.length} Quellen und ${input.kernfakten.length} Kernfakten. Typ: ${input.artikelTyp}.`;
}

// X-Post-Generator
export function generateXThread(article: ArticleResult, options: { posts?: number } = {}): XThreadResult {
  const postCount = options.posts || 8;
  const posts: XThreadPost[] = [];

  // Hook-Post: stärkste belegte Aussage
  const hookPost = generateHookPost(article);
  posts.push({ nummer: 1, text: hookPost, zeichen: hookPost.length });

  // Fakten aus dem Artikel extrahieren
  const faktenAusArtikel = extractFakten(article.article);
  
  // Thread-Posts generieren
  for (let i = 2; i <= postCount - 1; i++) {
    const faktIndex = i - 2;
    if (faktIndex < faktenAusArtikel.length) {
      const text = faktenAusArtikel[faktIndex];
      if (text.length <= 280) {
        posts.push({ nummer: i, text, zeichen: text.length });
      } else {
        // Kürzen
        const gekürzt = text.substring(0, 277) + '...';
        posts.push({ nummer: i, text: gekürzt, zeichen: gekürzt.length });
      }
    }
  }

  // Letzter Post: Einordnung
  const letzterPost = `Mehr dazu in meinem Artikel. Quellen und Fakten: [Link] ${article.factTable.length} Quellen geprüft.`;
  posts.push({ nummer: postCount, text: letzterPost, zeichen: letzterPost.length });

  // Konsistenz-Check
  const consistencyCheck = checkConsistency(article, posts);

  return {
    posts,
    hookAlternatives: generateHookAlternatives(article),
    hashtags: generateHashtags(article),
    pinnedPost: generatePinnedPost(article),
    consistencyCheck: { passed: consistencyCheck.passed, issues: consistencyCheck.issues },
  };
}

function generateHookPost(article: ArticleResult): string {
  // Stärkste belegte Aussage
  const belegteFakten = article.factTable.filter(f => f.status === 'belegt');
  if (belegteFakten.length > 0) {
    const hook = belegteFakten[0].behauptung;
    if (hook.length <= 280) return hook;
    return hook.substring(0, 277) + '...';
  }
  
  return article.headline;
}

function extractFakten(articleText: string): string[] {
  // Fakten aus dem Artikel extrahieren
  const lines = articleText.split('\n');
  return lines
    .filter(line => line.includes('[BELEGT]') && line.length < 280)
    .map(line => line.replace(/\[BELEGT[^\]]*\]/g, '').trim())
    .filter(line => line.length > 20);
}

function checkConsistency(article: ArticleResult, posts: XThreadPost[]): { passed: boolean; issues: string[] } {
  const issues: string[] = [];
  const articleFakten = article.factTable.map(f => f.behauptung);
  
  posts.forEach(post => {
    // Prüfen ob Post-Fakten im Artikel stehen
    const postFakt = post.text;
    if (!articleFakten.some(f => f.includes(postFakt) || postFakt.includes(f))) {
      issues.push(`Post ${post.nummer}: Fakt nicht im Artikel gefunden`);
    }
  });
  
  return { passed: issues.length === 0, issues };
}

function generateHookAlternatives(article: ArticleResult): string[] {
  const alternatives: string[] = [];
  
  // Alternative 1: Frage
  if (article.openQuestions.length > 0) {
    alternatives.push(`Was wir noch nicht wissen: ${article.openQuestions[0]}`);
  }
  
  // Alternative 2: Zahl/Fakt
  const belegteFakten = article.factTable.filter(f => f.status === 'belegt');
  if (belegteFakten.length > 1) {
    alternatives.push(belegteFakten[1].behauptung);
  }
  
  // Alternative 3: Teaser
  alternatives.push(article.teaser);
  
  return alternatives.slice(0, 3);
}

function generateHashtags(article: ArticleResult): string[] {
  // Max. 3 Hashtags
  const hashtags: string[] = [];
  
  if (article.headline.toLowerCase().includes('recherche')) hashtags.push('#Recherche');
  if (article.factTable.length > 0) hashtags.push('#Fakten');
  if (article.openQuestions.length > 0) hashtags.push('#Investigativ');
  
  return hashtags.slice(0, 3);
}

function generatePinnedPost(article: ArticleResult): string {
  return `📌 ${article.headline}\n\n${article.teaser}`;
}

// Fact-Table bauen
export function buildFactTable(input: InvestigateInput): FactRow[] {
  const rows: FactRow[] = [];
  
  input.kernfakten.forEach(fakt => {
    const quelle = input.quellen.find(q => fakt.includes(q.label));
    rows.push({
      behauptung: fakt,
      quelle: quelle?.label || 'unbekannt',
      status: quelle ? 'belegt' : 'offen',
    });
  });
  
  return rows;
}

// Timeline bauen
export function buildTimeline(input: InvestigateInput): TimelineEvent[] {
  return input.ereignisse
    .sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime())
    .map(e => ({
      datum: e.datum,
      beschreibung: e.beschreibung,
      quelle: e.quelle,
    }));
}

// Artikel analysieren
export function analyzeArticle(article: ArticleResult): InvestigateWarning[] {
  const warnings: InvestigateWarning[] = [];
  
  // Clickbait-Check
  const clickbaitWörter = ['schockierend', 'bahnbrechend', 'game-changer', 'unglaublich', 'mega'];
  clickbaitWörter.forEach(wort => {
    if (article.article.toLowerCase().includes(wort)) {
      warnings.push({
        code: 'clickbait',
        severity: 'warning',
        message: `Clickbait-Formulierung gefunden: "${wort}"`,
        fix: 'Sachlichere Formulierung wählen',
      });
    }
  });
  
  // Unbelegte Superlative
  const superlative = ['der größte', 'die größte', 'am wichtigsten', 'einzigartig', 'unübertroffen'];
  superlative.forEach(sup => {
    if (article.article.toLowerCase().includes(sup) && !article.article.includes('[BELEGT')) {
      warnings.push({
        code: 'unbelegtes-superlativ',
        severity: 'warning',
        message: `Unbelegtes Superlativ: "${sup}"`,
        fix: 'Quelle nachweisen oder Superlativ entfernen',
      });
    }
  });
  
  // Single-Sourcing
  const zentraleBehauptungen = article.factTable.filter(f => f.status === 'belegt');
  const quellen = new Set(zentraleBehauptungen.map(f => f.quelle));
  if (zentraleBehauptungen.length > 1 && quellen.size === 1) {
    warnings.push({
      code: 'single-source',
      severity: 'error',
      message: 'Alle zentralen Behauptungen basieren auf einer einzigen Quelle',
      fix: 'Weitere unabhängige Quellen hinzufügen',
    });
  }
  
  // Rechtliche Warnungen
  if (article.article.includes('Tatsachenbehauptung') || article.article.includes('Personen')) {
    warnings.push({
      code: 'rechtlich',
      severity: 'warning',
      message: 'Mögliche Tatsachenbehauptung über Personen',
      fix: 'Quellen prüfen, Gegedarstellung einholen',
    });
  }
  
  return warnings;
}

// Recherche-Plan generieren
export function generateResearchPlan(input: InvestigateInput): ResearchPlan {
  return {
    offeneFragen: input.offeneFragen,
    benoetigteDokumente: [
      'Offizielle Dokumente',
      'Rechercheberichte',
      'Datenbank-Auszüge',
    ],
    moeglicheGespraechspartner: [
      'Betroffene',
      'Experten',
      'Behörden',
    ],
    ifgAnfrage: input.rechtlicheSensibilität 
      ? 'Entwurf für IFG-Anfrage erstellen' 
      : undefined,
  };
}
