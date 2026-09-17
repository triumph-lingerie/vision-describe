/**
 * POST /api/batch-create
 *
 * Creates an Anthropic Message Batch for ecommerce description optimization.
 * Builds requests sorted by language for max prompt cache hits.
 *
 * maxDuration: 60s
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { longDescColumnFor } from './_lib/longDescColumns';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin, verifyUserJwt, getUserApiKeys } from './_lib/supabaseAdmin';
import type { RunConfig } from './_lib/types';
import {
  ECOMMERCE_SYSTEM_PROMPT,
  SLOGGI_ECOMMERCE_SYSTEM_PROMPT,
  buildEcommerceUserPrompt,
} from './_lib/ecommercePrompts';

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Authenticate user
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    const jwt = authHeader.slice(7);
    const user = await verifyUserJwt(jwt);

    // 2. Parse request body
    const { rows: inlineRows, fileStoragePath, config: runConfig, langs, fileName } = req.body as {
      rows?: Record<string, unknown>[];
      fileStoragePath?: string;
      config: RunConfig;
      langs: string[];
      fileName: string;
    };

    // Load rows from Storage or inline
    let rows: Record<string, unknown>[];
    if (fileStoragePath) {
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from('run-files')
        .download(fileStoragePath);
      if (downloadError || !fileData) {
        return res.status(400).json({ error: 'File not found at provided storage path' });
      }
      const text = await fileData.text();
      rows = JSON.parse(text);
      if (runConfig.dryRun) rows = rows.slice(0, 10);
    } else if (inlineRows && Array.isArray(inlineRows) && inlineRows.length > 0) {
      rows = runConfig.dryRun ? inlineRows.slice(0, 10) : inlineRows;
    } else {
      return res.status(400).json({ error: 'Provide either fileStoragePath or rows' });
    }
    if (!runConfig || !runConfig.modelId) {
      return res.status(400).json({ error: 'Missing required config.modelId' });
    }
    if (!langs || !Array.isArray(langs) || langs.length === 0) {
      return res.status(400).json({ error: 'Missing or empty langs array' });
    }

    // 3. Get the Anthropic API key (user's own, else the deployment's)
    const keys = await getUserApiKeys(user.id);
    const apiKey = keys.anthropic_key || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'No Anthropic API key configured for user' });
    }

    // 4. Create run record
    const runId = crypto.randomUUID();
    const totalRows = rows.length;
    const totalRequests = totalRows * langs.length;

    const { error: runError } = await supabaseAdmin.from('runs').insert({
      id: runId,
      user_id: user.id,
      use_case: runConfig.useCase || 'ecommerce',
      model_id: runConfig.modelId,
      file_name: fileName || null,
      total_rows: totalRows,
      config: { ...runConfig, langs } as Record<string, unknown>,
      status: 'running',
      processing_mode: 'batch',
      processed_count: 0,
      chain_count: 0,
      project_id: runConfig.projectId || null,
    });

    if (runError) {
      console.error('Failed to create run:', runError);
      return res.status(500).json({ error: 'Failed to create run record' });
    }

    // 5. Build batch requests — sorted by language for max prompt cache hits
    const isSloggi = runConfig.useCase === 'sloggi-ecommerce';
    const systemPrompt = isSloggi ? SLOGGI_ECOMMERCE_SYSTEM_PROMPT : ECOMMERCE_SYSTEM_PROMPT;

    const requests: Anthropic.Messages.BatchCreateParams.Request[] = [];

    // Sort by language first (outer loop), then by row index (inner loop)
    for (const lang of langs) {
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        const descKey = longDescColumnFor(row, lang);
        const description = String(row[descKey] ?? '').trim();

        // Skip rows with no description for this language
        if (!description) continue;

        const userPrompt = buildEcommerceUserPrompt(row, lang);

        requests.push({
          custom_id: `row-${rowIndex}-lang-${lang}`,
          params: {
            model: runConfig.modelId,
            // Thinking tokens count against max_tokens on Opus 5: 2000 cut
            // long rows off mid-sentence, 16000 matches the live path.
            max_tokens: 16000,
            thinking: { type: 'adaptive' },
            output_config: { effort: 'high' },
            system: [
              {
                type: 'text',
                text: systemPrompt,
                cache_control: { type: 'ephemeral', ttl: '1h' },
              },
            ],
            messages: [{ role: 'user', content: userPrompt }],
          },
        });
      }
    }

    if (requests.length === 0) {
      // Clean up the run record since there's nothing to process
      await supabaseAdmin.from('runs').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', runId);
      return res.status(200).json({ runId, batchId: null, totalRequests: 0 });
    }

    // 6. Create the batch via Anthropic SDK
    const client = new Anthropic({ apiKey });
    const batch = await client.messages.batches.create({
      requests,
    });

    // 7. Store batch_id in the run record config
    await supabaseAdmin.from('runs').update({
      config: { ...runConfig, langs, batchId: batch.id } as Record<string, unknown>,
    }).eq('id', runId);

    return res.status(200).json({
      runId,
      batchId: batch.id,
      totalRequests: requests.length,
    });
  } catch (err) {
    console.error('batch-create error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}
