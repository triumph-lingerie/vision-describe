/**
 * Claude API utilities for the Generate flows (Image Analysis, Metadata
 * Generation, CSV Translation).
 *
 * Every text call sends the stable instruction block as a cached system
 * prefix. The metadata flows use the 1-hour cache TTL because a batch of 250+
 * calls runs longer than the default 5 minutes.
 *
 * Model and effort per route live in ../generationConfig.ts. Sampling
 * parameters (temperature, top_p, top_k) are not sent: Opus 5 rejects them.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { VisionApiResponse, ImageFile, CachedPromptInput } from '../types';
import { isQuotaError, emitQuotaExhausted } from '@/lib/api/anthropicErrors';
import { costFromUsage } from '@/lib/pricing';
import {
  type Effort,
  EN_MASTER_MODEL,
  GENERATION_MAX_TOKENS,
  IMAGE_ANALYSIS_EFFORT,
  SYSTEM_CACHE_TTL,
} from '../generationConfig';

/**
 * Wrap a Claude SDK promise so a "tokens finished" failure (credit balance too
 * low, or a rate limit) raises the app-wide quota signal that opens the
 * reload-and-resume dialog. The error is still rethrown so callers keep their
 * existing handling.
 */
function withQuotaDetection<T>(p: Promise<T>): Promise<T> {
  return p.catch((err) => {
    if (isQuotaError(err)) emitQuotaExhausted();
    throw err;
  });
}

function browserClient(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    // Long batches hit transient 429s and 5xx; four retries with the SDK's
    // backoff clear most of them before the quota dialog has to appear.
    maxRetries: 4,
  });
}

/**
 * Turn a response with no usable text into an error that says why.
 *
 * Opus 5 can end a turn with stop_reason 'refusal' (HTTP 200, a stop_details
 * category, and no text block). Without this, a declined SKU surfaced as the
 * generic "No valid text content" and looked like a parsing bug, easy to miss
 * in a batch of several hundred calls. 'max_tokens' gets the same treatment,
 * since a truncated description is also worth naming.
 */
function describeEmptyResponse(response: Anthropic.Message): string {
  const stopReason = response.stop_reason;

  if (stopReason === 'refusal') {
    const category = response.stop_details?.category;
    return `Claude declined this request${category ? ` (${category})` : ''}. The source copy or product data likely tripped a safety classifier. Check the input for this SKU.`;
  }

  if (stopReason === 'max_tokens') {
    return 'Response hit the max_tokens ceiling before producing any text. Raise max_tokens or shorten the input.';
  }

  return `No valid text content in Claude response${stopReason ? ` (stop_reason: ${stopReason})` : ''}`;
}

/**
 * Type guard: narrows the union returned by prompt builders. Old builders
 * returned plain strings; new ones return {system, user}.
 */
export function isCachedPrompt(value: unknown): value is CachedPromptInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as CachedPromptInput).system === 'string' &&
    typeof (value as CachedPromptInput).user === 'string'
  );
}

function toVisionApiResponse(
  response: Anthropic.Message,
  model: string,
  cacheTtl: '5m' | '1h'
): VisionApiResponse {
  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  );

  if (!textBlock || !textBlock.text.trim()) {
    throw new Error(describeEmptyResponse(response));
  }

  const usage = response.usage;
  return {
    content: textBlock.text.trim(),
    model: response.model || model,
    stopReason: response.stop_reason,
    tokens: {
      inputTokens: usage?.input_tokens ?? 0,
      outputTokens: usage?.output_tokens ?? 0,
      cacheCreationTokens: usage?.cache_creation_input_tokens ?? 0,
      cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
    },
    costUsd: costFromUsage(model, usage, { cacheTtl }),
  };
}

export interface TextCallOptions {
  /** Adaptive-thinking effort for this route. Defaults to the API default, high. */
  effort?: Effort;
  maxTokens?: number;
  /** TTL for the cached system block. Defaults to the flow-wide setting. */
  cacheTtl?: '5m' | '1h';
}

/**
 * Request parameters for a text-only generation call. Shared with the batch
 * submission path so a live call and a batched one are the same request.
 */
export function buildTextParams(
  prompt: string | CachedPromptInput,
  model: string,
  options: TextCallOptions = {}
): Anthropic.MessageCreateParamsNonStreaming {
  const cacheTtl = options.cacheTtl ?? SYSTEM_CACHE_TTL;
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: options.maxTokens ?? GENERATION_MAX_TOKENS,
    thinking: { type: 'adaptive' },
    output_config: { effort: options.effort ?? 'high' },
    messages: [{ role: 'user', content: isCachedPrompt(prompt) ? prompt.user : prompt }],
  };
  if (isCachedPrompt(prompt)) {
    params.system = [
      {
        type: 'text',
        text: prompt.system,
        cache_control: { type: 'ephemeral', ttl: cacheTtl },
      },
    ];
  }
  return params;
}

/**
 * Call Claude with vision (images + text prompt). The instruction text is
 * sent as a cached prefix so repeated analyses with the same settings re-read
 * it at a tenth of the input price; the images vary and follow.
 */
export async function analyzeWithClaude(
  prompt: string,
  images: ImageFile[],
  apiKey: string,
  model: string = EN_MASTER_MODEL,
  options: TextCallOptions = {}
): Promise<VisionApiResponse> {
  const client = browserClient(apiKey);

  const imageContent: Anthropic.ImageBlockParam[] = images.map((img) => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: img.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
      data: img.base64,
    },
  }));

  const cacheTtl = options.cacheTtl ?? '5m';
  const response = await withQuotaDetection(
    client.messages.create({
      model,
      max_tokens: options.maxTokens ?? 8192,
      thinking: { type: 'adaptive' },
      output_config: { effort: options.effort ?? IMAGE_ANALYSIS_EFFORT },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt, cache_control: { type: 'ephemeral', ttl: cacheTtl } },
            ...imageContent,
          ],
        },
      ],
    })
  );

  return toVisionApiResponse(response, model, cacheTtl);
}

/**
 * Call Claude for text-only generation, rewriting or localisation.
 *
 * `prompt` accepts a plain string (single user message, no caching, kept for
 * older callers) or a `CachedPromptInput` ({system, user}) whose system block
 * is cached for every later call in the batch.
 */
export async function translateWithClaude(
  prompt: string | CachedPromptInput,
  apiKey: string,
  model: string = EN_MASTER_MODEL,
  signal?: AbortSignal,
  options: TextCallOptions = {}
): Promise<VisionApiResponse> {
  const client = browserClient(apiKey);
  const params = buildTextParams(prompt, model, options);
  const response = await withQuotaDetection(
    client.messages.create(params, signal ? { signal } : undefined)
  );
  return toVisionApiResponse(response, model, options.cacheTtl ?? SYSTEM_CACHE_TTL);
}

/**
 * Exact input-token count of a prompt, from the API's own tokenizer. Used for
 * the pre-run cost estimate: one count per distinct prompt shape is enough,
 * the products in a batch differ by a few dozen tokens each.
 */
export async function countPromptTokens(
  prompt: string | CachedPromptInput,
  apiKey: string,
  model: string = EN_MASTER_MODEL
): Promise<{ systemTokens: number; userTokens: number }> {
  const client = browserClient(apiKey);
  if (isCachedPrompt(prompt)) {
    const [whole, userOnly] = await Promise.all([
      client.messages.countTokens({
        model,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
      }),
      client.messages.countTokens({
        model,
        messages: [{ role: 'user', content: prompt.user }],
      }),
    ]);
    return {
      systemTokens: Math.max(0, whole.input_tokens - userOnly.input_tokens),
      userTokens: userOnly.input_tokens,
    };
  }
  const count = await client.messages.countTokens({
    model,
    messages: [{ role: 'user', content: prompt }],
  });
  return { systemTokens: 0, userTokens: count.input_tokens };
}
