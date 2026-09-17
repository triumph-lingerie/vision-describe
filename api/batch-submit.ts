/**
 * POST /api/batch-submit
 *
 * Creates an Anthropic Message Batch for a Metadata Generation run from a
 * requests file the browser wrote to the run-files bucket. The file carries
 * each distinct system prompt once; this function expands it into the
 * per-request params (adaptive thinking, effort, cached system block).
 *
 * Body: { runId, phase: 'en' | 'loc', requestsStoragePath }
 *
 * maxDuration: 60s
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin, verifyUserJwt, getUserApiKeys } from './_lib/supabaseAdmin';

export const config = { maxDuration: 60 };

interface RequestsFile {
  version: 1;
  model: string;
  max_tokens: number;
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  cache_ttl: '5m' | '1h';
  systems: Record<string, string>;
  items: Array<{ custom_id: string; system: string; user: string }>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    const user = await verifyUserJwt(authHeader.slice(7));

    const { runId, phase, requestsStoragePath } = req.body as {
      runId?: string;
      phase?: 'en' | 'loc';
      requestsStoragePath?: string;
    };
    if (!runId || !phase || !requestsStoragePath) {
      return res.status(400).json({ error: 'Missing runId, phase or requestsStoragePath' });
    }
    if (phase !== 'en' && phase !== 'loc') {
      return res.status(400).json({ error: 'phase must be "en" or "loc"' });
    }
    if (!requestsStoragePath.startsWith(`${user.id}/`)) {
      return res.status(403).json({ error: 'Requests file does not belong to this user' });
    }

    const { data: run, error: runError } = await supabaseAdmin
      .from('runs')
      .select('id, user_id, config, status')
      .eq('id', runId)
      .single();
    if (runError || !run || run.user_id !== user.id) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('run-files')
      .download(requestsStoragePath);
    if (downloadError || !fileData) {
      return res.status(400).json({ error: 'Requests file not found at provided storage path' });
    }
    const file = JSON.parse(await fileData.text()) as RequestsFile;
    if (!file.items?.length || !file.model) {
      return res.status(400).json({ error: 'Requests file is empty or malformed' });
    }

    const keys = await getUserApiKeys(user.id);
    const apiKey = keys.anthropic_key || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'No Anthropic API key configured for user' });
    }

    const requests: Anthropic.Messages.BatchCreateParams.Request[] = file.items.map((item) => {
      const system = file.systems[item.system];
      if (typeof system !== 'string') {
        throw new Error(`Unknown system prompt key "${item.system}" for ${item.custom_id}`);
      }
      return {
        custom_id: item.custom_id,
        params: {
          model: file.model,
          max_tokens: file.max_tokens || 16000,
          thinking: { type: 'adaptive' },
          output_config: { effort: file.effort || 'high' },
          system: [
            {
              type: 'text',
              text: system,
              cache_control: { type: 'ephemeral', ttl: file.cache_ttl || '1h' },
            },
          ],
          messages: [{ role: 'user', content: item.user }],
        },
      };
    });

    const client = new Anthropic({ apiKey });
    const batch = await client.messages.batches.create({ requests });

    const now = new Date().toISOString();
    const cfg = (run.config ?? {}) as Record<string, unknown>;
    const prevBatch = (cfg.batch ?? {}) as Record<string, unknown>;
    const batchState = {
      ...prevBatch,
      phase,
      [`${phase}BatchId`]: batch.id,
      [`${phase}SubmittedAt`]: now,
      [`${phase}Collected`]: false,
    };
    await supabaseAdmin
      .from('runs')
      .update({
        config: { ...cfg, batch: batchState },
        status: 'running',
        updated_at: now,
      })
      .eq('id', runId);

    // The requests file has served its purpose; the batch is the record now.
    await supabaseAdmin.storage.from('run-files').remove([requestsStoragePath]).catch(() => {});

    return res.status(200).json({ batchId: batch.id, totalRequests: requests.length });
  } catch (err) {
    console.error('batch-submit error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}
