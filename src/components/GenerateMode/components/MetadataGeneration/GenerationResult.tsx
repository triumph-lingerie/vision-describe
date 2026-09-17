import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { GeneratedProduct } from '../../types';
import { formatUsd } from '@/lib/pricing';

interface GenerationResultProps {
  results: GeneratedProduct[];
  selectedLanguages: string[];
  onExport: () => Promise<Blob>;
  /** PIM round-trip only: builds the SFCC upload template. */
  onExportSfccImport?: () => Promise<Blob>;
  onReset: () => void;
  /** List-price cost of the run in USD (Batches API price when run in batch mode). */
  costUsd?: number;
  /** 'live' or 'batch', shown next to the cost. */
  mode?: string;
}

export const GenerationResult: React.FC<GenerationResultProps> = ({
  results,
  selectedLanguages,
  onExport,
  onExportSfccImport,
  onReset,
  costUsd,
  mode,
}) => {
  const totalDescriptions = results.reduce(
    (sum, r) => sum + Object.keys(r.translations).length,
    0
  );
  const totalErrors = results.reduce((sum, r) => sum + (r.errors?.length || 0), 0);
  const totalWarnings = results.reduce((sum, r) => sum + (r.warnings?.length || 0), 0);
  const productsWithWarnings = results.filter((r) => (r.warnings?.length || 0) > 0);

  const download = async (build: () => Promise<Blob>, prefix: string) => {
    try {
      const blob = await build();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.download = `${prefix}_${timestamp}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast('File exported successfully');
    } catch {
      toast.error('Export failed');
    }
  };

  const handleExport = () => download(onExport, 'metadata-generated');

  const handleExportSfccImport = () => {
    if (!onExportSfccImport) return;
    return download(onExportSfccImport, 'SFCC_Product_info_template_upload');
  };

  return (
    <div className=" space-y-6">
      <section>
        <div className="mb-3">
          <p className="label-mono">
            <span
              className="inline-block size-1.5 rounded-full bg-foreground mr-2 align-middle"
              aria-hidden="true"
            />
            Complete
          </p>
          <h2 className="mt-1 text-base font-semibold tracking-tightest text-foreground">
            Generation complete
          </h2>
        </div>

        <div className="border border-border bg-card">
          <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-border">
            <StatCell label="Products" value={String(results.length)} />
            <StatCell label="Descriptions" value={String(totalDescriptions)} />
            <StatCell
              label="Warnings"
              value={String(totalWarnings)}
              tone={totalWarnings > 0 ? 'muted' : 'foreground'}
            />
            <StatCell
              label="Errors"
              value={String(totalErrors)}
              tone={totalErrors > 0 ? 'destructive' : 'foreground'}
            />
            <StatCell
              label={mode === 'batch' ? 'Cost (batch)' : 'Cost'}
              value={typeof costUsd === 'number' ? formatUsd(costUsd) : '-'}
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 px-5 py-4 border-t border-border">
            {onExportSfccImport && (
              <Button onClick={handleExportSfccImport}>
                <Download className="h-4 w-4 mr-2" />
                Export PIM upload
              </Button>
            )}
            <Button
              onClick={handleExport}
              variant={onExportSfccImport ? 'outline' : 'default'}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
            <Button variant="outline" onClick={onReset}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Process another file
            </Button>
          </div>
          {onExportSfccImport && (
            <p className="px-5 pb-4 -mt-1 text-xs text-muted-foreground">
              "Export PIM upload" is the SFCC template, ready to load: one row
              per product and locale, keyed by LanguageID. "Export Excel" keeps
              the layout of the file you uploaded.
            </p>
          )}
        </div>
      </section>

      {productsWithWarnings.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <p className="label-mono">Style checks</p>
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              {productsWithWarnings.length} product{productsWithWarnings.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="mb-2">
              Non-blocking findings from the code-side checks (opener, banned
              words, em dashes, bullet count, length). Worth a look before the
              upload.
            </p>
            <ul className="space-y-0.5 font-mono">
              {productsWithWarnings.slice(0, 12).map((r) => (
                <li key={r.product.materialNumber}>
                  {r.product.materialNumber}: {r.warnings?.slice(0, 3).join(' · ')}
                  {(r.warnings?.length || 0) > 3 ? ` · +${(r.warnings?.length || 0) - 3} more` : ''}
                </li>
              ))}
              {productsWithWarnings.length > 12 && (
                <li>… {productsWithWarnings.length - 12} more products</li>
              )}
            </ul>
          </div>
        </section>
      )}

      {results.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <p className="label-mono">Preview: first 10 rows</p>
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              {Math.min(10, results.length)} / {results.length}
            </span>
          </div>

          <div className="border border-border overflow-hidden">
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border">
                    <TableHead className="label-mono">Material No</TableHead>
                    <TableHead className="label-mono">Product</TableHead>
                    <TableHead className="label-mono">Brand</TableHead>
                    {selectedLanguages.slice(0, 3).map((lang) => (
                      <TableHead key={lang} className="label-mono">
                        {lang.toUpperCase()}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.slice(0, 10).map((r, idx) => (
                    <TableRow
                      key={idx}
                      className="hover:bg-muted/20 border-b border-border last:border-b-0"
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                        {r.product.materialNumber}
                      </TableCell>
                      <TableCell className="text-xs text-foreground">
                        {r.product.productName}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.product.brand}
                      </TableCell>
                      {selectedLanguages.slice(0, 3).map((lang) => (
                        <TableCell
                          key={lang}
                          className="text-xs text-muted-foreground max-w-[200px]"
                        >
                          <div className="truncate">
                            {r.translations[lang]
                              ? r.translations[lang].replace(/<[^>]+>/g, ' ').substring(0, 80) + '…'
                              : r.errors?.find((e) => e.startsWith(lang))
                                ? '(error)'
                                : '—'}
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

function StatCell({
  label,
  value,
  tone = 'foreground',
}: {
  label: string;
  value: string;
  tone?: 'foreground' | 'destructive' | 'muted';
}) {
  return (
    <div className="p-5">
      <p className="label-mono-sm">{label}</p>
      <p
        className={cn(
          'mt-2 text-2xl font-mono tracking-tightest tabular-nums',
          tone === 'destructive'
            ? 'text-destructive'
            : tone === 'muted'
              ? 'text-muted-foreground'
              : 'text-foreground',
        )}
      >
        {value}
      </p>
    </div>
  );
}
