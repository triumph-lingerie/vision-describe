/**
 * Anthropic API list prices in USD per million tokens (MTok), and the cost
 * arithmetic every flow shares.
 *
 * Source: platform.claude.com/docs/en/about-claude/pricing, checked
 * 2026-09-17. Cache writes cost 1.25x the input price on the 5-minute TTL and
 * 2x on the 1-hour TTL; cache reads cost 0.1x the input price (Claude Fable
 * 5.1 reads at 0.25 USD/MTok, half of Opus 5's rate). The Batches API takes
 * 50% off every token type.
 *
 * api/_lib/pricing.ts is a copy for the server functions (Vercel compiles only
 * files under api/); src/lib/pricing.sync.test.ts keeps the two equal.
 */

export interface ModelPricing {
  /** Uncached input tokens. */
  input: number;
  /** Output tokens, thinking included. */
  output: number;
  /** Prompt-cache reads. */
  cacheRead: number;
  /** Prompt-cache writes, 5-minute TTL. */
  cacheWrite5m: number;
  /** Prompt-cache writes, 1-hour TTL. */
  cacheWrite1h: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10 },
  'claude-fable-5-1': { input: 10, output: 50, cacheRead: 0.25, cacheWrite5m: 12.5, cacheWrite1h: 20 },
  'claude-opus-4-8': { input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10 },
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite5m: 2.5, cacheWrite1h: 4 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1, cacheWrite5m: 1.25, cacheWrite1h: 2 },
};

/** Batches API discount on every token type. */
export const BATCH_DISCOUNT = 0.5;

/** The subset of the API's `usage` object the cost arithmetic reads. */
export interface UsageLike {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_creation?: {
    ephemeral_5m_input_tokens?: number | null;
    ephemeral_1h_input_tokens?: number | null;
  } | null;
}

export interface CostOptions {
  /** Request ran through the Batches API (50% off). */
  batch?: boolean;
  /**
   * TTL used for the cache writes when the usage object does not carry the
   * per-TTL breakdown. Defaults to 5m.
   */
  cacheTtl?: '5m' | '1h';
}

export function pricingFor(model: string): ModelPricing {
  const direct = MODEL_PRICING[model];
  if (direct) return direct;
  // Dated aliases such as claude-opus-5-20260401 share the base model's price.
  const base = Object.keys(MODEL_PRICING).find((id) => model.startsWith(id));
  return base ? MODEL_PRICING[base] : MODEL_PRICING['claude-opus-5'];
}

const n = (v: number | null | undefined): number => (typeof v === 'number' && v > 0 ? v : 0);

/** Cost in USD of one API response. */
export function costFromUsage(model: string, usage: UsageLike | null | undefined, opts: CostOptions = {}): number {
  if (!usage) return 0;
  const p = pricingFor(model);
  const write5m = usage.cache_creation
    ? n(usage.cache_creation.ephemeral_5m_input_tokens)
    : opts.cacheTtl === '1h'
      ? 0
      : n(usage.cache_creation_input_tokens);
  const write1h = usage.cache_creation
    ? n(usage.cache_creation.ephemeral_1h_input_tokens)
    : opts.cacheTtl === '1h'
      ? n(usage.cache_creation_input_tokens)
      : 0;
  const usd =
    (n(usage.input_tokens) * p.input +
      n(usage.output_tokens) * p.output +
      n(usage.cache_read_input_tokens) * p.cacheRead +
      write5m * p.cacheWrite5m +
      write1h * p.cacheWrite1h) /
    1_000_000;
  return opts.batch ? usd * BATCH_DISCOUNT : usd;
}

export interface UsageTotals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
}

export function emptyTotals(): UsageTotals {
  return { calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 };
}

/** Adds one response to a running total (mutates and returns `totals`). */
export function addUsage(
  totals: UsageTotals,
  model: string,
  usage: UsageLike | null | undefined,
  opts: CostOptions = {}
): UsageTotals {
  if (!usage) return totals;
  totals.calls += 1;
  totals.inputTokens += n(usage.input_tokens);
  totals.outputTokens += n(usage.output_tokens);
  totals.cacheReadTokens += n(usage.cache_read_input_tokens);
  totals.cacheWriteTokens += n(usage.cache_creation_input_tokens);
  totals.costUsd += costFromUsage(model, usage, opts);
  return totals;
}

/** "0.0123" -> "0.01 USD"; sub-cent amounts keep four decimals. */
export function formatUsd(usd: number): string {
  if (!Number.isFinite(usd)) return '-';
  const digits = usd > 0 && usd < 0.01 ? 4 : 2;
  return `${usd.toFixed(digits)} USD`;
}

/**
 * Average output tokens per generated description, thinking included,
 * measured on the sloggi CH60 batch (2026-09-02, Opus 5 at high effort).
 * Used only for pre-run estimates.
 */
export const OBSERVED_OUTPUT_TOKENS = {
  /** EN master or EN rewrite at high effort. */
  enMasterHigh: 900,
  /** One localisation at medium effort (EN master already written). */
  localisationMedium: 550,
  /** One localisation at high effort. */
  localisationHigh: 700,
} as const;
