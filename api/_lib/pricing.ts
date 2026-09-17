/**
 * Server-side copy of src/lib/pricing.ts (the cost arithmetic only).
 *
 * Vercel compiles the TypeScript under api/ and nothing else: a function that
 * imports ../src/... deploys, then dies at invocation with
 * FUNCTION_INVOCATION_FAILED. So the price table lives twice, and
 * src/lib/pricing.sync.test.ts fails the build if the two copies drift.
 */

export interface ModelPricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite5m: number;
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
  batch?: boolean;
  cacheTtl?: '5m' | '1h';
}

export function pricingFor(model: string): ModelPricing {
  const direct = MODEL_PRICING[model];
  if (direct) return direct;
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
