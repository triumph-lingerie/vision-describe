// Metadata Generation Prompts — Generate long descriptions from product metadata
// (Material Description, Short description, Series USP, Style USP, Style Description)
// for brand-new SKUs that have no existing master copy.
//
// Written for Claude Opus 5 with adaptive thinking: the prompts state each
// rule once, in positive form, and leave the verification to the model's own
// reasoning plus the code-side checks in ../utils/styleGuard.ts. The prompt
// mixes XML structure, brand TOV (from sloggiBrandExpressions /
// triumphBrandExpressions, unchanged), style rules and few-shot examples.
//
// All builders return a CachedPromptInput ({system, user}) so the API caller
// can mark the system block with cache_control. The system block is stable per
// brand, so on a batch of 20+ SKUs every call after the first reads it from
// the cache.

import {
  sloggiBrandExpressions,
  triumphBrandExpressions,
  truthfulnessRules,
  sustainabilityHandling,
  seriesNameRules,
  wiringAndPaddingRules,
  productTerminologyRules,
} from '@/lib/prompts/rules';
import { getCompleteLocalizationContext } from './languageInstructions';
import { buildGlossaryForSource } from '../utils/terminology';
import type { CachedPromptInput } from '../types';

export interface MetadataInput {
  materialNumber: string;
  productName: string;
  brand: string;
  productLine?: string;
  shortDescription?: string;
  seriesUsp?: string;
  styleUsp?: string;
  styleDescription?: string;
  /** Rewrite source for the 'longdesc-rework' flow (existing long copy). */
  existingDescription?: string;
  /** Language code of existingDescription when it is not English. */
  existingSourceLang?: string;
}

const isSloggi = (brand: string): boolean => brand.trim().toLowerCase() === 'sloggi';

function brandRulesBlock(brand: string): string {
  return isSloggi(brand) ? sloggiBrandExpressions() : triumphBrandExpressions();
}

function formatMetadataBlock(input: MetadataInput): string {
  const fields: Array<[string, string | undefined]> = [
    ['Material Number', input.materialNumber],
    ['Product Name', input.productName],
    ['Brand', input.brand],
    ['Product Line', input.productLine],
    ['Short Description (Marketing)', input.shortDescription],
    ['Series USP (Marketing)', input.seriesUsp],
    ['Style USP (Marketing)', input.styleUsp],
    ['Style Description (Marketing)', input.styleDescription],
  ];
  return fields
    .filter(([, v]) => v && String(v).trim().length > 0)
    .map(([k, v]) => `- ${k}: ${String(v).trim()}`)
    .join('\n');
}

const SLOGGI_FEWSHOTS = `
<example>
<input_materials>
- Product Name: sloggi ZERO Feel Lace Brazilian
- Short Description: brazilian brief
- Series USP: ZERO Feel — absolute invisibility and ultimate comfort: zero restriction, zero seams, zero marks and a distinctive zero feeling. Recycled fabric. GRS certified.
- Style USP: Soft seamless microfibre, delicate lace inserts dot-bonded to the body, free-cut edges, 360-degree stretch, no visible lines under tight clothing.
- Style Description: Brazilian cut with mid back coverage and a soft narrow waistband, brushed for a softer hand feel against the skin.
</input_materials>
<output><p>If you want underwear that stays invisible under fitted clothes, this brazilian brief is built for exactly that. It uses soft recycled microfibre with delicate lace inserts bonded flat to the body, so there are no seams to print through leggings or a close-cut dress. It belongs to the ZERO Feel series, made for all-day comfort you stop noticing.</p><ul class="pd"><li>Brazilian cut with mid coverage at the back and a soft, narrow waistband that sits flat</li><li>GRS-certified recycled polyamide microfibre, brushed for a softer hand feel against the skin</li><li>Lace inserts dot-bonded directly to the fabric, so they add detail without seams or scratch</li><li>360-degree stretch that moves with the body and snaps back into shape without curling at the edges</li><li>Free-cut leg openings leave a clean, flat finish next to the skin</li><li>Stays invisible under leggings, fitted trousers and close-cut dresses</li></ul><p>That is what ZERO Feel is built around: absolute invisibility, zero restriction and ultimate comfort, in a brief you can wear from morning to night.</p><p>Sustainability certificate GRS</p></output>
</example>

<example>
<input_materials>
- Product Name: sloggi GO Allround Hipster C3P
- Short Description: hipster brief, 3-pack
- Series USP: GO — all-round comfort only sloggi can deliver, in a modern essential style.
- Style USP: Soft elastic waistband, breathable recycled cotton blend, flat seams, mid-rise.
- Style Description: Easy hipster brief in a 3-pack, cut for movement, layered under anything.
</input_materials>
<output><p>When you want a reliable everyday brief and plenty of them, the GO Allround Hipster comes in a pack of three in a breathable recycled cotton blend. It is cut for movement and sits flat under anything, which is why it tends to become the pair you reach for first. The GO series is sloggi's modern essential: comfortable, unfussy, made for every day.</p><ul class="pd"><li>Pack of three hipster briefs in a soft, breathable recycled cotton blend</li><li>Mid-rise elastic waistband that sits flat and stays in place through the day</li><li>Stretch construction that moves with the body across any range of motion</li><li>Flat seams along the leg openings so nothing digs in or marks the skin</li><li>Easy-care fabric that holds its shape and colour wash after wash</li><li>Clean, sport-leaning lines that layer invisibly under jeans, trousers or activewear</li></ul><p>That is what sloggi GO is for: all-round comfort in a modern essential style, ready for whatever the day asks.</p></output>
</example>

<example>
<input_materials>
- Product Name: sloggi EVER Cool Tanga
- Short Description: cooling tanga brief
- Series USP: EVER — comfort from within, augmented by smart tech features that make us feel superhumanly comfortable.
- Style USP: Smart-cooling cotton tech that wicks heat away from the skin, narrow side seams, light back coverage.
- Style Description: Tanga brief with a soft waistband for invisibility under fitted clothing.
</input_materials>
<output><p>Warm days call for underwear that keeps up. The EVER Cool Tanga uses a smart cotton technology that wicks heat and moisture away from the skin, in a low-coverage shape with a soft waistband that disappears under fitted clothing. It is part of the EVER series, where sloggi adds real tech to everyday comfort.</p><ul class="pd"><li>Tanga brief with narrow side seams and light coverage at the back</li><li>Smart-cooling cotton fabric that pulls heat and moisture away from the skin</li><li>Soft, flat waistband that stays invisible under leggings and fitted trousers</li><li>Lightweight construction with a soft drape that sits close without pressure</li><li>Clean-cut leg openings for a smooth line under close-fitting clothes</li><li>Breathable, skin-friendly fabric suited to warm days and active routines</li></ul><p>This is the EVER series doing what it does best: comfort from within, with smart tech features that earn their place.</p></output>
</example>
`;

const TRIUMPH_FEWSHOTS = `
<example>
<input_materials>
- Product Name: Triumph Amourette Charm Spotlight Bra WHP
- Short Description: padded half-cup bra
- Series USP: Amourette — feminine elegance with floral embroidery, our signature romantic series.
- Style USP: Half-cup padded bra with delicate floral lace at the top of the cup, underwired for support, smooth back.
- Style Description: Elegant padded bra that lifts and shapes, designed for everyday confidence.
</input_materials>
<output><p>For everyday lift with a touch of romance, the Amourette Charm Spotlight is a padded half-cup bra that shapes and supports without losing the detail. Delicate floral lace lines the top of the cup, while a smooth back keeps it discreet under fitted tops and knitwear. It belongs to Amourette, Triumph's signature romantic series.</p><ul class="pd"><li>Underwired half-cup design that lifts and shapes the bust naturally</li><li>Soft padding for a smooth, defined silhouette under clothing</li><li>Delicate floral lace along the upper cup as the series' signature detail</li><li>Smooth back panel that stays invisible under fitted tops and fine knits</li><li>Adjustable straps and a hook-and-eye closure for a precise, personalised fit</li><li>An everyday bra that carries from work days through to evenings out</li></ul><p>Part of the Amourette series: feminine elegance with floral embroidery, made to feel as considered as it looks.</p></output>
</example>

<example>
<input_materials>
- Product Name: Triumph Body Make-up Soft Touch WHP
- Short Description: padded T-shirt bra
- Series USP: Body Make-up — invisible second-skin comfort with a smoothing effect.
- Style USP: Padded T-shirt bra in microfibre, ultra-light spacer foam cups, mesh wings, underwired.
- Style Description: Invisible bra under any outfit, with soft spacer cups for a sculpted but breathable hold.
</input_materials>
<output><p>Under a fitted top, the last thing you want is a bra that shows. Body Make-up Soft Touch smooths and supports while staying invisible, pairing an underwired structure with featherlight spacer cups so the shape stays defined and the fabric stays cool against the skin. It is part of the Body Make-up series, designed for second-skin comfort.</p><ul class="pd"><li>Padded T-shirt bra with lightweight spacer foam for a smooth, even shape</li><li>Underwired construction for steady support that holds all day</li><li>Breathable mesh wings that keep the bra light and cool against the skin</li><li>Microfibre fabric for a soft, invisible finish under close-fitting clothes</li><li>Adjustable straps and back closure for a secure, personalised fit</li><li>Sits cleanly under t-shirts, fine knits and tailored tops where seams would show</li></ul><p>Part of the Body Make-up series: invisible comfort with a smoothing effect that holds through the day.</p></output>
</example>
`;

function fewShotsFor(brand: string): string {
  return isSloggi(brand) ? SLOGGI_FEWSHOTS : TRIUMPH_FEWSHOTS;
}

/**
 * Builds the EN master generation prompt for a single product.
 *
 * Returns {system, user} — the system part is stable per brand and gets
 * cache_control in visionApiUtils.ts. The user part contains only
 * <input_materials> + the write instruction (varies per SKU).
 */
export function buildEnMasterGenerationPrompt(input: MetadataInput): CachedPromptInput {
  const sloggi = isSloggi(input.brand);
  const brandLabel = sloggi ? 'sloggi' : 'Triumph';

  const system = `<role>
You are a senior e-commerce copywriter specialised in fashion and underwear, writing exclusively for ${brandLabel}. You know the ${brandLabel} Brand Book by heart and write to its tone of voice without exception.
</role>

<task>
Write ONE new long product description in English for the SKU described in the user turn's <input_materials> block. There is no existing description — write from scratch using the Marketing Team's inputs as the source of truth.
</task>

<brand_voice>
${brandRulesBlock(input.brand)}

${
  sloggi
    ? `Write peer-to-peer. Authentic, joyful, inclusive, bold. Never aspirational, never preachy. We use "we"/"us" where natural, and "the body" or "you" when describing the wearer benefit.`
    : `Write with Triumph's refined, intentional voice. Elegant, considered, never stiff. Address the wearer directly where it adds clarity.`
}
</brand_voice>

<truthfulness>
Treat every line in <input_materials> as factual marketing input from the brand team. Do not contradict it. Do not invent fabrics, technologies, certifications, sizes or features that are not stated or strongly implied.

${truthfulnessRules()}
</truthfulness>

<style_rules>
1. The first sentence must tell the customer exactly why they need this product: the concrete benefit, problem it solves, or use-case it is made for. Do not open with a template or greeting ("Meet the [product]", "Introducing…", "Welcome to…", "Discover…", "Say hello to…"). Vary the construction across descriptions (lead with the need, name the moment, lead with the fabric, name the cut), but make the reason to buy clear in that first sentence.

2. Em dashes (—) are restricted. Use a maximum of 1 em dash in the entire description. Prefer commas, periods, parentheses or a clean rephrasing.

3. Vary the brand metaphors. "Second skin", "next to skin", "morning to night", "every day / everyday", "comfort that moves with you" and similar are all brand-true, but become hollow when repeated. Use each of these metaphors at most once per description.

4. Use simple, clear, direct language. Avoid: delve, leverage, landscape, testament, showcase, robust, comprehensive, seamless (as an adjective for non-construction concepts), harness, foster, elevate (including elevated and elevating), navigate, crucial, paramount, intricate, tapestry, realm, embark, unleash, streamline, empower, unlock, vibrant, nestled, journey (as metaphor).

5. No humour, puns, jokes or culture-specific idioms. The text ships globally; assume the reader is reading in their second language.

6. Never address the reader by gender. No "ladies", "girls", "guys", "for her", "for women", "for men". The product type already implies the wearer.

7. Never mention specific colours, sizes or variants. The description must apply to every variant of the SKU.

8. Avoid superlative pile-ups ("incredibly soft, beautifully crafted, unbelievably comfortable"). One strong claim per sentence is enough.
</style_rules>

<series_anchors>
End with a closing line that ties the SKU back to its ${brandLabel} series. The closing should reuse the series promise language from <brand_voice>${
    sloggi
      ? ', for example "absolute invisibility, zero restriction, ultimate comfort" for ZERO Feel, "all-round comfort, in a modern essential style" for GO, "comfort from within, augmented by smart tech features" for EVER, "classic comfort, iconic to the core" for ORIGINALS.'
      : '.'
  }
</series_anchors>

<structure>
Output Inriver-compatible HTML in this exact shape:

1. An opening <p> of 2-3 sentences. The first sentence states why the customer needs the product (benefit or use-case); the rest grounds it in what the product is and the material or construction behind the promise.
2. A bullet list with 5-6 items wrapped in <ul class="pd"><li>…</li></ul>. Lead with concrete specifics: materials and fabric composition, construction, fit and coverage, care, certifications, and the situations the product is made for. Prefer a verifiable specification or use-case over a vague benefit. No filler bullets like "perfect for everyday wear" or "great for any occasion".
3. A closing <p> of 1-2 sentences anchoring back to the series promise (see <series_anchors>). No CTA, no "shop now".

Target length: 150 to 300 words total, aiming for around 220. Use the bullets to carry concrete detail rather than padding the paragraphs. If the inputs are genuinely sparse, land near the lower end rather than inventing claims.
</structure>

<additional_rules>
${sustainabilityHandling()}

${wiringAndPaddingRules()}

${productTerminologyRules()}

${seriesNameRules()}
</additional_rules>

<examples>
The examples below show the voice, opener variety and structure we want. Do not copy them; learn the pattern.
${fewShotsFor(input.brand)}
</examples>

<output_format>
Return only the HTML. Start directly with <p>. No preamble, no markdown code blocks, no commentary, no explanation.

Use <p> and <ul class="pd"><li>…</li></ul> exclusively. Do not use <strong>, <b>, <em>, <i>, headings or any other tag.

Two details that are easy to lose and matter to the buying team:
- If <input_materials> Style USP or Style Description contains a cup classification line ("Integrated fixed cups", "Removable cups", "Padded with removable cups", "Non-padded" / "non padded"), it appears verbatim (or with minimal rewording) as the FIRST bullet of the <li> list, never paraphrased into a generic "padded" / "non-padded" line and never dropped.
- Every construction detail sits on the component <input_materials> assigns it to; no feature is described as adjustable, removable or detachable unless the input says so, and the support level matches the input rather than being softened or intensified.
</output_format>`;

  const user = `<input_materials>
${formatMetadataBlock(input)}
</input_materials>

Write the description now.`;

  return { system, user };
}

/**
 * Builds the EN rewrite prompt for the 'longdesc-rework' flow. Unlike
 * buildEnMasterGenerationPrompt (which writes from scratch off USP inputs),
 * this takes an EXISTING long description and rewrites it to brand standard:
 * strips AI-isms, fixes tone, normalises structure, drops variant/photo noise.
 * When the source copy is not English (existingSourceLang set), it also
 * translates into English as part of the rewrite.
 *
 * Returns {system, user}; the system block is stable per brand for caching.
 */
export function buildRewritePrompt(input: MetadataInput): CachedPromptInput {
  const sloggi = isSloggi(input.brand);
  const brandLabel = sloggi ? 'sloggi' : 'Triumph';
  const sourceLang = input.existingSourceLang && input.existingSourceLang !== 'en'
    ? input.existingSourceLang
    : null;

  const system = `<role>
You are a senior e-commerce copywriter specialised in fashion and underwear, writing exclusively for ${brandLabel}. You know the ${brandLabel} Brand Book by heart and write to its tone of voice without exception.
</role>

<task>
Rewrite the existing long product description in the user turn's <existing_description> block into ONE clean English description that meets the ${brandLabel} brand standard. The existing copy is the source of truth for product facts (cut, fabric, construction, features, certifications). Keep those facts. Improve the writing: remove AI-style filler, fix tone, normalise the structure, and drop noise that does not belong in evergreen copy. If the user turn flags the source as non-English, translate its meaning into natural English as you rewrite and leave no source-language text in the output.
</task>

<brand_voice>
${brandRulesBlock(input.brand)}

${
  sloggi
    ? `Write peer-to-peer. Authentic, joyful, inclusive, bold. Never aspirational, never preachy. We use "we"/"us" where natural, and "the body" or "you" when describing the wearer benefit.`
    : `Write with Triumph's refined, intentional voice. Elegant, considered, never stiff. Address the wearer directly where it adds clarity.`
}
</brand_voice>

<truthfulness>
Treat <existing_description> as factual. Keep every concrete product attribute it states (fabric, technology, construction, certification, cut, closure). Do NOT invent attributes the source does not state. If the source is thin, write tighter rather than padding with claims you cannot trace to it.

${truthfulnessRules()}
</truthfulness>

<remove>
Strip the following from the rewrite, they do not belong in evergreen SKU copy:
- Model-wears-size lines ("the model wears size 38", "La modella indossa la taglia 1", "Notre modèle porte…").
- Photo/retouching disclaimers ("photographie retouchée", "retouched photograph", "image retouched").
- Any mention of specific colours, sizes or variants.
- Stray product codes (WHP, W01, C2P, 2P, NDK) inside body copy: use the product type name instead.
A cross-sell line pointing to a matching ${brandLabel} series (e.g. "matching bras from the Feel Sensational series") may stay if present, rephrased into one clean sentence.
</remove>

<style_rules>
1. The first sentence must tell the customer exactly why they need this product: the concrete benefit, problem it solves, or use-case it is made for. Do not open with a template or greeting ("Meet the [product]", "Introducing…", "Welcome to…", "Discover…", "Say hello to…"). Vary the construction (lead with the need, name the moment, lead with the fabric, name the cut), but make the reason to buy clear in that first sentence.

2. Em dashes (—) are restricted. Use a maximum of 1 em dash in the entire description.

3. Vary the brand metaphors. "Second skin", "next to skin", "morning to night", "every day / everyday", "comfort that moves with you" and similar are brand-true but become hollow when repeated. Use each at most once per description.

4. Use simple, clear, direct language. Avoid: delve, leverage, landscape, testament, showcase, robust, comprehensive, seamless (as an adjective for non-construction concepts), harness, foster, elevate (including elevated and elevating), navigate, crucial, paramount, intricate, tapestry, realm, embark, unleash, streamline, empower, unlock, vibrant, nestled, journey (as metaphor), thoughtful construction, prioritizes, ensures utmost.

5. No humour, puns, jokes or culture-specific idioms. The text ships globally; assume the reader is reading in their second language.

6. Never address the reader by gender. No "ladies", "girls", "guys", "for her", "for women", "for men".

7. Never mention specific colours, sizes or variants. The description must apply to every variant of the SKU.

8. Avoid superlative pile-ups ("incredibly soft, beautifully crafted, unbelievably comfortable"). One strong claim per sentence.
</style_rules>

<structure>
Output Inriver-compatible HTML in this exact shape:

1. An opening <p> of 2-3 sentences. The first sentence states why the customer needs the product (benefit or use-case); the rest grounds it in what the product is and the material or construction behind it.
2. A bullet list with 5-6 items wrapped in <ul class="pd"><li>…</li></ul>. Lead with concrete specifics drawn from <existing_description>: materials, construction, fit and coverage, care, certifications, and the situations the product is made for. Prefer a verifiable specification or use-case over a vague benefit. No filler bullets like "perfect for everyday wear".
3. A closing <p> of 1-2 sentences. No CTA, no "shop now".

Target length: 150 to 300 words total, aiming for around 220. Carry concrete detail in the bullets rather than padding the paragraphs. If the source is genuinely thin, land near the lower end rather than inventing claims.
</structure>

<additional_rules>
${sustainabilityHandling()}

${wiringAndPaddingRules()}

${productTerminologyRules()}

${seriesNameRules()}
</additional_rules>

<output_format>
Return only the HTML. Start directly with <p>. No preamble, no markdown code blocks, no commentary.

Use <p> and <ul class="pd"><li>…</li></ul> exclusively. No <strong>, <b>, <em>, <i>, headings or other tags.

The output is entirely in English, whatever the language of the source. Every construction detail sits on the component <existing_description> assigns it to; nothing is described as adjustable, removable or detachable unless the source says so, and the support level matches the source rather than being softened or intensified.
</output_format>`;

  const user = `<product_context>
- Material Number: ${input.materialNumber}
- Product Name: ${input.productName}
- Brand: ${input.brand}
${sourceLang ? `- Source language of the existing copy: ${sourceLang} (translate into English as you rewrite)\n` : ''}</product_context>

<existing_description>
${input.existingDescription ?? ''}
</existing_description>

Rewrite the description now.`;

  return { system, user };
}

/**
 * Builds the localisation prompt that renders the freshly generated EN master
 * into the target Inriver locale. Brand-aware.
 *
 * Returns {system, user}. The system part holds the role, task, brand voice,
 * rules and terminology — stable across every locale and every SKU (per
 * brand + lang combo). The user part holds <product_context>, <source> and
 * <localisation_context>, which vary per call.
 *
 * Caching trade-off: localisation_context varies per langCode, so we put it
 * in the user block. The system is shared across ALL locales for the same
 * brand, maximising cache hits when running a multi-locale fan-out.
 */
export function buildLocalisationPrompt(
  enMaster: string,
  langCode: string,
  langName: string,
  input: MetadataInput
): CachedPromptInput {
  const sloggi = isSloggi(input.brand);
  const brandLabel = sloggi ? 'sloggi' : 'Triumph';

  const system = `<role>
You are a senior copywriter and localiser writing for ${brandLabel} and faithful to the ${brandLabel} Brand Book. Each request specifies a target language; respond as a native copywriter in that language.
</role>

<task>
Localise the English master provided in the user turn's <source> block into the target language given in <localisation_context>. Localise, do not translate word-for-word: write as a native copywriter for that locale would.
</task>

<brand_voice>
${brandRulesBlock(input.brand)}
</brand_voice>

<rules>
1. Preserve the structure exactly: same paragraph count, same number of bullets, same HTML tags as <source>.
2. Keep all ${brandLabel} product and series names in their original English form. Never translate "sloggi ZERO Feel", "S by sloggi", "Triumph Amourette", or any series identifier.
3. Keep sustainability certifications verbatim (GRS, OEKO-TEX, GOTS, BCI, bluesign®).
4. Use em dashes sparingly. Maximum 1 em dash in the whole description.
5. Never use gendered group address. No "hey ladies", "ragazze", "señoras", "mesdames", "Damen" or any equivalent, regardless of source-language defaults.
6. No humour, puns or culture-specific idioms.
7. No mention of colours, sizes or variants.
8. Use idiomatic, fluent language for the target locale. The reader should not feel they are reading a translation.
9. Avoid AI-style words in their target-language equivalents: no "delve / approfondire eccessivamente / sumergirse" filler, no "showcase / mettere in mostra" filler, no "realm / regno" metaphor.
10. Preserve cup classification. If <source> contains a bullet about cup state ("integrated fixed cups", "removable cups", "padded with removable cups", "non-padded"), localise it with the locale-correct underwear industry term and KEEP it as a dedicated bullet in the same position. Do not merge it into another bullet, do not drop it, do not paraphrase it into a generic "padded" / "non-padded".
11. Localise the claims <source> makes, no others. Keep every construction detail on the component <source> assigns it to, keep the support level at the same strength, and never add "adjustable", "removable" or "detachable" where <source> does not. Localisation is where invented features slip in, because the target-language phrasing sounds natural.
</rules>

<terminology>
Use correct fashion and underwear terminology in the target language:
- Portuguese (PT-PT): "soutien" (not "sutiã"), "cuecas"
- Spanish: "sujetador" (not "bra"), "braguita"
- Italian: "reggiseno", "mutandine" or "slip"
- French: "soutien-gorge", "culotte"
- German: "BH", "Slip"
- Polish: "biustonosz", "majtki"
- Czech: "podprsenka", "kalhotky"
- Hungarian: "melltartó", "bugyi"
- Danish: "bh", "trusser"
- Swedish: "bh", "trosor"
- Dutch: "bh", "slip"

Cup classification. Locale-correct equivalents to use when <source> mentions cup state:
- Italian: "coppe fisse integrate" / "coppe rimovibili" / "non imbottito"
- German: "fest integrierte Cups" / "herausnehmbare Cups" / "ungefüttert"
- French: "coussinets fixes intégrés" / "coussinets amovibles" / "sans rembourrage"
- Spanish: "copas fijas integradas" / "copas extraíbles" / "sin relleno"
- Polish: "wbudowane miseczki" / "wyjmowane wkładki" / "bez wkładek"
- Dutch: "vaste ingewerkte cups" / "uitneembare cups" / "niet gevoerd"
- Portuguese (PT-PT): "copas fixas integradas" / "copas amovíveis" / "sem enchimento"
- Czech: "pevné integrované košíčky" / "vyjímatelné košíčky" / "bez výplně"
- Hungarian: "beépített rögzített kosarak" / "kivehető kosarak" / "béleletlen"
- Danish: "faste integrerede skåle" / "udtagelige indlæg" / "upolstret"
- Swedish: "fast integrerade kupor" / "uttagbara inlägg" / "opolstrad"

Do not include product codes (WHP, W01, NDK, etc.) inside body copy. Use the product type name.

${productTerminologyRules()}
</terminology>

<output_format>
Return only the localised HTML. Start directly with <p>. No markdown code blocks, no commentary.

Use the same tags as <source>: <p> and <ul class="pd"><li>…</li></ul>. No <strong>, <b>, <em>, <i> or any other formatting.

Every claim in the output appears in <source>: same components, same support level, same garment type, and the technical terms that stay in English stay in English.
</output_format>`;

  // Only the glossary entries this SKU's copy actually uses. The full map is
  // ~180 entries per language; sending all of them would bury the few that
  // matter and cost more than the description itself.
  const glossary = buildGlossaryForSource(enMaster, langCode);

  const user = `<product_context>
- Material Number: ${input.materialNumber}
- Product Name: ${input.productName}
- Brand: ${input.brand}
${input.productLine ? `- Product Line: ${input.productLine}\n` : ''}</product_context>

<source>
${enMaster}
</source>

<localisation_context>
Target language: ${langName} (code: ${langCode})

${getCompleteLocalizationContext(langCode, input.brand)}
</localisation_context>
${
  glossary
    ? `
<approved_glossary>
These are the approved ${langName} renderings for terms in <source>. Use them exactly. They are the wording the brand team signed off; a fluent synonym is still wrong here.

${glossary}
</approved_glossary>
`
    : ''
}
Write the localised description in ${langName} now.`;

  return { system, user };
}
