/**
 * Server-side Anthropic Claude client wrapper.
 * No browser dependencies (no toast, no dangerouslyAllowBrowser).
 *
 * Adaptive thinking with a per-call effort (default high), prompt caching on
 * the system block, optional structured output through a zod schema, and the
 * list-price cost of every call so the run totals stop reading zero.
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod/v4';
import { costFromUsage } from './pricing';

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface AiResponse<T = unknown> {
  content: string;
  /** Present when `outputSchema` was given and the response validated. */
  parsed?: T;
  stopReason: string | null;
  tokens: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  };
  /** List-price cost in USD, cache rates included. */
  costUsd: number;
}

export interface AiCallOptions<T = unknown> {
  effort?: Effort;
  maxTokens?: number;
  cacheTtl?: '5m' | '1h';
  /**
   * When set, the API constrains the response to this schema (structured
   * outputs) and `parsed` carries the validated object. Prefer this over
   * "return JSON only" prompt instructions plus regex parsing.
   */
  outputSchema?: z.ZodType<T>;
}

function describeEmpty(response: Anthropic.Message, modelId: string): string {
  const stopReason = response.stop_reason;
  const category = response.stop_details?.category;
  if (stopReason === 'refusal') {
    return `Claude declined this request${category ? ` (${category})` : ''} for model ${modelId}`;
  }
  if (stopReason === 'max_tokens') {
    return `Response hit the max_tokens ceiling before producing text for model ${modelId}`;
  }
  return `No text content in Anthropic response${stopReason ? ` (stop_reason: ${stopReason})` : ''} for model ${modelId}`;
}

/**
 * Call Anthropic Claude API (server-side).
 */
export async function callAnthropic<T = unknown>(
  apiKey: string,
  modelId: string,
  systemPrompt: string,
  userPrompt: string,
  options: AiCallOptions<T> = {}
): Promise<AiResponse<T>> {
  const client = new Anthropic({ apiKey, maxRetries: 4 });
  const cacheTtl = options.cacheTtl ?? '5m';

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: modelId,
    max_tokens: options.maxTokens ?? 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: options.effort ?? 'high' },
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral', ttl: cacheTtl },
      },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  };

  let response: Anthropic.Message;
  let parsed: T | undefined;

  if (options.outputSchema) {
    const parsedResponse = await client.messages.parse({
      ...params,
      output_config: {
        effort: options.effort ?? 'high',
        format: zodOutputFormat(options.outputSchema),
      },
    });
    response = parsedResponse;
    parsed = (parsedResponse.parsed_output ?? undefined) as T | undefined;
  } else {
    response = await client.messages.create(params);
  }

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  );
  if (!textBlock) {
    throw new Error(describeEmpty(response, modelId));
  }

  const usage = response.usage;
  return {
    content: textBlock.text.trim(),
    parsed,
    stopReason: response.stop_reason,
    tokens: {
      inputTokens: usage?.input_tokens ?? 0,
      outputTokens: usage?.output_tokens ?? 0,
      cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
      cacheCreationTokens: usage?.cache_creation_input_tokens ?? 0,
    },
    costUsd: costFromUsage(modelId, usage, { cacheTtl }),
  };
}

/**
 * Unified AI call dispatcher. The app is Anthropic-only.
 */
export async function callAI<T = unknown>(
  apiKey: string,
  modelId: string,
  systemPrompt: string,
  userPrompt: string,
  options: AiCallOptions<T> = {}
): Promise<AiResponse<T>> {
  return callAnthropic(apiKey, modelId, systemPrompt, userPrompt, options);
}
