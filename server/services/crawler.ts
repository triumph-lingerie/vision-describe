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
}

export async function crawlProductPage(url: string): Promise<CrawlResult> {
  try {
    console.log(`Crawling URL: ${url}`);
    
    // Fetch the page
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    
    // Detect language from URL, html lang attribute, or meta tags
    const language = detectLanguage(url, $);
    
    // Extract product category from the specific div element
    const category = extractCategory($);
    
    // Extract product images
    const images = await extractImages($, url);
    
    // Extract title and description
    const title = $('title').text().trim() || $('h1').first().text().trim();
    const description = $('meta[name="description"]').attr('content') || '';

    console.log(`Crawl completed - Language: ${language}, Category: ${category}, Images: ${images.length}`);

    return {
      url,
      language,
      category,
      images,
      title,
      description
    };
  } catch (error) {
    console.error('Error crawling page:', error);
    throw new Error(`Failed to crawl page: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function detectLanguage(url: string, $: cheerio.CheerioAPI): string {
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

function extractCategory($: cheerio.CheerioAPI): string {
  // Look for the specific div class mentioned by the user
  const categoryFromDiv = $('.headline.headline--h9-rs').text().trim();
  if (categoryFromDiv) return categoryFromDiv;
  
  // Fallback to other common selectors
  const fallbacks = [
    '.product-category',
    '.breadcrumb li:last-child',
    '[data-category]',
    '.category-name',
    'h2.category',
    '.product-type'
  ];
  
  for (const selector of fallbacks) {
    const text = $(selector).text().trim();
    if (text) return text;
  }
  
  return '';
}

async function extractImages($: cheerio.CheerioAPI, baseUrl: string): Promise<Array<{url: string, alt?: string, base64?: string, mimeType?: string}>> {
  const images: Array<{url: string, alt?: string, base64?: string, mimeType?: string}> = [];
  const seenUrls = new Set<string>();
  
  // Common selectors for product images
  const selectors = [
    '.product-images img',
    '.product-gallery img',
    '.product-photo img',
    '.product-image img',
    '[data-product-image] img',
    '.gallery img',
    '.carousel img',
    '.slider img',
    'img[src*="product"]',
    'img[alt*="product"]'
  ];
  
  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const $img = $(element);
      let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy');
      
      if (!src) return;
      
      // Convert relative URLs to absolute
      if (src.startsWith('//')) {
        src = 'https:' + src;
      } else if (src.startsWith('/')) {
        const urlObj = new URL(baseUrl);
        src = `${urlObj.protocol}//${urlObj.host}${src}`;
      } else if (!src.startsWith('http')) {
        src = new URL(src, baseUrl).href;
      }
      
      // Skip if we've already seen this URL
      if (seenUrls.has(src)) return;
      seenUrls.add(src);
      
      // Skip small images (likely thumbnails or icons)
      const width = parseInt($img.attr('width') || '0');
      const height = parseInt($img.attr('height') || '0');
      if ((width > 0 && width < 100) || (height > 0 && height < 100)) return;
      
      const alt = $img.attr('alt') || '';
      images.push({ url: src, alt });
    });
  }
  
  // Convert images to base64 for OpenAI
  const processedImages = await Promise.all(
    images.slice(0, 10).map(async (img) => { // Limit to 10 images
      try {
        const response = await axios.get(img.url, {
          responseType: 'arraybuffer',
          timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        const contentType = response.headers['content-type'] || 'image/jpeg';
        if (!contentType.startsWith('image/')) return img;
        
        const base64 = Buffer.from(response.data).toString('base64');
        return {
          ...img,
          base64,
          mimeType: contentType
        };
      } catch (error) {
        console.log(`Failed to fetch image ${img.url}:`, error instanceof Error ? error.message : 'Unknown error');
        return img; // Return without base64 if fetch fails
      }
    })
  );
  
  return processedImages.filter(img => img.base64); // Only return images we successfully processed
}