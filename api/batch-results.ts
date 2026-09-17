/**
 * POST /api/batch-results
 *
 * Retrieves results from a completed Anthropic Message Batch (Optimize mode),
 * merges them back into the original rows, and saves to the run_results table.
 *
 * Truncated responses (stop_reason max_tokens) and declined ones (refusal) are
 * counted and reported instead of silently written as the description.
 *
 * maxDuration: 300s
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin, verifyUserJwt, getUserApiKeys } from './_lib/supabaseAdmin';
import { longDescColumnFor } from './_lib/longDescColumns';
import { costFromUsage } from './_lib/pricing';

export const config = { maxDuration: 300 };

const UPSERT_CHUNK = 100;

/** Sanitize generated text: remove URLs, emails, and prices */
function sanitizeGenerated(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/gi, '')
    .replace(/\b(?:EUR|USD|CHF|GBP)?\s?\d+[.,]?\d*\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Parse custom_id format: row-{rowIndex}-lang-{lang} */
function parseCustomId(customId: string): { rowIndex: number; lang: string } | null {
  const match = customId.match(/^row-(\d+)-lang-(.+)$/);
  if (!match) return null;
  return { rowIndex: parseInt(match[1], 10), lang: match[2] };
}

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
    const { batchId, runId, rows, langs } = req.body as {
      batchId: string;
      runId: string;
      rows: Record<string, unknown>[];
      langs: string[];
    };

    if (!batchId || !runId) {
      return res.status(400).json({ error: 'Missing batchId or runId' });
    }
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Missing or empty rows array' });
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

    // 4. Stream results from Anthropic batch
    const client = new Anthropic({ apiKey });
    const resultStream = await client.messages.batches.results(batchId);

    // 5. Build merged rows (deep copy)
    const mergedRows: Record<string, unknown>[] = rows.map((r) => ({ ...r }));
    const rowCost = new Map<number, number>();
    const rowTokensIn = new Map<number, number>();
    const rowTokensOut = new Map<number, number>();
    const touchedRows = new Set<number>();

    let totalCost = 0;
    let totalTokensIn = 0;
    let totalTokensOut = 0;
    let succeededCount = 0;
    let errorCount = 0;
    let truncatedCount = 0;
    let refusedCount = 0;

    // 6. Iterate over streamed results
    for await (const entry of resultStream) {
      const parsed = parseCustomId(entry.custom_id);
      if (!parsed) {
        console.warn(`batch-results: could not parse custom_id: ${entry.custom_id}`);
        continue;
      }

      const { rowIndex, lang } = parsed;
      if (rowIndex < 0 || rowIndex >= rows.length) {
        console.warn(`batch-results: rowIndex ${rowIndex} out of bounds`);
        continue;
      }

      if (entry.result.type !== 'succeeded') {
        errorCount++;
        console.warn(
          `batch-results: ${entry.result.type} for ${entry.custom_id}:`,
          entry.result.type === 'errored' ? entry.result.error : 'expired'
        );
        continue;
      }

      const message = entry.result.message;
      const tokensIn = message.usage?.input_tokens ?? 0;
      const tokensOut = message.usage?.output_tokens ?? 0;
      const cost = costFromUsage(message.model, message.usage, { batch: true });
      totalTokensIn += tokensIn;
      totalTokensOut += tokensOut;
      totalCost += cost;
      rowTokensIn.set(rowIndex, (rowTokensIn.get(rowIndex) ?? 0) + tokensIn);
      rowTokensOut.set(rowIndex, (rowTokensOut.get(rowIndex) ?? 0) + tokensOut);
      rowCost.set(rowIndex, (rowCost.get(rowIndex) ?? 0) + cost);

      if (message.stop_reason === 'refusal') {
        refusedCount++;
        console.warn(`batch-results: refusal for ${entry.custom_id} (${message.stop_details?.category ?? 'no category'})`);
        continue;
      }
      if (message.stop_reason === 'max_tokens') {
        // A cut-off description must not replace the live one.
        truncatedCount++;
        console.warn(`batch-results: max_tokens truncation for ${entry.custom_id}`);
        continue;
      }

      const textBlock = message.content.find(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      );
      if (textBlock) {
        let gen = sanitizeGenerated(textBlock.text.trim());

        // Fallback to original description or title if empty
        if (!gen) {
          const descKey = longDescColumnFor(rows[rowIndex], lang);
          const altTitleKey = `MaterialAlternativeStyle_${lang}`;
          gen = String(
            rows[rowIndex][descKey] ??
              rows[rowIndex][altTitleKey] ??
              rows[rowIndex]['MaterialSeriesName'] ??
              ''
          ).trim();
        }

        mergedRows[rowIndex][longDescColumnFor(rows[rowIndex], lang)] = gen;
      }

      succeededCount++;
      touchedRows.add(rowIndex);
    }

    // 7. Save results to run_results in chunks (one round trip per 100 rows)
    const upserts = Array.from(touchedRows).map((rowIndex) => ({
      run_id: runId,
      row_index: rowIndex,
      result_data: mergedRows[rowIndex],
      cost: rowCost.get(rowIndex) ?? 0,
      tokens_in: rowTokensIn.get(rowIndex) ?? 0,
      tokens_out: rowTokensOut.get(rowIndex) ?? 0,
    }));
    for (let i = 0; i < upserts.length; i += UPSERT_CHUNK) {
      const { error } = await supabaseAdmin
        .from('run_results')
        .upsert(upserts.slice(i, i + UPSERT_CHUNK), { onConflict: 'run_id,row_index' });
      if (error) console.error('batch-results: upsert error', error);
    }

    // 8. Update run record as completed
    await supabaseAdmin.from('runs').update({
      status: 'completed',
      processed_count: succeededCount,
      total_cost: totalCost,
      total_tokens_in: totalTokensIn,
      total_tokens_out: totalTokensOut,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', runId);

    return res.status(200).json({
      rows: mergedRows,
      totalCost,
      totalTokensIn,
      totalTokensOut,
      succeededCount,
      errorCount,
      truncatedCount,
      refusedCount,
    });
  } catch (err) {
    console.error('batch-results error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}
