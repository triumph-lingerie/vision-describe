/**
 * Live smoke test: sends real requests to the Anthropic API with the models,
 * efforts and prompts the app uses. Skipped unless ANTHROPIC_API_KEY is set,
 * so `npm test` and CI stay offline. Costs a few cents per run.
 *
 *   ANTHROPIC_API_KEY=sk-ant-... npx vitest run src/lib/liveSmoke.test.ts
 *
 * Covers the three request shapes in the app: the EN master call, a
 * localisation call (both built by buildTextParams, which the live and the
 * batch paths share) and the server-side structured-output call.
 */
import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { callAnthropic } from '../../api/_lib/aiClients';
import {
  EN_MASTER_EFFORT,
  EN_MASTER_MODEL,
  LOCALISATION_EFFORT,
  LOCALISATION_MODEL,
} from '@/components/GenerateMode/generationConfig';
import {
  buildEnMasterGenerationPrompt,
  buildLocalisationPrompt,
  type MetadataInput,
} from '@/components/GenerateMode/prompts/metadataGenerationPrompt';
import { buildTextParams } from '@/components/GenerateMode/utils/visionApiUtils';
import { costFromUsage, formatUsd } from '@/lib/pricing';

const apiKey = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env
  .ANTHROPIC_API_KEY;

const PRODUCT: MetadataInput = {
  materialNumber: '10000000',
  productName: 'Amourette 300 WHP',
  brand: 'Triumph',
  productLine: 'Amourette',
  shortDescription: 'Wired padded bra with floral lace',
  seriesUsp: 'Timeless floral lace with a soft, comfortable feel',
  styleUsp: 'Half-cup padded bra with comfort wire for a rounded shape',
  styleDescription: 'Wired half-cup padded bra, adjustable straps, hook-and-eye closure, floral lace cups',
};

const TIMEOUT_MS = 300_000;

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

function report(label: string, message: Anthropic.Message, text: string): void {
  const u = message.usage;
  console.log(
    `\n[${label}] model=${message.model} stop_reason=${message.stop_reason}` +
      ` in=${u.input_tokens} out=${u.output_tokens}` +
      ` cache_write=${u.cache_creation_input_tokens ?? 0} cache_read=${u.cache_read_input_tokens ?? 0}` +
      ` cost=${formatUsd(costFromUsage(message.model, u, { cacheTtl: '1h' }))}\n${text}\n`
  );
}

describe.skipIf(!apiKey)('live smoke test against the Anthropic API', () => {
  const client = new Anthropic({ apiKey: apiKey ?? 'unset', maxRetries: 2 });
  let enMaster = '';

  it(
    `EN master on ${EN_MASTER_MODEL} (${EN_MASTER_EFFORT})`,
    async () => {
      const params = buildTextParams(buildEnMasterGenerationPrompt(PRODUCT), EN_MASTER_MODEL, {
        effort: EN_MASTER_EFFORT,
      });
      const message = await client.messages.create(params);
      enMaster = textOf(message);
      report('EN master', message, enMaster);
      expect(message.model.startsWith(EN_MASTER_MODEL)).toBe(true);
      expect(message.stop_reason).toBe('end_turn');
      expect(enMaster.length).toBeGreaterThan(150);
    },
    TIMEOUT_MS
  );

  it(
    `DE localisation on ${LOCALISATION_MODEL} (${LOCALISATION_EFFORT})`,
    async () => {
      expect(enMaster, 'needs the EN master from the previous test').not.toBe('');
      const params = buildTextParams(
        buildLocalisationPrompt(enMaster, 'de', 'German', PRODUCT),
        LOCALISATION_MODEL,
        { effort: LOCALISATION_EFFORT }
      );
      const message = await client.messages.create(params);
      const text = textOf(message);
      report('DE localisation', message, text);
      expect(message.model.startsWith(LOCALISATION_MODEL)).toBe(true);
      expect(message.stop_reason).toBe('end_turn');
      expect(text.length).toBeGreaterThan(150);
      expect(text).not.toBe(enMaster);
    },
    TIMEOUT_MS
  );

  it(
    `server-side structured output on ${EN_MASTER_MODEL}`,
    async () => {
      const schema = z.object({ title: z.string(), bullets: z.array(z.string()) });
      const res = await callAnthropic(
        apiKey ?? '',
        EN_MASTER_MODEL,
        'You write short e-commerce copy for a lingerie brand.',
        `Write a product title and exactly three short bullet points for: ${PRODUCT.styleDescription}.`,
        { outputSchema: schema, effort: 'low' }
      );
      console.log(
        `\n[structured output] stop_reason=${res.stopReason} in=${res.tokens.inputTokens}` +
          ` out=${res.tokens.outputTokens} cost=${formatUsd(res.costUsd)}\n${JSON.stringify(res.parsed, null, 2)}\n`
      );
      const parsed = schema.parse(res.parsed);
      expect(parsed.title.length).toBeGreaterThan(0);
      expect(parsed.bullets).toHaveLength(3);
    },
    TIMEOUT_MS
  );
});
