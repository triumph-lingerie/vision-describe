/**
 * Claude API integration for Optimize mode (client-side, official SDK).
 *
 * Claude Opus 5 configuration:
 * - Adaptive thinking at high effort (quality-sensitive copy)
 * - Prompt caching on the system block
 * - The SDK retries 429s and 5xx with backoff; a wall-clock timeout guards
 *   against a call that never returns (adaptive thinking can take ~120s on
 *   complex rows)
 */
import Anthropic from '@anthropic-ai/sdk';
import { claudeSystemPrompt } from './prompts/systemPrompt';
import { toast } from '@/hooks/use-toast';
import { isQuotaError, emitQuotaExhausted } from '@/lib/api/anthropicErrors';
import { costFromUsage } from '@/lib/pricing';

export interface ClaudeResponse {
  content: string;
  tokens: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
  };
  costUsd?: number;
}

export interface ClaudeRequestOptions {
  maxTokens?: number;
  timeoutMs?: number;
  retryAttempts?: number;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
}

const DEFAULT_MODEL = 'claude-opus-5';

/**
 * Optimizes text using the Anthropic Claude API via the official SDK.
 */
export const optimizeWithClaude = async (
  prompt: string,
  apiKey: string,
  model: string = DEFAULT_MODEL,
  systemPrompt?: string,
  options: ClaudeRequestOptions = {}
): Promise<ClaudeResponse> => {
  try {
    if (!apiKey || apiKey.trim() === '') {
      toast({
        title: 'Missing API Key',
        description: 'Please provide a valid Claude API key in the AI Configuration.',
        variant: 'destructive',
      });
      throw new Error('Claude API key is missing');
    }

    if (!apiKey.startsWith('sk-ant-')) {
      console.warn("Claude API key appears to have invalid format. Should start with 'sk-ant-'");
      toast({
        title: 'Invalid API Key Format',
        description: "Claude API keys start with 'sk-ant-'. Please check your key.",
        variant: 'warning',
      });
    }

    const claudeModel = model || DEFAULT_MODEL;
    const finalSystemPrompt = systemPrompt || claudeSystemPrompt;
    const timeoutMs = Math.max(0, options.timeoutMs ?? 120000);

    const client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
      maxRetries: Math.max(0, options.retryAttempts ?? 4),
    });

    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model: claudeModel,
      system: [
        {
          type: 'text',
          text: finalSystemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options.maxTokens ?? 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: options.effort ?? 'high' },
    };

    const request = client.messages.create(params);
    const response: Anthropic.Message = timeoutMs
      ? await Promise.race([
          request,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Claude request timed out')), timeoutMs)
          ),
        ])
      : await request;

    const usage = response.usage;
    const inputTokens = usage?.input_tokens ?? 0;
    const outputTokens = usage?.output_tokens ?? 0;
    const cacheReadTokens = usage?.cache_read_input_tokens ?? 0;
    const cacheCreationTokens = usage?.cache_creation_input_tokens ?? 0;

    const textContent = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );

    if (!textContent || !textContent.text.trim()) {
      if (response.stop_reason === 'refusal') {
        const category = response.stop_details?.category;
        throw new Error(
          `Claude declined this request${category ? ` (${category})` : ''}. Check the input for this row.`
        );
      }
      if (response.stop_reason === 'max_tokens') {
        throw new Error('Claude hit the max_tokens ceiling before producing text. Raise max_tokens.');
      }
      throw new Error('Claude returned an empty response. Please try again.');
    }

    return {
      content: textContent.text.trim(),
      tokens: { inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens },
      costUsd: costFromUsage(claudeModel, usage),
    };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      toast({
        title: 'Authentication Failed',
        description: 'Invalid Claude API key. Please check your API key in the AI Configuration.',
        variant: 'destructive',
      });
    }
    console.error('Claude API error:', error);
    if (isQuotaError(error)) emitQuotaExhausted();
    throw error;
  }
};
