/**
 * Client side of the Batches API path for Metadata Generation.
 *
 * The browser builds the prompts (it already does for the live path), writes
 * them to the run-files bucket as one compact file per phase, and asks the
 * server to submit them as an Anthropic Message Batch. The server keeps the
 * API key, submits, polls and collects; the browser post-processes the text.
 */
import { supabase } from '../supabase';
import { uploadRunFile, type BatchPhase } from '../metadataRuns';
import type { Effort } from '@/components/GenerateMode/generationConfig';

/** Requests file written to the run-files bucket for /api/batch-submit. */
export interface BatchRequestsFile {
  version: 1;
  model: string;
  max_tokens: number;
  effort: Effort;
  cache_ttl: '5m' | '1h';
  /** Distinct system prompts, keyed so each is stored once. */
  systems: Record<string, string>;
  items: Array<{ custom_id: string; system: string; user: string }>;
}

export function enCustomId(queueIndex: number): string {
  return `p${queueIndex}-en`;
}

export function locCustomId(queueIndex: number, langCode: string): string {
  return `p${queueIndex}-loc-${langCode}`;
}

export function parseMetadataCustomId(
  customId: string
): { queueIndex: number; kind: 'en' | 'loc'; lang?: string } | null {
  const m = customId.match(/^p(\d+)-(en|loc-(.+))$/);
  if (!m) return null;
  const queueIndex = parseInt(m[1], 10);
  if (m[2] === 'en') return { queueIndex, kind: 'en' };
  return { queueIndex, kind: 'loc', lang: m[3] };
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || `Server error: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export interface SubmitResult {
  batchId: string;
  totalRequests: number;
}

/** Uploads the requests file and asks the server to create the batch. */
export async function submitMetadataBatch(
  runId: string,
  phase: BatchPhase,
  file: BatchRequestsFile
): Promise<SubmitResult> {
  const requestsStoragePath = await uploadRunFile(runId, `${phase}-requests`, file);
  return post<SubmitResult>('/api/batch-submit', { runId, phase, requestsStoragePath });
}

export interface BatchStatus {
  batchId: string;
  status: 'in_progress' | 'canceling' | 'ended' | string;
  request_counts: {
    processing: number;
    succeeded: number;
    errored: number;
    canceled: number;
    expired: number;
  };
  created_at?: string;
  ended_at?: string | null;
}

export async function getMetadataBatchStatus(batchId: string, runId: string): Promise<BatchStatus> {
  return post<BatchStatus>('/api/batch-status', { batchId, runId });
}

export interface CollectSummary {
  succeeded: number;
  errored: number;
  expired: number;
  truncated: number;
  refused: number;
  costUsd: number;
  rows: number;
}

/** Stores the batch results in run_results (raw text) and returns counts. */
export async function collectMetadataBatch(runId: string, phase: BatchPhase): Promise<CollectSummary> {
  return post<CollectSummary>('/api/batch-collect', { runId, phase });
}

export async function cancelMetadataBatch(batchId: string, runId: string): Promise<void> {
  await post('/api/batch-cancel', { batchId, runId });
}
