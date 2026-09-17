/**
 * Model and effort per route for the Generate flows.
 *
 * One place to change so an A/B such as "EN master on Claude Fable 5.1,
 * localisations on Claude Opus 5" is a one-line edit. Prices for every model
 * listed here live in src/lib/pricing.ts.
 *
 * Effort: `high` is the API default and the right setting for the creative
 * step (the EN master, or the EN rewrite of an existing description). The
 * localisations start from a finished English text, so they run at `medium`,
 * which trims the thinking tokens that make up roughly half of the output
 * cost without changing the terminology contract. Validate any change on a
 * handful of SKUs with the market proofreaders before touching these.
 */

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/** EN master generation and EN rewrite (the creative step). */
export const EN_MASTER_MODEL = 'claude-opus-5';
export const EN_MASTER_EFFORT: Effort = 'high';

/** Localisation of the EN master into each target locale. */
export const LOCALISATION_MODEL = 'claude-opus-5';
export const LOCALISATION_EFFORT: Effort = 'medium';

/** CSV translation flow (existing copy translated cell by cell). */
export const CSV_TRANSLATION_EFFORT: Effort = 'high';

/** Image analysis flow. */
export const IMAGE_ANALYSIS_EFFORT: Effort = 'high';

/**
 * Output ceiling per call. Thinking tokens count against it on Opus 5, so a
 * 2000-token ceiling can cut a description off mid-sentence; 16000 leaves
 * room for the reasoning plus a 300-word HTML description.
 */
export const GENERATION_MAX_TOKENS = 16000;

/**
 * Prompt-cache TTL for the shared system block. A metadata batch of 250+
 * calls runs longer than the default 5 minutes, so the 1-hour TTL keeps every
 * call after the first a cache read.
 */
export const SYSTEM_CACHE_TTL: '5m' | '1h' = '1h';

/** Live mode: products processed in parallel after the cache-priming SKU. */
export const LIVE_PRODUCT_CONCURRENCY = 3;

/** Live mode: localisations of one product run in parallel, up to this many. */
export const LIVE_LOCALE_CONCURRENCY = 4;

/** How often the browser asks the server for a batch's status. */
export const BATCH_POLL_INTERVAL_MS = 30_000;
