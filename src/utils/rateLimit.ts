// Rate-Limiting: Token-Budget pro Minute für LLM-Calls.
// Verhindert API-Budget-Überschreitung und Missbrauch.

export interface RateLimitConfig {
  /** Maximale Tokens pro Minute */
  maxTokensPerMinute: number;
  /** Maximale Requests pro Minute */
  maxRequestsPerMinute: number;
}

export interface RateLimitStatus {
  allowed: boolean;
  tokensRemaining: number;
  requestsRemaining: number;
  resetAt: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxTokensPerMinute: 50_000,
  maxRequestsPerMinute: 10,
};

export class RateLimiter {
  private config: RateLimitConfig;
  private tokensUsed: number = 0;
  private requestsMade: number = 0;
  private windowStart: number = Date.now();

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private resetIfNeeded(): void {
    const now = Date.now();
    const elapsed = now - this.windowStart;
    if (elapsed >= 60_000) {
      this.tokensUsed = 0;
      this.requestsMade = 0;
      this.windowStart = now;
    }
  }

  /**
   * Prüft, ob ein Request erlaubt ist.
   * @param estimatedTokens Geschätzte Token-Anzahl für diesen Request
   */
  check(estimatedTokens: number = 0): RateLimitStatus {
    this.resetIfNeeded();
    const tokensRemaining = this.config.maxTokensPerMinute - this.tokensUsed;
    const requestsRemaining =
      this.config.maxRequestsPerMinute - this.requestsMade;
    const resetAt = this.windowStart + 60_000;

    if (estimatedTokens > tokensRemaining) {
      return {
        allowed: false,
        tokensRemaining,
        requestsRemaining,
        resetAt,
      };
    }
    if (requestsRemaining <= 0) {
      return {
        allowed: false,
        tokensRemaining,
        requestsRemaining,
        resetAt,
      };
    }
    return {
      allowed: true,
      tokensRemaining,
      requestsRemaining,
      resetAt,
    };
  }

  /**
   * Registriert einen durchgeführten Request.
   * Muss nach check() aufgerufen werden.
   */
  record(tokensUsed: number): void {
    this.resetIfNeeded();
    this.tokensUsed += tokensUsed;
    this.requestsMade += 1;
  }

  /**
   * Prüft und registriert in einem Schritt.
   * @returns true wenn erlaubt, false wenn blockiert
   */
  tryAcquire(estimatedTokens: number = 0): boolean {
    const status = this.check(estimatedTokens);
    if (status.allowed) {
      this.record(estimatedTokens);
      return true;
    }
    return false;
  }

  /** Setzt alle Zähler zurück */
  reset(): void {
    this.tokensUsed = 0;
    this.requestsMade = 0;
    this.windowStart = Date.now();
  }
}

// Globaler Rate-Limiter für LLM-Calls
export const llmRateLimiter = new RateLimiter();

/**
 * Token-Bucket Rate Limiter — für Tests und spezielle Use Cases.
 * Unterstützt variable Token-Kosten pro Request.
 */
export class TokenBucketRateLimit {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per second
  private lastRefill: number;

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const added = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + added);
    this.lastRefill = now;
  }

  tryConsume(tokens: number): boolean {
    this.refill();
    if (tokens > this.tokens) return false;
    this.tokens -= tokens;
    return true;
  }

  getTokensRemaining(): number {
    this.refill();
    return this.tokens;
  }

  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }
}
