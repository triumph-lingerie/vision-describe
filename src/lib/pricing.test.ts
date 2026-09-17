import { describe, expect, it } from 'vitest';
import { addUsage, costFromUsage, emptyTotals, formatUsd, pricingFor } from './pricing';

describe('pricing', () => {
  it('prices uncached input and output at list price', () => {
    const usd = costFromUsage('claude-opus-5', { input_tokens: 1_000_000, output_tokens: 1_000_000 });
    expect(usd).toBeCloseTo(5 + 25, 6);
  });

  it('prices cache reads at a tenth of input and 1h writes at twice input', () => {
    const reads = costFromUsage('claude-opus-5', { cache_read_input_tokens: 1_000_000 });
    expect(reads).toBeCloseTo(0.5, 6);
    const writes1h = costFromUsage(
      'claude-opus-5',
      { cache_creation_input_tokens: 1_000_000 },
      { cacheTtl: '1h' }
    );
    expect(writes1h).toBeCloseTo(10, 6);
    const writes5m = costFromUsage('claude-opus-5', { cache_creation_input_tokens: 1_000_000 });
    expect(writes5m).toBeCloseTo(6.25, 6);
  });

  it('prefers the per-TTL cache breakdown when the API returns it', () => {
    const usd = costFromUsage('claude-opus-5', {
      cache_creation_input_tokens: 2_000_000,
      cache_creation: { ephemeral_5m_input_tokens: 1_000_000, ephemeral_1h_input_tokens: 1_000_000 },
    });
    expect(usd).toBeCloseTo(6.25 + 10, 6);
  });

  it('halves everything on the Batches API', () => {
    const live = costFromUsage('claude-opus-5', { input_tokens: 500_000, output_tokens: 100_000 });
    const batch = costFromUsage('claude-opus-5', { input_tokens: 500_000, output_tokens: 100_000 }, { batch: true });
    expect(batch).toBeCloseTo(live / 2, 9);
  });

  it('reproduces the CH60 run within a few percent', () => {
    // 2026-09-02, vision-describe key: 315k uncached in, 2.24M cache read,
    // 315k out, 1h cache writes; Console cost report said 10.68 USD.
    const usd = costFromUsage(
      'claude-opus-5',
      {
        input_tokens: 315_293,
        cache_read_input_tokens: 2_241_000,
        cache_creation_input_tokens: 10_000,
        output_tokens: 315_132,
      },
      { cacheTtl: '1h' }
    );
    expect(usd).toBeGreaterThan(10.3);
    expect(usd).toBeLessThan(11.0);
  });

  it('falls back to the base model price for dated aliases and unknown ids', () => {
    expect(pricingFor('claude-opus-5-20260401')).toEqual(pricingFor('claude-opus-5'));
    expect(pricingFor('claude-fable-5-1').input).toBe(10);
    expect(pricingFor('something-else')).toEqual(pricingFor('claude-opus-5'));
  });

  it('accumulates totals across calls', () => {
    const t = emptyTotals();
    addUsage(t, 'claude-opus-5', { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 1000 });
    addUsage(t, 'claude-opus-5', { input_tokens: 100, output_tokens: 10, cache_creation_input_tokens: 500 });
    expect(t.calls).toBe(2);
    expect(t.inputTokens).toBe(200);
    expect(t.outputTokens).toBe(20);
    expect(t.cacheReadTokens).toBe(1000);
    expect(t.cacheWriteTokens).toBe(500);
    expect(t.costUsd).toBeGreaterThan(0);
  });

  it('formats sub-cent amounts with four decimals', () => {
    expect(formatUsd(0.0042)).toBe('0.0042 USD');
    expect(formatUsd(10.684)).toBe('10.68 USD');
    expect(formatUsd(0)).toBe('0.00 USD');
  });
});
