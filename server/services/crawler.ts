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

export async function crawlProductPage(url: string): Promise<CrawlResult> {
  console.log(`=== STARTING INTELLIGENT CRAWLER ===`);
  console.log(`URL: ${url}`);
  
  // Direct scraping - reliable and fast
  return await crawlWithBasicMethod(url);
}



async function crawlWithBasicMethod(url: string): Promise<CrawlResult> {
  console.log('=== INTELLIGENT CRAWLER STARTED ===');
  
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    },
    timeout: 15000
  });

  const $ = cheerio.load(response.data);
  
  // Step 1: Detect language
  const language = detectLanguageBasic(url, $);
  console.log(`✓ Language detected: ${language}`);
  
  // Step 2: Extract category with intelligent methods
  let category = '';
  
  // Use intelligent category extraction for all sites
  category = extractCategoryBasic($);
  console.log(`✓ Category extracted: "${category}"`);
  
  // Smart category override for Triumph products if needed
  if (url.includes('triumph.com') && (!category || category.includes('slips for') || category.includes('£'))) {
    const title = $('title').text().toLowerCase();
    const metaDesc = $('meta[name="description"]').attr('content')?.toLowerCase() || '';
    
    console.log(`Smart override needed - Current: "${category}"`);
    
    if (title.includes('bra') || metaDesc.includes('bra')) {
      if (title.includes('non-wired') || metaDesc.includes('non-wired') || title.includes('unwired')) {
        category = 'Non-wired bra';
      } else if (title.includes('push-up') || metaDesc.includes('push-up')) {
        category = 'Push-up bra';
      } else if (title.includes('sports') || metaDesc.includes('sports')) {
        category = 'Sports bra';
      } else if (title.includes('minimizer') || metaDesc.includes('minimizer')) {
        category = 'Minimizer bra';
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
    console.log(`✓ Smart override applied: "${category}"`);
  }
  
  // Step 3: Intelligent image extraction with multiple strategies
  let images: Array<{url: string, alt?: string, base64?: string, mimeType?: string}> = [];
  
  console.log('Starting intelligent image extraction...');
  
  // Strategy 1: Triumph-specific extraction
  if (url.includes('triumph.com')) {
    const productId = getProductId(url);
    if (productId) {
      console.log(`Extracting images for Triumph product ID: ${productId}`);
      const imageUrls = getImagesTriumph(response.data, productId);
      console.log(`Found ${imageUrls.length} Triumph-specific images`);
      if (imageUrls.length > 0) {
        images = await processImages(imageUrls);
      }
    }
  }
  
  // Strategy 2: Generic product image extraction if no Triumph images found
  if (images.length === 0) {
    console.log('Trying generic extraction...');
    const imageUrls = extractImagesBasic($, url);
    console.log(`Found ${imageUrls.length} generic images`);
    if (imageUrls.length > 0) {
      images = await processImages(imageUrls);
    }
  }
  
  // Strategy 3: Fallback to any product-related images
  if (images.length === 0) {
    console.log('Trying fallback extraction...');
    const fallbackImages = extractFallbackImages($, url);
    console.log(`Found ${fallbackImages.length} fallback images`);
    if (fallbackImages.length > 0) {
      images = await processImages(fallbackImages);
    }
  }
  
  const title = $('title').text().trim() || $('h1').first().text().trim() || 'Product';
  const description = $('meta[name="description"]').attr('content') || '';

  console.log('=== INTELLIGENT CRAWLER COMPLETED ===');
  console.log(`✓ Language: ${language}`);
  console.log(`✓ Category: "${category}"`);
  console.log(`✓ Images: ${images.length} processed`);
  console.log(`✓ Title: "${title}"`);

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

  // Take <img> and <source> (srcset) only inside the correct product-detail container
  const srcs: string[] = [];
  console.log('Searching for images in product-detail product-wrapper container...');
  
  // Target the correct container: product-detail product-wrapper
  $('.product-detail.product-wrapper img, .product-detail.product-wrapper source').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    const srcset = $(el).attr('srcset') || $(el).attr('data-srcset');

    [src, ...(srcset ? srcset.split(',') : [])].forEach(raw => {
      const url = raw?.trim().split(' ')[0];      // remove dimensions
      if (url && url.includes(`_${productId}_`) && !srcs.includes(url)) {
        console.log(`Found product image in container: ${url}`);
        srcs.push(url.replace(/width:\d+,height:\d+/g, 'width:688,height:909')  // high quality
                     .replace(/width=\d+&height=\d+/g, 'width=688&height=909'));
      }
    });
  });

  // Fallback to pdp__imageContainer if no images found in product-detail
  if (srcs.length === 0) {
    console.log('No images found in product-detail container, trying pdp__imageContainer fallback...');
    $('.pdp__imageContainer img, .pdp__imageContainer source').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      const srcset = $(el).attr('srcset') || $(el).attr('data-srcset');

      [src, ...(srcset ? srcset.split(',') : [])].forEach(raw => {
        const url = raw?.trim().split(' ')[0];      // remove dimensions
        if (url && url.includes(`_${productId}_`) && !srcs.includes(url)) {
          console.log(`Found product image in fallback: ${url}`);
          srcs.push(url.replace(/width:\d+,height:\d+/g, 'width:688,height:909')  // high quality
                       .replace(/width=\d+&height=\d+/g, 'width=688&height=909'));
        }
      });
    });
  }

  console.log(`Total images found: ${srcs.length}`);
  return srcs.slice(0, 8); // maximum 8 images
}

function getCategoryTriumph($: cheerio.CheerioAPI): string {
  console.log('=== Triumph category extraction ===');
  
  // Strategy 1: Look for breadcrumb category (most reliable)
  const breadcrumbCategory = $('.breadcrumb a').last().text().trim();
  if (breadcrumbCategory && !breadcrumbCategory.includes('Triumph') && breadcrumbCategory.length > 2) {
    console.log(`Found breadcrumb category: "${breadcrumbCategory}"`);
    return normalizeCategory(breadcrumbCategory);
  }
  
  // Strategy 2: Product type from structured data
  const jsonLd = $('script[type="application/ld+json"]').text();
  if (jsonLd) {
    try {
      const data = JSON.parse(jsonLd);
      if (data.category || data.productType) {
        const category = data.category || data.productType;
        console.log(`Found JSON-LD category: "${category}"`);
        return normalizeCategory(category);
      }
    } catch (e) {
      // Continue to next strategy
    }
  }
  
  // Strategy 3: Meta property for product category
  const ogType = $('meta[property="product:category"]').attr('content');
  if (ogType) {
    console.log(`Found OG product category: "${ogType}"`);
    return normalizeCategory(ogType);
  }
  
  // Strategy 4: H1 or product title analysis
  const h1Text = $('h1').first().text().toLowerCase();
  if (h1Text) {
    if (h1Text.includes('non-wired') || h1Text.includes('unwired')) {
      return 'Non-wired bra';
    } else if (h1Text.includes('minimizer')) {
      return 'Minimizer bra';
    } else if (h1Text.includes('push-up')) {
      return 'Push-up bra';
    } else if (h1Text.includes('sports')) {
      return 'Sports bra';
    } else if (h1Text.includes('bra')) {
      return 'Bra';
    } else if (h1Text.includes('brief')) {
      return 'Brief';
    } else if (h1Text.includes('slip')) {
      return 'Slip';
    }
  }
  
  // Strategy 5: Original headline method (fallback)
  const headline = $('.headline.headline--h9-rs').first();
  const textCat = headline.clone().find('meta').remove().end().text().trim();
  if (textCat && !textCat.includes('£') && !textCat.includes('for')) {
    console.log(`Found headline category: "${textCat}"`);
    return normalizeCategory(textCat);
  }

  // Strategy 6: Meta description analysis
  const metaCat = headline.find('meta[itemprop="description"]').attr('content');
  if (metaCat && !metaCat.includes('£') && !metaCat.includes('for')) {
    console.log(`Found meta category: "${metaCat}"`);
    return normalizeCategory(metaCat);
  }

  console.log('No reliable category found');
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
  console.log('=== Intelligent category extraction ===');
  
  // Strategy 1: Look for breadcrumb category (most reliable)
  const breadcrumbCategory = $('.breadcrumb a').last().text().trim();
  if (breadcrumbCategory && !breadcrumbCategory.includes('Triumph') && breadcrumbCategory.length > 2) {
    console.log(`Found breadcrumb category: "${breadcrumbCategory}"`);
    return normalizeCategory(breadcrumbCategory);
  }
  
  // Strategy 2: Product type from structured data
  const jsonLd = $('script[type="application/ld+json"]').text();
  if (jsonLd) {
    try {
      const data = JSON.parse(jsonLd);
      if (data.category || data.productType) {
        const category = data.category || data.productType;
        console.log(`Found JSON-LD category: "${category}"`);
        return normalizeCategory(category);
      }
    } catch (e) {
      // Continue to next strategy
    }
  }
  
  // Strategy 3: Meta property for product category
  const ogType = $('meta[property="product:category"]').attr('content');
  if (ogType) {
    console.log(`Found OG product category: "${ogType}"`);
    return normalizeCategory(ogType);
  }
  
  // Strategy 4: H1 or product title analysis
  const h1Text = $('h1').first().text().toLowerCase();
  console.log(`H1 analysis: "${h1Text}"`);
  if (h1Text) {
    if (h1Text.includes('non-wired') || h1Text.includes('unwired')) {
      console.log('Detected Non-wired bra from H1');
      return 'Non-wired bra';
    } else if (h1Text.includes('minimizer')) {
      console.log('Detected Minimizer bra from H1');
      return 'Minimizer bra';
    } else if (h1Text.includes('push-up')) {
      console.log('Detected Push-up bra from H1');
      return 'Push-up bra';
    } else if (h1Text.includes('sports')) {
      console.log('Detected Sports bra from H1');
      return 'Sports bra';
    } else if (h1Text.includes('bra')) {
      console.log('Detected Bra from H1');
      return 'Bra';
    } else if (h1Text.includes('brief')) {
      console.log('Detected Brief from H1');
      return 'Brief';
    } else if (h1Text.includes('slip')) {
      console.log('Detected Slip from H1');
      return 'Slip';
    }
    console.log(`H1 contains no product category keywords`);
  }
  
  // Strategy 4b: Try title tag as well
  const titleText = $('title').text().toLowerCase();
  console.log(`Title analysis: "${titleText}"`);
  if (titleText && titleText !== h1Text) {
    if (titleText.includes('non-wired') || titleText.includes('unwired')) {
      console.log('Detected Non-wired bra from Title');
      return 'Non-wired bra';
    } else if (titleText.includes('minimizer')) {
      console.log('Detected Minimizer bra from Title');
      return 'Minimizer bra';
    } else if (titleText.includes('push-up')) {
      console.log('Detected Push-up bra from Title');
      return 'Push-up bra';
    } else if (titleText.includes('sports')) {
      console.log('Detected Sports bra from Title');
      return 'Sports bra';
    } else if (titleText.includes('bra')) {
      console.log('Detected Bra from Title');
      return 'Bra';
    } else if (titleText.includes('brief')) {
      console.log('Detected Brief from Title');
      return 'Brief';
    } else if (titleText.includes('slip')) {
      console.log('Detected Slip from Title');
      return 'Slip';
    }
  }
  
  // Strategy 5: Original headline method (fallback) - avoid promotional content
  const headline = $('.headline.headline--h9-rs').first();
  const textCat = headline.clone().find('meta').remove().end().text().trim();
  if (textCat && !textCat.includes('£') && !textCat.includes('for') && !textCat.includes('slips')) {
    console.log(`Found clean headline category: "${textCat}"`);
    return normalizeCategory(textCat);
  }

  // Strategy 6: General meta description (last resort)
  const generalMeta = $('meta[name="description"]').attr('content');
  if (generalMeta && !generalMeta.includes('£') && !generalMeta.includes('for')) {
    console.log(`Using general meta description: "${generalMeta}"`);
    return normalizeCategory(generalMeta);
  }
  
  console.log('No reliable category found');
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
  
  console.log('=== Precise image extraction from product-detail container ===');
  
  // PRIMARY: Extract images from the correct product-detail product-wrapper container
  const productContainerSelectors = [
    '.product-detail.product-wrapper img',               // Target the specific container
    '.product-detail.product-wrapper source'            // Also check source elements
  ];
  
  for (const selector of productContainerSelectors) {
    console.log(`Checking selector: ${selector}`);
    $(selector).each((_, element) => {
      const $img = $(element);
      let src = $img.attr('src') || $img.attr('data-src');
      const srcset = $img.attr('srcset') || $img.attr('data-srcset');
      
      // Process src attribute
      if (src && !src.startsWith('data:')) {
        // Convert relative to absolute URL
        if (src.startsWith('//')) {
          src = 'https:' + src;
        } else if (src.startsWith('/')) {
          const urlObj = new URL(baseUrl);
          src = `${urlObj.protocol}//${urlObj.host}${src}`;
        }
        
        console.log(`Found product image in container: ${src}`);
        imageUrls.push(src);
      }
      
      // Process srcset attribute
      if (srcset) {
        const srcsetUrls = srcset.split(',').map(s => s.trim().split(' ')[0]);
        for (let srcsetUrl of srcsetUrls) {
          if (srcsetUrl && !srcsetUrl.startsWith('data:')) {
            if (srcsetUrl.startsWith('//')) {
              srcsetUrl = 'https:' + srcsetUrl;
            } else if (srcsetUrl.startsWith('/')) {
              const urlObj = new URL(baseUrl);
              srcsetUrl = `${urlObj.protocol}//${urlObj.host}${srcsetUrl}`;
            }
            
            console.log(`Found product image in srcset: ${srcsetUrl}`);
            imageUrls.push(srcsetUrl);
          }
        }
      }
    });
  }
  
  // FALLBACK: If no images found in product-detail container, try legacy selectors
  if (imageUrls.length === 0) {
    console.log('No images found in product-detail container, trying legacy selectors...');
    
    const fallbackSelectors = [
      '.pdp__mainImage.carousel__image.js-zoom',         // Exact class combination
      'img.pdp__mainImage.carousel__image',              // Alternative without js-zoom
      '.pdp__mainImage',                                 // Fallback to main image
      '.carousel__image.js-zoom'                         // Alternative combination
    ];
    
    for (const selector of fallbackSelectors) {
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
          
          console.log(`Found fallback image with ${selector}: ${src}`);
          imageUrls.push(src);
          break; // Only take one fallback image
        }
      }
    }
  }
  
  console.log(`Precise extraction completed with ${imageUrls.length} images`);
  return imageUrls.slice(0, 8); // Limit to 8 images
}

function extractFallbackImages($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const imageUrls: string[] = [];
  
  console.log('=== Fallback image extraction ===');
  
  // Look for any img tags that might contain product images
  const fallbackSelectors = [
    'img[src*="product"]',                    // Images with "product" in URL
    'img[src*="contentstore"]',               // Contentstore images
    'img[alt*="product"], img[alt*="Product"]', // Images with product in alt text
    '.product img',                           // Images in product containers
    '.gallery img',                           // Gallery images
    '[class*="image"] img',                   // Images in image-related classes
    'img[src*="transform"]'                   // Transformed images (like Triumph)
  ];
  
  for (const selector of fallbackSelectors) {
    console.log(`Checking fallback selector: ${selector}`);
    $(selector).each((_, element) => {
      const $img = $(element);
      let src = $img.attr('src') || $img.attr('data-src');
      
      if (src && !src.startsWith('data:') && !src.includes('placeholder') && !src.includes('loading')) {
        // Convert relative to absolute URL
        if (src.startsWith('//')) {
          src = 'https:' + src;
        } else if (src.startsWith('/')) {
          const urlObj = new URL(baseUrl);
          src = `${urlObj.protocol}//${urlObj.host}${src}`;
        }
        
        // Filter out very small images (likely icons)
        if (!src.includes('icon') && !src.includes('logo') && !imageUrls.includes(src)) {
          console.log(`Found fallback image: ${src}`);
          imageUrls.push(src);
        }
      }
    });
    
    if (imageUrls.length >= 3) break; // Stop when we have enough images
  }
  
  console.log(`Fallback extraction found ${imageUrls.length} images`);
  return imageUrls.slice(0, 5); // Limit to 5 fallback images
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