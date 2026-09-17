import { supabase } from './supabase';

export interface RunConfig {
  useCase: string;
  modelId: string;
  fileName?: string;
  totalRows: number;
  config?: Record<string, unknown>;
  projectId?: string;
}

export interface RunRecord {
  id: string;
  user_id: string;
  use_case: string;
  model_id: string;
  file_name: string | null;
  total_rows: number;
  config: Record<string, unknown>;
  status: 'running' | 'completed' | 'interrupted' | 'cancelled';
  total_cost: number;
  total_tokens_in: number;
  total_tokens_out: number;
  processed_count: number;
  file_storage_path: string | null;
  processing_mode: 'client' | 'server' | 'batch';
  chain_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface RunResultRecord {
  id: string;
  run_id: string;
  row_index: number;
  result_data: Record<string, unknown>;
  cost: number;
  tokens_in: number;
  tokens_out: number;
  created_at: string;
}

export async function createRun(config: RunConfig): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('runs')
    .insert({
      user_id: user.id,
      use_case: config.useCase,
      model_id: config.modelId,
      file_name: config.fileName || null,
      total_rows: config.totalRows,
      config: config.config || {},
      status: 'running',
      project_id: config.projectId || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[runPersistence] createRun error:', error);
    return null;
  }
  return data.id;
}

export async function saveRowResult(
  runId: string,
  rowIndex: number,
  resultData: Record<string, unknown>,
  cost: number = 0,
  tokensIn: number = 0,
  tokensOut: number = 0
): Promise<void> {
  try {
    await supabase
      .from('run_results')
      .upsert(
        {
          run_id: runId,
          row_index: rowIndex,
          result_data: resultData,
          cost,
          tokens_in: tokensIn,
          tokens_out: tokensOut,
        },
        { onConflict: 'run_id,row_index' }
      );
  } catch (err) {
    // Silently catch — don't block processing
    console.error('[runPersistence] saveRowResult error:', err);
  }
}

export async function updateRunStatus(
  runId: string,
  status: 'running' | 'completed' | 'interrupted' | 'cancelled',
  costSummary?: { totalCost: number; tokensIn: number; tokensOut: number }
): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (status === 'completed') {
    update.completed_at = new Date().toISOString();
  }
  if (costSummary) {
    update.total_cost = costSummary.totalCost;
    update.total_tokens_in = costSummary.tokensIn;
    update.total_tokens_out = costSummary.tokensOut;
  }

  const { error } = await supabase
    .from('runs')
    .update(update)
    .eq('id', runId);

  if (error) {
    console.error('[runPersistence] updateRunStatus error:', error);
  }
}

export async function heartbeat(runId: string): Promise<void> {
  const { error } = await supabase
    .from('runs')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', runId);

  if (error) {
    console.error('[runPersistence] heartbeat error:', error);
  }
}

export async function getCompletedRowIndices(runId: string): Promise<Set<number>> {
  // Paginate to fetch ALL indices (Supabase default limit is 1000)
  const PAGE_SIZE = 1000;
  const allIndices: number[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('run_results')
      .select('row_index')
      .eq('run_id', runId)
      .range(from, from + PAGE_SIZE - 1);

    if (error || !data || data.length === 0) break;
    allIndices.push(...data.map((r) => r.row_index));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return new Set(allIndices);
}

export async function getRunResults(runId: string): Promise<RunResultRecord[]> {
  // Paginate to fetch ALL results (Supabase default limit is 1000)
  const PAGE_SIZE = 1000;
  const allData: RunResultRecord[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('run_results')
      .select('*')
      .eq('run_id', runId)
      .order('row_index', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error || !data || data.length === 0) break;
    allData.push(...(data as RunResultRecord[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allData;
}

export async function findInterruptedRuns(): Promise<RunRecord[]> {
  // First mark stale CLIENT-SIDE runs as interrupted (server runs handle their own lifecycle)
  await markStaleRunsInterrupted();

  // Return interrupted runs AND server-side runs still running (for the banner)
  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .or('status.eq.interrupted,and(status.eq.running,processing_mode.eq.server)')
    // Metadata Generation runs have their own resume banner.
    .neq('use_case', 'metadata-generation')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as RunRecord[];
}

export async function markStaleRunsInterrupted(): Promise<void> {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  // Only mark client-side runs as stale; server runs manage their own lifecycle
  const { error } = await supabase
    .from('runs')
    .update({ status: 'interrupted' })
    .eq('status', 'running')
    .eq('processing_mode', 'client')
    .lt('updated_at', twoMinutesAgo);

  if (error) {
    console.error('[runPersistence] markStaleRunsInterrupted error:', error);
  }
}

export async function dismissRun(runId: string): Promise<void> {
  const { error } = await supabase
    .from('runs')
    .update({ status: 'cancelled' })
    .eq('id', runId);

  if (error) {
    console.error('[runPersistence] dismissRun error:', error);
  }
}
