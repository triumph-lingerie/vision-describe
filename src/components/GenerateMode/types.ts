export enum GenerateSubMode {
  SELECT = 'select',
  IMAGE_ANALYSIS = 'image_analysis',
  CSV_TRANSLATION = 'csv_translation',
  METADATA_GENERATION = 'metadata_generation',
}

export enum ImageAnalysisStep {
  SETTINGS = 'settings',
  UPLOAD = 'upload',
  PROCESSING = 'processing',
  RESULT = 'result',
}

// Hardcoded model for the image analysis flow.
// Claude Opus 5 — most capable Anthropic model, native vision, prompt
// caching works the same way as the text-only flows. No user selector
// exposed (the previous OpenAI gpt-5.2 path is removed).
export const IMAGE_ANALYSIS_MODEL = 'claude-opus-5';

export enum CsvTranslationStep {
  UPLOAD = 'upload',
  FORMAT_DETECT = 'format_detect',
  LANGUAGES = 'languages',
  PROCESSING = 'processing',
  RESULT = 'result',
}

// Hardcoded model for the CSV translation flow.
// Claude Opus 5 — most capable Anthropic model. No user selector exposed.
export const CSV_TRANSLATION_MODEL = 'claude-opus-5';

export interface ImageFile {
  base64: string;
  mimeType: string;
  preview: string;
  name: string;
  size: number;
}

export interface ProductSettings {
  language: string;
  category: string;
  certifications: string;
}

export interface VisionApiResponse {
  content: string;
  /** Model that served the request, as reported by the API. */
  model?: string;
  /** end_turn, max_tokens, refusal, ... */
  stopReason?: string | null;
  tokens: {
    inputTokens: number;
    outputTokens: number;
    /** Tokens written to prompt cache on this request (~1.25x base cost on 5m TTL, ~2x on 1h TTL). */
    cacheCreationTokens?: number;
    /** Tokens served from prompt cache on this request (~0.1x base cost). */
    cacheReadTokens?: number;
  };
  /** List-price cost of this call in USD, cache rates included. */
  costUsd?: number;
}

/**
 * Cached prompt input — system part is stable across requests (gets cache_control),
 * user part varies per request. Use this shape when you want prompt caching to apply.
 * Plain string is still accepted for backward compatibility (no caching).
 */
export interface CachedPromptInput {
  system: string;
  user: string;
}

// CSV Translation types
export type CSVFormatType = 'triumph' | 'sloggi' | 'beldona' | 'unknown';

export interface CSVFormat {
  type: CSVFormatType;
  headers: string[];
  requiredFields: string[];
}

export interface CSVProduct {
  rowIndex: number;
  materialNumber: string;
  productName: string;
  series: string;
  brand: string;
  subBrand: string;
  originalContent: string;
  rawRow: Record<string, any>;
}

export interface TranslatedProduct {
  product: CSVProduct;
  translations: Record<string, string>;
  errors?: string[];
}

export interface TranslationProgress {
  current: number;
  total: number;
}

export const AVAILABLE_LANGUAGES = [
  { code: 'uk', name: 'English (UK)' },
  { code: 'de', name: 'German (Deutschland)' },
  { code: 'fr', name: 'French (France)' },
  { code: 'it', name: 'Italian (Italia)' },
  { code: 'es', name: 'Spanish (España)' },
  { code: 'nl', name: 'Dutch (Nederland)' },
  { code: 'pt', name: 'Portuguese (Portugal)' },
  { code: 'pl', name: 'Polish (Polska)' },
  { code: 'cz', name: 'Czech (Česká republika)' },
  { code: 'hu', name: 'Hungarian (Magyarország)' },
  { code: 'dk', name: 'Danish (Danmark)' },
  { code: 'se', name: 'Swedish (Sverige)' },
  { code: 'at', name: 'German (Österreich)' },
  { code: 'ch-de', name: 'German (Schweiz)' },
  { code: 'ch-fr', name: 'French (Suisse)' },
  { code: 'ch-it', name: 'Italian (Svizzera)' },
  { code: 'be-fr', name: 'French (Belgique)' },
  { code: 'be-nl', name: 'Dutch (België)' },
] as const;

export const CERTIFICATION_OPTIONS = [
  'OEKO-TEX® Standard 100',
  'GOTS (Global Organic Textile Standard)',
  'Better Cotton Initiative (BCI)',
  'Fair Trade Certified',
  'bluesign®',
] as const;

// Metadata Generation types
export enum MetadataGenerationStep {
  UPLOAD = 'upload',
  FORMAT_DETECT = 'format_detect',
  LANGUAGES = 'languages',
  PROCESSING = 'processing',
  RESULT = 'result',
}

// Model shown in the metadata generation UI. The per-route models and efforts
// (EN master vs localisations) live in ../generationConfig.ts.
export { EN_MASTER_MODEL as METADATA_GENERATION_MODEL } from './generationConfig';

export type MetadataFormatType =
  | 'aw26-compact'
  | 'sloggi-b2c'
  | 'triumph-b2c'
  | 'longdesc-rework'
  | 'pim-longdesc'
  | 'unknown';

export interface MetadataFormat {
  type: MetadataFormatType;
  headers: string[];
  sheetNames: string[];
}

export interface MetadataProduct {
  sheetName: string;
  rowIndex: number;
  materialNumber: string;
  productName: string;
  brand: string;
  productLine?: string;
  shortDescription?: string;
  seriesUsp?: string;
  styleUsp?: string;
  styleDescription?: string;
  /**
   * For the 'longdesc-rework' format only: the existing long description used
   * as the rewrite source. Usually the existing EN copy; falls back to the
   * first populated locale when EN is empty (existingSourceLang records which).
   */
  existingDescription?: string;
  existingSourceLang?: string;
  rawRow: Record<string, any>;
}

export interface GeneratedProduct {
  product: MetadataProduct;
  enMaster?: string;
  translations: Record<string, string>;
  errors?: string[];
  /** Style-guard findings (non-blocking): greeting opener, banned word, structure, ... */
  warnings?: string[];
  /** List-price cost of this product's calls in USD. */
  costUsd?: number;
}

export interface GenerationProgress {
  current: number;
  total: number;
}

// Inriver language codes matching MaterialLongDescriptionEcom_<code> columns.
// Order mirrors the order in the source Excel files used by Masterdata.
export const INRIVER_LANGUAGES = [
  { code: 'cs', name: 'Czech (Česká republika)' },
  { code: 'da', name: 'Danish (Danmark)' },
  { code: 'de', name: 'German (Deutschland)' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish (España)' },
  { code: 'fr', name: 'French (France)' },
  { code: 'hu', name: 'Hungarian (Magyarország)' },
  { code: 'it', name: 'Italian (Italia)' },
  { code: 'nl', name: 'Dutch (Nederland)' },
  { code: 'pl', name: 'Polish (Polska)' },
  { code: 'pt-PT', name: 'Portuguese (Portugal)' },
  { code: 'sv', name: 'Swedish (Sverige)' },
] as const;

export const LANGUAGE_MAPPING: Record<string, string> = {
  'cs': 'Czech (Česká republika)',
  'da': 'Danish (Danmark)',
  'nl': 'Dutch (Nederland)',
  'en': 'English',
  'fr': 'French (France)',
  'de': 'German (Deutschland)',
  'hu': 'Hungarian (Magyarország)',
  'it': 'Italian (Italia)',
  'pl': 'Polish (Polska)',
  'pt': 'Portuguese - Portugal',
  'pt-PT': 'Portuguese - Portugal',
  'pt-BR': 'Portuguese - Brazil',
  'es': 'Spanish (España)',
  'sv': 'Swedish (Sverige)',
};
