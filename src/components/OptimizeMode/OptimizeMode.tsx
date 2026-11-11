/**
 * OptimizeMode — The inner content of the Optimize flow,
 * extracted for use within AppShell tabs. No ThemeProvider, Header, or Footer wrapper.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useHybridProcessing } from './hooks/useHybridProcessing';
import { useCostTracker } from './hooks/useCostTracker';
import { models } from '@/lib/models';
import { ProcessingStep } from './types';
import { UseCase, AVAILABLE_USE_CASES } from './usecases';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, RefreshCw, Download } from 'lucide-react';
import { StepIndicator, type StepDef } from '@/components/ui/step-indicator';
import { Workbook } from 'exceljs';
import { useApiKeys } from '@/contexts/ApiKeysContext';
import {
  getProjects,
  createProject,
  type ProjectWithStats,
} from '@/lib/projectPersistence';

import FileUpload from './components/FileUpload';
import ResumeRunBanner from './components/ResumeRunBanner';
import TokenCounter from './components/TokenCounter';
import ColumnSelector from './components/ColumnSelector';
import ColumnConfirmation from './components/ColumnConfirmation';
import ProcessingView from './components/ProcessingView';
import ExportResults from './components/ExportResults';
import BusinessIdFilterUpload from './components/BusinessIdFilterUpload';
import StoreTypeFilter from './components/StoreTypeFilter';
import { TranslatorPanel } from './components/TranslatorPanel';
import { COLOR_TRANSLATIONS, type ColorMapping } from './utils/translations/colorTranslations';
import { SIZE_TRANSLATION_TABLE, type SizeMapping } from './utils/translations/sizeTranslations';
import { getModelById } from '@/lib/models';
import {
  findInterruptedRuns,
  getCompletedRowIndices,
  getRunResults,
  dismissRun,
  type RunRecord,
} from '@/lib/runPersistence';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { isLongDescriptionColumn } from '@/lib/longDescriptionColumns';

// ─── Step Definitions ─────────────────────────────────────────────────────────

// Hardcoded model for the Optimize flow.
// Claude Fable 5.2 — most capable Anthropic model. No user selector exposed.
const OPTIMIZE_MODEL = 'claude-fable-5-2';

const getStepsForUseCase = (useCase: UseCase | ''): StepDef<ProcessingStep>[] => {
  switch (useCase) {
    case 'partoo':
      return [
        { key: ProcessingStep.UPLOAD, label: 'Upload' },
        { key: ProcessingStep.PROCESSING, label: 'Processing' },
        { key: ProcessingStep.COMPLETE, label: 'Complete' },
      ];
    case 'aboutyou':
    case 'next':
      return [
        { key: ProcessingStep.UPLOAD, label: 'Upload' },
        { key: ProcessingStep.CONFIRM_COLUMNS, label: 'Translations' },
        { key: ProcessingStep.PROCESSING, label: 'Processing' },
        { key: ProcessingStep.COMPLETE, label: 'Complete' },
      ];
    default: // ecommerce, amazon
      return [
        { key: ProcessingStep.UPLOAD, label: 'Upload' },
        { key: ProcessingStep.SELECT_COLUMNS, label: 'Columns' },
        { key: ProcessingStep.CONFIRM_COLUMNS, label: 'Confirm' },
        { key: ProcessingStep.PROCESSING, label: 'Processing' },
        { key: ProcessingStep.COMPLETE, label: 'Complete' },
      ];
  }
};

// ─── OptimizeMode Component ──────────────────────────────────────────────────

export const OptimizeMode: React.FC = () => {
  // API keys from user settings
  const { anthropicKey, hasKeys } = useApiKeys();

  // Project selection
  const [projects, setProjectsList] = useState<ProjectWithStats[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Current step
  const [currentStep, setCurrentStep] = useState<ProcessingStep>(ProcessingStep.UPLOAD);

  // File data
  const [fileData, setFileData] = useState<{
    rows: any[];
    columns: string[];
    meta?: any;
  } | null>(null);

  // Selected columns
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  // Column mappings (for confirmation step)
  const [columnMappings, setColumnMappings] = useState<any>([]);

  // Selected model
  const [selectedModel, setSelectedModel] = useState<string>('');

  // Business ID Filter
  const [businessIdsFilter, setBusinessIdsFilter] = useState<Set<string> | null>(null);

  // Store Type Filter (Partoo)
  const [storeTypeFilter, setStoreTypeFilter] = useState<Set<string> | null>(null);

  // Translation mappings for NEXT/AboutYou
  const [colorMappings, setColorMappings] = useState<ColorMapping[]>([...COLOR_TRANSLATIONS]);
  const [sizeMappings, setSizeMappings] = useState<SizeMapping[]>([...SIZE_TRANSLATION_TABLE]);

  // Processing state
  const {
    isProcessing,
    progress,
    totalRows,
    processedRows,
    logs,
    estimatedTimeRemaining,
    processingMode,
    costTracker,
    processFile,
    cancelProcessing,
    reconnectToRun,
  } = useHybridProcessing();

  const [processedData, setProcessedData] = useState<any[] | null>(null);
  const [processingStartTime, setProcessingStartTime] = useState<Date | null>(null);
  const [processingEndTime, setProcessingEndTime] = useState<Date | null>(null);

  // Use case selection (no default — user must choose)
  const [useCase, setUseCase] = useState<UseCase | ''>('');

  // Resume state
  const [interruptedRuns, setInterruptedRuns] = useState<RunRecord[]>([]);
  const [resumingRun, setResumingRun] = useState<RunRecord | null>(null);

  // Load projects on mount
  useEffect(() => {
    getProjects().then(setProjectsList).catch(() => {});
  }, []);

  // Load interrupted runs on mount
  useEffect(() => {
    findInterruptedRuns()
      .then((runs) => setInterruptedRuns(runs))
      .catch(() => {});
  }, []);

  const handleResumeRun = (run: RunRecord) => {
    setResumingRun(run);
    setUseCase(run.use_case as UseCase);
    toast('Upload the same file to resume processing', {
      description: `Re-upload the file "${run.file_name || 'original file'}" to continue where you left off.`,
    });
  };

  /** Reconnect to a server-side run that's still running */
  const handleReconnectRun = async (run: RunRecord) => {
    setUseCase(run.use_case as UseCase);
    setSelectedModel(run.model_id);
    setCurrentStep(ProcessingStep.PROCESSING);
    setProcessingStartTime(new Date());
    // Remove from interrupted list so banner hides
    setInterruptedRuns((prev) => prev.filter((r) => r.id !== run.id));

    try {
      const results = await reconnectToRun(run);
      setProcessedData(results);
      setProcessingEndTime(new Date());
      setCurrentStep(ProcessingStep.COMPLETE);
      toast('File processed successfully!', {
        description: 'Server-side processing completed.',
      });
    } catch (error) {
      console.error('Reconnect error:', error);
      toast.error('Processing error', {
        description: error instanceof Error ? error.message : 'Server run failed.'
      });
      setCurrentStep(ProcessingStep.UPLOAD);
      // Re-fetch interrupted runs
      findInterruptedRuns().then(setInterruptedRuns).catch(() => {});
    }
  };

  const handleDismissRun = async (run: RunRecord) => {
    await dismissRun(run.id);
    setInterruptedRuns((prev) => prev.filter((r) => r.id !== run.id));
  };

  // Handle file upload
  const handleFileUploaded = async (data: { rows: any[]; columns: string[]; meta?: any }) => {
    setFileData(data);
    setBusinessIdsFilter(null);
    setStoreTypeFilter(null);

    // --- Resume flow: if resuming, validate and fast-track to processing ---
    if (resumingRun) {
      if (data.rows.length !== resumingRun.total_rows) {
        toast.error('Row count mismatch', {
          description: `Expected ${resumingRun.total_rows} rows but got ${data.rows.length}. Please upload the same file.`
        });
        setResumingRun(null);
        return;
      }

      try {
        const [skipIndices, results] = await Promise.all([
          getCompletedRowIndices(resumingRun.id),
          getRunResults(resumingRun.id),
        ]);

        // Pre-populate existing results
        const existingResults = results.map((r) => r.result_data as Record<string, unknown>);

        toast(`Resuming: ${skipIndices.size} of ${resumingRun.total_rows} rows already done`, {
          description: 'Processing remaining rows...',
        });

        // Remove from interrupted list
        setInterruptedRuns((prev) => prev.filter((r) => r.id !== resumingRun.id));

        // Determine model & API key from the run config
        const modelConfig = getModelById(resumingRun.model_id);
        if (!modelConfig) {
          toast.error('Model not found', {
            description: `Model "${resumingRun.model_id}" is no longer available.`
          });
          setResumingRun(null);
          return;
        }
        const apiKey = anthropicKey;
        if (!apiKey) {
          toast.error('API Key Missing', {
            description: 'Configure your API keys in Settings before processing.'
          });
          setResumingRun(null);
          return;
        }

        setSelectedModel(resumingRun.model_id);
        setCurrentStep(ProcessingStep.PROCESSING);
        setProcessingStartTime(new Date());

        const runUseCase = resumingRun.use_case as UseCase;
        const processedRowsData = await processFile(
          data.rows,
          data.columns,
          modelConfig,
          apiKey,
          {
            useCase: runUseCase || 'ecommerce',
            resumeRunId: resumingRun.id,
            skipIndices,
            existingResults,
            fileName: resumingRun.file_name || undefined,
          },
          costTracker
        );

        setProcessedData(processedRowsData);
        setProcessingEndTime(new Date());
        setCurrentStep(ProcessingStep.COMPLETE);
        setResumingRun(null);
        toast('File processed successfully!', {
          description: 'Your file has been optimized successfully.',
        });
        return;
      } catch (error) {
        console.error('Resume error:', error);
        toast.error('Error resuming run', {
          description: error instanceof Error ? error.message : 'Please try again.'
        });
        setResumingRun(null);
        return;
      }
    }

    if (useCase === 'partoo') {
      const partooColumns = data.columns.filter(col => {
        if (!col || typeof col !== 'string') return false;
        const colLower = col.toLowerCase().trim();
        return !(
          /^business.?id$/i.test(col) ||
          /^code$/i.test(col) ||
          /^siret$/i.test(col) ||
          /^unnamed/i.test(col) ||
          /local.?or.?global/i.test(col) ||
          /creation.?date/i.test(col) ||
          /closed.?date/i.test(col) ||
          /address.?complement/i.test(col) ||
          colLower === '' ||
          colLower.startsWith('business default')
        );
      });

      setSelectedColumns(partooColumns);

      const findColumn = (patterns: RegExp[]): string | undefined => {
        return data.columns.find(col =>
          col && patterns.some(pattern => pattern.test(col))
        );
      };

      const partooMapping = {
        mapping: {
          businessId: findColumn([/^Business identification$/i, /^Business\s*Id$/i]),
          name: findColumn([/^Name$/i, /^Nom$/i]),
          address: findColumn([/^Address$/i, /^Adresse$/i]),
          city: findColumn([/^City$/i, /^Ville$/i]),
          zipcode: findColumn([/^Zipcode$/i, /^Code postal$/i]),
          country: findColumn([/^Country$/i, /^Pays$/i]),
          status: findColumn([/^Status$/i, /^Statut$/i]),
          shortDescription: findColumn([/^Short description/i]),
          longDescription: findColumn([/^Long description/i]),
          businessOpeningDate: findColumn([/^business.?opening.?date$/i, /^Date d'ouverture$/i]),
          about: findColumn([/^About$/i]),
          groups: findColumn([/^Groupes?$/i, /^Groups?$/i]),
          mainCategory: findColumn([/^Cat[eé]gorie principale$/i, /^Main category$/i]),
          secondaryCategories: findColumn([/^Cat[eé]gories additionnelles$/i, /^Secondary categories$/i]),
          inStoreServices: findColumn([/^In Store Services$/i]),
          bookAFitting: findColumn([/^Book a Fitting$/i]),
          triumphOutlets: findColumn([/^Triumph Outlets$/i]),
        }
      };

      setColumnMappings(partooMapping);
      // Stay on UPLOAD step so user can see/use filters before proceeding
    } else if (useCase === 'next' || useCase === 'aboutyou') {
      setSelectedColumns(data.columns);
      setColorMappings([...COLOR_TRANSLATIONS]);
      setSizeMappings([...SIZE_TRANSLATION_TABLE]);
      setCurrentStep(ProcessingStep.CONFIRM_COLUMNS);
    } else {
      setCurrentStep(ProcessingStep.SELECT_COLUMNS);
    }
  };

  const handleColumnsSelected = (columns: string[]) => {
    setSelectedColumns(columns);
    setCurrentStep(ProcessingStep.CONFIRM_COLUMNS);
  };

  const handleColumnConfirmation = (mappings: any) => {
    setColumnMappings(mappings);
    void handleStartProcessing(mappings);
  };

  const handleBackToColumnSelection = () => {
    setCurrentStep(ProcessingStep.SELECT_COLUMNS);
  };

  const handleStartProcessing = async (
    mappingsOverride?: any,
    options?: { dryRun?: boolean; targetLanguage?: string },
  ) => {
    const model = OPTIMIZE_MODEL;
    if (!anthropicKey) {
      toast.error('Anthropic API Key Missing', {
        description: `This flow uses ${model}. Configure your Anthropic key in Settings.`,
      });
      return;
    }

    const effectiveMappings = mappingsOverride ?? columnMappings;
    const apiKey = anthropicKey;

    setSelectedModel(model);
    setCurrentStep(ProcessingStep.PROCESSING);
    setProcessingStartTime(new Date());

    if (!fileData) return;

    try {
      const modelConfig = getModelById(model);
      if (!modelConfig) {
        throw new Error('Invalid model selected');
      }

      const processedRowsData = await processFile(
        fileData.rows,
        selectedColumns,
        modelConfig,
        apiKey as string,
        {
          useCase: useCase || 'ecommerce',
          mappings: effectiveMappings,
          dryRun: options?.dryRun,
          lang: options?.targetLanguage,
          langs: effectiveMappings?.workLangs,
          businessIdsFilter: businessIdsFilter,
          storeTypeFilter: storeTypeFilter,
          colorMappings,
          sizeMappings,
          fileName: fileData.meta?.fileName,
          projectId: selectedProjectId || undefined,
        },
        costTracker
      );

      setProcessedData(processedRowsData);
      setProcessingEndTime(new Date());
      setCurrentStep(ProcessingStep.COMPLETE);
      toast('File processed successfully!', {
        description: 'Your file has been optimized successfully.',
      });
    } catch (error) {
      console.error('Error optimizing text:', error);
      toast.error('Error processing file', {
        description: error instanceof Error ? error.message : 'Please try again.'
      });
      setCurrentStep(ProcessingStep.CONFIRM_COLUMNS);
    }
  };

  const downloadProcessedFile = async () => {
    if (!processedData) return;

    try {
      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet("Optimized Descriptions");

      if (processedData.length > 0) {
        const headers = Object.keys(processedData[0]);
        worksheet.addRow(headers);
        processedData.forEach(row => {
          const values = headers.map(header => row[header] || '');
          worksheet.addRow(values);
        });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `optimized_descriptions_${timestamp}.xlsx`;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating Excel file:', error);
      toast.error('Error generating file', {
        description: 'Please try again.'
      });
    }
  };

  const getProcessingTime = () => {
    if (!processingStartTime || !processingEndTime) return null;
    const diff = processingEndTime.getTime() - processingStartTime.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const goBack = () => {
    switch (currentStep) {
      case ProcessingStep.SELECT_COLUMNS:
        setCurrentStep(ProcessingStep.UPLOAD);
        setFileData(null);
        setSelectedColumns([]);
        break;
      case ProcessingStep.CONFIRM_COLUMNS:
        setCurrentStep(ProcessingStep.SELECT_COLUMNS);
        setColumnMappings([]);
        break;
      case ProcessingStep.PROCESSING:
        break;
      case ProcessingStep.COMPLETE:
        reloadFile();
        break;
    }
  };

  const goForward = () => {
    switch (currentStep) {
      case ProcessingStep.UPLOAD:
        if (fileData) {
          // Partoo skips column selection — go straight to processing
          if (useCase === 'partoo') {
            void handleStartProcessing();
          } else {
            setCurrentStep(ProcessingStep.SELECT_COLUMNS);
          }
        }
        break;
      case ProcessingStep.SELECT_COLUMNS:
        if (selectedColumns.length > 0) {
          setCurrentStep(ProcessingStep.CONFIRM_COLUMNS);
        }
        break;
      case ProcessingStep.CONFIRM_COLUMNS:
        if (columnMappings.length > 0) {
          void handleStartProcessing();
        }
        break;
    }
  };

  const reloadFile = () => {
    setFileData(null);
    setSelectedColumns([]);
    setSelectedModel('');
    setProcessedData(null);
    setProcessingStartTime(null);
    setProcessingEndTime(null);
    setBusinessIdsFilter(null);
    setStoreTypeFilter(null);
    setUseCase('');
    setColorMappings([...COLOR_TRANSLATIONS]);
    setSizeMappings([...SIZE_TRANSLATION_TABLE]);
    setCurrentStep(ProcessingStep.UPLOAD);
  };

  const renderStep = () => {
    switch (currentStep) {
      case ProcessingStep.UPLOAD:
        return (
          <div className=" space-y-4 animate-fade-in">
            <ResumeRunBanner
              runs={interruptedRuns}
              onResume={handleResumeRun}
              onDismiss={handleDismissRun}
              onReconnect={handleReconnectRun}
            />
            {!hasKeys && (
              <div className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <p>
                  Configure your API keys in <strong>Settings</strong> before processing files.
                </p>
              </div>
            )}
            <section>
              <div className="mb-4">
                <p className="label-mono mb-1">Step 01 / Input</p>
                <h2 className="text-base font-semibold tracking-tightest text-foreground">
                  Upload your file
                </h2>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  Select a use case and upload your data file.
                </p>
              </div>
              <div className="border border-border bg-card p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Use Case</label>
                  <Select value={useCase} onValueChange={(v) => setUseCase(v as UseCase)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select use case" />
                    </SelectTrigger>
                    <SelectContent>
                      {([...AVAILABLE_USE_CASES].sort((a, b) => {
                        const order: Record<string, number> = { ecommerce: 0, amazon: 1, partoo: 2, aboutyou: 3, next: 4 };
                        const ao = order[a.value] ?? 99;
                        const bo = order[b.value] ?? 99;
                        if (ao !== bo) return ao - bo;
                        return a.label.localeCompare(b.label);
                      })).map((uc) => (
                          <SelectItem key={uc.value} value={uc.value}>
                            {uc.label}
                          </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {useCase && projects.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Project (optional)</label>
                    <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No project</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {useCase && (
                  <FileUpload onFileUploaded={handleFileUploaded} useCase={useCase} />
                )}
              </div>
            </section>

            {fileData && useCase === 'partoo' && (
              <>
                <BusinessIdFilterUpload
                  onFilterLoaded={(ids) => setBusinessIdsFilter(ids)}
                  onFilterCleared={() => setBusinessIdsFilter(null)}
                  disabled={isProcessing}
                />
                <StoreTypeFilter
                  rows={fileData.rows}
                  groupsColumnKey={columnMappings?.mapping?.groups || 'Groups'}
                  onFilterChange={(types) => setStoreTypeFilter(types)}
                  disabled={isProcessing}
                />
              </>
            )}
          </div>
        );

      case ProcessingStep.SELECT_COLUMNS:
        return (
          <div className="">
            <div className="mb-4">
              <p className="label-mono mb-1">Step 02 / Columns</p>
              {useCase === 'amazon' ? (
                <>
                  <h2 className="text-base font-semibold tracking-tightest text-foreground">Select columns (Amazon)</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Choose input columns such as rtip_product_description#1.value and bullet_point#*.value</p>
                </>
              ) : useCase === 'partoo' ? (
                <>
                  <h2 className="text-base font-semibold tracking-tightest text-foreground">Select store data columns (Partoo)</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Select columns like Name, City, Country, Short description, Long description</p>
                </>
              ) : (
                <>
                  <h2 className="text-base font-semibold tracking-tightest text-foreground">Select language variants</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Choose MaterialLongDescriptionEcom columns to optimize (with or without Color prefix)</p>
                </>
              )}
            </div>

            <ColumnSelector
              useCase={useCase || 'ecommerce'}
              columns={(() => {
                const cols = fileData?.columns || [];
                if (useCase === 'amazon' || useCase === 'partoo') return cols;
                return cols.filter(isLongDescriptionColumn);
              })()}
              onColumnsSelected={handleColumnsSelected}
            />
          </div>
        );

      case ProcessingStep.CONFIRM_COLUMNS:
        if (useCase === 'next' || useCase === 'aboutyou') {
          return (
            <div className="">
              <TranslatorPanel
                useCase={useCase}
                colorMappings={colorMappings}
                onColorMappingsChange={setColorMappings}
                sizeMappings={useCase === 'next' ? sizeMappings : undefined}
                onSizeMappingsChange={useCase === 'next' ? setSizeMappings : undefined}
                onConfirm={() => void handleStartProcessing()}
                onBack={() => {
                  setCurrentStep(ProcessingStep.UPLOAD);
                  setFileData(null);
                }}
              />
            </div>
          );
        }
        return (
          <ColumnConfirmation
            fileData={fileData!}
            selectedColumns={selectedColumns}
            useCase={useCase || 'ecommerce'}
            onConfirm={handleColumnConfirmation}
            onBack={handleBackToColumnSelection}
          />
        );

      case ProcessingStep.PROCESSING:
        const modelConfig = getModelById(selectedModel);
        const modelDisplayName = modelConfig ? modelConfig.name : selectedModel;

        return (
          <div className="">
            <div className="mb-5">
              <p className="label-mono mb-1">
                <span className="status-dot animate-pulse mr-2 align-middle" />
                Processing
              </p>
              <h2 className="text-base font-semibold tracking-tightest text-foreground">Processing file</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Running <span className="font-mono">{modelDisplayName}</span> on the queued rows. Do not close the tab.
              </p>
            </div>

            <ProcessingView
              progress={progress}
              totalRows={totalRows}
              processedRows={processedRows}
              logs={logs}
              estimatedTimeRemaining={estimatedTimeRemaining}
              processingMode={processingMode}
              onCancel={cancelProcessing}
            />
          </div>
        );

      case ProcessingStep.COMPLETE:
        return (
          <div className="space-y-6">
            <div>
              <p className="label-mono mb-1">
                <span className="inline-block size-1.5 rounded-full bg-foreground mr-2 align-middle" aria-hidden="true" />
                Complete
              </p>
              <h2 className="text-base font-semibold tracking-tightest text-foreground">Processing complete</h2>
              <p className="mt-1 text-sm text-muted-foreground">Your file has been processed successfully.</p>
            </div>

            <section>
              <p className="label-mono mb-3">Summary</p>
              <div className="border border-border bg-card">
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
                  <div className="p-5 space-y-3 text-sm">
                    <div className="flex justify-between items-baseline">
                      <span className="label-mono-sm">Rows Processed</span>
                      <span className="font-mono text-foreground tabular-nums">{processedData?.length || 0}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="label-mono-sm">Model</span>
                      <span className="font-mono text-foreground">{getModelById(selectedModel)?.name || selectedModel}</span>
                    </div>
                    {getProcessingTime() && (
                      <div className="flex justify-between items-baseline">
                        <span className="label-mono-sm">Time</span>
                        <span className="font-mono text-foreground tabular-nums">{getProcessingTime()}</span>
                      </div>
                    )}
                  </div>

                  {costTracker && (
                    <div className="p-5 space-y-3 text-sm">
                      <div className="flex justify-between items-baseline">
                        <span className="label-mono-sm">Total Cost</span>
                        <span className="font-mono text-foreground tabular-nums">
                          ${costTracker.getSessionStats().totalActualCost.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="label-mono-sm">Total Tokens</span>
                        <span className="font-mono text-foreground tabular-nums">
                          {costTracker.getSessionStats().totalTokens.toLocaleString()}
                        </span>
                      </div>
                      {processedData && processedData.length > 0 && (
                        <div className="flex justify-between items-baseline">
                          <span className="label-mono-sm">Avg Cost/Row</span>
                          <span className="font-mono text-foreground tabular-nums">
                            ${(costTracker.getSessionStats().totalActualCost / processedData.length).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
                  <ExportResults results={processedData} isDisabled={!processedData || processedData.length === 0} originalMeta={fileData?.meta} useCase={useCase || 'ecommerce'} />
                  <Button variant="outline" onClick={reloadFile}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Process another file
                  </Button>
                </div>
              </div>
            </section>

            {processedData && processedData.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <p className="label-mono">Preview · first 10 rows</p>
                  <span className="text-xs text-muted-foreground font-mono tabular-nums">
                    {Math.min(10, processedData.length)} / {processedData.length}
                  </span>
                </div>

                <div className="border border-border overflow-hidden">
                  <div className="max-h-[500px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          {useCase === 'partoo' ? (
                            <>
                              <TableHead className="font-normal text-foreground text-xs">Business ID</TableHead>
                              <TableHead className="font-normal text-foreground text-xs">Name</TableHead>
                              <TableHead className="font-normal text-foreground text-xs">City</TableHead>
                              <TableHead className="font-normal text-foreground text-xs w-[200px]">Short Description</TableHead>
                              <TableHead className="font-normal text-foreground text-xs w-[300px]">Long Description</TableHead>
                              <TableHead className="font-normal text-foreground text-xs w-[250px]">About</TableHead>
                            </>
                          ) : useCase === 'next' ? (
                            <>
                              <TableHead className="font-normal text-foreground text-xs">Supplier Code</TableHead>
                              <TableHead className="font-normal text-foreground text-xs">Product Title</TableHead>
                              <TableHead className="font-normal text-foreground text-xs w-[300px]">Copy Design Features</TableHead>
                            </>
                          ) : useCase === 'aboutyou' ? (
                            <>
                              <TableHead className="font-normal text-foreground text-xs">Style No</TableHead>
                              <TableHead className="font-normal text-foreground text-xs">Style Name</TableHead>
                              <TableHead className="font-normal text-foreground text-xs w-[300px]">Long Description</TableHead>
                            </>
                          ) : useCase === 'amazon' ? (
                            <>
                              <TableHead className="font-normal text-foreground text-xs">SKU</TableHead>
                              <TableHead className="font-normal text-foreground text-xs">Product Name</TableHead>
                              <TableHead className="font-normal text-foreground text-xs w-[300px]">Description</TableHead>
                            </>
                          ) : (useCase === 'ecommerce' || useCase === 'sloggi-ecommerce') ? (
                            <>
                              <TableHead className="font-normal text-foreground text-xs">SAP No</TableHead>
                              <TableHead className="font-normal text-foreground text-xs">Product Name</TableHead>
                              <TableHead className="font-normal text-foreground text-xs w-[300px]">Optimized Text</TableHead>
                            </>
                          ) : (
                            <>
                              <TableHead className="font-normal text-foreground text-xs">SKU</TableHead>
                              <TableHead className="font-normal text-foreground text-xs">Product Name</TableHead>
                              <TableHead className="font-normal text-foreground text-xs w-[300px]">Optimized Text</TableHead>
                            </>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processedData.slice(0, 10).map((row: any, index: number) => {
                          if (useCase === 'partoo' && columnMappings?.mapping) {
                            const mapping = columnMappings.mapping;
                            const businessId = row[mapping.businessId] || '-';
                            const name = row[mapping.name] || '-';
                            const city = row[mapping.city] || '-';
                            const shortDesc = row[mapping.shortDescription] || '';
                            const longDesc = row[mapping.longDescription] || '';
                            const aboutDesc = mapping.about ? (row[mapping.about] || '') : '';

                            return (
                              <TableRow key={index} className="hover:bg-muted/30">
                                <TableCell className="font-mono text-xs text-muted-foreground">{businessId}</TableCell>
                                <TableCell className="text-xs text-foreground">{name}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{city}</TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                                  <div className="truncate" title={shortDesc || undefined}>{shortDesc || '-'}</div>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[300px]">
                                  <div className="truncate" title={longDesc || undefined}>{longDesc || '-'}</div>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[250px]">
                                  <div className="truncate" title={aboutDesc || undefined}>{aboutDesc || '-'}</div>
                                </TableCell>
                              </TableRow>
                            );
                          }

                          if (useCase === 'next') {
                            const code = row['Next Supplier Code'] || row['Manufacturers Style No'] || '-';
                            const title = row['Product Description (Item Title)'] || '-';
                            const copy = row['Copy Design Features (Tone of Voice)'] || '';
                            return (
                              <TableRow key={index} className="hover:bg-muted/30">
                                <TableCell className="font-mono text-xs text-muted-foreground">{code}</TableCell>
                                <TableCell className="text-xs text-foreground">{title}</TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[300px]">
                                  <div className="line-clamp-2" title={copy || undefined}>{copy || '-'}</div>
                                </TableCell>
                              </TableRow>
                            );
                          }

                          if (useCase === 'aboutyou') {
                            const styleNo = row['Style No supplier'] || '-';
                            const styleName = row['Supplier Style Name (Style wording for Shop)'] || row['Style name supplier'] || '-';
                            const longDesc = row['Style Long Description for Shop'] || '';
                            return (
                              <TableRow key={index} className="hover:bg-muted/30">
                                <TableCell className="font-mono text-xs text-muted-foreground">{styleNo}</TableCell>
                                <TableCell className="text-xs text-foreground">{styleName}</TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[300px]">
                                  <div className="line-clamp-2" title={longDesc || undefined}>{longDesc || '-'}</div>
                                </TableCell>
                              </TableRow>
                            );
                          }

                          if (useCase === 'amazon') {
                            const sku = row['vendor_sku#1.value'] || row['external_product_id#1.value'] || '-';
                            const title = row['item_name#1.value'] || '-';
                            const desc = row['gen_description'] || '';
                            return (
                              <TableRow key={index} className="hover:bg-muted/30">
                                <TableCell className="font-mono text-xs text-muted-foreground">{sku}</TableCell>
                                <TableCell className="text-xs text-foreground">{title}</TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[300px]">
                                  <div className="line-clamp-2" title={desc || undefined}>{desc || '-'}</div>
                                </TableCell>
                              </TableRow>
                            );
                          }

                          if (useCase === 'ecommerce' || useCase === 'sloggi-ecommerce') {
                            const sapNo = row['MaterialSAPMaterialNo'] || row['ColorSAPMaterialNo'] || '-';
                            const productName = row['MaterialMaterialDescription_en'] || '-';
                            // Preview: show first language description
                            const descKey = Object.keys(row).find(k => k.startsWith('MaterialLongDescriptionEcom_'));
                            const desc = descKey ? String(row[descKey] || '') : '';
                            return (
                              <TableRow key={index} className="hover:bg-muted/30">
                                <TableCell className="font-mono text-xs text-muted-foreground">{sapNo}</TableCell>
                                <TableCell className="text-xs text-foreground">{productName}</TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[300px]">
                                  <div className="line-clamp-2" title={desc || undefined}>{desc || '-'}</div>
                                </TableCell>
                              </TableRow>
                            );
                          }

                          return (
                            <TableRow key={index} className="hover:bg-muted/30">
                              <TableCell className="font-mono text-xs text-muted-foreground">{row.sku || row.asin || '-'}</TableCell>
                              <TableCell className="text-xs text-foreground">{row.productName || row.title || '-'}</TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[300px]">
                                <div className="line-clamp-2" title={row.optimizedLongDescription || row.optimizedText}>
                                  {row.optimizedLongDescription || row.optimizedText || '-'}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  const canGoBack = currentStep !== ProcessingStep.UPLOAD && !isProcessing;
  const canGoForward =
    (currentStep === ProcessingStep.UPLOAD && fileData) ||
    (currentStep === ProcessingStep.SELECT_COLUMNS && selectedColumns.length > 0);

  const steps = getStepsForUseCase(useCase);

  return (
    <div className="animate-in fade-in-0 duration-300 ">
      <div className="mb-6">
        <h1 className="text-xl font-medium tracking-tight">Optimize</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-powered content optimization for e-commerce platforms
        </p>
      </div>

      <StepIndicator steps={steps} currentStep={currentStep} />

      {renderStep()}

      {currentStep !== ProcessingStep.COMPLETE && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 pt-5 border-t border-border/40">
          <div className="flex flex-wrap items-center gap-2">
            {canGoBack && (
              <Button variant="ghost" onClick={goBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            {currentStep !== ProcessingStep.UPLOAD && currentStep !== ProcessingStep.PROCESSING && (
              <Button variant="ghost" onClick={reloadFile}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Reload File
              </Button>
            )}
          </div>
          {canGoForward && (
            <Button onClick={goForward} className="ml-auto">
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
