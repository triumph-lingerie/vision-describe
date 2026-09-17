import React, { useRef, useMemo, useCallback, useEffect } from 'react';
import { Upload, AlertCircle, Cloud, Play, X, Zap, Layers } from 'lucide-react';
import { StepIndicator, type StepDef } from '@/components/ui/step-indicator';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { formatUsd } from '@/lib/pricing';
import { useMetadataGeneration, type ProcessingMode } from '../../hooks/useMetadataGeneration';
import { MetadataGenerationStep, METADATA_GENERATION_MODEL } from '../../types';
import {
  EN_MASTER_EFFORT,
  EN_MASTER_MODEL,
  LOCALISATION_EFFORT,
  LOCALISATION_MODEL,
} from '../../generationConfig';
import { MetadataLanguageMultiSelect } from './MetadataLanguageMultiSelect';
import { GenerationResult } from './GenerationResult';
import { useApiKeys } from '@/contexts/ApiKeysContext';
import { toast } from 'sonner';

function SpecRow({
  label,
  value,
  mono = false,
  truncate = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <dt className="label-mono-sm shrink-0">{label}</dt>
      <dd
        className={cn(
          'text-foreground text-right min-w-0',
          mono && 'font-mono text-xs tabular-nums',
          truncate && 'truncate',
        )}
        title={truncate ? value : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

interface MetadataGenerationFlowProps {
  onBack: () => void;
}

const STEP_DEFS: StepDef<MetadataGenerationStep>[] = [
  { key: MetadataGenerationStep.UPLOAD, label: 'Upload' },
  { key: MetadataGenerationStep.FORMAT_DETECT, label: 'Detect' },
  { key: MetadataGenerationStep.LANGUAGES, label: 'Languages' },
  { key: MetadataGenerationStep.PROCESSING, label: 'Processing' },
  { key: MetadataGenerationStep.RESULT, label: 'Result' },
];

const MODE_OPTIONS: Array<{
  value: ProcessingMode;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    value: 'live',
    label: 'Live',
    hint: 'Results as they come, keep the tab open',
    icon: Zap,
  },
  {
    value: 'batch',
    label: 'Batch',
    hint: 'Half price, results within the hour, tab can be closed',
    icon: Layers,
  },
];

export const MetadataGenerationFlow: React.FC<MetadataGenerationFlowProps> = ({
  onBack,
}) => {
  const { anthropicKey } = useApiKeys();

  const {
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
    openRuns,
    resumeRun,
    dismissRun,
    parseFile,
    startGeneration,
    cancelGeneration,
    exportResults,
    exportSfccImport,
    reset,
  } = useMetadataGeneration();

  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const f = e.target.files?.[0];
    if (f) await parseFile(f);
  };

  const handleDrop: React.DragEventHandler = async (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) await parseFile(f);
  };

  const requireKey = useCallback((): boolean => {
    if (!anthropicKey) {
      toast.error('Anthropic API Key Missing', {
        description: `This flow uses ${METADATA_GENERATION_MODEL}. Configure your Anthropic key in Settings.`,
      });
      return false;
    }
    return true;
  }, [anthropicKey]);

  const handleStart = () => {
    if (!requireKey()) return;
    startGeneration(anthropicKey);
  };

  const handleResume = (run: (typeof openRuns)[number]) => {
    if (!requireKey()) return;
    resumeRun(run, anthropicKey);
  };

  // Pre-run estimate whenever the queue, the languages or the mode change on
  // the languages step. Token counting is free; it just needs the key.
  useEffect(() => {
    if (step !== MetadataGenerationStep.LANGUAGES || !anthropicKey) return;
    const t = window.setTimeout(() => estimateCost(anthropicKey), 400);
    return () => window.clearTimeout(t);
  }, [step, anthropicKey, estimateCost, processingMode]);

  /** One line per affected SKU: 'de_DE holds fr_FR, nl_NL holds de_DE'. */
  const mismatchSkus = useMemo(() => {
    const bySku = new Map<string, string[]>();
    for (const m of localeMismatches) {
      const detail = m.detectedLocale
        ? `${m.declaredLocale} holds ${m.detectedLocale}`
        : `${m.declaredLocale} is not ${m.declaredLocale}`;
      const list = bySku.get(m.materialNumber);
      if (list) list.push(detail);
      else bySku.set(m.materialNumber, [detail]);
    }
    return Array.from(bySku.entries()).map(([materialNumber, details]) => ({
      materialNumber,
      columns: details.join(', '),
    }));
  }, [localeMismatches]);

  const brandBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      const b = (p.brand || 'unknown').trim();
      counts.set(b, (counts.get(b) || 0) + 1);
    }
    return Array.from(counts.entries());
  }, [products]);

  const opsPerProduct =
    selectedLanguages.length === 0
      ? 0
      : selectedLanguages.includes('en')
        ? selectedLanguages.length
        : selectedLanguages.length + 1;

  const toggleBrand = useCallback(
    (brand: string) => {
      setSelectedBrands((prev) =>
        prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
      );
    },
    [setSelectedBrands]
  );

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleDropZoneKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openFilePicker();
    }
  };

  const batchPercent =
    batchProgress && batchProgress.total > 0
      ? Math.round(
          ((batchProgress.succeeded + batchProgress.errored + batchProgress.expired) /
            batchProgress.total) *
            100
        )
      : 0;

  return (
    <div className="">
      <StepIndicator steps={STEP_DEFS} currentStep={step} />

      {step === MetadataGenerationStep.UPLOAD && (
        <section className="">
          {openRuns.length > 0 && (
            <div className="mb-6 space-y-3">
              {openRuns.map((run) => {
                const cfg = run.config;
                const isBatch = cfg.mode === 'batch';
                const date = new Date(run.created_at).toLocaleString();
                return (
                  <div key={run.id} className="border border-border bg-muted/30 px-5 py-4">
                    <div className="flex items-start gap-3">
                      <Cloud className="h-4 w-4 text-signal mt-0.5 shrink-0" aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <p className="label-mono">
                          <span
                            className={cn('status-dot mr-2 align-middle', run.status === 'running' && 'animate-pulse')}
                          />
                          {isBatch ? 'Batch run' : 'Live run'}{' '}
                          {run.status === 'running' ? 'in progress' : 'interrupted'}
                        </p>
                        <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-xs font-mono text-muted-foreground">
                          {cfg.fileName && <span title={cfg.fileName}>{cfg.fileName}</span>}
                          <span>{cfg.products.length} products</span>
                          <span>{cfg.languages.join(', ')}</span>
                          <span>
                            {run.processed_count || 0} / {run.total_rows} done
                          </span>
                          <span>{date}</span>
                          {isBatch && cfg.batch?.phase && (
                            <span>
                              phase {cfg.batch.phase === 'en' ? 'EN masters' : 'localisations'}
                              {cfg.batch[`${cfg.batch.phase}Collected`] ? ', collected' : ''}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                          <Button size="sm" onClick={() => handleResume(run)} disabled={isProcessing}>
                            <Play className="h-3.5 w-3.5 mr-1.5" />
                            {isBatch ? 'Reconnect' : 'Resume'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => dismissRun(run)} disabled={isProcessing}>
                            <X className="h-3.5 w-3.5 mr-1.5" />
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mb-4">
            <p className="label-mono mb-1">Step 01 / Input</p>
            <h2 className="text-base font-semibold tracking-tightest text-foreground">
              Upload product metadata file
            </h2>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              Excel file with product metadata for new SKUs (AW26 compact or B2C
              standard headers), or a PIM long-description export to rewrite.
              Multi-sheet workbooks are read in full.
            </p>
          </div>

          <input
            type="file"
            accept=".xlsx,.xls,.xlsm"
            className="hidden"
            ref={inputRef}
            onChange={handleFileChange}
          />

          <div
            role="button"
            tabIndex={0}
            aria-label="Drag and drop product metadata file or click to browse"
            onClick={openFilePicker}
            onKeyDown={handleDropZoneKeyDown}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="flex flex-col items-center justify-center gap-3 border border-dashed border-border bg-card p-12 cursor-pointer transition-colors hover:border-foreground/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2"
          >
            <Upload className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <div className="text-center">
              <p className="label-mono mb-1">Drop file or click to browse</p>
              <p className="text-xs text-muted-foreground font-mono">.xlsx · .xls · .xlsm</p>
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}

          <div className="mt-6">
            <button
              type="button"
              onClick={onBack}
              className="label-mono-sm hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2"
            >
              ← Back to mode selection
            </button>
          </div>
        </section>
      )}

      {step === MetadataGenerationStep.FORMAT_DETECT && format && (
        <section className="">
          <div className="mb-4">
            <p className="label-mono mb-1">Step 02 / Detect</p>
            <h2 className="text-base font-semibold tracking-tightest text-foreground">
              File detected
            </h2>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              Confirm the format, scope the queue by brand, and exclude any SKUs
              that should not enter the batch.
            </p>
          </div>

          <dl className="border border-border divide-y divide-border bg-card text-sm">
            <SpecRow label="Format" value={format.type} mono />
            <SpecRow label="Products" value={String(products.length)} mono />
            <SpecRow label="Sheets" value={format.sheetNames.join(', ')} mono truncate />
            <SpecRow label="File" value={file?.name ?? ''} truncate />
          </dl>

          {brandBreakdown.length > 0 && (
            <div className="mt-6 space-y-5">
              <div>
                <div className="flex items-baseline justify-between mb-3">
                  <p className="label-mono">Brand filter</p>
                  <p className="label-mono-sm normal-case tracking-normal">
                    click to include / exclude
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {brandBreakdown.map(([b, n]) => {
                    const on = selectedBrands.includes(b);
                    return (
                      <button
                        key={b}
                        type="button"
                        aria-pressed={on}
                        aria-label={`${b}, ${n} products, ${on ? 'included' : 'excluded'}`}
                        onClick={() => toggleBrand(b)}
                        className={cn(
                          'inline-flex items-center border px-2.5 py-1 text-xs font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2',
                          on
                            ? 'border-signal bg-signal/10 text-signal'
                            : 'border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground',
                        )}
                      >
                        <span className={cn(on && 'text-signal')}>{b}</span>
                        <span
                          className={cn(
                            'ml-1.5 tabular-nums',
                            on ? 'text-signal/70' : 'text-muted-foreground/70',
                          )}
                        >
                          × {n}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {selectedBrands.length === 0 && (
                  <p className="mt-2 text-xs text-destructive">Select at least one brand to proceed.</p>
                )}
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-3">
                  <Label htmlFor="sku-exclusion" className="label-mono">
                    Exclude SKUs
                  </Label>
                  <span className="label-mono-sm normal-case tracking-normal tabular-nums">
                    {excludedSkus.length > 0 ? `${excludedSkus.length} excluded` : 'optional'}
                  </span>
                </div>
                <Textarea
                  id="sku-exclusion"
                  value={exclusionInput}
                  onChange={(e) => setExclusionInput(e.target.value)}
                  placeholder="e.g. 10228663, 10228693, 10228698 (comma, space or newline separated)"
                  rows={2}
                  className="font-mono text-xs"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Material Numbers listed here are dropped from the queue after the brand filter.
                </p>
              </div>
            </div>
          )}

          {format.type === 'unknown' && (
            <div className="mt-4 flex items-center gap-2 border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              Unknown format: the file needs either AW26 compact headers, B2C
              standard headers, or the PIM long-description export columns.
            </div>
          )}

          {format.type === 'longdesc-rework' && (
            <div className="mt-4 border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              Rework mode: each SKU's existing long description is rewritten to
              brand standard in English, then localised into the locale columns
              already present in the file. Existing columns are overwritten in
              place. Rows with no existing copy fall back to the product name.
            </div>
          )}

          {format.type === 'pim-longdesc' && (
            <div className="mt-4 border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              PIM export detected. Each SKU's existing long description is
              rewritten to brand standard in English, then localised into the
              locales the file carries. At the end you get the SFCC upload
              template, ready to load back into the PIM.
            </div>
          )}

          {localeMismatches.length > 0 && (
            <div className="mt-4 border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="font-medium">
                  {mismatchSkus.length} product{mismatchSkus.length === 1 ? '' : 's'} with a
                  locale column in the wrong language
                </span>
              </div>
              <p className="mt-2 text-muted-foreground">
                These columns hold text in a language other than the one the
                header names, so a rewrite would start from the wrong source.
                Check them in the PIM, or exclude the SKUs above.
              </p>
              <ul className="mt-2 space-y-0.5 font-mono text-xs text-muted-foreground">
                {mismatchSkus.slice(0, 8).map((m) => (
                  <li key={m.materialNumber}>
                    {m.materialNumber}: {m.columns}
                  </li>
                ))}
              </ul>
              {mismatchSkus.length > 8 && (
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  … {mismatchSkus.length - 8} more
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-6 mt-6 border-t border-border">
            <Button variant="ghost" onClick={() => reset()}>
              Upload different file
            </Button>
            <Button
              onClick={() => setStep(MetadataGenerationStep.LANGUAGES)}
              disabled={products.length === 0 || selectedBrands.length === 0}
            >
              Next: Select languages
              {selectedBrands.length > 0 && queuedProducts.length !== products.length ? (
                <span className="ml-2 font-mono text-xs tabular-nums opacity-70">
                  ({queuedProducts.length}/{products.length})
                </span>
              ) : null}
            </Button>
          </div>
        </section>
      )}

      {step === MetadataGenerationStep.LANGUAGES && (
        <MetadataLanguageMultiSelect
          selectedLanguages={selectedLanguages}
          onSelectionChange={setSelectedLanguages}
          onNext={handleStart}
          onBack={() => setStep(MetadataGenerationStep.FORMAT_DETECT)}
          summary={
            <div className="space-y-4">
              <div>
                <p className="label-mono mb-2">Processing mode</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MODE_OPTIONS.map(({ value, label, hint, icon: Icon }) => {
                    const on = processingMode === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setProcessingMode(value)}
                        className={cn(
                          'flex items-start gap-3 border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2',
                          on
                            ? 'border-signal bg-signal/10'
                            : 'border-border bg-card hover:border-foreground/40',
                        )}
                      >
                        <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', on ? 'text-signal' : 'text-muted-foreground')} />
                        <span>
                          <span className={cn('block text-sm font-medium', on ? 'text-signal' : 'text-foreground')}>
                            {label}
                          </span>
                          <span className="block text-xs text-muted-foreground">{hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border border-border bg-card px-4 py-3 text-xs text-muted-foreground space-y-1">
                <p>
                  {queuedProducts.length} products × {opsPerProduct} ={' '}
                  <span className="font-mono">{queuedProducts.length * opsPerProduct}</span> calls.
                  EN master on <span className="font-mono">{EN_MASTER_MODEL}</span> ({EN_MASTER_EFFORT}),
                  localisations on <span className="font-mono">{LOCALISATION_MODEL}</span> ({LOCALISATION_EFFORT}).
                </p>
                {estimating && <p>Counting prompt tokens…</p>}
                {!estimating && estimate && (
                  <p>
                    Estimated cost:{' '}
                    <span className={cn('font-mono', processingMode === 'live' && 'text-foreground')}>
                      {formatUsd(estimate.liveUsd)} live
                    </span>{' '}
                    ·{' '}
                    <span className={cn('font-mono', processingMode === 'batch' && 'text-foreground')}>
                      {formatUsd(estimate.batchUsd)} batch
                    </span>
                    <span className="block mt-1 opacity-80">{estimate.basedOn}.</span>
                  </p>
                )}
                {!estimating && !estimate && anthropicKey && (
                  <p>Estimate unavailable (the token count call failed; the run still works).</p>
                )}
              </div>
            </div>
          }
          nextLabel={processingMode === 'batch' ? 'Submit batch' : 'Start generation'}
        />
      )}

      {step === MetadataGenerationStep.PROCESSING && (
        <section className="">
          <div className="mb-5">
            <div className="flex items-baseline justify-between gap-4 mb-2">
              <p className="label-mono">
                <span className="status-dot animate-pulse mr-2 align-middle" />
                Processing
              </p>
              {processingMode === 'batch' && batchProgress ? (
                <p className="font-mono text-xs tabular-nums text-muted-foreground">
                  {batchProgress.succeeded + batchProgress.errored + batchProgress.expired} /{' '}
                  {batchProgress.total}
                </p>
              ) : (
                <p className="font-mono text-xs tabular-nums text-muted-foreground">
                  {progress.current.toString().padStart(3, '0')} /{' '}
                  {progress.total.toString().padStart(3, '0')}
                </p>
              )}
            </div>
            <h2 className="text-base font-semibold tracking-tightest text-foreground">
              {processingMode === 'batch' ? 'Batch in progress' : 'Generating descriptions'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {processingMode === 'batch'
                ? `${batchProgress ? `${batchProgress.phase === 'en' ? 'EN masters' : 'Localisations'}: ${batchProgress.step}. ` : ''}Anthropic processes the batch on its side; this tab can be closed and the run picked up again from the upload screen.`
                : `Running ${METADATA_GENERATION_MODEL} on the queued products. Do not close the tab; if you do, the run can be resumed from the upload screen.`}
            </p>
          </div>

          <Progress
            value={
              processingMode === 'batch'
                ? batchPercent
                : progress.total > 0
                  ? (progress.current / progress.total) * 100
                  : 0
            }
            className="h-1"
          />

          {logs.length > 0 && (
            <ScrollArea className="h-40 mt-5 border border-border bg-card p-3">
              <div className="space-y-1">
                {logs.map((log, i) => (
                  <p key={i} className="text-xs text-muted-foreground font-mono">
                    {log}
                  </p>
                ))}
              </div>
            </ScrollArea>
          )}

          <div className="mt-6 flex flex-col items-start gap-1">
            <Button variant="destructive" size="sm" onClick={cancelGeneration} disabled={!isProcessing}>
              {processingMode === 'batch' ? 'Cancel batch' : 'Cancel & abort in-flight calls'}
            </Button>
            <p className="text-xs text-muted-foreground">
              {processingMode === 'batch'
                ? 'Asks Anthropic to stop the batch. Requests already processed are still billed.'
                : 'Aborts all pending API calls immediately. Partial results are kept.'}
            </p>
          </div>
        </section>
      )}

      {step === MetadataGenerationStep.RESULT && (
        <GenerationResult
          results={results}
          selectedLanguages={selectedLanguages}
          onExport={exportResults}
          onExportSfccImport={format?.type === 'pim-longdesc' ? exportSfccImport : undefined}
          onReset={reset}
          costUsd={totals.costUsd}
          mode={processingMode}
        />
      )}
    </div>
  );
};
