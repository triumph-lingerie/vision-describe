import { describe, expect, it } from 'vitest';
import * as client from './pricing';
import * as server from '../../api/_lib/pricing';

// api/_lib/pricing.ts is a copy: Vercel compiles only the files under api/,
// so the server functions cannot import this module. Keep the copies equal.
describe('server copy of the price table', () => {
  it('matches the client table', () => {
    expect(server.MODEL_PRICING).toEqual(client.MODEL_PRICING);
    expect(server.BATCH_DISCOUNT).toBe(client.BATCH_DISCOUNT);
  });

  it('computes the same cost', () => {
    const usage = {
      input_tokens: 315_293,
      cache_read_input_tokens: 2_241_000,
      cache_creation_input_tokens: 10_000,
      output_tokens: 315_132,
    };
    for (const batch of [false, true]) {
      expect(server.costFromUsage('claude-opus-5', usage, { batch, cacheTtl: '1h' })).toBeCloseTo(
        client.costFromUsage('claude-opus-5', usage, { batch, cacheTtl: '1h' }),
        9
      );
    }
  });
});
