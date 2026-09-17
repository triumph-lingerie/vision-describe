/**
 * Server-side processor wrappers.
 *
 * Fully self-contained — no imports from src/ to avoid ESM/CJS conflicts
 * on Vercel. System prompts and row data come from the run config stored in DB.
 */
import { callAI, type AiCallOptions, type AiResponse } from './aiClients';
import { z } from 'zod/v4';
import { longDescColumnFor } from './longDescColumns';
import { RunConfig } from './types';
import {
  wiringAndPaddingCompact,
  seriesNameRules,
  truthfulnessRules,
  ECOMMERCE_SYSTEM_PROMPT,
  SLOGGI_ECOMMERCE_SYSTEM_PROMPT,
  buildEcommerceUserPrompt,
} from './ecommercePrompts';

// Structured-output schemas: the API constrains the response to these shapes,
// so the JSON never has to be fished out of prose or code fences.
const PARTOO_STORE_SCHEMA = z.object({ short_description: z.string(), long_description: z.string() });
const NEXT_SCHEMA = z.object({ product_title: z.string(), copy_design_features: z.string() });
const ABOUTYOU_SCHEMA = z.object({ style_name: z.string(), long_description: z.string() });

interface ModelLike {
  id: string;
}

async function serverOptimize<T = unknown>(
  userPrompt: string,
  model: ModelLike,
  apiKey: string,
  systemPrompt: string,
  options: AiCallOptions<T> = {}
): Promise<AiResponse<T>> {
  return callAI(apiKey, model.id, systemPrompt, userPrompt, options);
}

// ---------------------------------------------------------------------------
// Dispatcher: process a single row based on use case
// ---------------------------------------------------------------------------
export async function processRow(
  row: Record<string, unknown>,
  rowIndex: number,
  apiKey: string,
  config: RunConfig
): Promise<{ result: Record<string, unknown>; cost: number; tokensIn: number; tokensOut: number }> {
  const model: ModelLike = { id: config.modelId };

  // The client-side processors build a prompt per row and call the AI.
  // On the server, we replicate that: extract the relevant text from the row,
  // build a prompt, call the AI, and store the result back in the row.
  //
  // The system prompt is embedded in the config or we use the row content
  // which already contains the full prompt built by the client-side code.

  switch (config.useCase) {
    case 'partoo':
      return processPartooRow(row, rowIndex, model, apiKey, config);
    case 'amazon':
      return processAmazonRow(row, rowIndex, model, apiKey, config);
    case 'next':
      return processNextRow(row, rowIndex, model, apiKey, config);
    case 'aboutyou':
      return processAboutYouRow(row, rowIndex, model, apiKey, config);
    case 'ecommerce':
    case 'sloggi-ecommerce':
      return processEcommerceRow(row, rowIndex, model, apiKey, config);
    default:
      return processGenericRow(row, rowIndex, model, apiKey, config);
  }
}

// ===========================================================================
// Partoo helpers — inlined from src/ to keep server bundle self-contained
// ===========================================================================

interface PartooStoreData {
  name: string;
  address: string;
  city: string;
  zipcode: string;
  country: string;
  status: string;
  existingShort?: string;
  existingLong?: string;
  businessOpeningDate?: string;
  existingAbout?: string;
  groups?: string;
  mainCategory?: string;
  secondaryCategories?: string;
  hasInStoreServices?: boolean;
  hasBookAFitting?: boolean;
  isOutlet?: boolean;
}

const COUNTRY_TO_LANGUAGE: Record<string, string> = {
  IT: 'it-IT', FR: 'fr-FR', PT: 'pt-PT', DE: 'de-DE', AT: 'de-AT',
  ES: 'es-ES', NL: 'nl-NL', BE: 'nl-BE', LU: 'fr-LU', UK: 'en-GB',
  GB: 'en-GB', IE: 'en-IE', US: 'en-US', CH: 'de-CH', HU: 'hu-HU',
  PL: 'pl-PL', CZ: 'cs-CZ', SK: 'sk-SK', RO: 'ro-RO', BG: 'bg-BG',
  HR: 'hr-HR', SI: 'sl-SI', GR: 'el-GR', SE: 'sv-SE', NO: 'no-NO',
  DK: 'da-DK', FI: 'fi-FI',
};

const SWISS_CITY_LANGUAGES: Record<string, string> = {
  'zürich': 'de-CH', 'zurich': 'de-CH', 'basel': 'de-CH', 'bern': 'de-CH',
  'luzern': 'de-CH', 'lucerne': 'de-CH', 'winterthur': 'de-CH',
  'st. gallen': 'de-CH', 'st gallen': 'de-CH',
  'genève': 'fr-CH', 'geneva': 'fr-CH', 'lausanne': 'fr-CH',
  'neuchâtel': 'fr-CH', 'neuchatel': 'fr-CH', 'fribourg': 'fr-CH', 'sion': 'fr-CH',
  'lugano': 'it-CH', 'bellinzona': 'it-CH', 'locarno': 'it-CH',
};

function detectLanguage(country: string, city: string): string {
  const cu = country.toUpperCase();
  if (cu === 'CH' || cu === 'SWITZERLAND') {
    return SWISS_CITY_LANGUAGES[city.toLowerCase().trim()] || 'en-GB';
  }
  return COUNTRY_TO_LANGUAGE[cu] || 'en-GB';
}

function isStoreClosed(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes('permanently closed') || s.includes('closed permanently') ||
    s.includes('definitively closed') || s.includes('chiuso definitivamente') ||
    s.includes('fermé définitivement');
}

const CLOSED_STORE_MESSAGES: Record<string, { short: string; long: string }> = {
  'it-IT': { short: 'Il negozio Triumph di {city} è chiuso definitivamente. Visita il sito del brand per trovare altri punti vendita.', long: 'Il negozio Triumph di {city} è chiuso definitivamente. Visita il sito del brand per trovare altri punti vendita.' },
  'fr-FR': { short: 'Le magasin Triumph de {city} est fermé définitivement. Veuillez consulter le site de la marque pour trouver d\'autres points de vente.', long: 'Le magasin Triumph de {city} est fermé définitivement. Veuillez consulter le site de la marque pour trouver d\'autres points de vente.' },
  'de-DE': { short: 'Das Triumph-Geschäft in {city} ist dauerhaft geschlossen. Besuchen Sie die Website der Marke, um weitere Standorte zu finden.', long: 'Das Triumph-Geschäft in {city} ist dauerhaft geschlossen. Besuchen Sie die Website der Marke, um weitere Standorte zu finden.' },
  'de-AT': { short: 'Das Triumph-Geschäft in {city} ist dauerhaft geschlossen. Besuchen Sie die Website der Marke, um weitere Standorte zu finden.', long: 'Das Triumph-Geschäft in {city} ist dauerhaft geschlossen. Besuchen Sie die Website der Marke, um weitere Standorte zu finden.' },
  'de-CH': { short: 'Das Triumph-Geschäft in {city} ist dauerhaft geschlossen. Besuchen Sie die Website der Marke, um weitere Standorte zu finden.', long: 'Das Triumph-Geschäft in {city} ist dauerhaft geschlossen. Besuchen Sie die Website der Marke, um weitere Standorte zu finden.' },
  'fr-CH': { short: 'Le magasin Triumph de {city} est fermé définitivement. Veuillez consulter le site de la marque pour trouver d\'autres points de vente.', long: 'Le magasin Triumph de {city} est fermé définitivement. Veuillez consulter le site de la marque pour trouver d\'autres points de vente.' },
  'it-CH': { short: 'Il negozio Triumph di {city} è chiuso definitivamente. Visita il sito del brand per trovare altri punti vendita.', long: 'Il negozio Triumph di {city} è chiuso definitivamente. Visita il sito del brand per trovare altri punti vendita.' },
  'pt-PT': { short: 'A loja Triumph em {city} está encerrada permanentemente. Visite o site da marca para encontrar outras localizações.', long: 'A loja Triumph em {city} está encerrada permanentemente. Visite o site da marca para encontrar outras localizações.' },
  'es-ES': { short: 'La tienda Triumph de {city} está cerrada permanentemente. Visite el sitio web de la marca para encontrar otras ubicaciones.', long: 'La tienda Triumph de {city} está cerrada permanentemente. Visite el sitio web de la marca para encontrar otras ubicaciones.' },
  'nl-NL': { short: 'De Triumph-winkel in {city} is permanent gesloten. Bezoek de merkwebsite om andere locaties te vinden.', long: 'De Triumph-winkel in {city} is permanent gesloten. Bezoek de merkwebsite om andere locaties te vinden.' },
  'en-GB': { short: 'The Triumph store in {city} is permanently closed. Please visit the brand website for other locations.', long: 'The Triumph store in {city} is permanently closed. Please visit the brand website for other locations.' },
  'en-IE': { short: 'The Triumph store in {city} is permanently closed. Please visit the brand website for other locations.', long: 'The Triumph store in {city} is permanently closed. Please visit the brand website for other locations.' },
  'en-US': { short: 'The Triumph store in {city} is permanently closed. Please visit the brand website for other locations.', long: 'The Triumph store in {city} is permanently closed. Please visit the brand website for other locations.' },
};

function getClosedStoreMessage(language: string, city: string): { short: string; long: string } {
  const m = CLOSED_STORE_MESSAGES[language] || CLOSED_STORE_MESSAGES['en-GB'];
  return { short: m.short.replace('{city}', city), long: m.long.replace('{city}', city) };
}

function isGenericDescription(text: string | undefined, city: string): boolean {
  if (!text || text.trim().length === 0) return true;
  if (text.length < 40) return true;
  const boilerplate = [/welcome to our store/i, /benvenuti nel nostro/i, /bienvenue dans notre/i, /willkommen in unserem/i, /bienvenido a nuestra/i, /welkom in onze/i];
  for (const p of boilerplate) { if (p.test(text)) return true; }
  const corporate = [
    /\d+\s*anni/i, /\d+\s*years/i, /\d+\s*jahren/i, /\d+\s*ans/i,
    /dal\s*\d{4}/i, /since\s*\d{4}/i, /seit\s*\d{4}/i, /depuis\s*\d{4}/i, /desde\s*\d{4}/i,
    /\d{2,}'?\d{3}\s*(negozi|stores|magasins|geschäfte|tiendas|lojas)/i,
    /\d{2,}\s*(paesi|countries|länder|pays|países)/i,
    /triumph international/i, /business social compliance initiative/i,
    /globally|globalmente|à l'échelle mondiale|weltweit/i,
    /worldwide|in tutto il mondo|dans le monde entier|auf der ganzen welt/i,
    /handwerksqualität|qualità artigianale|craftsmanship quality/i,
    /già\s+dal|bereits\s+seit|déjà\s+depuis/i,
  ];
  let cc = 0;
  for (const p of corporate) { if (p.test(text)) cc++; }
  if (cc >= 2) return true;
  const cityLower = city.toLowerCase();
  const textLower = text.toLowerCase();
  const hasCity = textLower.includes(cityLower);
  const hasCat = /lingerie|fitting|reggiseni|intimo|soutien|bra/i.test(text);
  if (!hasCity && !hasCat) return true;
  if (cc >= 1 && !hasCity) return true;
  return false;
}

function categorizeStoreType(groups: string | undefined | null): string {
  if (!groups) return 'Other';
  const entries = groups.split(';').map(s => s.trim().toLowerCase());
  if (entries.some(e => /partner\s+stores/.test(e))) return 'Partner Stores';
  if (entries.some(e => /triumph\s+stores/.test(e))) return 'Triumph Stores';
  return 'Other';
}

function stripMarkdown(s: string): string {
  if (!s) return s;
  let t = s.replace(/<[^>]+>/g, ' ');
  t = t.replace(/\*\*(.*?)\*\*/g, '$1');
  t = t.replace(/\*(.*?)\*/g, '$1');
  t = t.replace(/`([^`]+)`/g, '$1');
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  t = t.replace(/#{1,6}\s/g, '');
  t = t.replace(/\s+/g, ' ');
  return t.trim();
}

function buildPartooStorePrompt(storeData: PartooStoreData, overwritePolicy: 'fill-only' | 'fill-improve' = 'fill-improve'): string {
  const language = detectLanguage(storeData.country, storeData.city);
  let prompt = `Language: ${language}\n\nUse ONLY these details. Do not invent or infer missing information.\n\nINPUTS:\n- Name: ${storeData.name}\n- City: ${storeData.city}\n- Country: ${storeData.country}\n- Status: ${storeData.status}`;
  if (storeData.address) prompt += `\n- Address: ${storeData.address}`;
  if (storeData.zipcode) prompt += `\n- Zipcode: ${storeData.zipcode}`;
  const shortIsGeneric = overwritePolicy === 'fill-improve' && isGenericDescription(storeData.existingShort, storeData.city);
  const longIsGeneric = overwritePolicy === 'fill-improve' && isGenericDescription(storeData.existingLong, storeData.city);
  if (storeData.existingShort && !shortIsGeneric) prompt += `\n- Existing short (for reference): ${storeData.existingShort}`;
  if (storeData.existingLong && !longIsGeneric) prompt += `\n- Existing long (for reference): ${storeData.existingLong}`;
  if (shortIsGeneric || longIsGeneric) {
    prompt += `\n\n⚠️ IMPORTANT: Previous description was GENERIC corporate text (company history, global stats).\nWrite COMPLETELY NEW content using ONLY the store details above.\nDO NOT reference or copy any corporate history, founding dates, global statistics, or brand background.`;
  }
  prompt += `\n\nWrite two fields: short_description (plain text, at most 80 characters) and long_description (plain text, 600 to 750 characters; use the full budget for a rich, informative text).\n\nRequirements:\n- Write in ${language}. Do not use any other language.\n- Mention ${storeData.city} naturally in both descriptions.\n- ${storeData.address ? `Mention ${storeData.address} if it fits naturally.` : 'Address not provided - do not invent one.'}\n- Use only information from Inputs above. Do not invent details.\n- Focus on: expert bra fitting, lingerie for everyday comfort, coordinated sets.\n- Write naturally to answer local search intents (e.g. "lingerie store in ${storeData.city}", "Triumph near me"). Describe the in-store experience.\n- No company history, global stats, corporate background, certifications, or mission statements.\n- No prices, hours, phone, email, directions, promotions, or loyalty programs.\n- Plain text only: no HTML, markdown, links, emojis.`;
  return prompt;
}

function parsePartooResponse(response: string): { short: string; long: string } | null {
  try {
    let c = response.trim();
    c = c.replace(/^```(?:json)?\s*\n?/i, '');
    c = c.replace(/\n?```\s*$/i, '');
    c = c.trim();
    const parsed = JSON.parse(c);
    if (parsed.short_description && parsed.long_description) {
      return { short: parsed.short_description.trim(), long: parsed.long_description.trim() };
    }
    return null;
  } catch { return null; }
}

function buildPartooAboutPrompt(storeData: PartooStoreData, overwritePolicy: 'fill-only' | 'fill-improve' = 'fill-improve'): string {
  const language = detectLanguage(storeData.country, storeData.city);
  const entries = (storeData.groups || '').split(';').map(s => s.trim().toLowerCase());
  const isPartner = entries.some(e => /partner\s+stores/.test(e));
  const isOwnStore = !isPartner && entries.some(e => /triumph\s+stores/.test(e));
  let prompt = `Language: ${language}\n\nUse ONLY these details. Do not invent or infer missing information.\n\nINPUTS:\n- Name: ${storeData.name}\n- City: ${storeData.city}\n- Country: ${storeData.country}`;
  if (storeData.address) prompt += `\n- Address: ${storeData.address}`;
  if (storeData.zipcode) prompt += `\n- Zipcode: ${storeData.zipcode}`;
  if (storeData.mainCategory) prompt += `\n- Category: ${storeData.mainCategory.replace(/_/g, ' ')}`;
  if (storeData.secondaryCategories) prompt += `\n- Additional categories: ${storeData.secondaryCategories.replace(/_/g, ' ')}`;
  if (isOwnStore) prompt += `\n- Store type: Official Triumph store`;
  else if (isPartner) prompt += `\n- Store type: Authorized retailer / partner`;
  const services: string[] = [];
  if (storeData.hasInStoreServices) services.push('in-store fitting service');
  if (storeData.hasBookAFitting) services.push('online fitting appointment booking');
  if (services.length > 0) prompt += `\n- Available services: ${services.join(', ')}`;
  if (storeData.isOutlet) prompt += `\n- Outlet store: yes`;
  const aboutIsGeneric = overwritePolicy === 'fill-improve' && isGenericDescription(storeData.existingAbout, storeData.city);
  if (storeData.existingAbout && !aboutIsGeneric) prompt += `\n- Existing About (for reference): ${storeData.existingAbout}`;
  prompt += `\n\nTASK: Write an "About" text for this store's page on the Triumph store locator website.\nThis text appears on the individual store page and should help local SEO and AI-powered local search results.\n\nRequirements:\n- Write in ${language}. Do not use any other language.\n- Maximum 500 characters.\n- Mention ${storeData.city} naturally.\n- Light Markdown is allowed: **bold** for emphasis, bullet lists with - for services.\n- Make the text UNIQUE to this specific location using the details provided.\n- Focus on: why visit this store, what services are available, what makes it special locally.\n- This is NOT a product description — it is a presentation of the physical store location.\n- NO company history, global stats, founding dates, corporate background.\n- NO prices, opening hours, phone, email, directions, promotions, loyalty programs.\n- NO HTML, emojis, links, or headings (#).\n\nReturn ONLY the About text (plain Markdown string, NOT JSON). No extra commentary.`;
  return prompt;
}

function parsePartooAboutResponse(response: string): string | null {
  if (!response || !response.trim()) return null;
  let text = response.trim();
  text = text.replace(/^```(?:markdown|md)?\s*\n?/i, '');
  text = text.replace(/\n?```\s*$/i, '');
  text = text.trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }
  if (text.length === 0) return null;
  if (text.length > 500) {
    const truncated = text.substring(0, 500);
    const lastPeriod = truncated.lastIndexOf('.');
    text = lastPeriod > 300 ? truncated.substring(0, lastPeriod + 1) : truncated;
  }
  return text;
}

// System prompts (inlined from partooSystemPrompt.ts)
const PARTOO_SYSTEM_PROMPT = `You are a professional copywriter creating localized store descriptions for Triumph retail locations.

LANGUAGE:
- Write in the language specified in the user prompt. Do not use any other language or mix languages.
- French (FR): use formal "vous" form
- Portuguese (PT): use formal tone
- All other languages: professional but warm tone

TONE OF VOICE (Triumph Brand):
- Direct, intentional, earnest, and personal
- Honest and confident; never salesy or preachy
- Elegant and respectful language
- Balance between aspirational and empathetic
- Avoid paternalism, preaching, hyperbole, jokes, or puns
- Focus on SOLUTIONS (comfort, expert bra fitting) rather than empty slogans
- Simple, confident language without being pompous

BRAND VALUES & PERSONALITY:
- Empathy, intuition, dynamism
- Courageous, dedicated, open-minded
- These emerge in HOW we speak; do NOT list them as labels

CONTENT SCOPE:
- Describe ONLY the specific store and its local context
- Mention the CITY naturally
- Mention the ADDRESS only if it is provided in Inputs
- Highlight EXPERT BRA FITTING as a key service
- Focus on LINGERIE FOR EVERYDAY COMFORT
- Mention COORDINATED SETS when appropriate
- Use ONLY the information provided in Inputs. If something is missing, omit it gracefully; do NOT invent or infer details.

AI DISCOVERABILITY (for AI Overviews and local recommendation engines):
- Write in natural, conversational sentences that answer common local search intents
- Naturally weave in the store name, city, neighborhood/address, and key services
- Describe the in-store EXPERIENCE rather than just listing facts
- Use varied, specific language
- Prioritize clarity and informativeness

STRICT EXCLUSIONS:
- NO links, HTML/markdown, emojis, or special characters
- NO promotions, discounts, loyalty programs, awards, unverifiable claims, or superlatives
- NO company history, founding dates, years of experience, global statistics
- NO corporate background, certifications, brand mission statements
- NO prices, phone numbers, email addresses, opening hours, or directions UNLESS explicitly provided in Inputs
- Write as if describing a LOCAL BOUTIQUE, not a global corporation
- NEVER copy or reference corporate boilerplate text

NATURAL WRITING — avoid robotic AI patterns:
- BANNED phrases: "in the heart of" / "nel cuore di" / "au cœur de" / "im Herzen von", "nestled", "vibrant", "boasts", "showcasing", "testament", "tapestry", "pivotal", "fostering", "renowned", "a benchmark", "commitment to"
- BANNED structures: "Not only... but also...", three-adjective triads, em-dash dramatic clauses, trailing "-ing" phrases
- USE simple copulatives: prefer "is" / "è" / "ist" / "est" over inflated synonyms
- VARY sentence openings
- Write like a local shop owner would speak

OVERWRITE POLICY:
- If existing text is GENERIC (shorter than 40 characters, boilerplate, or missing both city and lingerie category), REWRITE FULLY
- Otherwise, IMPROVE clarity and local specificity while keeping all constraints

LENGTH & FORMAT:
- Short description: maximum 80 characters
- Long description: AIM for 600-750 characters
- COUNT characters and ensure BOTH fields are within limits BEFORE responding
- Output JSON ONLY with these exact keys: "short_description", "long_description"

PERMANENTLY CLOSED STORES:
- If Inputs indicate the store is permanently closed, return closure message translated in the appropriate language

FAIL-SAFE:
- If you cannot comply with these constraints, return a minimal compliant JSON with empty strings for both fields`;

const PARTOO_ABOUT_SYSTEM_PROMPT = `You are a professional copywriter specializing in local SEO content for store locator pages.
You write unique "About" texts for individual Triumph retail store pages that improve local search visibility.

LANGUAGE:
- Write in the language specified in the user prompt. Do not use any other language or mix languages.
- French (FR): use formal "vous" form
- Portuguese (PT): use formal tone
- All other languages: professional but warm tone

TONE OF VOICE (Triumph Brand):
- Direct, intentional, earnest, and personal
- Honest and confident; never salesy or preachy
- Simple, confident language without being pompous

CONTENT SCOPE:
- Present THIS SPECIFIC STORE LOCATION — not the Triumph brand globally
- Mention the CITY naturally for local SEO
- Highlight available services (fitting, booking, outlet) when provided
- Differentiate between official Triumph stores and authorized retailers
- Focus on: why someone nearby should visit, what they will find, what services are available
- Use ONLY the information provided in Inputs.

STRICT EXCLUSIONS:
- NO company history, founding dates, years of experience, global statistics
- NO corporate background, certifications, brand mission statements
- NO prices, phone numbers, email addresses, opening hours, or directions
- NO promotions, discounts, loyalty programs, awards, or superlatives
- NO links, HTML tags, emojis, or headings

NATURAL WRITING — avoid robotic AI patterns:
- BANNED phrases: "in the heart of", "nestled", "vibrant", "boasts", "showcasing", "testament", "renowned", "commitment to"
- BANNED structures: "Not only... but also...", three-adjective triads, em-dash dramatic clauses
- Use **bold** sparingly — maximum 2 bold phrases; never bold the city name or brand name
- Write like a local shop owner would speak

FORMAT:
- Maximum 500 characters
- Light Markdown is ALLOWED: **bold** for emphasis (max 2 uses), bullet lists with - for key services
- Output ONLY the About text as a plain Markdown string
- Do NOT wrap in JSON, code blocks, or quotes

FAIL-SAFE:
- If you cannot comply, return a minimal one-sentence description mentioning the city and store type`;

// ---------------------------------------------------------------------------
// Partoo processor — full port of client-side logic
// ---------------------------------------------------------------------------
async function processPartooRow(
  row: Record<string, unknown>,
  rowIndex: number,
  model: ModelLike,
  apiKey: string,
  config: RunConfig
): Promise<{ result: Record<string, unknown>; cost: number; tokensIn: number; tokensOut: number }> {
  const processed = { ...row } as any;
  let totalIn = 0;
  let totalOut = 0;
  let totalCost = 0;

  const mapping = config.mappings?.mapping as Record<string, string> || config.mappings as Record<string, string> || {};
  const overwritePolicy = (config as any).overwritePolicy || 'fill-improve';

  // Column keys from mapping or Partoo Excel defaults
  const nameKey = mapping.name || 'Name';
  const cityKey = mapping.city || 'City';
  const countryKey = mapping.country || 'Country';
  const addressKey = mapping.address || 'Address';
  const zipcodeKey = mapping.zipcode || 'Zipcode';
  const statusKey = mapping.status || 'Status';
  const mappingShortKey = mapping.shortDescription || 'Short description';
  const mappingLongKey = mapping.longDescription || 'Long description';
  const aboutKey = mapping.about || 'About';
  const groupsKey = mapping.groups || 'Groupes';
  const mainCategoryKey = mapping.mainCategory || 'Catégorie principale';
  const secondaryCategoriesKey = mapping.secondaryCategories || 'Catégories additionnelles';
  const inStoreServicesKey = mapping.inStoreServices || 'In Store Services';
  const bookAFittingKey = mapping.bookAFitting || 'Book a Fitting';
  const triumphOutletsKey = mapping.triumphOutlets || 'Triumph Outlets';

  const name = String(row[nameKey] ?? '').trim();
  const city = String(row[cityKey] ?? '').trim();
  const country = String(row[countryKey] ?? '').trim();
  const address = String(row[addressKey] ?? '').trim();
  const zipcode = String(row[zipcodeKey] ?? '').trim();
  const status = String(row[statusKey] ?? 'open').trim();

  // Business ID filter — skip row if not in filter list
  const businessIdKey = mapping.businessId || 'Business identification';
  const bizIdKeyActual = Object.keys(row).find(k => k === businessIdKey) ||
    Object.keys(row).find(k => /business\s*id/i.test(k)) ||
    Object.keys(row).find(k => /business\s*identification/i.test(k));
  const businessId = bizIdKeyActual ? String(row[bizIdKeyActual] ?? '').trim() : '';

  if (config.businessIdsFilter && config.businessIdsFilter.length > 0) {
    const filterSet = new Set(config.businessIdsFilter);
    if (!filterSet.has(businessId)) {
      // Not in filter — return original row unchanged
      processed._label = businessId || name || city || `Row ${rowIndex + 1}`;
      return { result: processed, cost: 0, tokensIn: 0, tokensOut: 0 };
    }
  }

  // Store type filter — skip row if store type not selected
  if (config.storeTypeFilter && config.storeTypeFilter.length > 0) {
    const groups = String(row[mapping.groups || 'Groupes'] ?? '').trim() || undefined;
    const storeType = categorizeStoreType(groups);
    const filterSet = new Set(config.storeTypeFilter);
    if (!filterSet.has(storeType)) {
      // Store type not selected — skip entirely (don't include in output)
      processed._label = businessId || name || city || `Row ${rowIndex + 1}`;
      return { result: processed, cost: 0, tokensIn: 0, tokensOut: 0 };
    }
  }

  // Dynamic column picking for language-specific description columns
  const language = detectLanguage(country, city);
  const deriveLangCodes = (lang: string): string[] => {
    if (!lang) return [];
    const lower = lang.toLowerCase();
    const parts = lower.split(/[-_]/g);
    const codes: string[] = [lower];
    if (parts.length > 0) codes.push(parts[0]);
    if (parts.length > 1) codes.push(parts[1]);
    return [...new Set(codes.filter(Boolean))];
  };
  const langCodes = deriveLangCodes(language);

  const pickDescriptionColumn = (type: 'short' | 'long'): string => {
    const baseProvided = type === 'short' ? mappingShortKey : mappingLongKey;
    if (baseProvided in row) return baseProvided;
    const cols = Object.keys(row);
    const regex = type === 'short' ? /short\s+description/i : /long\s+description/i;
    const candidates = cols.filter(c => regex.test(c));
    if (candidates.length === 0) return baseProvided;
    for (const code of langCodes) {
      const codeRegex = new RegExp(`(^|\\s|[_-])${code}(\\s|$)`, 'i');
      const hit = candidates.find(c => codeRegex.test(c.toLowerCase()));
      if (hit) return hit;
    }
    const sorted = [...candidates].sort((a, b) => a.length - b.length);
    return sorted[0];
  };

  const shortDescKey = pickDescriptionColumn('short');
  const longDescKey = pickDescriptionColumn('long');

  const existingShort = String(row[shortDescKey] ?? '').trim() || undefined;
  const existingLong = String(row[longDescKey] ?? '').trim() || undefined;
  const existingAbout = String(row[aboutKey] ?? '').trim() || undefined;
  const groups = String(row[groupsKey] ?? '').trim() || undefined;
  const mainCategory = String(row[mainCategoryKey] ?? '').trim() || undefined;
  const secondaryCategories = String(row[secondaryCategoriesKey] ?? '').trim() || undefined;
  const inStoreServicesRaw = String(row[inStoreServicesKey] ?? '').trim().toUpperCase();
  const bookAFittingRaw = String(row[bookAFittingKey] ?? '').trim();
  const triumphOutletsRaw = String(row[triumphOutletsKey] ?? '').trim().toUpperCase();
  const hasAboutColumn = aboutKey in row || Object.keys(row).some(k => /^about$/i.test(k));

  // Skip if missing required fields
  if (!name || !city || !country) {
    return { result: processed, cost: 0, tokensIn: 0, tokensOut: 0 };
  }

  // Handle permanently closed stores
  if (isStoreClosed(status)) {
    const closureMsg = getClosedStoreMessage(language, city);
    processed[shortDescKey] = closureMsg.short;
    processed[longDescKey] = closureMsg.long;
    processed._optimizedFields = ['Short Description', 'Long Description'];
    processed._label = businessId || name || city || `Row ${rowIndex + 1}`;
    return { result: processed, cost: 0, tokensIn: 0, tokensOut: 0 };
  }

  // Check what needs generation
  let needsShort = !existingShort;
  let needsLong = !existingLong;
  if (overwritePolicy === 'fill-improve') {
    if (existingShort && isGenericDescription(existingShort, city)) needsShort = true;
    if (existingLong && isGenericDescription(existingLong, city)) needsLong = true;
  }

  let needsAbout = false;
  if (hasAboutColumn) {
    if (!existingAbout) {
      needsAbout = true;
    } else if (overwritePolicy === 'fill-improve' && isGenericDescription(existingAbout, city)) {
      needsAbout = true;
    }
  }

  // If nothing to generate, skip
  if (!needsShort && !needsLong && !needsAbout) {
    return { result: processed, cost: 0, tokensIn: 0, tokensOut: 0 };
  }

  // Build store data
  const storeData: PartooStoreData = {
    name, address, city, zipcode, country, status,
    existingShort, existingLong, existingAbout, groups, mainCategory, secondaryCategories,
    hasInStoreServices: inStoreServicesRaw === 'TRUE',
    hasBookAFitting: !!bookAFittingRaw && bookAFittingRaw.toLowerCase() !== 'false',
    isOutlet: triumphOutletsRaw === 'TRUE',
  };

  // Short + Long description generation
  if (needsShort || needsLong) {
    const userPrompt = buildPartooStorePrompt(storeData, overwritePolicy);
    const res = await serverOptimize(userPrompt, model, apiKey, PARTOO_SYSTEM_PROMPT, { outputSchema: PARTOO_STORE_SCHEMA });
    totalIn += res.tokens.inputTokens;
    totalOut += res.tokens.outputTokens;
    totalCost += res.costUsd ?? 0;

    const parsed = res.parsed
      ? { short: res.parsed.short_description.trim(), long: res.parsed.long_description.trim() }
      : parsePartooResponse(res.content);
    if (parsed) {
      if (needsShort) processed[shortDescKey] = stripMarkdown(parsed.short);
      if (needsLong) processed[longDescKey] = stripMarkdown(parsed.long);
    } else {
      // Fallback: store raw response
      processed[longDescKey] = res.content;
    }
  }

  // About field generation (separate AI call, Markdown preserved)
  if (needsAbout) {
    const aboutPrompt = buildPartooAboutPrompt(storeData, overwritePolicy);
    const aboutRes = await serverOptimize(aboutPrompt, model, apiKey, PARTOO_ABOUT_SYSTEM_PROMPT);
    totalIn += aboutRes.tokens.inputTokens;
    totalOut += aboutRes.tokens.outputTokens;
    totalCost += aboutRes.costUsd ?? 0;

    const parsedAbout = parsePartooAboutResponse(aboutRes.content);
    if (parsedAbout) {
      processed[aboutKey] = parsedAbout;
    }
  }

  const fields: string[] = [];
  if (needsShort) fields.push('Short Description');
  if (needsLong) fields.push('Long Description');
  if (needsAbout) fields.push('About');
  processed._optimizedFields = fields;

  // Set label for activity log (use Business identification or store name)
  processed._label = businessId || name || city || `Row ${rowIndex + 1}`;

  return { result: processed, cost: totalCost, tokensIn: totalIn, tokensOut: totalOut };
}

// ===========================================================================
// Shared helpers — imported from ecommercePrompts.ts
// (wiringAndPaddingCompact, seriesNameRules, truthfulnessRules,
//  ECOMMERCE_SYSTEM_PROMPT, buildEcommerceUserPrompt)
// ===========================================================================

function preFlight(): string {
  return `PRE-FLIGHT VERIFICATION (internal only — do NOT include in output):
Silently verify before returning:
1. Every technical claim exists in the input data — remove any that do not
2. Replace inferred details with neutral language
3. No assumptions or invented specs in the output`;
}

// Product abbreviations (shared by NEXT & AboutYou)
const PRODUCT_ABBREVIATIONS: [string, string][] = [
  ['B', 'Balconette Bra'], ['BS', 'Soft Body (Non-Wired Body)'], ['BSW', 'Wired Body'],
  ['BSWP', 'Wired Padded Body'], ['BV', 'Bra Camisole'], ['EX', 'Global Line Produced for Europe'],
  ['F', 'Front Closure Bra'], ['HW Short', 'High-Waist Short'], ['L02', 'Longline Bra'],
  ['LSL', 'Long Sleeve'], ['Minimizer WP', 'Minimizer Wired Padded Bra'], ['N', 'Non-Wired Bra'],
  ['N01', 'Non-Wired Bra'], ['NDK', 'Nightdress (Knit)'], ['NDW', 'Nightdress (Woven)'],
  ['NSL', 'Sleeveless'], ['P', 'Padded Bra'], ['P01', 'Padded Bra'], ['Panty L', 'Long Leg Panty'],
  ['PK', 'Pyjama (Knit)'], ['PSW', 'Pyjama (Short, Woven)'], ['SSL', 'Short Sleeve'],
  ['Super HW Mid-Thigh', 'Super High-Waist Mid-Thigh Panty'],
  ['Super HW Panty', 'Super High-Waist Shaping Panty'], ['W', 'Wired Bra'],
  ['W01', 'Minimizer Wired Bra'], ['WDP', 'Wired Padded Bra with Detachable Straps'],
  ['WH', 'Wired Half Cup Bra'], ['WHP', 'Wired Half Padded Bra'], ['WHP01', 'Wired Half Padded Bra'],
  ['WHPM', 'Wired Half Padded Multiway Bra'], ['WHU', 'Wired Half Cup Push-Up Bra'],
  ['WHUF', 'Wired Half Cup Push-Up Front Closure Bra'], ['WHUM', 'Wired Half Cup Push-Up Multiway Bra'],
  ['WP', 'Wired Padded Bra'],
];

function formatAbbreviationsForPrompt(): string {
  return PRODUCT_ABBREVIATIONS.map(([code, name]) => `- ${code} = ${name}`).join('\n');
}

// Language instructions (used by Amazon)
const LANGUAGE_INSTRUCTIONS: Record<string, { name: string; instructions: string; brandTone: string }> = {
  'en': { name: 'English', instructions: 'Write in natural, fluent English.', brandTone: 'Sophisticated, empowering, quality-focused' },
  'pt-PT': { name: 'European Portuguese (Portugal)', instructions: 'CRITICAL: Write in EUROPEAN PORTUGUESE (Portugal), NOT Brazilian Portuguese. Use Portuguese vocabulary: "telemóvel" (not "celular"), "autocarro" (not "ônibus"). Use "tu" form, not "você". Natural Portuguese sentence structure.', brandTone: 'Sofisticado, elegante, de qualidade premium' },
  'pt-BR': { name: 'Brazilian Portuguese (Brazil)', instructions: 'Write in BRAZILIAN PORTUGUESE (Brazil). Use Brazilian vocabulary. Natural Brazilian sentence structure.', brandTone: 'Acessível, confortável, confiável' },
  'es': { name: 'Spanish (Español)', instructions: 'Write in natural, fluent SPANISH. DO NOT translate word-for-word from English. Use Spanish idiomatic expressions.', brandTone: 'Sofisticado, elegante, empoderador' },
  'de': { name: 'German (Deutsch)', instructions: 'Write in natural, fluent GERMAN. Use German sentence structure and compound words. Use "Sie" form.', brandTone: 'Präzise, qualitätsbewusst, elegant' },
  'fr': { name: 'French (Français)', instructions: 'Write in natural, fluent FRENCH. French elegance in expression. Use "vous" form.', brandTone: 'Élégant, sophistiqué, raffiné' },
  'it': { name: 'Italian (Italiano)', instructions: 'Write in natural, fluent ITALIAN. Italian natural flow, not English structure.', brandTone: 'Elegante, sofisticato, di qualità' },
};

function getLanguageInstructions(langCode: string): string {
  const lang = LANGUAGE_INSTRUCTIONS[langCode];
  if (!lang) return `Write in ${langCode.toUpperCase()} with natural, fluent expression.`;
  return `TARGET LANGUAGE: ${lang.name}\n\nLOCALIZATION INSTRUCTIONS:\n${lang.instructions}\n\nBRAND TONE for ${lang.name}:\n${lang.brandTone}\n\nCRITICAL RULES:\n- DO NOT translate literally word-for-word from English\n- ADAPT the message to sound natural and native in ${lang.name}\n- Use idiomatic expressions native to ${lang.name}\n\nSERIES NAME FORMATTING (ALL LANGUAGES):\n- ALWAYS remove "O-" or "O -" prefix from series names\n- For series ending in "T", use the name without "T"\n- ALWAYS refer to series as "the [Series Name] series"`;
}

function getShortLanguageInstruction(langCode: string): string {
  const lang = LANGUAGE_INSTRUCTIONS[langCode];
  if (!lang) return langCode.toUpperCase();
  return `${lang.name} (natural, not literal translation)`;
}

// Color translations (used by NEXT & AboutYou)
interface ColorMapping { code: string; triumphName: string; standardColor: string; }
const COLOR_TRANSLATIONS: ColorMapping[] = [
  { code: 'M010', triumphName: 'GREEN - DARK COMBINATION', standardColor: 'Green' },
  { code: '3595', triumphName: 'LILAC', standardColor: 'Purple' },
  { code: '7855', triumphName: 'OLIVE GOLD', standardColor: 'Green' },
  { code: '0040', triumphName: 'PORCELAIN', standardColor: 'Nude' },
  { code: '3880', triumphName: 'WILD ROSE', standardColor: 'Pink' },
  { code: '1141', triumphName: 'CACAO', standardColor: 'Brown' },
  { code: '3602', triumphName: 'CHROME', standardColor: 'Grey' },
  { code: '1588', triumphName: 'FLORAL PINK', standardColor: 'Pink' },
  { code: '00KY', triumphName: 'LIGHT BLUE', standardColor: 'Blue' },
  { code: '00CM', triumphName: 'NOSTALGIC BROWN', standardColor: 'Brown' },
  { code: '00DM', triumphName: 'PUFF PINK', standardColor: 'Pink' },
  { code: '00GZ', triumphName: 'SILK WHITE', standardColor: 'White' },
  { code: '0003', triumphName: 'WHITE', standardColor: 'White' },
  { code: '0004', triumphName: 'BLACK', standardColor: 'Black' },
  { code: '00SA', triumphName: 'ICE', standardColor: 'Blue' },
  { code: 'M007', triumphName: 'BLUE - LIGHT COMBINATION', standardColor: 'Blue' },
  { code: 'V013', triumphName: 'MULTIPLE COLOURS 13', standardColor: 'Purple' },
  { code: 'V014', triumphName: 'MULTIPLE COLOURS 14', standardColor: 'Purple' },
  { code: 'V019', triumphName: 'MULTIPLE COLOURS 19', standardColor: 'Blue' },
  { code: 'V002', triumphName: 'MULTIPLE COLOURS 2', standardColor: 'Purple' },
  { code: 'V020', triumphName: 'MULTIPLE COLOURS 20', standardColor: 'Blue' },
  { code: '00LZ', triumphName: 'NEW BEIGE', standardColor: 'Nude' },
  { code: '00HJ', triumphName: 'PURPLE', standardColor: 'Purple' },
  { code: 'M008', triumphName: 'BLUE - DARK COMBINATION', standardColor: 'Blue' },
  { code: '00TS', triumphName: 'PRUSSIAN BLUE', standardColor: 'Blue' },
  { code: '00ZE', triumphName: 'CHOCOLATE MOUSSE', standardColor: 'Brown' },
  { code: '0049', triumphName: 'FLOWER PURPLE', standardColor: 'Purple' },
  { code: 'V004', triumphName: 'MULTIPLE COLOURS 4', standardColor: 'Blue' },
  { code: '00NZ', triumphName: 'NUDE BEIGE', standardColor: 'Nude' },
  { code: 'M019', triumphName: 'PINK - LIGHT COMBINATION', standardColor: 'Red' },
  { code: '00EH', triumphName: 'ROYAL PURPLE', standardColor: 'Purple' },
  { code: '1991', triumphName: 'SILENCE', standardColor: 'Blue' },
  { code: '6926', triumphName: 'SWEET MARSALA', standardColor: 'Red' },
  { code: '00JO', triumphName: 'INK GRAY', standardColor: 'Grey' },
  { code: 'M034', triumphName: 'DARK GREY MELANGE', standardColor: 'Grey' },
  { code: '6653', triumphName: 'FLASHY PINK', standardColor: 'Pink' },
  { code: 'M013', triumphName: 'GREY COMBINATION', standardColor: 'Blue' },
  { code: '3557', triumphName: 'GREY SHADOW', standardColor: 'Grey' },
  { code: 'M032', triumphName: 'LIGHT GREY MELANGE', standardColor: 'Cream' },
  { code: '00EP', triumphName: 'NEUTRAL BEIGE', standardColor: 'Nude' },
  { code: '6901', triumphName: 'TOASTED ALMOND', standardColor: 'Natural' },
  { code: '00QF', triumphName: 'VINTAGE DENIM', standardColor: 'Blue' },
  { code: '0035', triumphName: 'RED COMBINATION', standardColor: 'Red' },
  { code: '00FZ', triumphName: 'SHANGHAI RED', standardColor: 'Red' },
  { code: '00YQ', triumphName: 'BRANDY', standardColor: 'Purple' },
  { code: 'M006', triumphName: 'RED - DARK COMBINATION', standardColor: 'Red' },
];

function translateColor(triumphColorOrCode: string, mappings: ColorMapping[] = COLOR_TRANSLATIONS): string {
  if (!triumphColorOrCode) return '';
  const needle = triumphColorOrCode.trim().toUpperCase();
  const byName = mappings.find(m => m.triumphName.toUpperCase() === needle);
  if (byName) return byName.standardColor;
  const byCode = mappings.find(m => m.code.toUpperCase() === needle);
  if (byCode) return byCode.standardColor;
  return triumphColorOrCode;
}

// Size translations (used by NEXT)
const BAND_MAP: Record<string, string> = { '70':'32','75':'34','80':'36','85':'38','90':'40','95':'42','100':'44' };
const DRESS_BRA_BAND_MAP: Record<string, string> = { '38':'34','40':'36','42':'38','44':'40','46':'42' };
const CUP_MAP: Record<string, string> = { A:'A',B:'B',C:'C',D:'D',E:'DD',F:'E',G:'F',H:'G' };
const DRESS_SIZE_MAP: Record<string, string> = { '36':'8','38':'10','40':'12','42':'14','44':'16','46':'18','48':'20' };

function translateSize(euSize: string): string {
  if (!euSize) return '';
  const s = euSize.trim().toUpperCase();
  // Direct bra size: CupBand (e.g. "D80", "D080")
  const cupBand = s.match(/^([A-H]{1,2})(\d{2,3})$/);
  if (cupBand) {
    const [, cup, rawBand] = cupBand;
    const band = rawBand.length === 3 && rawBand.startsWith('0') ? rawBand.slice(1) : rawBand;
    const gbCup = CUP_MAP[cup];
    const gbBand = BAND_MAP[band] ?? DRESS_BRA_BAND_MAP[band];
    if (gbBand && gbCup) return `${gbBand} ${gbCup}`;
  }
  // BandCup (e.g. "80D")
  const bandCup = s.match(/^(\d{2,3})([A-H]{1,2})$/);
  if (bandCup) {
    const [, rawBand, cup] = bandCup;
    const band = rawBand.length === 3 && rawBand.startsWith('0') ? rawBand.slice(1) : rawBand;
    const gbCup = CUP_MAP[cup];
    const gbBand = BAND_MAP[band] ?? DRESS_BRA_BAND_MAP[band];
    if (gbBand && gbCup) return `${gbBand} ${gbCup}`;
  }
  // Dress size
  if (DRESS_SIZE_MAP[s]) return DRESS_SIZE_MAP[s];
  return euSize;
}

// Sanitizers
function sanitizeBulletsOutputToArray(raw: string): string[] {
  if (!raw) return [];
  let txt = String(raw).replace(/\r\n|\r/g, '\n').trim();
  txt = txt.replace(/^\s*(bullets?:|bullet points?:)\s*/i, '');
  let lines = txt.split('\n').map(s => s.trim()).filter(Boolean);
  if (lines.length === 1) {
    const one = lines[0];
    for (const rx of [/\s•\s+/, /\s-\s+/, /\s–\s+/, /\s—\s+/, /\s\|\s+/, /;\s+/]) {
      const parts = one.split(rx).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) { lines = parts; break; }
    }
  }
  lines = lines.map(l => l.replace(/^\s*(?:[-–—•]|(\d+)[\.\)]\s*)\s*/, '').trim());
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lines) {
    if (!l) continue;
    const key = l.toLowerCase();
    if (seen.has(key)) continue;
    out.push(l); seen.add(key);
    if (out.length === 5) break;
  }
  while (out.length < 5) out.push('—');
  return out;
}

function sanitizeAplusShort(raw: string): string {
  if (!raw) return '';
  let s = String(raw).replace(/^\s*(bullets?:|a\+?\s*short:)\s*/i, '').replace(/\s+/g, ' ').replace(/[\r\n]+/g, ' ').trim();
  if (s.length > 300) s = s.slice(0, 300).trim();
  return s;
}

function sanitizeDescription(raw: string): string {
  if (!raw) return '';
  return String(raw).replace(/^\s*(description:)\s*/i, '').replace(/[*_`#>-]/g, m => m === '-' ? '' : '').replace(/\s+/g, ' ').trim();
}

const POLICY_RX = /\b(best|heals?|cures?|100%\s*(?:eco|sustainable))\b/i;
function hasPolicyIssues(...texts: (string|undefined)[]): boolean {
  return texts.some(t => t ? POLICY_RX.test(t) : false);
}

function sanitizeStripMarkdown(text: string): string {
  return text.replace(/<[^>]+>/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_~`#]+/g, '').replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

// ===========================================================================
// Amazon processor — full port of client-side logic
// ===========================================================================

const AMAZON_SYSTEM_PROMPT = `
You are an expert Amazon listings writer.

OUTPUT CONTRACT (STRICT):
- BULLETS: return EXACTLY 5 lines, each a single concise benefit/features sentence.
  - No numbering, no emojis, no markdown, no labels like "Bullets:".
  - No leading symbols (no "-", "•", "—", "1)").
  - Plain text only, one bullet per line.
- DESCRIPTION: return ONE clean paragraph (3–6 sentences). No headings, no lists, no HTML/markdown.
- APLUS_SHORT: return ONE sentence <= 300 characters. No labels like "A+ Short:".

STYLE & POLICY:
- Brand-safe, neutral, benefit-first. Do not invent specs/materials.
- No medical/therapeutic claims, no guarantees, no superlatives like "best".
- No price, shipping, availability, promotions, or competitors.

LOCALIZATION & TONE OF VOICE (CRITICAL):
- DO NOT translate literally word-for-word from English
- LOCALIZE (adapt) the message to sound natural and fluent in the target language
- Use idiomatic expressions native to the target language, not English structure

LANGUAGE-SPECIFIC CRITICAL RULES:
- PT-PT (European Portuguese): Use "telemóvel" NOT "celular", "acolchoamento" NOT "enchimento"
- PT-BR (Brazilian Portuguese): Use Brazilian vocabulary ("celular", "ônibus")
- ES (Spanish): Adapt for natural Spanish flow
- DE (German): Use German compound words and sentence structure
- FR (French): Maintain French elegance and natural flow
- IT (Italian): Use Italian expressiveness and style

${wiringAndPaddingCompact()}

${seriesNameRules()}

${truthfulnessRules()}

SEO (if provided):
- Use the primary keyword ONCE in the first bullet and in the first sentence of the description.
- Use secondary keywords at most once across the remaining bullets/description.

RETURN RULE:
- Return ONLY the requested text for the current task (bullets OR description OR APLUS_SHORT).
- Do NOT prepend any labels.

${preFlight()}
`;

async function processAmazonRow(
  row: Record<string, unknown>,
  rowIndex: number,
  model: ModelLike,
  apiKey: string,
  config: RunConfig
): Promise<{ result: Record<string, unknown>; cost: number; tokensIn: number; tokensOut: number }> {
  const processed = { ...row } as any;
  const mapping = config.mappings?.mapping as Record<string, any> || config.mappings as Record<string, any> || {};
  let totalIn = 0;
  let totalOut = 0;
  let totalCost = 0;

  const idKey = mapping.productId || 'vendor_sku#1.value';
  const titleKey = mapping.title || 'item_name#1.value';
  const descKey = mapping.descriptionIn || 'rtip_product_description#1.value';
  const bulletKeys = (mapping.bullets || []).filter(Boolean) as string[];

  const title = String(row[titleKey] ?? '');
  const descriptionIn = String(row[descKey] ?? '');
  const bulletsIn = bulletKeys.map(k => String(row[k] ?? '').trim()).filter(b => b.length > 0);
  const language = config.lang || 'en';
  const primaryKeyword = String(row['generic_keyword#1.value'] ?? title ?? '').trim() || undefined;

  const safe = (v?: string) => (v ?? '').trim();

  // 1) Bullets
  const bulletsPrompt = `
TASK: Write EXACTLY 5 bullets for an Amazon PDP.

LOCALIZATION: If the input content is in a different language, LOCALIZE (not just translate) to ${getShortLanguageInstruction(language)}.
${getLanguageInstructions(language)}

CONTEXT:
- Title: ${safe(title)}
- Existing description (may be empty): ${safe(descriptionIn)}
- Existing bullets (may be empty): ${bulletsIn.join(' | ')}

SEO:
- Primary keyword: ${primaryKeyword || '(none)'}
- Use the primary keyword ONCE in the FIRST bullet (if provided).

FORMAT:
- Output ONLY 5 lines. No numbering, no symbols, no labels.
- Sound natural and native in the target language.
`;

  const bulletsRes = await serverOptimize(bulletsPrompt, model, apiKey, AMAZON_SYSTEM_PROMPT);
  totalIn += bulletsRes.tokens.inputTokens;
  totalOut += bulletsRes.tokens.outputTokens;
  totalCost += bulletsRes.costUsd ?? 0;
  const bullets = sanitizeBulletsOutputToArray(bulletsRes.content || '');
  processed['gen_bullet_1'] = bullets[0] || '—';
  processed['gen_bullet_2'] = bullets[1] || '—';
  processed['gen_bullet_3'] = bullets[2] || '—';
  processed['gen_bullet_4'] = bullets[3] || '—';
  processed['gen_bullet_5'] = bullets[4] || '—';

  // 2) Long description
  const descPrompt = `
TASK: Write ONE paragraph (3–6 sentences) Amazon PDP long description.

LOCALIZATION: If the input content is in a different language, LOCALIZE (not just translate) to ${getShortLanguageInstruction(language)}.
${getLanguageInstructions(language)}

CONTEXT:
- Title: ${safe(title)}
- Existing description (may be empty): ${safe(descriptionIn)}
- Bullets (may be empty): ${bullets.join(' | ')}

SEO:
- Primary keyword: ${primaryKeyword || '(none)'} → Use it ONCE in the FIRST sentence.

FORMAT:
- Output ONLY the paragraph. No labels, no headings, no bullets, no HTML/markdown.
`;

  const descRes = await serverOptimize(descPrompt, model, apiKey, AMAZON_SYSTEM_PROMPT);
  totalIn += descRes.tokens.inputTokens;
  totalOut += descRes.tokens.outputTokens;
  totalCost += descRes.costUsd ?? 0;
  const genDescription = sanitizeDescription(descRes.content || '');
  processed['gen_description'] = genDescription;

  // 3) A+ short
  const aplusPrompt = `
TASK: Write ONE sentence (<= 300 chars) for Amazon A+ content (between two images).

LOCALIZATION: If the source content is in a different language, LOCALIZE (not just translate) to ${getShortLanguageInstruction(language)}.
${getLanguageInstructions(language)}

SOURCE:
- Use this description as source: ${safe(genDescription) || safe(descriptionIn)}

SEO:
- Include the primary keyword ONCE if provided: ${primaryKeyword || '(none)'}.

FORMAT:
- Output ONLY the sentence. No labels, no headings, no line breaks.
- Strictly <= 300 characters.
`;

  const aplusRes = await serverOptimize(aplusPrompt, model, apiKey, AMAZON_SYSTEM_PROMPT);
  totalIn += aplusRes.tokens.inputTokens;
  totalOut += aplusRes.tokens.outputTokens;
  totalCost += aplusRes.costUsd ?? 0;
  processed['gen_aplus_short'] = sanitizeAplusShort(aplusRes.content || '');

  // Policy guard
  if (hasPolicyIssues(processed['gen_bullet_1'], processed['gen_bullet_2'], processed['gen_bullet_3'],
    processed['gen_bullet_4'], processed['gen_bullet_5'], processed['gen_description'], processed['gen_aplus_short'])) {
    processed['gen_warnings'] = (processed['gen_warnings'] ? processed['gen_warnings'] + '; ' : '') + 'PolicyTermsDetected';
  }

  processed._optimizedFields = ['Bullets', 'Description', 'A+ Short'];
  processed._label = String(row[idKey] ?? '').trim() || String(row[titleKey] ?? '').trim() || `Row ${rowIndex + 1}`;
  return { result: processed, cost: totalCost, tokensIn: totalIn, tokensOut: totalOut };
}

// ===========================================================================
// NEXT processor — full port of client-side logic
// ===========================================================================

const NEXT_SYSTEM_PROMPT = `You are a professional fashion copywriter creating product content for NEXT, a major British fashion retailer.

## TARGET AUDIENCE
- Female, 30-55 years old
- Family-oriented, practical — values quality, reliability, good value
- Prefers clear, informative descriptions

## TONE OF VOICE (Triumph × NEXT)
- Warm, reassuring, informative — like a knowledgeable sales assistant
- Professional but approachable; confident but not boastful
- Focus on practical benefits: comfort, durability, fit, versatility

## LANGUAGE
- BRITISH ENGLISH only: colour (not color), favourite (not favorite), centre (not center), fibre (not fiber), moulded (not molded)

## PRODUCT ABBREVIATIONS
${formatAbbreviationsForPrompt()}

## CONTENT RULES
- Product Title: max 100 characters. Clear, descriptive title.
- Copy Design Features: max 1000 characters. Detailed, benefit-led copy.
- Include lingerie-specific attributes naturally when provided: Fit, Padding, Rise, Support, Type, Wiring
- Plain text ONLY — NO HTML, markdown, emojis, bullet points
- NO superlatives ("best", "perfect", "ultimate", "100%")
- NEVER invent features not present in the source data

${preFlight()}
4. British English spelling throughout
5. product_title ≤100 characters, copy_design_features ≤1000 characters

## OUTPUT FORMAT
Your entire response must be ONLY the JSON object below — no verification text, no markdown fences, no explanation:
{"product_title":"<max 100 characters>","copy_design_features":"<max 1000 characters>"}`;

function buildNextPrompt(data: {
  supplierCode: string; styleNo: string; existingTitle: string;
  colorName: string; standardColor: string; size: string;
  existingCopy: string; composition: string;
  fit?: string; padding?: string; rise?: string; support?: string;
  lingerieType?: string; wiring?: string;
}): string {
  const attrs = [
    data.fit && `Fit: ${data.fit}`, data.padding && `Padding: ${data.padding}`,
    data.rise && `Rise: ${data.rise}`, data.support && `Support: ${data.support}`,
    data.lingerieType && `Type: ${data.lingerieType}`, data.wiring && `Wiring: ${data.wiring}`,
  ].filter(Boolean);
  const lines = [
    'TASK: Rewrite the product title and copy design features for NEXT (UK retailer).', '',
    'PRODUCT DATA:',
    `- Supplier Code: ${data.supplierCode || '(not specified)'}`,
    `- Style No: ${data.styleNo}`,
    `- Existing Title: ${data.existingTitle || '(empty)'}`,
    `- Colour: ${data.colorName}${data.standardColor ? ` (Standard: ${data.standardColor})` : ''}`,
    `- Size: ${data.size || '(not specified)'}`,
    `- Composition: ${data.composition || '(not specified)'}`,
    `- Existing Copy: ${data.existingCopy || '(empty)'}`,
  ];
  if (attrs.length > 0) { lines.push(`- Lingerie Attributes:`); attrs.forEach(a => lines.push(`  - ${a}`)); }
  lines.push('', 'INSTRUCTIONS:',
    '- Product Title: max 100 chars, clear, descriptive for NEXT customer.',
    '- Copy Design Features: max 1000 chars, detailed, benefit-led, British English.',
    '- Include lingerie attributes naturally if provided.',
    '- Use ONLY information from the Product Data above.', '',
    'Fields: product_title (max 100 characters), copy_design_features (max 1000 characters).');
  return lines.join('\n');
}

function parseNextResponse(response: string): { productTitle: string; copyDesignFeatures: string } | null {
  try {
    let c = response.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    const parsed = JSON.parse(c);
    if (parsed.product_title && parsed.copy_design_features) {
      return { productTitle: String(parsed.product_title).trim().slice(0, 100), copyDesignFeatures: String(parsed.copy_design_features).trim().slice(0, 1000) };
    }
    return null;
  } catch { return null; }
}

async function processNextRow(
  row: Record<string, unknown>,
  rowIndex: number,
  model: ModelLike,
  apiKey: string,
  config: RunConfig
): Promise<{ result: Record<string, unknown>; cost: number; tokensIn: number; tokensOut: number }> {
  const processed = { ...row } as any;
  let totalIn = 0;
  let totalOut = 0;
  let totalCost = 0;
  const mapping = config.mappings?.mapping as Record<string, string> || config.mappings as Record<string, string> || {};
  const colorMappings = (config as any).colorMappings || COLOR_TRANSLATIONS;

  const supplierCodeKey = mapping.supplierCode || 'Next Supplier Code';
  const styleNoKey = mapping.styleNo || 'Manufacturers Style No';
  const productTitleKey = mapping.productTitle || 'Product Description (Item Title)';
  const colorNameKey = mapping.colorName || 'Manufacturers Colour Name';
  const standardColorKey = mapping.standardColor || 'Standard Colour';
  const sizeKey = mapping.size || 'Size';
  const copyFeaturesKey = mapping.copyDesignFeatures || 'Copy Design Features (Tone of Voice)';
  const compositionKey = mapping.composition || 'Garment Composition';
  const fitKey = mapping.fit || 'Fit';
  const paddingKey = mapping.padding || 'Padding';
  const riseKey = mapping.rise || 'Rise';
  const supportKey = mapping.support || 'Support';
  const lingerieTypeKey = mapping.lingerieType || 'Type';
  const wiringKey = mapping.wiring || 'Wiring';

  const supplierCode = String(row[supplierCodeKey] ?? '').trim();
  const styleNo = String(row[styleNoKey] ?? '').trim();

  // Skip if missing required fields
  if (!supplierCode && !styleNo) {
    return { result: processed, cost: 0, tokensIn: 0, tokensOut: 0 };
  }

  const existingTitle = String(row[productTitleKey] ?? '').trim();
  const colorName = String(row[colorNameKey] ?? '').trim();
  const existingStdColor = String(row[standardColorKey] ?? '').trim();
  const existingSize = String(row[sizeKey] ?? '').trim();
  const existingCopy = String(row[copyFeaturesKey] ?? '').trim();
  const composition = String(row[compositionKey] ?? '').trim();

  // Deterministic: size translation EU->GB
  let sizeValue = existingSize;
  if (existingSize) {
    const gbSize = translateSize(existingSize);
    if (gbSize !== existingSize) { sizeValue = gbSize; processed[sizeKey] = gbSize; }
  }

  // Deterministic: color translation
  let standardColor = existingStdColor;
  if (!standardColor && colorName) {
    standardColor = translateColor(colorName, colorMappings);
    if (standardColor !== colorName) processed[standardColorKey] = standardColor;
  }
  if (colorName && standardColor && standardColor !== colorName) {
    processed[colorNameKey] = standardColor;
  }

  // AI call
  const userPrompt = buildNextPrompt({
    supplierCode, styleNo, existingTitle, colorName, standardColor,
    size: sizeValue, existingCopy, composition,
    fit: String(row[fitKey] ?? '').trim() || undefined,
    padding: String(row[paddingKey] ?? '').trim() || undefined,
    rise: String(row[riseKey] ?? '').trim() || undefined,
    support: String(row[supportKey] ?? '').trim() || undefined,
    lingerieType: String(row[lingerieTypeKey] ?? '').trim() || undefined,
    wiring: String(row[wiringKey] ?? '').trim() || undefined,
  });

  const res = await serverOptimize(userPrompt, model, apiKey, NEXT_SYSTEM_PROMPT, { outputSchema: NEXT_SCHEMA });
  totalIn += res.tokens.inputTokens;
  totalOut += res.tokens.outputTokens;
  totalCost += res.costUsd ?? 0;

  const parsed = res.parsed
    ? {
        productTitle: res.parsed.product_title.trim().slice(0, 100),
        copyDesignFeatures: res.parsed.copy_design_features.trim().slice(0, 1000),
      }
    : parseNextResponse(res.content);
  const fields: string[] = [];
  if (parsed) {
    processed[productTitleKey] = sanitizeStripMarkdown(parsed.productTitle).slice(0, 100);
    processed[copyFeaturesKey] = sanitizeStripMarkdown(parsed.copyDesignFeatures).slice(0, 1000);
    fields.push('Product Title', 'Copy Design Features');
  } else {
    processed.gen_error = 'Failed to parse AI response';
  }
  if (processed[sizeKey] !== existingSize) fields.push('Size (EU→GB)');
  if (processed[standardColorKey] !== existingStdColor || processed[colorNameKey] !== colorName) fields.push('Color');
  processed._optimizedFields = fields;
  processed._label = supplierCode || styleNo || `Row ${rowIndex + 1}`;

  return { result: processed, cost: totalCost, tokensIn: totalIn, tokensOut: totalOut };
}

// ===========================================================================
// AboutYou processor — full port of client-side logic
// ===========================================================================

const ABOUTYOU_SYSTEM_PROMPT = `You are a professional fashion copywriter creating product content for About You, a leading European fashion and lifestyle e-commerce platform.

## TARGET AUDIENCE
- Younger, trend-conscious, style-led demographic, aged 18-35
- Values personal expression, individuality, and trend-forward fashion
- Buys lingerie that combines style with everyday comfort

## TONE OF VOICE (Triumph × About You)
- Fresh, confident, and contemporary — NOT corporate or stiff
- Speak like a stylish friend recommending a great find
- Authentic and personality-driven
- Short, punchy sentences for impact

## PRODUCT ABBREVIATIONS
${formatAbbreviationsForPrompt()}

## CONTENT RULES
- Style Name: max 80 characters. Short, catchy, trend-aware product name.
- Long Description: max 500 characters. Engaging, benefit-driven.
- Write in ENGLISH unless the input data is clearly in another language (match the input language)
- Plain text ONLY — NO HTML, markdown, emojis
- NO superlatives ("best", "perfect", "ultimate", "100%")
- NEVER invent features not present in the source data
- Focus on FIT, FEEL, and STYLE

${preFlight()}
4. style_name ≤80 characters, long_description ≤500 characters

## OUTPUT FORMAT
Your entire response must be ONLY the JSON object below:
{"style_name":"<max 80 characters>","long_description":"<max 500 characters>"}`;

function buildAboutYouPrompt(data: {
  styleNo: string; styleName: string; colorNameSupplier: string;
  colorTranslation: string; size: string; productGroup: string;
  existingStyleWording?: string; existingLongDescription?: string;
}): string {
  const lines = [
    'TASK: Write a style name and long description for About You.', '',
    'PRODUCT DATA:',
    `- Style No: ${data.styleNo}`, `- Style Name: ${data.styleName}`,
    `- Product Group: ${data.productGroup || '(not specified)'}`,
    `- Colour: ${data.colorNameSupplier}${data.colorTranslation ? ` (About You standard: ${data.colorTranslation})` : ''}`,
    `- Size: ${data.size || '(not specified)'}`,
  ];
  if (data.existingStyleWording) lines.push(`- Existing Style Wording: ${data.existingStyleWording}`);
  if (data.existingLongDescription) lines.push(`- Existing Long Description: ${data.existingLongDescription}`);
  lines.push('', 'INSTRUCTIONS:',
    '- Style Name: Create a short, catchy product name (max 80 chars) for 18-35 audience.',
    '- Long Description: Write engaging description (max 500 chars) highlighting fit, feel, style.',
    '- Use ONLY information from the Product Data above.', '',
    'Fields: style_name (max 80 characters), long_description (max 500 characters).');
  return lines.join('\n');
}

function parseAboutYouResponse(response: string): { styleName: string; longDescription: string } | null {
  try {
    let c = response.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    const parsed = JSON.parse(c);
    if (parsed.style_name && parsed.long_description) {
      return { styleName: String(parsed.style_name).trim().slice(0, 80), longDescription: String(parsed.long_description).trim().slice(0, 500) };
    }
    return null;
  } catch { return null; }
}

async function processAboutYouRow(
  row: Record<string, unknown>,
  rowIndex: number,
  model: ModelLike,
  apiKey: string,
  config: RunConfig
): Promise<{ result: Record<string, unknown>; cost: number; tokensIn: number; tokensOut: number }> {
  const processed = { ...row } as any;
  let totalIn = 0;
  let totalOut = 0;
  let totalCost = 0;
  const mapping = config.mappings?.mapping as Record<string, string> || config.mappings as Record<string, string> || {};
  const colorMappings = (config as any).colorMappings || COLOR_TRANSLATIONS;

  const styleNoKey = mapping.styleNo || 'Style No supplier';
  const styleNameKey = mapping.styleName || 'Style name supplier';
  const colorNameKey = mapping.colorNameSupplier || 'Color name supplier';
  const colorTransKey = mapping.colorTranslation || 'Colortranslation for About You';
  const sizeKey = mapping.size || 'Size';
  const productGroupKey = mapping.productGroup || 'Product group';
  const styleWordingKey = mapping.styleWording || 'Supplier Style Name (Style wording for Shop)';
  const longDescKey = mapping.longDescription || 'Style Long Description for Shop';

  const styleNo = String(row[styleNoKey] ?? '').trim();
  const styleName = String(row[styleNameKey] ?? '').trim();

  // Skip if missing required fields
  if (!styleNo && !styleName) {
    return { result: processed, cost: 0, tokensIn: 0, tokensOut: 0 };
  }

  const colorNameSupplier = String(row[colorNameKey] ?? '').trim();
  const existingColorTrans = String(row[colorTransKey] ?? '').trim();

  // Deterministic: color translation
  let colorTranslation = existingColorTrans;
  if (!colorTranslation && colorNameSupplier) {
    colorTranslation = translateColor(colorNameSupplier, colorMappings);
    if (colorTranslation !== colorNameSupplier) processed[colorTransKey] = colorTranslation;
  }
  if (colorNameSupplier && colorTranslation && colorTranslation !== colorNameSupplier) {
    processed[colorNameKey] = colorTranslation;
  }

  // AI call
  const userPrompt = buildAboutYouPrompt({
    styleNo, styleName, colorNameSupplier, colorTranslation,
    size: String(row[sizeKey] ?? '').trim(),
    productGroup: String(row[productGroupKey] ?? '').trim(),
    existingStyleWording: String(row[styleWordingKey] ?? '').trim() || undefined,
    existingLongDescription: String(row[longDescKey] ?? '').trim() || undefined,
  });

  const res = await serverOptimize(userPrompt, model, apiKey, ABOUTYOU_SYSTEM_PROMPT, { outputSchema: ABOUTYOU_SCHEMA });
  totalIn += res.tokens.inputTokens;
  totalOut += res.tokens.outputTokens;
  totalCost += res.costUsd ?? 0;

  const parsed = res.parsed
    ? {
        styleName: res.parsed.style_name.trim().slice(0, 80),
        longDescription: res.parsed.long_description.trim().slice(0, 500),
      }
    : parseAboutYouResponse(res.content);
  const fields: string[] = [];
  if (parsed) {
    processed[styleWordingKey] = sanitizeStripMarkdown(parsed.styleName).slice(0, 80);
    processed[longDescKey] = sanitizeStripMarkdown(parsed.longDescription).slice(0, 500);
    fields.push('Style Name', 'Long Description');
  } else {
    processed.gen_error = 'Failed to parse AI response';
  }
  if (processed[colorTransKey] !== existingColorTrans || processed[colorNameKey] !== colorNameSupplier) fields.push('Color');
  processed._optimizedFields = fields;
  processed._label = styleNo || styleName || `Row ${rowIndex + 1}`;

  return { result: processed, cost: totalCost, tokensIn: totalIn, tokensOut: totalOut };
}

// ===========================================================================
// Ecommerce processor — full port of client-side logic
// (ECOMMERCE_SYSTEM_PROMPT now imported from ecommercePrompts.ts)
// ===========================================================================

async function processEcommerceRow(
  row: Record<string, unknown>,
  rowIndex: number,
  model: ModelLike,
  apiKey: string,
  config: RunConfig
): Promise<{ result: Record<string, unknown>; cost: number; tokensIn: number; tokensOut: number }> {
  const processed = { ...row } as any;
  let totalIn = 0;
  let totalOut = 0;
  let totalCost = 0;
  const language = config.lang || 'en';

  const descKey = longDescColumnFor(row, language);
  const description = String(row[descKey] ?? '');

  // Skip if no description to optimize
  if (!description.trim()) {
    return { result: processed, cost: 0, tokensIn: 0, tokensOut: 0 };
  }

  // Optional short hint (dynamic column lookup)
  const shortHintKey = Object.keys(row).find(k => {
    const hasLang = new RegExp(`(^|[ _-])${language}($|[ _-])`, 'i').test(k);
    const isShortDesc = /short description/i.test(k) && hasLang;
    const isSC = /^sc(\b|[_\s-][a-z]{2}$|$)/i.test(k) && new RegExp(`${language}$`, 'i').test(k);
    const isAltStyle = new RegExp(`^materialalternativestyle_${language}$`, 'i').test(k);
    return isShortDesc || isSC || isAltStyle;
  });
  const shortHint = shortHintKey ? String(row[shortHintKey] ?? '') : '';
  const altTitleKey = `MaterialAlternativeStyle_${language}`;
  const title = String(row[altTitleKey] ?? row['MaterialSeriesName'] ?? '');
  const wiringInfo = String(row['Wiring Info'] ?? row['WiringInfo'] ?? row['MaterialProductWiringTypeAI_en'] ?? row['Wiring'] ?? '').trim();
  const paddingInfo = String(row['Padding info'] ?? row['PaddingInfo'] ?? row['MaterialProductLiningLevelTypeAI_en'] ?? row['Padding'] ?? '').trim();
  const productGroup = String(row['Product Group'] ?? row['MaterialProductGroup'] ?? '').trim();
  const usps = String(row['MaterialB2CUSPs_en'] ?? '').trim();
  const seriesDescription = String(row['MaterialB2CSeriesDescription_en'] ?? '').trim();
  const styleDescription = String(row['MaterialB2CStyleDescription_en'] ?? '').trim();

  // Build prompt
  let prompt = 'TASK: Optimize the long description for e-commerce (1–3 paragraphs), plain text.\nCONTEXT:\n';
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

  const systemPrompt = config.useCase === 'sloggi-ecommerce' ? SLOGGI_ECOMMERCE_SYSTEM_PROMPT : ECOMMERCE_SYSTEM_PROMPT;
  const res = await serverOptimize(prompt, model, apiKey, systemPrompt);
  totalIn += res.tokens.inputTokens;
  totalOut += res.tokens.outputTokens;
  totalCost += res.costUsd ?? 0;

  let gen = (res.content || '').trim();
  gen = gen.replace(/https?:\/\/\S+/gi, '').replace(/[\w.+-]+@[\w-]+\.[\w.-]+/gi, '').replace(/\b(?:EUR|USD|CHF|GBP)?\s?\d+[\.,]?\d*\b/gi, '').replace(/\s{2,}/g, ' ').trim();
  if (!gen) gen = (description || title || '').toString().trim();
  processed['gen_description'] = gen;
  processed._optimizedFields = ['Description'];
  processed._label = String(row['MaterialSAPMaterialNo'] ?? row['ColorSAPMaterialNo'] ?? row['ProductID'] ?? row['ID'] ?? '').trim() || `Row ${rowIndex + 1}`;

  return { result: processed, cost: totalCost, tokensIn: totalIn, tokensOut: totalOut };
}

// ---------------------------------------------------------------------------
// Generic row processor (fallback for unknown use cases)
// ---------------------------------------------------------------------------
async function processGenericRow(
  row: Record<string, unknown>,
  rowIndex: number,
  model: ModelLike,
  apiKey: string,
  config: RunConfig
): Promise<{ result: Record<string, unknown>; cost: number; tokensIn: number; tokensOut: number }> {
  const processed = { ...row } as any;
  let totalIn = 0;
  let totalOut = 0;
  let totalCost = 0;

  const columns = config.selectedColumns || [];
  const systemPrompt = 'You are a professional copywriter specializing in e-commerce product descriptions. Optimize the given text for clarity and engagement.';

  for (const column of columns) {
    const original = row[column];
    if (!original || typeof original !== 'string') continue;

    const userPrompt = `Optimize this product description:\n\n"${original}"`;
    const res = await serverOptimize(userPrompt, model, apiKey, systemPrompt);
    totalIn += res.tokens.inputTokens;
    totalOut += res.tokens.outputTokens;
    totalCost += res.costUsd ?? 0;
    processed[column] = res.content;
  }

  return { result: processed, cost: totalCost, tokensIn: totalIn, tokensOut: totalOut };
}
