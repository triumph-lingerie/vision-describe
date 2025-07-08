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

// Initialize Firecrawl
const app = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY
});

export async function crawlProductPage(url: string): Promise<CrawlResult> {
  // For now, use basic crawling method for reliability
  // TODO: Fix Firecrawl integration later
  console.log(`Using basic crawling for URL: ${url}`);
  return await crawlWithBasicMethod(url);
}

async function crawlWithFirecrawl(url: string): Promise<CrawlResult> {
  const scrapeResult = await app.scrapeUrl(url);
  
  if (!scrapeResult.success) {
    throw new Error(`Firecrawl failed: ${scrapeResult.error}`);
  }

  // Firecrawl v1 returns data directly in the response object
  const scrapedData = scrapeResult.data || scrapeResult;
  
  console.log('Firecrawl successful, processing data...');
  console.log('Available data:', {
    hasMarkdown: !!scrapedData.markdown,
    hasMetadata: !!scrapedData.metadata,
    markdownLength: scrapedData.markdown?.length || 0
  });

  const language = detectLanguageFromData(url, scrapedData);
  const category = extractCategoryFromData(scrapedData);
  const imageUrls = extractImageUrlsFromData(scrapedData);
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
  const category = extractCategoryBasic($);
  const imageUrls = extractImagesBasic($, url);
  const images = await processImages(imageUrls);
  
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

function extractCategoryFromData(scrapedData: any): string {
  // Try to find in markdown content using regex for the specific div
  if (scrapedData && scrapedData.markdown) {
    // Look for headline--h9-rs class
    const headlineMatch = scrapedData.markdown.match(/headline--h9-rs[^>]*>([^<]+)/i);
    if (headlineMatch && headlineMatch[1]) {
      return headlineMatch[1].trim();
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
        return match[1].trim();
      }
    }
  }
  
  return '';
}

function extractCategoryBasic($: cheerio.CheerioAPI): string {
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

function extractImageUrlsFromData(scrapedData: any): string[] {
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
  const seenUrls = new Set<string>();
  
  // Common selectors for product images - prioritize main product images
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
    'img[alt*="product"]',
    'img[src*="contentstore"]', // For Triumph-specific CDN
    'img[src*="triumph"]'
  ];
  
  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const $img = $(element);
      let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy');
      
      if (!src) return;
      
      console.log(`Found image with selector ${selector}: ${src.substring(0, 80)}...`);
      
      // Skip data URLs (inline images, usually placeholders)
      if (src.startsWith('data:')) {
        console.log(`Skipping data URL found by ${selector}`);
        return;
      }
      
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
      if (seenUrls.has(src)) {
        console.log(`Skipping duplicate URL: ${src}`);
        return;
      }
      seenUrls.add(src);
      
      // Skip small images (likely thumbnails or icons)
      const width = parseInt($img.attr('width') || '0');
      const height = parseInt($img.attr('height') || '0');
      if ((width > 0 && width < 100) || (height > 0 && height < 100)) {
        console.log(`Skipping small image: ${src} (${width}x${height})`);
        return;
      }
      
      console.log(`Adding valid image URL: ${src}`);
      imageUrls.push(src);
    });
  }
  
  console.log(`Basic extraction found ${imageUrls.length} image URLs`);
  return imageUrls.slice(0, 10); // Limit to 10 images
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