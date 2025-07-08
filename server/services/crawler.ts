import FirecrawlApp from '@mendable/firecrawl-js';
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface CrawlResult {
  url: string;
  language: string;
  category: string;
  images: Array<{
    url: string;
    alt?: string;
    base64?: string;
    mimeType?: string;
  }>;
  title?: string;
  description?: string;
  markdown?: string;
}

// Initialize Firecrawl with longer timeout
const app = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY
});

export async function crawlProductPage(url: string): Promise<CrawlResult> {
  console.log(`Starting crawl for URL: ${url}`);
  
  // Try Firecrawl first for better image extraction, but with timeout protection
  const firecrawlPromise = crawlWithFirecrawl(url);
  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error('Firecrawl timeout after 15 seconds')), 15000)
  );
  
  try {
    console.log('Attempting Firecrawl extraction with 15s timeout...');
    return await Promise.race([firecrawlPromise, timeoutPromise]);
  } catch (error) {
    console.log('Firecrawl failed or timed out, using basic method:', error.message || error);
    return await crawlWithBasicMethod(url);
  }
}

async function crawlWithFirecrawl(url: string): Promise<CrawlResult> {
  // Configure Firecrawl for optimal performance and structured extraction
  const scrapeResult = await app.scrapeUrl(url, {
    formats: ['json', 'html'], // Use JSON for structured extraction + HTML for fallback
    maxAge: 3600000, // Cache for 1 hour (500% faster for repeated requests)
    jsonOptions: {
      prompt: 'Extract from this product page: the product category (like "Minimizer bra", "Wired bra", etc.) and main product images URLs. Focus on actual product photos, not promotional banners or suggestions.'
    },
    includeTags: ['img', 'meta', 'title', 'div'], // Include essential tags
    excludeTags: ['script', 'style'], // Exclude unnecessary tags
    waitFor: 1000 // Wait for dynamic content
  });
  
  if (!scrapeResult.success) {
    throw new Error(`Firecrawl failed: ${scrapeResult.error}`);
  }

  // Firecrawl v1 returns data directly in the response object
  const scrapedData = scrapeResult.data || scrapeResult;
  
  console.log('Firecrawl successful, processing data...');
  console.log('Available data:', {
    hasMarkdown: !!scrapedData.markdown,
    hasMetadata: !!scrapedData.metadata,
    hasJson: !!scrapedData.json,
    markdownLength: scrapedData.markdown?.length || 0,
    imageCount: scrapedData.metadata?.image?.length || 0,
    hasHtml: !!scrapedData.html
  });

  const language = detectLanguageFromData(url, scrapedData);
  
  // Primary: Use JSON structured extraction if available
  let category = '';
  let imageUrls: string[] = [];
  
  if (scrapedData.json) {
    console.log('Using Firecrawl JSON structured extraction...');
    console.log('JSON data:', scrapedData.json);
    
    // Extract category from JSON if present
    if (scrapedData.json.category) {
      category = normalizeCategory(scrapedData.json.category);
      console.log(`Extracted category from JSON: "${category}"`);
    }
    
    // Extract images from JSON if present
    if (scrapedData.json.images && Array.isArray(scrapedData.json.images)) {
      imageUrls = scrapedData.json.images.slice(0, 8);
      console.log(`Extracted ${imageUrls.length} images from JSON`);
    }
  }
  
  // Fallback: Use precise HTML extraction for Triumph
  if (!category || imageUrls.length === 0) {
    console.log('Falling back to precise HTML extraction...');
    if (url.includes('triumph.com') && scrapedData.html) {
      const $ = cheerio.load(scrapedData.html);
      
      if (!category) {
        category = getCategoryTriumph($);
        console.log(`Extracted category from HTML: "${category}"`);
      }
      
      if (imageUrls.length === 0) {
        const productId = getProductId(url);
        if (productId) {
          imageUrls = getImagesTriumph(scrapedData.html, productId);
          console.log(`Extracted ${imageUrls.length} images from HTML for product ${productId}`);
        }
      }
    }
  }
  
  // Final fallback: Use original extraction methods
  if (!category) {
    category = extractCategoryFromData(scrapedData);
  }
  if (imageUrls.length === 0) {
    imageUrls = extractImageUrlsFromData(scrapedData, url);
  }

  const images = await processImages(imageUrls);
  
  return {
    url,
    language,
    category,
    images,
    title: scrapedData.metadata?.title || 'Product',
    description: scrapedData.metadata?.description || '',
    markdown: scrapedData.markdown
  };
}

async function crawlWithBasicMethod(url: string): Promise<CrawlResult> {
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    },
    timeout: 10000
  });

  const $ = cheerio.load(response.data);
  
  const language = detectLanguageBasic(url, $);
  let category = extractCategoryBasic($);
  const imageUrls = extractImagesBasic($, url);
  const images = await processImages(imageUrls);
  
  // Smart category override for Triumph products
  if (url.includes('triumph.com') && (!category || category.includes('slips for') || category.includes('£'))) {
    // Look for product type in title or meta description
    const title = $('title').text().toLowerCase();
    const metaDesc = $('meta[name="description"]').attr('content')?.toLowerCase() || '';
    
    console.log(`Smart override check - URL: triumph.com, Current category: "${category}"`);
    console.log(`Title: "${title}"`);
    console.log(`Meta desc: "${metaDesc}"`);
    
    if (title.includes('bra') || metaDesc.includes('bra')) {
      if (title.includes('non-wired') || metaDesc.includes('non-wired') || title.includes('unwired')) {
        category = 'Non-wired bra';
      } else if (title.includes('push-up') || metaDesc.includes('push-up')) {
        category = 'Push-up bra';
      } else if (title.includes('sports') || metaDesc.includes('sports')) {
        category = 'Sports bra';
      } else {
        category = 'Bra';
      }
    } else if (title.includes('brief') || metaDesc.includes('brief')) {
      category = 'Brief';
    } else if (title.includes('slip') || metaDesc.includes('slip')) {
      category = 'Slip';
    } else {
      category = 'Lingerie';
    }
    console.log(`Applied smart category override for Triumph: ${category}`);
  }
  
  const title = $('title').text().trim() || $('h1').first().text().trim() || 'Product';
  const description = $('meta[name="description"]').attr('content') || '';

  console.log(`Basic crawl completed - Language: ${language}, Category: ${category}, Images: ${images.length}`);

  return {
    url,
    language,
    category,
    images,
    title,
    description
  };
}

function detectLanguageFromData(url: string, scrapedData: any): string {
  // Try to detect from URL first
  const urlLanguage = extractLanguageFromUrl(url);
  if (urlLanguage) return urlLanguage;
  
  // Try from metadata
  if (scrapedData.metadata?.language) {
    return mapLanguageCode(scrapedData.metadata.language);
  }
  
  // Default to English
  return 'en';
}

function detectLanguageBasic(url: string, $: cheerio.CheerioAPI): string {
  // Try to detect from URL
  const urlLanguage = extractLanguageFromUrl(url);
  if (urlLanguage) return urlLanguage;
  
  // Try to detect from html lang attribute
  const htmlLang = $('html').attr('lang');
  if (htmlLang) {
    const lang = htmlLang.split('-')[0].toLowerCase();
    return mapLanguageCode(lang);
  }
  
  // Try to detect from meta tags
  const metaLang = $('meta[http-equiv="content-language"]').attr('content') ||
                   $('meta[name="language"]').attr('content');
  if (metaLang) {
    const lang = metaLang.split('-')[0].toLowerCase();
    return mapLanguageCode(lang);
  }
  
  // Default to English
  return 'en';
}

function extractLanguageFromUrl(url: string): string | null {
  // Common patterns for language detection in URLs
  const patterns = [
    /\/([a-z]{2})\./, // subdomain like uk.site.com
    /\/([a-z]{2})\// // path like /en/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return mapLanguageCode(match[1]);
    }
  }
  
  return null;
}

function mapLanguageCode(code: string): string {
  const mapping: Record<string, string> = {
    'en': 'en',
    'uk': 'en', // UK sites typically use English
    'it': 'it',
    'es': 'es',
    'fr': 'fr',
    'de': 'de',
    'pt': 'pt',
    'nl': 'nl',
    'pl': 'pl',
    'ru': 'ru',
    'ja': 'ja',
    'ko': 'ko',
    'zh': 'zh'
  };
  
  return mapping[code] || 'en';
}

function normalizeCategory(raw: string): string {
  const map: Record<string, string> = {
    // Triumph categories normalization
    'minimizer bra': 'Minimizer bra',
    'wired bra': 'Wired bra',
    'non-wired bra': 'Non-wired bra',
    'sports bra': 'Sports bra',
    'push-up bra': 'Push-up bra',
    'tai knickers': 'Knickers',
    'brief': 'Brief',
    'slip': 'Slip',
    'bodysuit': 'Bodysuit',
    'body': 'Bodysuit',
    'knickers': 'Knickers',
    'panty': 'Knickers',
    'underwear': 'Underwear',
    'lingerie': 'Lingerie'
  };
  const key = raw.toLowerCase();
  return map[key] ?? raw;   // if not mapped, keep original
}

function getProductId(url: string): string | null {
  const m = url.match(/\/(\d+)\.html/);
  return m ? m[1] : null;
}

function getImagesTriumph(html: string, productId: string): string[] {
  const $ = cheerio.load(html);

  // Take <img> and <source> (srcset) only inside the correct container
  const srcs: string[] = [];
  $('.pdp__imageContainer img, .pdp__imageContainer source').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    const srcset = $(el).attr('srcset') || $(el).attr('data-srcset');

    [src, ...(srcset ? srcset.split(',') : [])].forEach(raw => {
      const url = raw?.trim().split(' ')[0];      // remove dimensions
      if (url && url.includes(`_${productId}_`) && !srcs.includes(url)) {
        srcs.push(url.replace(/width:\d+,height:\d+/g, 'width:688,height:909')  // high quality
                     .replace(/width=\d+&height=\d+/g, 'width=688&height=909'));
      }
    });
  });

  return srcs.slice(0, 8); // maximum 8 images
}

function getCategoryTriumph($: cheerio.CheerioAPI): string {
  // 1) visible text (removes the <meta>)
  const headline = $('.headline.headline--h9-rs').first();
  const textCat = headline.clone().find('meta').remove().end().text().trim();
  if (textCat) return normalizeCategory(textCat);

  // 2) fallback to meta
  const metaCat = headline.find('meta[itemprop="description"]').attr('content');
  if (metaCat) return normalizeCategory(metaCat);

  return '';
}

function extractCategoryFromData(scrapedData: any): string {
  // Try to find in markdown content using regex for the specific div
  if (scrapedData && scrapedData.markdown) {
    // Look for headline--h9-rs class
    const headlineMatch = scrapedData.markdown.match(/headline--h9-rs[^>]*>([^<]+)/i);
    if (headlineMatch && headlineMatch[1]) {
      return normalizeCategory(headlineMatch[1].trim());
    }
    
    // Alternative patterns for product categories
    const categoryPatterns = [
      /category[^>]*>([^<]+)/i,
      /product-type[^>]*>([^<]+)/i,
      /breadcrumb[^>]*>.*?([^>]+)<\/[^>]*>$/i
    ];
    
    for (const pattern of categoryPatterns) {
      const match = scrapedData.markdown.match(pattern);
      if (match && match[1]) {
        return normalizeCategory(match[1].trim());
      }
    }
  }
  
  return '';
}

function extractCategoryBasic($: cheerio.CheerioAPI): string {
  console.log('=== Precise category extraction ===');
  
  // Use specialized Triumph extraction
  const triumphCategory = getCategoryTriumph($);
  if (triumphCategory) {
    console.log(`Found Triumph category: "${triumphCategory}"`);
    return triumphCategory;
  }
  
  // Fallback to general meta description for non-Triumph sites
  const generalMeta = $('meta[name="description"]').attr('content');
  if (generalMeta) {
    console.log(`Using general meta description: "${generalMeta}"`);
    return normalizeCategory(generalMeta);
  }
  
  console.log('No category found');
  return '';
}

function extractImageUrlsFromData(scrapedData: any, url?: string): string[] {
  // Use specialized Triumph extraction if applicable
  if (url && url.includes('triumph.com')) {
    const productId = getProductId(url);
    if (productId && scrapedData.html) {
      const triumphImages = getImagesTriumph(scrapedData.html, productId);
      console.log(`Found ${triumphImages.length} Triumph images for product ${productId}`);
      return triumphImages;
    }
  }
  
  // Fallback to generic extraction for non-Triumph sites
  const imageUrls: string[] = [];
  const seenUrls = new Set<string>();
  
  // Extract from markdown using regex for image URLs
  if (scrapedData && scrapedData.markdown) {
    const markdownImageRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
    let match;
    while ((match = markdownImageRegex.exec(scrapedData.markdown)) !== null) {
      let url = match[1];
      
      // Convert relative URLs to absolute
      if (url.startsWith('//')) {
        url = 'https:' + url;
      } else if (url.startsWith('/')) {
        url = 'https://uk.triumph.com' + url; // Base domain for Triumph
      }
      
      if (url.startsWith('http') && !seenUrls.has(url)) {
        seenUrls.add(url);
        imageUrls.push(url);
      }
    }
  }
  
  // Also try to extract from HTML content if available
  if (scrapedData && scrapedData.html) {
    const imgTagRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = imgTagRegex.exec(scrapedData.html)) !== null) {
      let url = match[1];
      
      // Convert relative URLs to absolute
      if (url.startsWith('//')) {
        url = 'https:' + url;
      } else if (url.startsWith('/')) {
        url = 'https://uk.triumph.com' + url;
      }
      
      if (url.startsWith('http') && !seenUrls.has(url) && url.includes('product')) {
        seenUrls.add(url);
        imageUrls.push(url);
      }
    }
  }
  
  console.log(`Found ${imageUrls.length} image URLs`);
  return imageUrls.slice(0, 10); // Limit to 10 images
}

function extractImagesBasic($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const imageUrls: string[] = [];
  
  console.log('=== Precise image extraction from main product image ===');
  
  // PRECISION: Extract only the main product image as suggested
  // <img class="image-shadow pdp__mainImage carousel__image js-zoom" src="..." />
  const mainImageSelectors = [
    '.pdp__mainImage.carousel__image.js-zoom',           // Exact class combination
    'img.pdp__mainImage.carousel__image',                // Alternative without js-zoom
    '.pdp__mainImage',                                   // Fallback to main image
    '.carousel__image.js-zoom'                           // Alternative combination
  ];
  
  for (const selector of mainImageSelectors) {
    const mainImage = $(selector).first();
    if (mainImage.length > 0) {
      let src = mainImage.attr('src');
      
      if (src && !src.startsWith('data:')) {
        // Convert relative to absolute URL
        if (src.startsWith('//')) {
          src = 'https:' + src;
        } else if (src.startsWith('/')) {
          const urlObj = new URL(baseUrl);
          src = `${urlObj.protocol}//${urlObj.host}${src}`;
        }
        
        console.log(`Found main product image with ${selector}: ${src}`);
        imageUrls.push(src);
        
        // Generate additional views from main image pattern (for variety)
        if (src.includes('contentstore.triumph.com')) {
          const productMatch = src.match(/(\d+_\d+_\d+_)(\d+)/);
          if (productMatch) {
            const basePattern = productMatch[1]; // e.g., "30_10215848_7539_"
            const currentView = parseInt(productMatch[2]); // e.g., 1
            
            // Generate 2-3 additional views for product variety
            for (let i = 2; i <= 4; i++) {
              if (i !== currentView) {
                const variantSrc = src.replace(`${basePattern}${currentView}`, `${basePattern}${i}`);
                imageUrls.push(variantSrc);
                console.log(`Generated variant view ${i}: ${variantSrc}`);
              }
            }
          }
        }
        
        console.log(`Extracted ${imageUrls.length} images from main product image`);
        return imageUrls; // Return immediately after finding main image
      }
    }
  }
  
  // FALLBACK: If no main image found, try carousel extraction (limited)
  console.log('Main product image not found, trying carousel fallback...');
  
  const fallbackSelectors = [
    '.pdp__imageContainer.js-tileImageCarousel img',
    '.js-tileImageCarousel img'
  ];
  
  for (const selector of fallbackSelectors) {
    $(selector).first().each((_, element) => {
      const $img = $(element);
      let src = $img.attr('src');
      
      if (src && !src.startsWith('data:')) {
        if (src.startsWith('//')) {
          src = 'https:' + src;
        } else if (src.startsWith('/')) {
          const urlObj = new URL(baseUrl);
          src = `${urlObj.protocol}//${urlObj.host}${src}`;
        }
        
        console.log(`Found fallback image: ${src}`);
        imageUrls.push(src);
      }
    });
    
    if (imageUrls.length > 0) break; // Stop after finding first valid image
  }
  
  console.log(`Precise extraction completed with ${imageUrls.length} images`);
  return imageUrls;
}

async function processImages(imageUrls: string[]): Promise<Array<{url: string, alt?: string, base64?: string, mimeType?: string}>> {
  // Filter out data URLs and invalid URLs upfront
  const validUrls = imageUrls.filter(url => {
    if (url.startsWith('data:')) {
      console.log(`Skipping data URL: ${url.substring(0, 50)}...`);
      return false;
    }
    if (!url.startsWith('http')) {
      console.log(`Skipping invalid URL: ${url}`);
      return false;
    }
    return true;
  });
  
  console.log(`Processing ${validUrls.length} valid images from ${imageUrls.length} found...`);
  
  const processedImages = await Promise.all(
    validUrls.map(async (url) => {
      try {
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        const contentType = response.headers['content-type'] || 'image/jpeg';
        if (!contentType.startsWith('image/')) {
          console.log(`Skipping non-image URL: ${url}`);
          return null;
        }
        
        const buffer = Buffer.from(response.data);
        const base64 = buffer.toString('base64');
        
        // Enhanced filtering for placeholder and tiny images
        if (buffer.length < 2000) {
          console.log(`Skipping small image: ${url} (${buffer.length} bytes)`);
          return null;
        }
        
        // Check for common placeholder patterns
        if (base64.startsWith('R0lGODlhAQABAAD') || // 1x1 transparent GIF
            base64.startsWith('R0lGODdhAQABAPAA') || // Another 1x1 GIF pattern
            base64.startsWith('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==')) { // 1x1 PNG
          console.log(`Skipping placeholder image: ${url}`);
          return null;
        }
        
        // Validate proper image formats for OpenAI
        if (!contentType.includes('jpeg') && !contentType.includes('jpg') && 
            !contentType.includes('png') && !contentType.includes('webp')) {
          console.log(`Skipping unsupported image format: ${url} (${contentType})`);
          return null;
        }
        
        console.log(`Successfully processed image: ${url} (${Math.round(buffer.length/1024)}KB)`);
        
        return {
          url,
          base64,
          mimeType: contentType
        };
      } catch (error) {
        console.log(`Failed to fetch image ${url}:`, error instanceof Error ? error.message : 'Unknown error');
        return null;
      }
    })
  );
  
  const validImages = processedImages.filter(img => img !== null) as Array<{url: string, alt?: string, base64?: string, mimeType?: string}>;
  console.log(`Successfully processed ${validImages.length} out of ${validUrls.length} images`);
  
  return validImages;
}
