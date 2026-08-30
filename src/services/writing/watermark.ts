// Statistischer Wasserzeichen-Entferner
// Port von claude-text-washer/stat_engine.py → TypeScript

export interface WatermarkReport {
  perplexity: number;
  burstiness: number;
  ngramBias: number;
  greenListRatio: number;
  sentenceEntropy: number;
  wordEntropy: number;
  typeTokenRatio: number;
  zipfCoefficient: number;
  hapaxRatio: number;
  aiScore: number; // 0-100, höher = wahrscheinlicher KI
  details: {
    tokenCount: number;
    sentenceCount: number;
    avgSentenceLength?: number;
    topBigrams?: Record<string, number>;
    topTrigrams?: Record<string, number>;
    note?: string;
    error?: string;
  };
}

// Stopwords für Englisch und Deutsch
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
  'used',
  'der', 'die', 'das', 'ein', 'eine', 'und', 'oder', 'aber', 'auf', 'zu',
  'für', 'von', 'mit', 'bei', 'aus', 'als', 'ist', 'war', 'sind', 'waren',
  'sein', 'haben', 'hat', 'hatte', 'wird', 'würde', 'kann',
]);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/\b\w+\b/g) || []);
}

export function sentenceSplit(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

export function calculateEntropy(tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const t of tokens) {
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  const total = tokens.length;
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / total;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

export function calculateTypeTokenRatio(tokens: string[], counts?: Map<string, number>): number {
  if (tokens.length === 0) return 0;
  if (counts) return counts.size / tokens.length;
  return new Set(tokens).size / tokens.length;
}

export function calculateZipfCoefficient(tokens: string[], counts?: Map<string, number>): number {
  if (tokens.length < 10) return 0;
  if (!counts) {
    counts = new Map();
    for (const t of tokens) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  const sortedFreq = Array.from(counts.values()).sort((a, b) => b - a).slice(0, 50);
  if (sortedFreq.length < 5) return 0;

  const logRanks = sortedFreq.map((_, i) => Math.log(i + 1));
  const logFreqs = sortedFreq.map(f => Math.log(f));
  const n = logRanks.length;

  const sumX = logRanks.reduce((a, b) => a + b, 0);
  const sumY = logFreqs.reduce((a, b) => a + b, 0);
  const sumXY = logRanks.reduce((acc, x, i) => acc + x * logFreqs[i], 0);
  const sumX2 = logRanks.reduce((acc, x) => acc + x * x, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  const slope = (n * sumXY - sumX * sumY) / denom;
  return -slope;
}

export function calculateHapaxRatio(tokens: string[], counts?: Map<string, number>): number {
  if (tokens.length === 0) return 0;
  if (!counts) {
    counts = new Map();
    for (const t of tokens) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  let hapax = 0;
  for (const c of counts.values()) {
    if (c === 1) hapax++;
  }
  return counts.size > 0 ? hapax / counts.size : 0;
}

export function calculatePerplexity(tokens: string[]): number {
  return 2 ** calculateEntropy(tokens);
}

export function calculateBurstiness(sentences: string[]): number {
  if (sentences.length < 2) return 0;
  const lengths = sentences.map(s => s.split(/\s+/).length);
  const meanLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((acc, l) => acc + (l - meanLen) ** 2, 0) / lengths.length;
  return meanLen > 0 ? Math.sqrt(variance) / meanLen : 0;
}

export function analyzeNgrams(tokens: string[], n: number): Record<string, number> {
  if (tokens.length < n) return {};
  const ngrams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(' '));
  }
  const counts = new Map<string, number>();
  for (const ng of ngrams) {
    counts.set(ng, (counts.get(ng) || 0) + 1);
  }
  const total = ngrams.length;
  const result: Record<string, number> = {};
  for (const [ng, count] of counts.entries()) {
    result[ng] = count / total;
  }
  // Nur Top 20
  return Object.fromEntries(
    Object.entries(result).sort((a, b) => b[1] - a[1]).slice(0, 20)
  );
}

export function detectGreenListBias(tokens: string[], counts?: Map<string, number>): number {
  if (tokens.length === 0) return 0;
  let stopCount = 0;
  if (counts) {
    for (const [t, c] of counts.entries()) {
      if (STOPWORDS.has(t)) stopCount += c;
    }
  } else {
    for (const t of tokens) {
      if (STOPWORDS.has(t)) stopCount++;
    }
  }
  return stopCount / tokens.length;
}

export function calculateSentenceEntropy(sentences: string[]): number {
  if (sentences.length < 2) return 0;
  const categories = sentences.map(s => {
    const wc = s.split(/\s+/).length;
    if (wc < 8) return 'short';
    if (wc < 20) return 'medium';
    return 'long';
  });
  const counts = new Map<string, number>();
  for (const c of categories) {
    counts.set(c, (counts.get(c) || 0) + 1);
  }
  const total = categories.length;
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / total;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

function calcAiScore(p: {
  burstiness: number;
  wordEntropy: number;
  sentenceEntropy: number;
  greenListRatio: number;
  ngramBias: number;
  typeTokenRatio: number;
  hapaxRatio: number;
  zipfCoefficient: number;
}): number {
  let score = 0;
  if (p.burstiness < 0.3) score += 20;
  if (p.wordEntropy < 6.0) score += 20;
  if (p.sentenceEntropy < 0.8) score += 15;
  if (p.greenListRatio > 0.4) score += 10;
  if (p.ngramBias > 0.05) score += 10;
  if (p.typeTokenRatio < 0.4) score += 10;
  if (p.hapaxRatio < 0.3) score += 10;
  if (p.zipfCoefficient < 0.5) score += 5;
  return score;
}

export function analyzeText(text: string): WatermarkReport {
  const tokens = tokenize(text);
  const sentences = sentenceSplit(text);
  const tokenCount = tokens.length;

  if (tokens.length === 0 || sentences.length === 0) {
    return {
      perplexity: 0, burstiness: 0, ngramBias: 0,
      greenListRatio: 0, sentenceEntropy: 0, wordEntropy: 0,
      typeTokenRatio: 0, zipfCoefficient: 0, hapaxRatio: 0,
      aiScore: 0, details: { tokenCount: 0, sentenceCount: 0, error: 'empty text' }
    };
  }

  const counts = new Map<string, number>();
  for (const t of tokens) {
    counts.set(t, (counts.get(t) || 0) + 1);
  }

  if (tokenCount < 20) {
    const wordEntropy = calculateEntropy(tokens);
    const sentenceEntropy = calculateSentenceEntropy(sentences);
    const burstiness = calculateBurstiness(sentences);
    return {
      perplexity: 2 ** wordEntropy,
      burstiness,
      ngramBias: 0,
      greenListRatio: detectGreenListBias(tokens, counts),
      sentenceEntropy,
      wordEntropy,
      typeTokenRatio: calculateTypeTokenRatio(tokens, counts),
      zipfCoefficient: 0,
      hapaxRatio: calculateHapaxRatio(tokens, counts),
      aiScore: Math.min(calcAiScore({
        burstiness,
        wordEntropy,
        sentenceEntropy,
        greenListRatio: detectGreenListBias(tokens, counts),
        ngramBias: 0,
        typeTokenRatio: calculateTypeTokenRatio(tokens, counts),
        hapaxRatio: calculateHapaxRatio(tokens, counts),
        zipfCoefficient: 0,
      }), 100),
      details: {
        tokenCount,
        sentenceCount: sentences.length,
        note: 'short text — zipf/ngram skipped',
      }
    };
  }

  const wordEntropy = calculateEntropy(tokens);
  const sentenceEntropy = calculateSentenceEntropy(sentences);
  const burstiness = calculateBurstiness(sentences);
  const greenListRatio = detectGreenListBias(tokens, counts);
  const typeTokenRatio = calculateTypeTokenRatio(tokens, counts);
  const zipfCoefficient = calculateZipfCoefficient(tokens, counts);
  const hapaxRatio = calculateHapaxRatio(tokens, counts);

  const bigrams = analyzeNgrams(tokens, 2);
  const trigrams = analyzeNgrams(tokens, 3);
  const ngramBias = Math.max(...Object.values(bigrams), 0);

  const aiScore = calcAiScore({
    burstiness,
    wordEntropy,
    sentenceEntropy,
    greenListRatio,
    ngramBias,
    typeTokenRatio,
    hapaxRatio,
    zipfCoefficient,
  });

  return {
    perplexity: 2 ** wordEntropy,
    burstiness,
    ngramBias,
    greenListRatio,
    sentenceEntropy,
    wordEntropy,
    typeTokenRatio,
    zipfCoefficient,
    hapaxRatio,
    aiScore: Math.min(aiScore, 100),
    details: {
      tokenCount,
      sentenceCount: sentences.length,
      avgSentenceLength: sentences.reduce((a, s) => a + s.split(/\s+/).length, 0) / sentences.length,
      topBigrams: Object.fromEntries(Object.entries(bigrams).slice(0, 5)),
      topTrigrams: Object.fromEntries(Object.entries(trigrams).slice(0, 5)),
    }
  };
}

// Anti-Wasserzeichen-Prompt generieren
export function generateAntiWatermarkPrompt(text: string, report: WatermarkReport): string {
  const strategies: string[] = [];

  if (report.burstiness < 0.3) {
    strategies.push('Vary sentence length dramatically: mix 3-word punches with 25-word flowing sentences.');
  }
  if (report.wordEntropy < 6.0) {
    strategies.push('Use rare, specific vocabulary. Avoid predictable word pairs.');
  }
  if (report.sentenceEntropy < 0.8) {
    strategies.push('Break structural patterns: alternate between statements, questions, and fragments.');
  }
  if (report.greenListRatio > 0.4) {
    strategies.push('Reduce common function words. Use more nouns and verbs.');
  }
  if (report.ngramBias > 0.05) {
    strategies.push('Avoid repetitive word sequences. Introduce unexpected transitions.');
  }
  if (strategies.length === 0) {
    strategies.push('Text appears natural. Maintain current style with minor variations.');
  }

  return `Rewrite the following text to eliminate statistical AI markers while preserving meaning.

Anti-watermark strategies to apply:
${strategies.map(s => `- ${s}`).join('\n')}

Additional rules:
- Break any rhythmic patterns in sentence structure
- Replace common word pairs with unexpected alternatives
- Introduce controlled "noise" through varied punctuation
- Maintain factual accuracy and original claims
- Output ONLY the rewritten text, no explanations

Original text:
${text}`;
}

// Invisible Unicode-Zeichen entfernen
export function stripInvisibleUnicode(text: string): string {
  // U+200A (Hair Space) ×10, U+202F (Narrow No-Break Space) ×18 etc.
  return text.replace(/[\u200A\u202F\u2009\u2006\u2008\u2004\u2005\u2002\u2003\u00A0]+/g, ' ');
}

// Formatierung für Ausgabe
export function formatReport(report: WatermarkReport): string {
  return [
    `AI Score:      ${report.aiScore.toFixed(1)}/100`,
    `Perplexity:    ${report.perplexity.toFixed(2)}`,
    `Burstiness:    ${report.burstiness.toFixed(3)}`,
    `Word Entropy:  ${report.wordEntropy.toFixed(3)}`,
    `Sent. Entropy: ${report.sentenceEntropy.toFixed(3)}`,
    `Green-list:    ${report.greenListRatio.toFixed(3)}`,
    `N-gram bias:   ${report.ngramBias.toFixed(4)}`,
    `TTR:           ${report.typeTokenRatio.toFixed(3)}`,
    `Zipf coeff:    ${report.zipfCoefficient.toFixed(3)}`,
    `Hapax ratio:   ${report.hapaxRatio.toFixed(3)}`,
  ].join('\n');
}
