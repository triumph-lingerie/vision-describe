/**
 * Post-generation checks for the long-description HTML.
 *
 * The prompts state these rules once; this module verifies them in code so
 * the prompt does not need a self-check list and a slip is visible in the run
 * log and the export instead of going live unnoticed. Warnings never block a
 * result.
 */

export type StyleWarningCode =
  | 'greeting-opener'
  | 'em-dash'
  | 'banned-word'
  | 'structure'
  | 'tags'
  | 'length'
  | 'empty';

export interface StyleWarning {
  code: StyleWarningCode;
  message: string;
}

/** Style-rule 4 of the EN prompts, kept in sync with the prompt text. */
export const BANNED_EN_WORDS = [
  'delve',
  'leverage',
  'landscape',
  'testament',
  'showcase',
  'robust',
  'comprehensive',
  'harness',
  'foster',
  'elevate',
  'elevated',
  'elevating',
  'navigate',
  'crucial',
  'paramount',
  'intricate',
  'tapestry',
  'realm',
  'embark',
  'unleash',
  'streamline',
  'empower',
  'unlock',
  'vibrant',
  'nestled',
  'thoughtful construction',
  'prioritizes',
  'ensures utmost',
] as const;

const GREETING_OPENERS = /^\s*(meet the|introducing|welcome to|discover|say hello to|hello|hi there)\b/i;
const ALLOWED_TAGS = new Set(['p', 'ul', 'li']);

export function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

function tagNames(html: string): string[] {
  const names: string[] = [];
  const re = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) names.push(m[1].toLowerCase());
  return names;
}

/** Checks the structure and typography rules shared by every language. */
export function checkStructure(html: string): StyleWarning[] {
  const warnings: StyleWarning[] = [];
  const text = stripTags(html);
  if (!text) return [{ code: 'empty', message: 'Empty description' }];

  const unexpected = Array.from(new Set(tagNames(html).filter((t) => !ALLOWED_TAGS.has(t))));
  if (unexpected.length > 0) {
    warnings.push({ code: 'tags', message: `Unexpected HTML tags: ${unexpected.join(', ')}` });
  }

  const paragraphs = (html.match(/<p\b/gi) || []).length;
  const lists = (html.match(/<ul\b/gi) || []).length;
  const bullets = (html.match(/<li\b/gi) || []).length;
  if (!/^\s*<p\b/i.test(html)) {
    warnings.push({ code: 'structure', message: 'Does not start with <p>' });
  }
  if (lists !== 1 || bullets < 5 || bullets > 6) {
    warnings.push({
      code: 'structure',
      message: `Expected one list with 5-6 bullets, found ${lists} list(s) with ${bullets} bullet(s)`,
    });
  }
  if (paragraphs < 2) {
    warnings.push({ code: 'structure', message: `Expected an opening and a closing paragraph, found ${paragraphs}` });
  }

  const dashes = (html.match(/—/g) || []).length;
  if (dashes > 1) {
    warnings.push({ code: 'em-dash', message: `${dashes} em dashes (maximum 1)` });
  }

  return warnings;
}

/** Checks the English-only rules on top of the structural ones. */
export function checkEnglishStyle(html: string): StyleWarning[] {
  const warnings = checkStructure(html);
  const text = stripTags(html);
  if (!text) return warnings;

  const opening = text.split(/[.!?]/)[0] || '';
  if (GREETING_OPENERS.test(opening)) {
    warnings.push({ code: 'greeting-opener', message: `Greeting opener: "${opening.slice(0, 40)}"` });
  }

  // Inflections count too: "elevates", "unlocking", "showcased".
  const hits = BANNED_EN_WORDS.filter((w) =>
    new RegExp(`\\b${w.replace(/ /g, '\\s+')}(?:s|es|d|ed|ing)?\\b`, 'i').test(text)
  );
  if (hits.length > 0) {
    warnings.push({ code: 'banned-word', message: `Banned words: ${hits.join(', ')}` });
  }

  const words = wordCount(text);
  if (words < 150 || words > 300) {
    warnings.push({ code: 'length', message: `${words} words (target 150-300)` });
  }

  return warnings;
}

/**
 * Checks a localised description: structure must mirror the EN master, the
 * wording rules are language-specific and stay with the proofreaders.
 */
export function checkLocalisedStyle(html: string, enMaster?: string): StyleWarning[] {
  const warnings = checkStructure(html);
  if (enMaster) {
    const src = (enMaster.match(/<li\b/gi) || []).length;
    const out = (html.match(/<li\b/gi) || []).length;
    if (src > 0 && src !== out) {
      warnings.push({ code: 'structure', message: `${out} bullets, EN master has ${src}` });
    }
  }
  return warnings;
}

export function formatWarnings(prefix: string, warnings: StyleWarning[]): string[] {
  return warnings.map((w) => `${prefix}: ${w.message}`);
}
