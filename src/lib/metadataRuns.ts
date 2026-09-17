/**
 * Persistence for Metadata Generation runs (live and batch).
 *
 * A run is a row in `runs` (use_case 'metadata-generation') whose `config`
 * holds everything needed to resume it: the product queue, the languages,
 * the models, and the batch ids. The parsed workbook goes to the `run-files`
 * bucket so the export can rebuild the original layout later. One row in
 * `run_results` per product (row_index = position in the queue) carries the
 * EN master and every localisation.
 */
import { supabase, isSupabaseConfigured } from './supabase';
import { getRunResults, type RunRecord } from './runPersistence';
import type { MetadataFormatType } from '@/components/GenerateMode/types';
import type {
  ParsedSheet,
  PersistedProduct,
} from '@/components/GenerateMode/utils/metadataFormats';
import type { Effort } from '@/components/GenerateMode/generationConfig';

export const METADATA_USE_CASE = 'metadata-generation';

export type MetadataRunMode = 'client' | 'batch';
export type BatchPhase = 'en' | 'loc';

export interface MetadataBatchState {
  /** Phase currently in flight or awaiting collection. */
  phase: BatchPhase;
  enBatchId?: string;
  enSubmittedAt?: string;
  enCollected?: boolean;
  locBatchId?: string;
  locSubmittedAt?: string;
  locCollected?: boolean;
}

export interface MetadataRunConfig {
  /** Keeps the shape assignable to the generic `runs.config` record. */
  [key: string]: unknown;
  kind: typeof METADATA_USE_CASE;
  version: 1;
  mode: MetadataRunMode;
  formatType: MetadataFormatType;
  fileName: string;
  /** Selected output languages (may include 'en'). */
  languages: string[];
  models: { enMaster: string; localisation: string };
  efforts: { enMaster: Effort; localisation: Effort };
  /** Queue order; row_index in run_results is the position in this list. */
  products: PersistedProduct[];
  /** Path of the parsed sheets JSON in the run-files bucket. */
  sheetsStoragePath: string | null;
  batch?: MetadataBatchState;
}

/** One entry of a batch result before post-processing. */
export interface RawGeneration {
  text?: string;
  error?: string;
  stopReason?: string | null;
}

/** `run_results.result_data` for a metadata run. */
export interface MetadataRowResult {
  materialNumber: string;
  sheetName: string;
  /** Row index in the original sheet, for the export. */
  rowIndex: number;
  enMaster?: string;
  translations: Record<string, string>;
  errors?: string[];
  warnings?: string[];
  /** Batch mode: model output as returned, before terminology post-processing. */
  raw?: { en?: RawGeneration; loc?: Record<string, RawGeneration> };
  /** True once the client post-processed `raw` into enMaster/translations. */
  finalised?: boolean;
}

export interface MetadataRunRecord extends Omit<RunRecord, 'config'> {
  config: MetadataRunConfig;
}

export function isMetadataRun(run: RunRecord): run is MetadataRunRecord {
  const cfg = run.config as Partial<MetadataRunConfig> | undefined;
  return run.use_case === METADATA_USE_CASE && cfg?.kind === METADATA_USE_CASE;
}

async function currentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Uploads the parsed workbook so a resumed run can still export it. */
export async function uploadSheets(runId: string, sheets: ParsedSheet[]): Promise<string | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const path = `${uid}/${runId}-sheets.json`;
  const { error } = await supabase.storage
    .from('run-files')
    .upload(path, JSON.stringify(sheets), { contentType: 'application/json', upsert: true });
  if (error) {
    console.error('[metadataRuns] uploadSheets error:', error);
    return null;
  }
  return path;
}

export async function downloadSheets(path: string): Promise<ParsedSheet[]> {
  const { data, error } = await supabase.storage.from('run-files').download(path);
  if (error || !data) {
    throw new Error(`Could not download the run's workbook: ${error?.message ?? 'no data'}`);
  }
  return JSON.parse(await data.text()) as ParsedSheet[];
}

/** Uploads a JSON payload for a server endpoint (bypasses the body limit). */
export async function uploadRunFile(runId: string, suffix: string, payload: unknown): Promise<string> {
  const uid = await currentUserId();
  if (!uid) throw new Error('Not authenticated');
  const path = `${uid}/${runId}-${suffix}.json`;
  const { error } = await supabase.storage
    .from('run-files')
    .upload(path, JSON.stringify(payload), { contentType: 'application/json', upsert: true });
  if (error) throw new Error(`Failed to upload run file: ${error.message}`);
  return path;
}

export async function createMetadataRun(
  runId: string,
  config: MetadataRunConfig,
  processingMode: MetadataRunMode
): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  const { error } = await supabase.from('runs').insert({
    id: runId,
    user_id: uid,
    use_case: METADATA_USE_CASE,
    model_id: config.models.enMaster,
    file_name: config.fileName || null,
    total_rows: config.products.length,
    config,
    status: 'running',
    processing_mode: processingMode,
    processed_count: 0,
    chain_count: 0,
    file_storage_path: config.sheetsStoragePath,
  });
  if (error) {
    console.error('[metadataRuns] createMetadataRun error:', error);
    return false;
  }
  return true;
}

export async function updateMetadataRun(
  runId: string,
  patch: Partial<{
    status: RunRecord['status'];
    config: MetadataRunConfig;
    processed_count: number;
    total_cost: number;
    total_tokens_in: number;
    total_tokens_out: number;
    error_message: string | null;
  }>
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const update: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
  if (patch.status === 'completed') update.completed_at = new Date().toISOString();
  const { error } = await supabase.from('runs').update(update).eq('id', runId);
  if (error) console.error('[metadataRuns] updateMetadataRun error:', error);
}

export async function saveProductResult(
  runId: string,
  queueIndex: number,
  result: MetadataRowResult,
  cost = 0,
  tokensIn = 0,
  tokensOut = 0
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('run_results').upsert(
    {
      run_id: runId,
      row_index: queueIndex,
      result_data: result,
      cost,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
    },
    { onConflict: 'run_id,row_index' }
  );
  if (error) console.error('[metadataRuns] saveProductResult error:', error);
}

export async function loadProductResults(
  runId: string
): Promise<Map<number, { result: MetadataRowResult; cost: number; tokensIn: number; tokensOut: number }>> {
  const rows = await getRunResults(runId);
  const map = new Map<number, { result: MetadataRowResult; cost: number; tokensIn: number; tokensOut: number }>();
  for (const r of rows) {
    map.set(r.row_index, {
      result: r.result_data as unknown as MetadataRowResult,
      cost: Number(r.cost) || 0,
      tokensIn: r.tokens_in || 0,
      tokensOut: r.tokens_out || 0,
    });
  }
  return map;
}

export async function getMetadataRun(runId: string): Promise<MetadataRunRecord | null> {
  const { data, error } = await supabase.from('runs').select('*').eq('id', runId).single();
  if (error || !data) return null;
  const run = data as RunRecord;
  return isMetadataRun(run) ? run : null;
}

/**
 * Metadata runs the user can pick up again: batch runs still in flight, and
 * live runs interrupted by a closed tab or an exhausted quota (a live run
 * counts as interrupted after two minutes without a heartbeat).
 */
export async function listOpenMetadataRuns(): Promise<MetadataRunRecord[]> {
  if (!isSupabaseConfigured) return [];
  const uid = await currentUserId();
  if (!uid) return [];

  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  await supabase
    .from('runs')
    .update({ status: 'interrupted' })
    .eq('user_id', uid)
    .eq('use_case', METADATA_USE_CASE)
    .eq('status', 'running')
    .eq('processing_mode', 'client')
    .lt('updated_at', twoMinutesAgo);

  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .eq('user_id', uid)
    .eq('use_case', METADATA_USE_CASE)
    .in('status', ['running', 'interrupted'])
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as RunRecord[]).filter(isMetadataRun);
}

export async function heartbeatRun(runId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('runs').update({ updated_at: new Date().toISOString() }).eq('id', runId);
}

export async function dismissMetadataRun(runId: string): Promise<void> {
  await updateMetadataRun(runId, { status: 'cancelled' });
}
