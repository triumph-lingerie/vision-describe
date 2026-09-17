/**
 * Extracted ecommerce prompts and prompt-building helpers.
 * Shared between processors.ts (server-side row-by-row) and batch-create.ts (batch API).
 */

// Kept in sync by hand with src/lib/prompts/rules/* — this file runs as a
// Vercel function and cannot resolve the `@/` alias.

import { longDescColumnFor } from './longDescColumns';

export function wiringAndPaddingCompact(): string {
  return `WIRING & PADDING (FOR BRA PRODUCTS):
- When wiring/padding info is provided, include as FIRST bullet point
- Format: "[Wiring], [padding] bra for [benefit]"
- Examples: "Non-wired, padded bra for everyday comfort" / "Wired, non-padded bra for natural shaping"
- SWIMWEAR: Skip wiring for one-pieces, mention padding only if relevant
- BEACHWEAR: Do NOT include wiring/padding info

CUP CLASSIFICATION (BRAS, BRA-SHIRTS, TOPS WITH INTEGRATED BRA, BODIES):
- If input has explicit cup state ("Integrated fixed cups", "Removable cups", "Non-padded"), reuse it verbatim (or with minimal rewording) in the FIRST bullet
- Do not paraphrase to a generic "padded" / "non-padded"
- If combined with wiring/padding, merge into one first bullet: e.g. "Non-wired T-shirt bra with integrated fixed cups for perfect hold"`;
}

export function productTerminologyCompact(): string {
  return `PRODUCT TERMINOLOGY:
- Keep in English in EVERY locale: cut names ("T-Shirt", "Push-up", "Bralette", "Maxi", "Midi", "Mini", "Hipster", "Tai", "String"), technologies ("Dot-Bonding" — never "Punktverschweißung"/"punktverschweißt", "LYCRA® FREEF!T® X-MOVE", "TENCEL™", "Supima"), certifications ("GRS", "OEKO-TEX"), and all series/product names
- German: "T-Shirt Bra" → "T-Shirt-BH", never "Hemd-BH" / "T-Hemd-BH"; "T-shirt" → "T-Shirt"; "High Waist" stays "High Waist", never "Miederslip"
- Sleeved garment = T-Shirt, sleeveless = Tanktop. Never swap the garment type given in the input
- Unsure of a technical term? Leave it in English rather than coining one. An untranslated term can be reviewed; an invented one ships as fact

FEATURE ATTRIBUTION:
- Keep every construction detail on the component the input assigns it to — Dot-Bonding finishes edges and seams, not straps
- Never add "adjustable" / "removable" / "detachable" to a component the input does not describe that way
- Cups are fixed unless the input says removable

SUPPORT LEVEL:
- Match the source level exactly: "strong lift up support" is never "sanfte Formgebung"
- No support level given → neutral wording ("Halt", "Unterstützung")`;
}

export function seriesNameRules(): string {
  return `SERIES NAME FORMATTING:
- ALWAYS remove the "O-" or "O -" prefix from series names
- For series ending in "T" (e.g., "Ladyform Soft T"), use the name without "T"
- ALWAYS refer to series as "the [Series Name] series" for clarity`;
}

export function truthfulnessRules(): string {
  return `TRUTHFULNESS & ANTI-INFERENCE (CRITICAL):
- NEVER add technical specifications not explicitly stated in the input
- NEVER infer product features from generic terms
- Stay STRICTLY within the information provided in the source material
- When translating technical terms, use NEUTRAL language unless specifics are provided

EXAMPLES:
WRONG:
- Input: "padded" → Output: "herausnehmbaren Einlagen" (adds "removable")
- Input: "adjustable" → Output: "vollständig verstellbar" (adds "completely")
- Input: "support" → Output: "maximaler medizinischer Support" (adds "medical", "maximum")
CORRECT:
- Input: "padded" → Output: "gepolstert" / "mit Einlagen" (neutral, no assumptions)
- Input: "adjustable" → Output: "verstellbar" (simple translation, no expansion)
- Input: "support" → Output: "Halt" / "Unterstützung" (neutral support)`;
}

export const ECOMMERCE_SYSTEM_PROMPT = `
You optimize e-commerce long descriptions for Triumph. Return ONLY plain text.
- Keep facts, improve readability and flow.
- 1–3 paragraphs, no pricing/shipping/competitor references.
- Tone: direct, intentional, earnest, personal. Sophisticated yet accessible.

${wiringAndPaddingCompact()}

${seriesNameRules()}

${truthfulnessRules()}

${productTerminologyCompact()}

PRE-FLIGHT VERIFICATION (internal only — do NOT include in output):
Silently verify before returning:
1. Every technical claim exists explicitly in the input source — remove any that do not
2. Replace inferred details with neutral language
3. No assumptions or invented specs in the output
4. Every construction detail sits on the component the source assigns it to, nothing gained "adjustable" / "removable" / "detachable", the support level matches the source, and do-not-translate terms stayed in English
`;

export const SLOGGI_ECOMMERCE_SYSTEM_PROMPT = `
You optimize e-commerce long descriptions for sloggi. Return ONLY plain text.
- Keep facts, improve readability and flow.
- 1–3 paragraphs, no pricing/shipping/competitor references.

SLOGGI BRAND VOICE:
- Tone: authentic, joyful, inclusive, bold — peer-to-peer, never preachy
- Essence: "Liberating true comfort" / "Move in comfort"
- Language: simple, clear, direct. No luxury jargon, no humour, no puns
- Audience: everyone who wears underwear, comms focused on 18-35
- Emphasise comfort, freedom of movement, everyday wearability
- AVOID: aspirational/exclusive tone, objectifying language, forced friendliness, gendered greetings ("hey ladies")

${wiringAndPaddingCompact()}

${seriesNameRules()}

${truthfulnessRules()}

${productTerminologyCompact()}

PRE-FLIGHT VERIFICATION (internal only — do NOT include in output):
Silently verify before returning:
1. Every technical claim exists explicitly in the input source — remove any that do not
2. Replace inferred details with neutral language
3. No assumptions or invented specs in the output
4. Tone is authentic, joyful, inclusive — not aspirational or luxury-focused
5. Every construction detail sits on the component the source assigns it to, nothing gained "adjustable" / "removable" / "detachable", the support level matches the source, and do-not-translate terms stayed in English
`;

/**
 * Build the user prompt for ecommerce row optimization.
 * Mirrors the logic from processEcommerceRow in processors.ts.
 */
export function buildEcommerceUserPrompt(
  row: Record<string, unknown>,
  language: string
): string {
  const descKey = longDescColumnFor(row, language);
  const description = String(row[descKey] ?? '');

  // Optional short hint (dynamic column lookup)
  const shortHintKey = Object.keys(row).find((k) => {
    const hasLang = new RegExp(`(^|[ _-])${language}($|[ _-])`, 'i').test(k);
    const isShortDesc = /short description/i.test(k) && hasLang;
    const isSC =
      /^sc(\b|[_\s-][a-z]{2}$|$)/i.test(k) &&
      new RegExp(`${language}$`, 'i').test(k);
    const isAltStyle = new RegExp(
      `^materialalternativestyle_${language}$`,
      'i'
    ).test(k);
    return isShortDesc || isSC || isAltStyle;
  });
  const shortHint = shortHintKey ? String(row[shortHintKey] ?? '') : '';
  const altTitleKey = `MaterialAlternativeStyle_${language}`;
  const title = String(
    row[altTitleKey] ?? row['MaterialSeriesName'] ?? ''
  );
  const wiringInfo = String(
    row['Wiring Info'] ??
      row['WiringInfo'] ??
      row['MaterialProductWiringTypeAI_en'] ??
      row['Wiring'] ??
      ''
  ).trim();
  const paddingInfo = String(
    row['Padding info'] ??
      row['PaddingInfo'] ??
      row['MaterialProductLiningLevelTypeAI_en'] ??
      row['Padding'] ??
      ''
  ).trim();
  const productGroup = String(
    row['Product Group'] ?? row['MaterialProductGroup'] ?? ''
  ).trim();
  const usps = String(row['MaterialB2CUSPs_en'] ?? '').trim();
  const seriesDescription = String(
    row['MaterialB2CSeriesDescription_en'] ?? ''
  ).trim();
  const styleDescription = String(
    row['MaterialB2CStyleDescription_en'] ?? ''
  ).trim();

  let prompt =
    'TASK: Optimize the long description for e-commerce (1–3 paragraphs), plain text.\nCONTEXT:\n';
  if (title) prompt += `- Title/Series: ${title}\n`;
  if (seriesDescription) prompt += `- Series Description: ${seriesDescription}\n`;
  if (styleDescription) prompt += `- Style Description: ${styleDescription}\n`;
  if (usps) prompt += `- USPs: ${usps}\n`;
  if (shortHint) prompt += `- Short hint: ${shortHint}\n`;
  if (description) prompt += `- Long description: ${description}\n`;
  if (wiringInfo) prompt += `- Wiring Type: ${wiringInfo}\n`;
  if (paddingInfo) prompt += `- Padding Type: ${paddingInfo}\n`;
  if (productGroup) prompt += `- Product Group: ${productGroup}\n`;
  prompt += `LANGUAGE: ${language}\n\nIMPORTANT: If Wiring Type and/or Padding Type are provided, include them as the FIRST bullet point in the format: "[Wiring], [padding] bra for [benefit]"\nReturn ONLY the optimized description.`;

  return prompt;
}
