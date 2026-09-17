/**
 * File-format detection and product extraction for the Metadata Generation
 * flow. Pure functions, no React: the hook calls them and the unit tests
 * exercise them directly.
 */
import { Workbook } from 'exceljs';
import type { MetadataFormatType, MetadataProduct } from '../types';
import {
  PIM_LONG_DESC_PREFIX,
  pimLocaleByLocale,
  pimLocalesFromHeaders,
  pimLongDescColumn,
} from '@/lib/pimLocales';

// Minimum character length for a MaterialLongDescriptionEcom_<lang> cell to
// count as a rewrite source in the 'longdesc-rework' flow. Below this a cell is
// an admin note or a certification fragment, not a description.
export const REWORK_MIN_SOURCE_LEN = 120;

export interface ParsedSheet {
  name: string;
  headers: string[];
  /** Cell values as trimmed strings, keyed by header. */
  data: Record<string, string>[];
}

export function cleanMarkdownFormatting(text: string): string {
  return text.replace(/^```[a-z]*\n?/gm, '').replace(/\n?```$/gm, '').trim();
}

function normaliseHeader(h: string): string {
  return h.toLowerCase().trim();
}

export function detectFormat(headers: string[]): MetadataFormatType {
  const set = new Set(headers.map(normaliseHeader));

  // AW26 compact format (the one Masterdata sends for new-product batches)
  const aw26Required = [
    'material number',
    'brand',
    'material description',
    'series usp',
    'style usp',
    'style description',
  ];
  if (aw26Required.every((h) => set.has(h))) return 'aw26-compact';

  // sloggi B2C standard (Inriver export)
  const sloggiB2cRequired = [
    'materialsapmaterialno',
    'materialmaterialdescription_en',
    'materialbrand',
    'materialb2cseriesdescription_en',
    'materialb2cstyledescription_en',
    'materialb2cusps_en',
  ];
  if (sloggiB2cRequired.every((h) => set.has(h))) return 'sloggi-b2c';

  // Triumph B2C standard
  const triumphB2cRequired = [
    'materialsapmaterialno',
    'materialmaterialdescription',
    'materialseriesname',
    'materialbrand',
    'materialsubbrand',
    'materialb2cseriesdescription_en',
    'materialb2cstyledescription_en',
    'materialb2cusps_en',
  ];
  if (triumphB2cRequired.every((h) => set.has(h))) return 'triumph-b2c';

  // PIM long-description export: 'Material Number' + 'Material Description'
  // plus one 'Ecom Long Desc_<locale>' column per locale. This is the export
  // Masterdata pulls out of the PIM for a rewrite round-trip; the matching
  // upload goes back as the SFCC import template.
  if (
    set.has('material number') &&
    set.has('material description') &&
    pimLocalesFromHeaders(headers).length > 0
  ) {
    return 'pim-longdesc';
  }

  // Long-description rework: a material number, an EN product name and at
  // least one existing MaterialLongDescriptionEcom_<lang> column, but none of
  // the structured B2C source fields (those would have matched above). This is
  // the "current assortment" export: rewrite the existing copy in place.
  const hasMatNo = set.has('materialsapmaterialno') || set.has('material number');
  const hasEnName =
    set.has('materialmaterialdescription_en') || set.has('materialmaterialdescription');
  const hasLongDescCol = headers.some((h) =>
    /^materiallongdescriptionecom_/i.test(h.trim())
  );
  if (hasMatNo && hasEnName && hasLongDescCol) return 'longdesc-rework';

  return 'unknown';
}

/** Inriver locale codes present as MaterialLongDescriptionEcom_<code> columns. */
export function longDescLangsFromHeaders(headers: string[]): string[] {
  return headers
    .map((h) => h.trim())
    .filter((h) => /^MaterialLongDescriptionEcom_/i.test(h))
    .map((h) => h.replace(/^MaterialLongDescriptionEcom_/i, ''));
}

export async function parseExcelAllSheets(file: File | ArrayBuffer): Promise<ParsedSheet[]> {
  const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer);
  const sheets: ParsedSheet[] = [];

  workbook.worksheets.forEach((ws) => {
    const headers: string[] = [];
    const firstRow = ws.getRow(1);
    firstRow.eachCell((cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value ?? '').trim();
    });

    const data: Record<string, string>[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const obj: Record<string, string> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) obj[header] = String(cell.value ?? '').trim();
      });
      if (Object.values(obj).some((v) => v && String(v).length > 0)) {
        data.push(obj);
      }
    });

    sheets.push({ name: ws.name, headers, data });
  });

  return sheets;
}

/**
 * Brand for exports that carry no brand column, inferred from the product name.
 *
 * "SLG" is the sloggi prefix for men's and basics lines (SLG Briefs, SLG Base
 * Trunk, SLG T-shirt). Matching on the full word alone sent those 22 SKUs down
 * the Triumph path, so they were written in the wrong brand voice.
 */
export function inferBrandFromName(name: string): string {
  return /\bsloggi\b|^\s*SLG\b/i.test(name) ? 'sloggi' : 'Triumph';
}

export function hasUsableMetadata(p: MetadataProduct): boolean {
  return Boolean(
    (p.shortDescription && p.shortDescription.trim()) ||
      (p.seriesUsp && p.seriesUsp.trim()) ||
      (p.styleUsp && p.styleUsp.trim()) ||
      (p.styleDescription && p.styleDescription.trim())
  );
}

export function extractProducts(
  format: MetadataFormatType,
  sheets: ParsedSheet[]
): MetadataProduct[] {
  const products: MetadataProduct[] = [];

  for (const sheet of sheets) {
    sheet.data.forEach((row, index) => {
      let p: MetadataProduct | null = null;

      if (format === 'aw26-compact') {
        const matNo = row['Material Number'] || row['MaterialSAPMaterialNo'] || '';
        if (!matNo) return;
        p = {
          sheetName: sheet.name,
          rowIndex: index,
          materialNumber: String(matNo),
          productName: String(row['Material Description'] || ''),
          brand: String(row['Brand'] || ''),
          productLine: row['Product Line'] ? String(row['Product Line']) : undefined,
          shortDescription: row['Short description']
            ? String(row['Short description'])
            : undefined,
          seriesUsp: row['Series USP'] ? String(row['Series USP']) : undefined,
          styleUsp: row['Style USP'] ? String(row['Style USP']) : undefined,
          styleDescription: row['Style Description']
            ? String(row['Style Description'])
            : undefined,
          rawRow: row,
        };
      } else if (format === 'longdesc-rework') {
        const matNo = row['MaterialSAPMaterialNo'] || row['Material Number'] || '';
        if (!matNo) return;
        const name = String(
          row['MaterialMaterialDescription_en'] ||
            row['MaterialMaterialDescription'] ||
            ''
        );
        // Brand isn't a column in this export; infer it from the product name.
        const brand = inferBrandFromName(name);
        // Pick the rewrite source: existing EN copy, else the first populated
        // locale (so the EN-empty rows still have a source to rewrite from).
        const langCols = longDescLangsFromHeaders(sheet.headers);
        const sourcePref = [
          'en', 'de', 'fr', 'it', 'es', 'nl', 'pl', 'cs', 'hu', 'da', 'sv', 'pt',
        ].filter((l) => langCols.includes(l));
        let existingDescription: string | undefined;
        let existingSourceLang: string | undefined;
        for (const lc of sourcePref) {
          const val = row[`MaterialLongDescriptionEcom_${lc}`];
          // Real copy (prose or HTML) runs 400+ chars. The 120-char floor skips
          // admin notes ("Long descriptions is online, however not in Inriver")
          // and standalone certification fragments that share these columns.
          if (val && String(val).trim().length >= REWORK_MIN_SOURCE_LEN) {
            existingDescription = String(val).trim();
            existingSourceLang = lc;
            break;
          }
        }
        p = {
          sheetName: sheet.name,
          rowIndex: index,
          materialNumber: String(matNo),
          productName: name,
          brand,
          existingDescription,
          existingSourceLang,
          rawRow: row,
        };
      } else if (format === 'pim-longdesc') {
        const matNo = row['Material Number'] || '';
        if (!matNo) return;
        const name = String(row['Material Description'] || '');
        // No brand column in this export; infer it from the product name the
        // same way the rework flow does.
        const brand = inferBrandFromName(name);

        // Pick the rewrite source: existing EN copy, else the first populated
        // locale, so rows with an empty EN column still have something to work
        // from. Same 120-char floor as the rework flow.
        const locales = pimLocalesFromHeaders(sheet.headers);
        const preferred = ['en_GB', ...locales.filter((l) => l !== 'en_GB')];
        let existingDescription: string | undefined;
        let existingSourceLang: string | undefined;
        for (const locale of preferred) {
          if (!locales.includes(locale)) continue;
          const val = row[pimLongDescColumn(locale)];
          if (val && String(val).trim().length >= REWORK_MIN_SOURCE_LEN) {
            existingDescription = String(val).trim();
            existingSourceLang = pimLocaleByLocale(locale)?.code ?? locale;
            break;
          }
        }
        p = {
          sheetName: sheet.name,
          rowIndex: index,
          materialNumber: String(matNo),
          productName: name,
          brand,
          existingDescription,
          existingSourceLang,
          rawRow: row,
        };
      } else if (format === 'sloggi-b2c' || format === 'triumph-b2c') {
        const matNo = row['MaterialSAPMaterialNo'] || '';
        if (!matNo) return;
        const name =
          row['MaterialMaterialDescription_en'] ||
          row['MaterialMaterialDescription'] ||
          '';
        p = {
          sheetName: sheet.name,
          rowIndex: index,
          materialNumber: String(matNo),
          productName: String(name),
          brand: String(row['MaterialBrand'] || ''),
          productLine: row['MaterialSeriesName']
            ? String(row['MaterialSeriesName'])
            : undefined,
          shortDescription: row['MaterialB2CShortDescription_en']
            ? String(row['MaterialB2CShortDescription_en'])
            : undefined,
          seriesUsp: row['MaterialB2CSeriesDescription_en']
            ? String(row['MaterialB2CSeriesDescription_en'])
            : undefined,
          styleUsp: row['MaterialB2CUSPs_en']
            ? String(row['MaterialB2CUSPs_en'])
            : undefined,
          styleDescription: row['MaterialB2CStyleDescription_en']
            ? String(row['MaterialB2CStyleDescription_en'])
            : undefined,
          rawRow: row,
        };
      }

      // Rework rows are always usable: they have a product name and either an
      // existing description to rewrite or (for the few fully-empty rows) the
      // name as a best-effort source. USP-based formats keep the stricter gate.
      const usable =
        format === 'longdesc-rework' || format === 'pim-longdesc'
          ? Boolean(p && p.productName.trim())
          : Boolean(p && hasUsableMetadata(p));
      if (p && usable) products.push(p);
    });
  }

  return products;
}

export function targetColumnFor(langCode: string): string {
  return `MaterialLongDescriptionEcom_${langCode}`;
}

/**
 * Language code a long-description column targets, for either naming
 * convention: 'MaterialLongDescriptionEcom_de' and 'Ecom Long Desc_de_DE' both
 * resolve to 'de'. Returns undefined for any other column.
 */
export function languageCodeForColumn(header: string): string | undefined {
  const h = header.trim();

  if (/^MaterialLongDescriptionEcom_/i.test(h)) {
    return h.replace(/^MaterialLongDescriptionEcom_/i, '');
  }

  if (h.toLowerCase().startsWith(PIM_LONG_DESC_PREFIX.toLowerCase())) {
    const locale = h.slice(PIM_LONG_DESC_PREFIX.length);
    return pimLocaleByLocale(locale)?.code;
  }

  return undefined;
}

/** Is the format one where an existing description is rewritten in place? */
export function isReworkFormat(format: MetadataFormatType | undefined | null): boolean {
  return format === 'longdesc-rework' || format === 'pim-longdesc';
}

/**
 * The product fields worth persisting with a run. `rawRow` is dropped: the
 * original sheets are stored separately, so the export can still rebuild the
 * workbook.
 */
export type PersistedProduct = Omit<MetadataProduct, 'rawRow'>;

export function toPersistedProduct(p: MetadataProduct): PersistedProduct {
  const { rawRow: _rawRow, ...rest } = p;
  return rest;
}
