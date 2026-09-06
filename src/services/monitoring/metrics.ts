// Metrics: Erfasse Token-Verbrauch, Generierungszeit, Erfolgsquote.
// Exportiere als CSV für Analyse.

export interface GenerationMetric {
  timestamp: number;
  bookId: string;
  chapterCount: number;
  totalTokens: number;
  durationMs: number;
  success: boolean;
  provider: string;
  model: string;
}

export interface MetricsReport {
  totalGenerations: number;
  successfulGenerations: number;
  failedGenerations: number;
  avgDurationMs: number;
  totalTokens: number;
  byProvider: Record<string, { count: number; tokens: number; avgMs: number }>;
}

const metrics: GenerationMetric[] = [];

/**
 * Erfasst eine Generierung.
 */
export function recordGeneration(metric: GenerationMetric): void {
  metrics.push(metric);
}

/**
 * Liefert einen Metrics-Report.
 */
export function getMetricsReport(): MetricsReport {
  const total = metrics.length;
  const successful = metrics.filter((m) => m.success).length;
  const failed = total - successful;
  const totalDuration = metrics.reduce((sum, m) => sum + m.durationMs, 0);
  const totalTokens = metrics.reduce((sum, m) => sum + m.totalTokens, 0);
  const byProvider: Record<string, { count: number; tokens: number; totalMs: number }> = {};
  for (const m of metrics) {
    if (!byProvider[m.provider]) {
      byProvider[m.provider] = { count: 0, tokens: 0, totalMs: 0 };
    }
    byProvider[m.provider].count += 1;
    byProvider[m.provider].tokens += m.totalTokens;
    byProvider[m.provider].totalMs += m.durationMs;
  }
  const byProviderResult: Record<
    string,
    { count: number; tokens: number; avgMs: number }
  > = {};
  for (const [provider, data] of Object.entries(byProvider)) {
    byProviderResult[provider] = {
      count: data.count,
      tokens: data.tokens,
      avgMs: data.count > 0 ? Math.round(data.totalMs / data.count) : 0,
    };
  }
  return {
    totalGenerations: total,
    successfulGenerations: successful,
    failedGenerations: failed,
    avgDurationMs: total > 0 ? Math.round(totalDuration / total) : 0,
    totalTokens,
    byProvider: byProviderResult,
  };
}

/**
 * Exportiert alle Metriken als CSV.
 */
export function exportCsv(): string {
  const header = "timestamp,bookId,chapterCount,totalTokens,durationMs,success,provider,model";
  const rows = metrics.map((m) =>
    [m.timestamp, m.bookId, m.chapterCount, m.totalTokens, m.durationMs, m.success, m.provider, m.model].join(",")
  );
  return [header, ...rows].join("\n");
}

/**
 * Setzt alle Metriken zurück.
 */
export function clearMetrics(): void {
  metrics.length = 0;
}
