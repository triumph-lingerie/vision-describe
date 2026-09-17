import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Workbook } from 'exceljs';
import type {
  MetadataFormat,
  MetadataFormatType,
  MetadataProduct,
  GeneratedProduct,
  GenerationProgress,
} from '../types';
import { MetadataGenerationStep, INRIVER_LANGUAGES, LANGUAGE_MAPPING } from '../types';
import {
  buildEnMasterGenerationPrompt,
  buildLocalisationPrompt,
  buildRewritePrompt,
} from '../prompts/metadataGenerationPrompt';
import { translateWithClaude, countPromptTokens } from '../utils/visionApiUtils';
import { processTextWithTerminology } from '../utils/terminology';
import {
  PIM_LOCALES,
  SFCC_IMPORT_HEADERS,
  SFCC_IMPORT_SHEET_NAME,
  findLocaleMismatches,
  pimLanguageCodesFromHeaders,
  pimLocaleByCode,
  pimLocalesFromHeaders,
  pimLongDescColumn,
  type LocaleMismatch,
} from '@/lib/pimLocales';
import {
  cleanMarkdownFormatting,
  detectFormat,
  extractProducts,
  isReworkFormat,
  languageCodeForColumn,
  longDescLangsFromHeaders,
  parseExcelAllSheets,
  targetColumnFor,
  toPersistedProduct,
  type ParsedSheet,
  type PersistedProduct,
} from '../utils/metadataFormats';
import { checkEnglishStyle, checkLocalisedStyle, formatWarnings } from '../utils/styleGuard';
import {
  BATCH_POLL_INTERVAL_MS,
  EN_MASTER_EFFORT,
  EN_MASTER_MODEL,
  GENERATION_MAX_TOKENS,
  LIVE_LOCALE_CONCURRENCY,
  LIVE_PRODUCT_CONCURRENCY,
  LOCALISATION_EFFORT,
  LOCALISATION_MODEL,
  SYSTEM_CACHE_TTL,
} from '../generationConfig';
import {
  BATCH_DISCOUNT,
  OBSERVED_OUTPUT_TOKENS,
  addUsage,
  emptyTotals,
  pricingFor,
  type UsageTotals,
} from '@/lib/pricing';
import { isQuotaError } from '@/lib/api/anthropicErrors';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  createMetadataRun,
  dismissMetadataRun,
  downloadSheets,
  heartbeatRun,
  listOpenMetadataRuns,
  loadProductResults,
  saveProductResult,
  updateMetadataRun,
  uploadSheets,
  type BatchPhase,
  type MetadataRowResult,
  type MetadataRunConfig,
  type MetadataRunRecord,
} from '@/lib/metadataRuns';
import {
  cancelMetadataBatch,
  collectMetadataBatch,
  enCustomId,
  getMetadataBatchStatus,
  locCustomId,
  submitMetadataBatch,
  type BatchRequestsFile,
} from '@/lib/api/metadataBatch';

export type ProcessingMode = 'live' | 'batch';

export interface CostEstimate {
  products: number;
  calls: number;
  liveUsd: number;
  batchUsd: number;
  enSystemTokens: number;
  enUserTokens: number;
  locSystemTokens: number;
  locUserTokens: number;
  /** What the output-token assumption is based on. */
  basedOn: string;
}

export interface BatchProgress {
  phase: BatchPhase;
  status: string;
  processing: number;
  succeeded: number;
  errored: number;
  expired: number;
  total: number;
  batchId?: string;
  /** Human-readable step: submitting, waiting, collecting, finalising. */
  step: string;
}

/** A queue entry: the product plus its position (row_index in run_results). */
interface QueueItem {
  index: number;
  product: MetadataProduct;
}

/** Placeholder EN master used only to size the localisation prompt. */
const SAMPLE_EN_MASTER =
  '<p>For everyday support that stays invisible under fitted clothing, this padded bra shapes and lifts without showing through. It uses soft microfibre with light spacer cups, so the line stays smooth from morning to evening. It belongs to the series made for second-skin comfort.</p><ul class="pd"><li>Underwired half-cup design that lifts and shapes the bust naturally</li><li>Soft padding for a smooth, defined silhouette under clothing</li><li>Delicate lace along the upper cup as the series signature detail</li><li>Smooth back panel that stays invisible under fitted tops and fine knits</li><li>Adjustable straps and a hook-and-eye closure for a precise fit</li><li>Sits cleanly under t-shirts, fine knits and tailored tops</li></ul><p>Part of the series: refined comfort with a smoothing effect that holds through the day.</p>';

function langNameOf(code: string): string {
  const def = INRIVER_LANGUAGES.find((l) => l.code === code);
  return def?.name || LANGUAGE_MAPPING[code] || code;
}

function enPromptFor(product: PersistedProduct, formatType: MetadataFormatType | undefined) {
  return isReworkFormat(formatType) && product.existingDescription
    ? buildRewritePrompt({
        materialNumber: product.materialNumber,
        productName: product.productName,
        brand: product.brand,
        existingDescription: product.existingDescription,
        existingSourceLang: product.existingSourceLang,
      })
    : buildEnMasterGenerationPrompt({
        materialNumber: product.materialNumber,
        productName: product.productName,
        brand: product.brand,
        productLine: product.productLine,
        shortDescription: product.shortDescription,
        seriesUsp: product.seriesUsp,
        styleUsp: product.styleUsp,
        styleDescription: product.styleDescription,
      });
}

function locPromptFor(enMaster: string, langCode: string, product: PersistedProduct) {
  return buildLocalisationPrompt(enMaster, langCode, langNameOf(langCode), {
    materialNumber: product.materialNumber,
    productName: product.productName,
    brand: product.brand,
    productLine: product.productLine,
  });
}

function finaliseEn(rawText: string): { text: string; warnings: string[] } {
  let text = cleanMarkdownFormatting(rawText);
  text = processTextWithTerminology(text, 'en');
  return { text, warnings: formatWarnings('en', checkEnglishStyle(text)) };
}

function finaliseLoc(rawText: string, langCode: string, enMaster: string): { text: string; warnings: string[] } {
  let text = cleanMarkdownFormatting(rawText);
  text = processTextWithTerminology(text, langCode);
  return { text, warnings: formatWarnings(langCode, checkLocalisedStyle(text, enMaster)) };
}

function isAbortError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (typeof err === 'object' && err !== null) {
    const e = err as { name?: string; message?: string };
    if (e.name === 'AbortError') return true;
    if (typeof e.message === 'string' && /aborted|abort/i.test(e.message)) return true;
  }
  return false;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      signal?.removeEventListener('abort', done);
      resolve();
    }
    signal?.addEventListener('abort', done, { once: true });
  });
}

/** Runs `fn` over `items` with at most `limit` in flight. Order of results preserved. */
async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function toGeneratedProduct(product: MetadataProduct, row: MetadataRowResult, costUsd?: number): GeneratedProduct {
  return {
    product,
    enMaster: row.enMaster,
    translations: { ...row.translations },
    errors: row.errors && row.errors.length > 0 ? row.errors : undefined,
    warnings: row.warnings && row.warnings.length > 0 ? row.warnings : undefined,
    costUsd,
  };
}

function restoreProduct(p: PersistedProduct): MetadataProduct {
  return { ...p, rawRow: {} };
}

export function useMetadataGeneration() {
  const [step, setStep] = useState<MetadataGenerationStep>(MetadataGenerationStep.UPLOAD);
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [products, setProducts] = useState<MetadataProduct[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [exclusionInput, setExclusionInput] = useState<string>('');
  const [format, setFormat] = useState<MetadataFormat | null>(null);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(
    INRIVER_LANGUAGES.map((l) => l.code)
  );
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('live');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress>({ current: 0, total: 0 });
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<GeneratedProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [localeMismatches, setLocaleMismatches] = useState<LocaleMismatch[]>([]);
  const [totals, setTotals] = useState<UsageTotals>(emptyTotals());
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [openRuns, setOpenRuns] = useState<MetadataRunRecord[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const userCancelledRef = useRef(false);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const refreshOpenRuns = useCallback(async () => {
    try {
      setOpenRuns(await listOpenMetadataRuns());
    } catch (err) {
      console.error('[metadata] listOpenMetadataRuns failed:', err);
    }
  }, []);

  useEffect(() => {
    refreshOpenRuns();
  }, [refreshOpenRuns]);

  const parseFile = useCallback(
    async (uploadedFile: File) => {
      setFile(uploadedFile);
      setError(null);

      try {
        if (!/\.(xlsx?|xlsm)$/i.test(uploadedFile.name)) {
          throw new Error('Only Excel files (.xlsx, .xls, .xlsm) are supported in this mode.');
        }

        const parsed = await parseExcelAllSheets(uploadedFile);
        setSheets(parsed);

        // Union of headers across all sheets to drive format detection
        const allHeaders = Array.from(new Set(parsed.flatMap((s) => s.headers)));
        const detected = detectFormat(allHeaders);

        const fmt: MetadataFormat = {
          type: detected,
          headers: allHeaders,
          sheetNames: parsed.map((s) => s.name),
        };
        setFormat(fmt);

        if (detected === 'unknown') {
          setError(
            'File format not recognised. Expected AW26-compact, sloggi-B2C, Triumph-B2C, or a PIM long-description export (Material Number + Ecom Long Desc_<locale> columns).'
          );
          setProducts([]);
          setStep(MetadataGenerationStep.FORMAT_DETECT);
          return;
        }

        const prods = extractProducts(detected, parsed);
        setProducts(prods);
        const brands = Array.from(new Set(prods.map((p) => (p.brand || 'unknown').trim())));
        setSelectedBrands(brands);

        // For the rework format, regenerate exactly the locale columns already
        // present in the file (e.g. the current assortment ships 'pt', not
        // 'pt-PT'), so the output overwrites them in place rather than adding
        // parallel columns.
        if (detected === 'longdesc-rework') {
          const fileLangs = longDescLangsFromHeaders(allHeaders);
          if (fileLangs.length > 0) setSelectedLanguages(fileLangs);
          const withSource = prods.filter((p) => p.existingDescription).length;
          addLog(
            `Rework mode: ${prods.length} SKU(s), ${withSource} with an existing description to rewrite, ${prods.length - withSource} from product name only. Languages preset from file: ${fileLangs.join(', ')}.`
          );
        }

        if (detected === 'pim-longdesc') {
          const fileLangs = pimLanguageCodesFromHeaders(allHeaders);
          if (fileLangs.length > 0) setSelectedLanguages(fileLangs);
          const withSource = prods.filter((p) => p.existingDescription).length;
          addLog(
            `PIM rework mode: ${prods.length} SKU(s), ${withSource} with an existing description to rewrite, ${prods.length - withSource} from product name only. Locales preset from file: ${pimLocalesFromHeaders(allHeaders).join(', ')}.`
          );

          // A PIM export can ship a locale column holding another locale's text.
          // Rewriting from the wrong source language would be invisible in the
          // output, so surface it here instead.
          const mismatches = parsed.flatMap((s) =>
            findLocaleMismatches(s.data, s.headers, 'Material Number', 'Material Description')
          );
          setLocaleMismatches(mismatches);
          if (mismatches.length > 0) {
            const skus = new Set(mismatches.map((m) => m.materialNumber));
            addLog(
              `Warning: ${mismatches.length} cell(s) across ${skus.size} SKU(s) hold text in a different language than their column claims. Check these before generating.`
            );
          }
        }

        addLog(`Parsed ${prods.length} product(s) across ${parsed.length} sheet(s); format: ${detected}`);
        setStep(MetadataGenerationStep.FORMAT_DETECT);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse file');
      }
    },
    [addLog]
  );

  const excludedSkus = useMemo(
    () =>
      exclusionInput
        .split(/[\s,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    [exclusionInput]
  );

  const queuedProducts = useMemo(() => {
    const excluded = new Set(excludedSkus);
    return products.filter(
      (p) =>
        selectedBrands.includes((p.brand || 'unknown').trim()) &&
        !excluded.has(String(p.materialNumber).trim())
    );
  }, [products, selectedBrands, excludedSkus]);

  /**
   * Pre-run cost estimate. Exact input token counts from the API's tokenizer
   * on one sample product; output tokens from the CH60 batch averages.
   */
  const estimateCost = useCallback(
    async (apiKey: string) => {
      const queue = queuedProducts;
      if (!apiKey || queue.length === 0 || selectedLanguages.length === 0) {
        setEstimate(null);
        return;
      }
      setEstimating(true);
      try {
        const sample = queue[0];
        const nonEnLangs = selectedLanguages.filter((l) => l !== 'en');
        const enCount = await countPromptTokens(enPromptFor(sample, format?.type), apiKey, EN_MASTER_MODEL);
        const locCount =
          nonEnLangs.length > 0
            ? await countPromptTokens(locPromptFor(SAMPLE_EN_MASTER, nonEnLangs[0], sample), apiKey, LOCALISATION_MODEL)
            : { systemTokens: 0, userTokens: 0 };

        const enPrice = pricingFor(EN_MASTER_MODEL);
        const locPrice = pricingFor(LOCALISATION_MODEL);
        const enOut = OBSERVED_OUTPUT_TOKENS.enMasterHigh;
        const locOut =
          LOCALISATION_EFFORT === 'high' || LOCALISATION_EFFORT === 'xhigh' || LOCALISATION_EFFORT === 'max'
            ? OBSERVED_OUTPUT_TOKENS.localisationHigh
            : OBSERVED_OUTPUT_TOKENS.localisationMedium;
        const write = SYSTEM_CACHE_TTL === '1h' ? 'cacheWrite1h' : 'cacheWrite5m';

        const perProductEn =
          enCount.userTokens * enPrice.input + enCount.systemTokens * enPrice.cacheRead + enOut * enPrice.output;
        const perProductLoc =
          nonEnLangs.length *
          (locCount.userTokens * locPrice.input + locCount.systemTokens * locPrice.cacheRead + locOut * locPrice.output);
        // The first call of each prompt shape writes the cache instead of reading it.
        const cacheWrites =
          enCount.systemTokens * (enPrice[write] - enPrice.cacheRead) +
          (nonEnLangs.length > 0 ? locCount.systemTokens * (locPrice[write] - locPrice.cacheRead) : 0);

        const liveUsd = (queue.length * (perProductEn + perProductLoc) + cacheWrites) / 1_000_000;
        setEstimate({
          products: queue.length,
          calls: queue.length * (1 + nonEnLangs.length),
          liveUsd,
          batchUsd: liveUsd * BATCH_DISCOUNT,
          enSystemTokens: enCount.systemTokens,
          enUserTokens: enCount.userTokens,
          locSystemTokens: locCount.systemTokens,
          locUserTokens: locCount.userTokens,
          basedOn: `input tokens counted on ${sample.materialNumber}; output assumed ${enOut} tokens per EN master and ${locOut} per localisation (CH60 averages)`,
        });
      } catch (err) {
        console.error('[metadata] estimate failed:', err);
        setEstimate(null);
      } finally {
        setEstimating(false);
      }
    },
    [queuedProducts, selectedLanguages, format?.type]
  );

  const buildRunConfig = useCallback(
    (
      queue: PersistedProduct[],
      mode: ProcessingMode,
      sheetsStoragePath: string | null,
      formatType: MetadataFormatType,
      fileName: string
    ): MetadataRunConfig => ({
      kind: 'metadata-generation',
      version: 1,
      mode: mode === 'batch' ? 'batch' : 'client',
      formatType,
      fileName,
      languages: selectedLanguages,
      models: { enMaster: EN_MASTER_MODEL, localisation: LOCALISATION_MODEL },
      efforts: { enMaster: EN_MASTER_EFFORT, localisation: LOCALISATION_EFFORT },
      products: queue,
      sheetsStoragePath,
    }),
    [selectedLanguages]
  );

  /** Products still missing an EN master or one of the selected languages. */
  const needsWork = useCallback(
    (row: MetadataRowResult | undefined, includesEn: boolean, nonEnLangs: string[]) => {
      if (!row) return { en: true, langs: nonEnLangs };
      const en = !row.enMaster;
      const langs = en ? nonEnLangs : nonEnLangs.filter((l) => !row.translations?.[l]);
      void includesEn;
      return { en, langs };
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Live mode: the browser calls the API directly, product by product.
  // ---------------------------------------------------------------------------
  const runLive = useCallback(
    async (
      apiKey: string,
      queue: QueueItem[],
      ctx: {
        runId: string | null;
        formatType: MetadataFormatType | undefined;
        /** Output languages for this run (state may lag on a resume). */
        languages: string[];
        existing: Map<number, { result: MetadataRowResult; cost: number; tokensIn: number; tokensOut: number }>;
        signal: AbortSignal;
      }
    ): Promise<GeneratedProduct[]> => {
      const { signal } = ctx;
      const includesEn = ctx.languages.includes('en');
      const nonEnLangs = ctx.languages.filter((l) => l !== 'en');
      const opsPerProduct = 1 + nonEnLangs.length;
      const totalOps = queue.length * opsPerProduct;
      let completed = 0;
      const runTotals = emptyTotals();
      const accumulated = new Map<number, GeneratedProduct>();
      let quotaHit = false;

      setProgress({ current: 0, total: totalOps });
      addLog(
        `Live mode: ${queue.length} product(s) × (1 EN master + ${nonEnLangs.length} localisations) = ${totalOps} operations. EN on ${EN_MASTER_MODEL} (${EN_MASTER_EFFORT}), localisations on ${LOCALISATION_MODEL} (${LOCALISATION_EFFORT}).`
      );

      const bump = (n = 1) => {
        completed += n;
        setProgress({ current: completed, total: totalOps });
      };

      const noteQuota = (err: unknown) => {
        if (!quotaHit && isQuotaError(err)) {
          quotaHit = true;
          addLog('Anthropic credit or rate limit exhausted. Stopping; the products done so far are saved and the run can be resumed.');
          abortRef.current?.abort();
        }
      };

      const processOneProduct = async ({ index, product }: QueueItem): Promise<GeneratedProduct> => {
        const prior = ctx.existing.get(index);
        const row: MetadataRowResult = prior
          ? { ...prior.result, translations: { ...(prior.result.translations ?? {}) }, errors: [], warnings: [...(prior.result.warnings ?? [])] }
          : {
              materialNumber: product.materialNumber,
              sheetName: product.sheetName,
              rowIndex: product.rowIndex,
              translations: {},
              errors: [],
              warnings: [],
            };
        let cost = prior?.cost ?? 0;
        let tokensIn = prior?.tokensIn ?? 0;
        let tokensOut = prior?.tokensOut ?? 0;
        const work = needsWork(prior?.result, includesEn, nonEnLangs);

        if (signal.aborted) return toGeneratedProduct(product, row, cost);

        // Step 1: the EN master (rewrite of the existing copy, or generation
        // from the structured inputs / product name).
        if (work.en) {
          try {
            const res = await translateWithClaude(enPromptFor(product, ctx.formatType), apiKey, EN_MASTER_MODEL, signal, {
              effort: EN_MASTER_EFFORT,
              maxTokens: GENERATION_MAX_TOKENS,
              cacheTtl: SYSTEM_CACHE_TTL,
            });
            const fin = finaliseEn(res.content);
            row.enMaster = fin.text;
            row.warnings = [...(row.warnings ?? []), ...fin.warnings];
            addUsage(runTotals, EN_MASTER_MODEL, {
              input_tokens: res.tokens.inputTokens,
              output_tokens: res.tokens.outputTokens,
              cache_read_input_tokens: res.tokens.cacheReadTokens,
              cache_creation_input_tokens: res.tokens.cacheCreationTokens,
            }, { cacheTtl: SYSTEM_CACHE_TTL });
            cost += res.costUsd ?? 0;
            tokensIn += res.tokens.inputTokens;
            tokensOut += res.tokens.outputTokens;
          } catch (err) {
            if (isAbortError(err) || signal.aborted) return toGeneratedProduct(product, row, cost);
            noteQuota(err);
            const msg = err instanceof Error ? err.message : 'EN generation failed';
            row.errors = [...(row.errors ?? []), `en: ${msg}`];
            addLog(`Error generating EN for ${product.materialNumber}: ${msg}`);
          }
          bump();
        } else {
          bump();
        }
        if (row.enMaster && includesEn) row.translations['en'] = row.enMaster;

        // Step 2: localisations, a few in parallel per product.
        const enMaster = row.enMaster;
        if (enMaster && !signal.aborted && work.langs.length > 0) {
          await mapWithLimit(work.langs, LIVE_LOCALE_CONCURRENCY, async (langCode) => {
            if (signal.aborted) return;
            try {
              const res = await translateWithClaude(locPromptFor(enMaster, langCode, product), apiKey, LOCALISATION_MODEL, signal, {
                effort: LOCALISATION_EFFORT,
                maxTokens: GENERATION_MAX_TOKENS,
                cacheTtl: SYSTEM_CACHE_TTL,
              });
              const fin = finaliseLoc(res.content, langCode, enMaster);
              row.translations[langCode] = fin.text;
              row.warnings = [...(row.warnings ?? []), ...fin.warnings];
              addUsage(runTotals, LOCALISATION_MODEL, {
                input_tokens: res.tokens.inputTokens,
                output_tokens: res.tokens.outputTokens,
                cache_read_input_tokens: res.tokens.cacheReadTokens,
                cache_creation_input_tokens: res.tokens.cacheCreationTokens,
              }, { cacheTtl: SYSTEM_CACHE_TTL });
              cost += res.costUsd ?? 0;
              tokensIn += res.tokens.inputTokens;
              tokensOut += res.tokens.outputTokens;
            } catch (err) {
              if (isAbortError(err) || signal.aborted) return;
              noteQuota(err);
              const msg = err instanceof Error ? err.message : 'Localisation failed';
              row.errors = [...(row.errors ?? []), `${langCode}: ${msg}`];
              addLog(`Error localising ${product.materialNumber} to ${langCode}: ${msg}`);
            }
            bump();
          });
        } else if (!enMaster) {
          bump(work.langs.length);
        }
        bump(nonEnLangs.length - work.langs.length);

        row.finalised = true;
        if (ctx.runId && !signal.aborted) {
          await saveProductResult(ctx.runId, index, row, cost, tokensIn, tokensOut);
        }
        setTotals({ ...runTotals });
        const generated = toGeneratedProduct(product, row, cost);
        accumulated.set(index, generated);
        setResults(Array.from(accumulated.values()));
        return generated;
      };

      // Already complete products go straight to the result list.
      const pending: QueueItem[] = [];
      for (const item of queue) {
        const prior = ctx.existing.get(item.index);
        const work = needsWork(prior?.result, includesEn, nonEnLangs);
        if (prior && !work.en && work.langs.length === 0) {
          const row = { ...prior.result, translations: { ...(prior.result.translations ?? {}) } };
          if (row.enMaster && includesEn) row.translations['en'] = row.enMaster;
          accumulated.set(item.index, toGeneratedProduct(item.product, row, prior.cost));
          bump(opsPerProduct);
        } else {
          pending.push(item);
        }
      }
      if (accumulated.size > 0) {
        addLog(`${accumulated.size} product(s) already complete from the saved run; ${pending.length} to go.`);
        setResults(Array.from(accumulated.values()));
      }

      const heartbeat = ctx.runId ? window.setInterval(() => heartbeatRun(ctx.runId as string), 30_000) : null;
      try {
        // Warmup: with 2+ products, run the first alone so the prompt cache is
        // written before the parallel batch fires; otherwise the first
        // LIVE_PRODUCT_CONCURRENCY requests all pay the cache-write premium.
        let start = 0;
        if (pending.length >= 2) {
          await processOneProduct(pending[0]);
          start = 1;
          if (!signal.aborted) {
            addLog(
              `Cache primed on first SKU (${pending[0].product.materialNumber}); running remaining ${pending.length - 1} in parallel batches of ${LIVE_PRODUCT_CONCURRENCY}, ${LIVE_LOCALE_CONCURRENCY} localisations at a time per product.`
            );
          }
        }
        for (let i = start; i < pending.length && !signal.aborted; i += LIVE_PRODUCT_CONCURRENCY) {
          const batch = pending.slice(i, i + LIVE_PRODUCT_CONCURRENCY);
          await Promise.all(batch.map(processOneProduct));
          addLog(`Batch completed: ${Math.min(i + LIVE_PRODUCT_CONCURRENCY, pending.length)}/${pending.length} product(s)`);
        }
      } finally {
        if (heartbeat !== null) window.clearInterval(heartbeat);
        if (runTotals.calls > 0) {
          const totalCached = runTotals.cacheReadTokens + runTotals.cacheWriteTokens;
          const hitRate = totalCached > 0 ? Math.round((runTotals.cacheReadTokens / totalCached) * 100) : 0;
          addLog(
            `Usage: ${runTotals.calls} calls, ${runTotals.inputTokens.toLocaleString()} input + ${runTotals.outputTokens.toLocaleString()} output tokens, prompt cache ${runTotals.cacheReadTokens.toLocaleString()} read / ${runTotals.cacheWriteTokens.toLocaleString()} written (${hitRate}% hit rate). Cost ${runTotals.costUsd.toFixed(2)} USD.`
          );
        }
        if (ctx.runId) {
          const finished = queue.every((q) => {
            const g = accumulated.get(q.index);
            return g && g.enMaster && nonEnLangs.every((l) => g.translations[l]);
          });
          const priorCost = Array.from(ctx.existing.values()).reduce((s, r) => s + r.cost, 0);
          await updateMetadataRun(ctx.runId, {
            status: userCancelledRef.current ? 'cancelled' : finished ? 'completed' : 'interrupted',
            processed_count: accumulated.size,
            total_cost: priorCost + runTotals.costUsd,
            total_tokens_in: runTotals.inputTokens,
            total_tokens_out: runTotals.outputTokens,
            error_message: quotaHit ? 'Anthropic credit or rate limit exhausted' : null,
          });
        }
      }

      return queue.map((q) => accumulated.get(q.index)).filter((g): g is GeneratedProduct => Boolean(g));
    },
    [addLog, needsWork]
  );

  // ---------------------------------------------------------------------------
  // Batch mode: Anthropic Batches API through the server, two phases.
  // ---------------------------------------------------------------------------
  const runBatch = useCallback(
    async (
      queue: QueueItem[],
      ctx: {
        runId: string;
        config: MetadataRunConfig;
        signal: AbortSignal;
      }
    ): Promise<GeneratedProduct[]> => {
      const { signal } = ctx;
      let config = ctx.config;
      const includesEn = config.languages.includes('en');
      const nonEnLangs = config.languages.filter((l) => l !== 'en');
      const productAt = new Map(queue.map((q) => [q.index, q.product]));

      const persistConfig = async (patch: Partial<MetadataRunConfig>) => {
        config = { ...config, ...patch };
        await updateMetadataRun(ctx.runId, { config });
      };

      const waitForBatch = async (phase: BatchPhase, batchId: string, total: number) => {
        for (;;) {
          if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
          const status = await getMetadataBatchStatus(batchId, ctx.runId);
          const c = status.request_counts;
          setBatchProgress({
            phase,
            batchId,
            status: status.status,
            processing: c?.processing ?? 0,
            succeeded: c?.succeeded ?? 0,
            errored: c?.errored ?? 0,
            expired: c?.expired ?? 0,
            total,
            step: status.status === 'ended' ? 'collecting results' : 'waiting for Anthropic',
          });
          if (status.status === 'ended') return;
          await sleep(BATCH_POLL_INTERVAL_MS, signal);
        }
      };

      const loadRows = async () => loadProductResults(ctx.runId);

      // Phase EN --------------------------------------------------------------
      let rows = await loadRows();
      const enTodo = queue.filter((q) => !rows.get(q.index)?.result.enMaster);
      const batchState = config.batch;
      if (enTodo.length > 0 && !(batchState?.enBatchId && !batchState.enCollected)) {
        if (!batchState?.enBatchId || batchState.enCollected) {
          const systems: Record<string, string> = {};
          const items: BatchRequestsFile['items'] = [];
          for (const q of enTodo) {
            const p = enPromptFor(q.product, config.formatType);
            const key = `en-${q.product.brand.trim().toLowerCase() || 'brand'}-${p.system.length}`;
            systems[key] = p.system;
            items.push({ custom_id: enCustomId(q.index), system: key, user: p.user });
          }
          setBatchProgress({ phase: 'en', status: 'submitting', processing: items.length, succeeded: 0, errored: 0, expired: 0, total: items.length, step: 'submitting EN masters' });
          addLog(`Batch mode: submitting ${items.length} EN master request(s) on ${config.models.enMaster} (${config.efforts.enMaster}).`);
          const submitted = await submitMetadataBatch(ctx.runId, 'en', {
            version: 1,
            model: config.models.enMaster,
            max_tokens: GENERATION_MAX_TOKENS,
            effort: config.efforts.enMaster,
            cache_ttl: SYSTEM_CACHE_TTL,
            systems,
            items,
          });
          await persistConfig({
            batch: { ...(config.batch ?? { phase: 'en' }), phase: 'en', enBatchId: submitted.batchId, enSubmittedAt: new Date().toISOString(), enCollected: false },
          });
          addLog(`EN batch ${submitted.batchId} accepted (${submitted.totalRequests} requests). Most batches finish within an hour; this tab can be closed and the run resumed later.`);
        }
      }
      if (config.batch?.enBatchId && !config.batch.enCollected) {
        await waitForBatch('en', config.batch.enBatchId, enTodo.length || queue.length);
        const summary = await collectMetadataBatch(ctx.runId, 'en');
        addLog(`EN batch collected: ${summary.succeeded} ok, ${summary.errored} errored, ${summary.expired} expired, ${summary.truncated} truncated, ${summary.refused} declined. Cost ${summary.costUsd.toFixed(2)} USD.`);
        await persistConfig({ batch: { ...(config.batch as NonNullable<MetadataRunConfig['batch']>), enCollected: true } });
        rows = await loadRows();
        // Post-process the raw EN text into the master (terminology, style guard).
        for (const q of queue) {
          const entry = rows.get(q.index);
          if (!entry || entry.result.enMaster) continue;
          const raw = entry.result.raw?.en;
          const row = { ...entry.result, translations: { ...(entry.result.translations ?? {}) }, errors: [...(entry.result.errors ?? [])], warnings: [...(entry.result.warnings ?? [])] };
          if (raw?.text) {
            const fin = finaliseEn(raw.text);
            row.enMaster = fin.text;
            row.warnings.push(...fin.warnings);
            if (includesEn) row.translations['en'] = fin.text;
          } else if (raw?.error) {
            row.errors.push(`en: ${raw.error}`);
          }
          await saveProductResult(ctx.runId, q.index, row, entry.cost, entry.tokensIn, entry.tokensOut);
          rows.set(q.index, { ...entry, result: row });
        }
      }

      // Phase LOC -------------------------------------------------------------
      if (nonEnLangs.length > 0) {
        const locItemsFor = () => {
          const systems: Record<string, string> = {};
          const items: BatchRequestsFile['items'] = [];
          for (const q of queue) {
            const entry = rows.get(q.index);
            const enMaster = entry?.result.enMaster;
            if (!enMaster) continue;
            for (const lang of nonEnLangs) {
              if (entry?.result.translations?.[lang]) continue;
              const p = locPromptFor(enMaster, lang, q.product);
              const key = `loc-${q.product.brand.trim().toLowerCase() || 'brand'}-${p.system.length}`;
              systems[key] = p.system;
              items.push({ custom_id: locCustomId(q.index, lang), system: key, user: p.user });
            }
          }
          return { systems, items };
        };
        if (!config.batch?.locBatchId || config.batch.locCollected) {
          const { systems, items } = locItemsFor();
          if (items.length > 0) {
            setBatchProgress({ phase: 'loc', status: 'submitting', processing: items.length, succeeded: 0, errored: 0, expired: 0, total: items.length, step: 'submitting localisations' });
            addLog(`Submitting ${items.length} localisation request(s) on ${config.models.localisation} (${config.efforts.localisation}).`);
            const submitted = await submitMetadataBatch(ctx.runId, 'loc', {
              version: 1,
              model: config.models.localisation,
              max_tokens: GENERATION_MAX_TOKENS,
              effort: config.efforts.localisation,
              cache_ttl: SYSTEM_CACHE_TTL,
              systems,
              items,
            });
            await persistConfig({
              batch: { ...(config.batch ?? { phase: 'loc' }), phase: 'loc', locBatchId: submitted.batchId, locSubmittedAt: new Date().toISOString(), locCollected: false },
            });
            addLog(`Localisation batch ${submitted.batchId} accepted (${submitted.totalRequests} requests).`);
          }
        }
        if (config.batch?.locBatchId && !config.batch.locCollected) {
          await waitForBatch('loc', config.batch.locBatchId, queue.length * nonEnLangs.length);
          const summary = await collectMetadataBatch(ctx.runId, 'loc');
          addLog(`Localisation batch collected: ${summary.succeeded} ok, ${summary.errored} errored, ${summary.expired} expired, ${summary.truncated} truncated, ${summary.refused} declined. Cost ${summary.costUsd.toFixed(2)} USD.`);
          await persistConfig({ batch: { ...(config.batch as NonNullable<MetadataRunConfig['batch']>), locCollected: true } });
          rows = await loadRows();
          for (const q of queue) {
            const entry = rows.get(q.index);
            if (!entry?.result.enMaster) continue;
            const row = { ...entry.result, translations: { ...(entry.result.translations ?? {}) }, errors: [...(entry.result.errors ?? [])], warnings: [...(entry.result.warnings ?? [])] };
            let changed = false;
            for (const lang of nonEnLangs) {
              if (row.translations[lang]) continue;
              const raw = entry.result.raw?.loc?.[lang];
              if (raw?.text) {
                const fin = finaliseLoc(raw.text, lang, row.enMaster as string);
                row.translations[lang] = fin.text;
                row.warnings.push(...fin.warnings);
                changed = true;
              } else if (raw?.error) {
                row.errors.push(`${lang}: ${raw.error}`);
                changed = true;
              }
            }
            row.finalised = true;
            if (changed) {
              await saveProductResult(ctx.runId, q.index, row, entry.cost, entry.tokensIn, entry.tokensOut);
              rows.set(q.index, { ...entry, result: row });
            }
          }
        }
      }

      // Assemble --------------------------------------------------------------
      const generated: GeneratedProduct[] = [];
      const runTotals = emptyTotals();
      for (const q of queue) {
        const entry = rows.get(q.index);
        if (!entry) continue;
        const row = { ...entry.result, translations: { ...(entry.result.translations ?? {}) } };
        if (row.enMaster && includesEn) row.translations['en'] = row.enMaster;
        runTotals.costUsd += entry.cost;
        runTotals.inputTokens += entry.tokensIn;
        runTotals.outputTokens += entry.tokensOut;
        generated.push(toGeneratedProduct(productAt.get(q.index) as MetadataProduct, row, entry.cost));
      }
      setTotals(runTotals);
      const finished = generated.length === queue.length && generated.every((g) => g.enMaster && nonEnLangs.every((l) => g.translations[l]));
      await updateMetadataRun(ctx.runId, {
        status: finished ? 'completed' : 'interrupted',
        processed_count: generated.length,
      });
      addLog(`Batch run ${finished ? 'complete' : 'finished with gaps'}: ${generated.length} product(s), ${runTotals.costUsd.toFixed(2)} USD (Batches API price).`);
      return generated;
    },
    [addLog]
  );

  const finish = useCallback(
    (generated: GeneratedProduct[], aborted: boolean) => {
      setResults(generated);
      abortRef.current = null;
      setIsProcessing(false);
      setBatchProgress(null);
      if (aborted) addLog('Generation cancelled. No further API calls.');
      else addLog(`Generation complete: ${generated.length} product(s) processed`);
      setStep(MetadataGenerationStep.RESULT);
      refreshOpenRuns();
    },
    [addLog, refreshOpenRuns]
  );

  const startGeneration = useCallback(
    async (apiKey: string) => {
      const queue: QueueItem[] = queuedProducts.map((product, index) => ({ index, product }));
      if (queue.length === 0 || selectedLanguages.length === 0) return;

      const controller = new AbortController();
      abortRef.current = controller;
      userCancelledRef.current = false;
      setIsProcessing(true);
      setError(null);
      setResults([]);
      setTotals(emptyTotals());
      setBatchProgress(null);
      setStep(MetadataGenerationStep.PROCESSING);

      const formatType = format?.type ?? 'unknown';
      const fileName = file?.name ?? '';
      let generated: GeneratedProduct[] = [];

      try {
        if (processingMode === 'batch') {
          if (!isSupabaseConfigured) throw new Error('Batch mode needs the Supabase backend; use live mode here.');
          const id = crypto.randomUUID();
          const sheetsPath = await uploadSheets(id, sheets);
          const config = buildRunConfig(queue.map((q) => toPersistedProduct(q.product)), 'batch', sheetsPath, formatType, fileName);
          const created = await createMetadataRun(id, config, 'batch');
          if (!created) throw new Error('Could not create the run record; check the Supabase connection.');
          setRunId(id);
          generated = await runBatch(queue, { runId: id, config, signal: controller.signal });
        } else {
          let id: string | null = null;
          if (isSupabaseConfigured) {
            id = crypto.randomUUID();
            const sheetsPath = await uploadSheets(id, sheets);
            const config = buildRunConfig(queue.map((q) => toPersistedProduct(q.product)), 'live', sheetsPath, formatType, fileName);
            const created = await createMetadataRun(id, config, 'client');
            if (!created) {
              id = null;
              addLog('Run persistence unavailable: results will not survive a reload.');
            } else {
              setRunId(id);
            }
          }
          generated = await runLive(apiKey, queue, {
            runId: id,
            formatType: format?.type,
            languages: selectedLanguages,
            existing: new Map(),
            signal: controller.signal,
          });
        }
      } catch (err) {
        if (!isAbortError(err)) {
          const msg = err instanceof Error ? err.message : 'Generation failed';
          setError(msg);
          addLog(`Error: ${msg}`);
        }
      } finally {
        finish(generated, controller.signal.aborted);
      }
    },
    [queuedProducts, selectedLanguages, format, file, sheets, processingMode, buildRunConfig, runBatch, runLive, addLog, finish]
  );

  /** Picks up a saved run: live runs continue where they stopped, batch runs re-attach to the batch in flight. */
  const resumeRun = useCallback(
    async (run: MetadataRunRecord, apiKey: string) => {
      const cfg = run.config;
      const controller = new AbortController();
      abortRef.current = controller;
      userCancelledRef.current = false;
      setLogs([]);
      setError(null);
      setResults([]);
      setTotals(emptyTotals());
      setBatchProgress(null);
      setIsProcessing(true);
      setRunId(run.id);
      setProcessingMode(cfg.mode === 'batch' ? 'batch' : 'live');
      setSelectedLanguages(cfg.languages);
      setFormat({ type: cfg.formatType, headers: [], sheetNames: [] });
      const restored = cfg.products.map(restoreProduct);
      setProducts(restored);
      setSelectedBrands(Array.from(new Set(restored.map((p) => (p.brand || 'unknown').trim()))));
      setExclusionInput('');
      setStep(MetadataGenerationStep.PROCESSING);
      addLog(`Resuming run ${run.id.slice(0, 8)} (${cfg.mode}, ${cfg.products.length} products, ${cfg.languages.join(', ')}).`);

      let generated: GeneratedProduct[] = [];
      try {
        if (cfg.sheetsStoragePath) {
          try {
            setSheets(await downloadSheets(cfg.sheetsStoragePath));
          } catch (err) {
            addLog(`Workbook not restored (${err instanceof Error ? err.message : 'download failed'}); the Excel export will only carry the generated columns.`);
            setSheets([]);
          }
        }
        const queue: QueueItem[] = restored.map((product, index) => ({ index, product }));
        await updateMetadataRun(run.id, { status: 'running' });
        if (cfg.mode === 'batch') {
          generated = await runBatch(queue, { runId: run.id, config: cfg, signal: controller.signal });
        } else {
          const existing = await loadProductResults(run.id);
          generated = await runLive(apiKey, queue, {
            runId: run.id,
            formatType: cfg.formatType,
            languages: cfg.languages,
            existing,
            signal: controller.signal,
          });
        }
      } catch (err) {
        if (!isAbortError(err)) {
          const msg = err instanceof Error ? err.message : 'Resume failed';
          setError(msg);
          addLog(`Error: ${msg}`);
        }
      } finally {
        finish(generated, controller.signal.aborted);
      }
    },
    [runBatch, runLive, addLog, finish]
  );

  const dismissRun = useCallback(
    async (run: MetadataRunRecord) => {
      await dismissMetadataRun(run.id);
      refreshOpenRuns();
    },
    [refreshOpenRuns]
  );

  const cancelGeneration = useCallback(() => {
    const ctrl = abortRef.current;
    if (ctrl && !ctrl.signal.aborted) {
      userCancelledRef.current = true;
      ctrl.abort();
      addLog('Cancel requested. Aborting in-flight API calls…');
      if (processingMode === 'batch' && runId && batchProgress?.batchId) {
        cancelMetadataBatch(batchProgress.batchId, runId).catch((err) =>
          addLog(`Batch cancel request failed: ${err instanceof Error ? err.message : String(err)}`)
        );
      } else if (runId) {
        updateMetadataRun(runId, { status: 'cancelled' });
      }
    }
  }, [addLog, processingMode, runId, batchProgress]);

  /**
   * Export: rebuilds the original workbook (preserving sheets and all original
   * columns) and fills the long-description column for every selected language
   * with the generated/localised content.
   *
   * Two column conventions are in play, the Inriver 'MaterialLongDescriptionEcom_<lang>'
   * one and the PIM export's 'Ecom Long Desc_<locale>' one, so the target
   * column follows whichever the source file uses. A resumed run whose
   * workbook could not be restored exports the generated columns only.
   */
  const exportResults = useCallback(async (): Promise<Blob> => {
    const workbook = new Workbook();
    const isPim = format?.type === 'pim-longdesc';
    const resultByMatNo = new Map<string, GeneratedProduct>();
    for (const r of results) {
      resultByMatNo.set(String(r.product.materialNumber), r);
    }

    const sourceSheets: ParsedSheet[] =
      sheets.length > 0
        ? sheets
        : [
            {
              name: 'Generated',
              headers: ['Material Number', 'Material Description', 'Brand'],
              data: results.map((r) => ({
                'Material Number': r.product.materialNumber,
                'Material Description': r.product.productName,
                Brand: r.product.brand,
              })),
            },
          ];

    for (const sheet of sourceSheets) {
      const ws = workbook.addWorksheet(sheet.name || 'Sheet1');

      // Ensure every selected language has a target column in the output
      const headers = [...sheet.headers];
      for (const lang of selectedLanguages) {
        const locale = pimLocaleByCode(lang)?.locale;
        const col = isPim && locale ? pimLongDescColumn(locale) : targetColumnFor(lang);
        if (!headers.includes(col)) headers.push(col);
      }
      ws.addRow(headers);

      // Compute material-number column for this sheet
      const matCol = headers.find(
        (h) => h === 'Material Number' || h.toLowerCase() === 'materialsapmaterialno'
      );

      for (const row of sheet.data) {
        const rowOut: unknown[] = [];
        const matNo = matCol ? String(row[matCol] ?? '') : '';
        const generated = matNo ? resultByMatNo.get(matNo) : undefined;

        for (const h of headers) {
          const lang = languageCodeForColumn(h);
          if (lang && generated && generated.translations[lang]) {
            rowOut.push(generated.translations[lang]);
          } else {
            rowOut.push(row[h] ?? '');
          }
        }
        ws.addRow(rowOut);
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }, [results, sheets, selectedLanguages, format]);

  /**
   * Export: the SFCC upload template Masterdata feeds back into the PIM, one
   * row per product and locale, keyed by numeric LanguageID.
   *
   * Only generated content is written. A locale that produced nothing for a SKU
   * is left out rather than uploaded empty, which would blank the live copy.
   */
  const exportSfccImport = useCallback(async (): Promise<Blob> => {
    const workbook = new Workbook();
    const ws = workbook.addWorksheet(SFCC_IMPORT_SHEET_NAME);
    ws.addRow([...SFCC_IMPORT_HEADERS]);

    // Grouped by locale, then by product, matching the files Masterdata sends.
    for (const locale of PIM_LOCALES) {
      if (!selectedLanguages.includes(locale.code)) continue;
      for (const r of results) {
        const description = r.translations[locale.code];
        if (!description || !description.trim()) continue;
        ws.addRow([locale.languageId, String(r.product.materialNumber), description, '']);
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }, [results, selectedLanguages]);

  const reset = useCallback(() => {
    if (abortRef.current && !abortRef.current.signal.aborted) {
      abortRef.current.abort();
    }
    abortRef.current = null;
    setStep(MetadataGenerationStep.UPLOAD);
    setFile(null);
    setSheets([]);
    setProducts([]);
    setSelectedBrands([]);
    setExclusionInput('');
    setFormat(null);
    setSelectedLanguages(INRIVER_LANGUAGES.map((l) => l.code));
    setIsProcessing(false);
    setProgress({ current: 0, total: 0 });
    setBatchProgress(null);
    setLogs([]);
    setResults([]);
    setError(null);
    setLocaleMismatches([]);
    setTotals(emptyTotals());
    setEstimate(null);
    setRunId(null);
    refreshOpenRuns();
  }, [refreshOpenRuns]);

  return {
    step,
    setStep,
    file,
    products,
    queuedProducts,
    selectedBrands,
    setSelectedBrands,
    exclusionInput,
    setExclusionInput,
    excludedSkus,
    format,
    selectedLanguages,
    setSelectedLanguages,
    processingMode,
    setProcessingMode,
    isProcessing,
    progress,
    batchProgress,
    logs,
    results,
    error,
    localeMismatches,
    totals,
    estimate,
    estimating,
    estimateCost,
    runId,
    openRuns,
    refreshOpenRuns,
    resumeRun,
    dismissRun,
    parseFile,
    startGeneration,
    cancelGeneration,
    exportResults,
    exportSfccImport,
    reset,
  };
}
