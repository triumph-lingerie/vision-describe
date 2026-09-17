/**
 * POST /api/batch-collect
 *
 * Reads the results of a finished Metadata Generation batch and stores the
 * model output, as returned, in run_results (one row per product). Terminology
 * post-processing happens in the browser, which owns those rules.
 *
 * Body: { runId, phase: 'en' | 'loc' }
 *
 * maxDuration: 300s
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin, verifyUserJwt, getUserApiKeys } from './_lib/supabaseAdmin';
import { costFromUsage } from '../src/lib/pricing';

export const config = { maxDuration: 300 };

const UPSERT_CHUNK = 100;

interface RawGeneration {
  text?: string;
  error?: string;
  stopReason?: string | null;
}

interface RowResult {
  materialNumber: string;
  sheetName: string;
  rowIndex: number;
  enMaster?: string;
  translations: Record<string, string>;
  errors?: string[];
  warnings?: string[];
  raw?: { en?: RawGeneration; loc?: Record<string, RawGeneration> };
  finalised?: boolean;
}

function parseCustomId(customId: string): { queueIndex: number; kind: 'en' | 'loc'; lang?: string } | null {
  const m = customId.match(/^p(\d+)-(en|loc-(.+))$/);
  if (!m) return null;
  const queueIndex = parseInt(m[1], 10);
  return m[2] === 'en' ? { queueIndex, kind: 'en' } : { queueIndex, kind: 'loc', lang: m[3] };
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

    const { runId, phase } = req.body as { runId?: string; phase?: 'en' | 'loc' };
    if (!runId || (phase !== 'en' && phase !== 'loc')) {
      return res.status(400).json({ error: 'Missing runId or invalid phase' });
    }

    const { data: run, error: runError } = await supabaseAdmin
      .from('runs')
      .select('id, user_id, config, total_cost, total_tokens_in, total_tokens_out')
      .eq('id', runId)
      .single();
    if (runError || !run || run.user_id !== user.id) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const cfg = (run.config ?? {}) as Record<string, unknown>;
    const batchState = (cfg.batch ?? {}) as Record<string, unknown>;
    const batchId = batchState[`${phase}BatchId`] as string | undefined;
    if (!batchId) {
      return res.status(400).json({ error: `No ${phase} batch recorded for this run` });
    }
    const products = (cfg.products ?? []) as Array<{
      materialNumber: string;
      sheetName: string;
      rowIndex: number;
    }>;
    const cacheTtl = (cfg.cacheTtl as '5m' | '1h' | undefined) ?? '1h';

    const keys = await getUserApiKeys(user.id);
    const apiKey = keys.anthropic_key || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'No Anthropic API key configured for user' });
    }

    const client = new Anthropic({ apiKey });
    const batch = await client.messages.batches.retrieve(batchId);
    if (batch.processing_status !== 'ended') {
      return res.status(409).json({ error: `Batch is still ${batch.processing_status}` });
    }

    // Existing rows for this run, so a loc phase merges into the en phase rows.
    const existing = new Map<number, RowResult>();
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data: page } = await supabaseAdmin
        .from('run_results')
        .select('row_index, result_data')
        .eq('run_id', runId)
        .range(from, from + PAGE - 1);
      if (!page || page.length === 0) break;
      for (const r of page) existing.set(r.row_index, r.result_data as RowResult);
      if (page.length < PAGE) break;
    }

    const rows = new Map<number, RowResult>();
    const rowCost = new Map<number, number>();
    const rowIn = new Map<number, number>();
    const rowOut = new Map<number, number>();
    const rowFor = (queueIndex: number): RowResult => {
      let row = rows.get(queueIndex);
      if (!row) {
        const base = existing.get(queueIndex);
        const p = products[queueIndex];
        row = base
          ? { ...base, translations: { ...(base.translations ?? {}) }, raw: { ...(base.raw ?? {}) } }
          : {
              materialNumber: p?.materialNumber ?? String(queueIndex),
              sheetName: p?.sheetName ?? '',
              rowIndex: p?.rowIndex ?? queueIndex,
              translations: {},
              raw: {},
            };
        row.finalised = false;
        rows.set(queueIndex, row);
      }
      return row;
    };

    let succeeded = 0;
    let errored = 0;
    let expired = 0;
    let truncated = 0;
    let refused = 0;
    let totalCost = 0;
    let totalIn = 0;
    let totalOut = 0;

    for await (const entry of await client.messages.batches.results(batchId)) {
      const id = parseCustomId(entry.custom_id);
      if (!id) {
        console.warn(`batch-collect: unrecognised custom_id ${entry.custom_id}`);
        continue;
      }
      const row = rowFor(id.queueIndex);
      const raw: RawGeneration = {};

      if (entry.result.type === 'succeeded') {
        const message = entry.result.message;
        const usage = message.usage;
        const cost = costFromUsage(message.model, usage, { batch: true, cacheTtl });
        totalCost += cost;
        totalIn += usage?.input_tokens ?? 0;
        totalOut += usage?.output_tokens ?? 0;
        rowCost.set(id.queueIndex, (rowCost.get(id.queueIndex) ?? 0) + cost);
        rowIn.set(id.queueIndex, (rowIn.get(id.queueIndex) ?? 0) + (usage?.input_tokens ?? 0));
        rowOut.set(id.queueIndex, (rowOut.get(id.queueIndex) ?? 0) + (usage?.output_tokens ?? 0));
        raw.stopReason = message.stop_reason;

        const textBlock = message.content.find(
          (block): block is Anthropic.TextBlock => block.type === 'text'
        );
        if (message.stop_reason === 'refusal') {
          refused++;
          raw.error = `Claude declined this request${message.stop_details?.category ? ` (${message.stop_details.category})` : ''}`;
        } else if (message.stop_reason === 'max_tokens') {
          truncated++;
          raw.error = 'Response hit the max_tokens ceiling (truncated)';
        } else if (!textBlock || !textBlock.text.trim()) {
          errored++;
          raw.error = 'No text content in response';
        } else {
          succeeded++;
          raw.text = textBlock.text.trim();
        }
      } else if (entry.result.type === 'errored') {
        errored++;
        const e = entry.result.error as { type?: string; message?: string } | undefined;
        raw.error = `Batch request failed (${e?.type ?? 'error'})${e?.message ? `: ${e.message}` : ''}`;
      } else {
        expired++;
        raw.error = `Batch request ${entry.result.type}`;
      }

      row.raw = row.raw ?? {};
      if (id.kind === 'en') {
        row.raw.en = raw;
      } else if (id.lang) {
        row.raw.loc = row.raw.loc ?? {};
        row.raw.loc[id.lang] = raw;
      }
    }

    const upserts = Array.from(rows.entries()).map(([queueIndex, result]) => ({
      run_id: runId,
      row_index: queueIndex,
      result_data: result,
      cost: (rowCost.get(queueIndex) ?? 0) + 0,
      tokens_in: rowIn.get(queueIndex) ?? 0,
      tokens_out: rowOut.get(queueIndex) ?? 0,
    }));
    // Rows that already existed keep their earlier cost and tokens on top.
    for (const u of upserts) {
      const prev = existing.get(u.row_index);
      if (prev) {
        const { data: prevRow } = await supabaseAdmin
          .from('run_results')
          .select('cost, tokens_in, tokens_out')
          .eq('run_id', runId)
          .eq('row_index', u.row_index)
          .single();
        if (prevRow) {
          u.cost += Number(prevRow.cost) || 0;
          u.tokens_in += prevRow.tokens_in || 0;
          u.tokens_out += prevRow.tokens_out || 0;
        }
      }
    }
    for (let i = 0; i < upserts.length; i += UPSERT_CHUNK) {
      const { error } = await supabaseAdmin
        .from('run_results')
        .upsert(upserts.slice(i, i + UPSERT_CHUNK), { onConflict: 'run_id,row_index' });
      if (error) throw new Error(`run_results upsert failed: ${error.message}`);
    }

    const now = new Date().toISOString();
    await supabaseAdmin
      .from('runs')
      .update({
        config: { ...cfg, batch: { ...batchState, [`${phase}Collected`]: true } },
        total_cost: (Number(run.total_cost) || 0) + totalCost,
        total_tokens_in: (run.total_tokens_in || 0) + totalIn,
        total_tokens_out: (run.total_tokens_out || 0) + totalOut,
        updated_at: now,
      })
      .eq('id', runId);

    return res.status(200).json({
      succeeded,
      errored,
      expired,
      truncated,
      refused,
      costUsd: totalCost,
      rows: rows.size,
    });
  } catch (err) {
    console.error('batch-collect error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}
