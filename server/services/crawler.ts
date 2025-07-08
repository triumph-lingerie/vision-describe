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
  console.log(`Starting crawl for URL: ${url}`);
  
  // Try Firecrawl first for better image extraction, especially for Triumph
  try {
    console.log('Attempting Firecrawl extraction first...');
    return await crawlWithFirecrawl(url);
  } catch (error) {
    console.log('Firecrawl failed, falling back to basic method:', error);
    return await crawlWithBasicMethod(url);
  }
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
    markdownLength: scrapedData.markdown?.length || 0,
    imageCount: scrapedData.metadata?.image?.length || 0
  });

  const language = detectLanguageFromData(url, scrapedData);
  
  // Enhanced category extraction for Triumph specifically
  let category = '';
  if (url.includes('triumph.com')) {
    // Try to extract from title/metadata first
    const title = scrapedData.metadata?.title || scrapedData.title || '';
    const description = scrapedData.metadata?.description || scrapedData.description || '';
    
    // Look for product type in title or description
    const combinedText = `${title} ${description}`.toLowerCase();
    
    if (combinedText.includes('non-wired bra') || combinedText.includes('wireless bra')) {
      category = 'Non-wired bra';
    } else if (combinedText.includes('wired bra') || combinedText.includes('underwire bra')) {
      category = 'Wired bra';
    } else if (combinedText.includes('bra') && combinedText.includes('sport')) {
      category = 'Sports bra';
    } else if (combinedText.includes('bra')) {
      category = 'Bra';
    } else if (combinedText.includes('knickers') || combinedText.includes('brief') || combinedText.includes('panty')) {
      category = 'Knickers';
    } else if (combinedText.includes('bodysuit') || combinedText.includes('body')) {
      category = 'Bodysuit';
    }
    
    console.log(`Extracted category from metadata: "${category}" from title/desc: "${title}" / "${description}"`);
  }
  
  // Fallback to original method if no category found
  if (!category) {
    category = extractCategoryFromData(scrapedData);
  }
  
  // Enhanced image extraction for Triumph using Firecrawl metadata
  let imageUrls: string[] = [];
  
  if (url.includes('triumph.com') && scrapedData.metadata?.image) {
    console.log(`Firecrawl found ${scrapedData.metadata.image.length} images for Triumph`);
    
    // Extract product ID from URL
    const productIdMatch = url.match(/\/(\d+)\.html/);
    const productId = productIdMatch ? productIdMatch[1] : null;
    
    if (productId) {
      // Filter images to get only the main product images
      // Based on the data you shared, let's try multiple patterns
      const productImages = scrapedData.metadata.image.filter((img: string) => 
        img.includes('contentstore.triumph.com') && (
          img.includes(`30_${productId}_`) ||           // Standard pattern
          img.includes(`_${productId}_`) ||             // Alternative pattern  
          img.includes(`${productId}`)                  // Basic product ID match
        )
      );
      
      console.log(`Found ${productImages.length} product images for ID ${productId}`);
      if (productImages.length > 0) {
        console.log('Product images found:', productImages.slice(0, 3).map(img => img.substring(img.lastIndexOf('/') + 1)));
      }
      
      // Prioritize main carousel patterns (viewType > 1000) and primary images
      const mainCarouselImages = productImages.filter((img: string) => {
        const viewTypeMatch = img.match(/_(\d{4})_/);
        if (viewTypeMatch) {
          const viewType = parseInt(viewTypeMatch[1]);
          return viewType > 1000; // Main carousel patterns like 6106, 4505, etc.
        }
        return false;
      });
      
      if (mainCarouselImages.length > 0) {
        console.log(`Using ${mainCarouselImages.length} main carousel images from Firecrawl`);
        imageUrls = mainCarouselImages.slice(0, 8); // Limit to 8 images
      } else if (productImages.length > 0) {
        // Fallback to other product images, but remove duplicates
        const uniqueProductImages = [...new Set(productImages)];
        console.log(`No main carousel found, using ${uniqueProductImages.length} unique product images from Firecrawl`);
        imageUrls = uniqueProductImages.slice(0, 6);
      } else {
        // Last resort: check for any images that might be variants 
        console.log('No direct product images found, checking for variants...');
        const variantImages = scrapedData.metadata.image.filter((img: string) => 
          img.includes('contentstore.triumph.com') && 
          (img.includes(`_${productId}_`) || img.includes('transform/'))
        );
        console.log(`Found ${variantImages.length} potential variant images`);
        imageUrls = variantImages.slice(0, 6);
      }
      
      // Convert to higher quality images
      imageUrls = imageUrls.map(img => 
        img.replace(/width:\d+,height:\d+/, 'width:688,height:909')
           .replace(/width=\d+&height=\d+/, 'width=688&height=909')
      );
    } else {
      // Fallback to all Triumph images if no product ID found
      const triumphImages = scrapedData.metadata.image.filter((img: string) => 
        img.includes('contentstore.triumph.com')
      );
      console.log(`Using ${triumphImages.length} general Triumph images as fallback`);
      imageUrls = triumphImages.slice(0, 10);
    }
  } else {
    // For non-Triumph sites, use the original logic
    imageUrls = extractImageUrlsFromData(scrapedData);
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
  console.log('=== Category extraction debug ===');
  
  // Find ALL divs and debug them
  $('div').each((i, elem) => {
    const $elem = $(elem);
    const classes = $elem.attr('class') || '';
    const text = $elem.text().trim();
    
    // Only log divs that might contain product info
    if ((classes.includes('headline') || text.includes('Non-wired') || text.includes('bra')) && text.length > 0 && text.length < 50) {
      console.log(`DIV ${i}: class="${classes}", text="${text}"`);
    }
  });
  
  // Try meta description first for cleaner product type
  const metaDescription = $('meta[itemprop="description"]').attr('content');
  if (metaDescription && metaDescription.trim()) {
    console.log(`Found category from meta description: ${metaDescription.trim()}`);
    return metaDescription.trim();
  }
  
  // Look for the specific div class mentioned by the user  
  const categoryFromDiv = $('.headline.headline--h9-rs').first().text().trim();
  if (categoryFromDiv) {
    console.log(`Found category from headline--h9-rs: ${categoryFromDiv}`);
    return categoryFromDiv;
  }
  
  // Try different variations of headline selectors
  const headlineVariations = [
    '.headline--h9-rs',
    'div.headline.headline--h9-rs', 
    '.headline.headline--h9-rs',
    '[class*="headline--h9-rs"]'
  ];
  
  for (const selector of headlineVariations) {
    const text = $(selector).first().text().trim();
    if (text) {
      console.log(`Found category from headline variation ${selector}: ${text}`);
      return text;
    }
  }
  
  // Look for any element containing "Non-wired bra" specifically
  const nonWiredElements = $('*:contains("Non-wired bra")');
  if (nonWiredElements.length > 0) {
    const text = nonWiredElements.first().text().trim();
    if (text.length < 100) { // Avoid getting long descriptions
      console.log(`Found category from Non-wired bra search: ${text}`);
      return text;
    }
  }
  
  console.log('No category found');
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
  // Start with Triumph-specific selectors first
  const selectors = [
    '.pdp__imageContainer.js-tileImageCarousel img', // Triumph-specific product image container
    '.js-tileImageCarousel img',
    '.pdp__imageContainer img',
    '.product-images img',
    '.product-gallery img', 
    '.product-photo img',
    '.product-image img',
    '[data-product-image] img',
    '.gallery img',
    'img[src*="contentstore"]', // For Triumph-specific CDN - prioritize actual product images
    'img[alt*="product"]'
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
      
      // For Triumph carousel images, check if this is a different view/angle
      const isTriumphCarousel = src.includes('contentstore.triumph.com');
      
      if (isTriumphCarousel) {
        // For Triumph, extract the image identifier from the URL
        // Example: 30_10135874_0003_4.jpg means: pattern_product_view_variant
        const imageMatch = src.match(/(\d+_\d+_\d+_\d+)/);
        const imageId = imageMatch ? imageMatch[1] : src;
        
        if (seenUrls.has(imageId)) {
          console.log(`Skipping duplicate Triumph image variant: ${src}`);
          return;
        }
        seenUrls.add(imageId);
        console.log(`Added unique Triumph image variant: ${imageId}`);
      } else {
        // For non-Triumph sites, use base URL duplicate checking
        const baseUrl = src.split('?')[0];
        if (seenUrls.has(baseUrl)) {
          console.log(`Skipping duplicate URL: ${src}`);
          return;
        }
        seenUrls.add(baseUrl);
      }
      
      // Skip small images (likely thumbnails or icons)
      const width = parseInt($img.attr('width') || '0');
      const height = parseInt($img.attr('height') || '0');
      if ((width > 0 && width < 100) || (height > 0 && height < 100)) {
        console.log(`Skipping small image: ${src} (${width}x${height})`);
        return;
      }
      
      // Skip banner/promotional images for better product focus
      if (src.includes('banner') || src.includes('promo') || src.includes('sloggi') || 
          src.includes('brand') || src.includes('logo')) {
        console.log(`Skipping promotional/banner image: ${src}`);
        return;
      }
      
      console.log(`Adding valid image URL: ${src}`);
      imageUrls.push(src);
    });
  }
  
  // For Triumph, extract real carousel images from all product types
  if (baseUrl.includes('triumph.com')) {
    console.log('Extracting Triumph main product carousel images...');
    
    const htmlContent = $.html();
    
    // Extract product ID from URL or existing images
    let productId = null;
    const urlMatch = baseUrl.match(/\/(\d+)\.html/);
    if (urlMatch) {
      productId = urlMatch[1];
    } else if (imageUrls.length > 0) {
      const imgMatch = imageUrls[0].match(/30_(\d+)_/);
      if (imgMatch) {
        productId = imgMatch[1];
      }
    }
    
    if (productId) {
      console.log(`Searching for product ID ${productId} main carousel patterns...`);
      
      // Search for all possible main carousel patterns for this product
      const carouselPatterns = htmlContent.match(new RegExp(`30_${productId}_\\d{4}_\\d+\\.(?:jpg|png)`, 'g'));
      
      if (carouselPatterns) {
        const uniquePatterns = [...new Set(carouselPatterns)];
        console.log(`Found main carousel patterns: ${uniquePatterns.join(', ')}`);
        
        // Find the main carousel pattern (usually higher numbers like 6106, 4505, etc.)
        const mainPattern = uniquePatterns.find(p => {
          const viewTypeMatch = p.match(/_(\d{4})_/);
          if (viewTypeMatch) {
            const viewType = parseInt(viewTypeMatch[1]);
            return viewType > 1000; // Main carousel patterns are usually > 1000
          }
          return false;
        });
        
        if (mainPattern) {
          console.log(`Using main carousel pattern: ${mainPattern}`);
          
          // Get UUID from existing image
          const existingUrl = imageUrls.find(url => url.includes(`30_${productId}`));
          if (existingUrl) {
            const uuidMatch = existingUrl.match(/transform\/([^\/]+)\//);
            if (uuidMatch) {
              const uuid = uuidMatch[1];
              
              // Clear existing URLs and add main carousel images
              imageUrls.length = 0;
              
              // Generate variants (1-6) for the main pattern
              const viewTypeMatch = mainPattern.match(/_(\d{4})_/);
              const viewType = viewTypeMatch[1];
              
              for (let i = 1; i <= 6; i++) {
                const variantUrl = `https://contentstore.triumph.com/transform/${uuid}/30_${productId}_${viewType}_${i}.png?io=transform:fill,gravity:center,width:688,height:909&format=webp`;
                imageUrls.push(variantUrl);
                console.log(`Added main carousel variant: ${variantUrl}`);
              }
            }
          }
        }
      }
      
      // Fallback: if no main carousel found, use the best available pattern
      if (imageUrls.length === 1) {
        console.log('No main carousel found, generating variants from available pattern');
        const firstImage = imageUrls[0];
        const patternMatch = firstImage.match(/(\d+)_(\d+)_(\d+)_(\d+)/);
        
        if (patternMatch) {
          const [, prefix, prodId, viewType, variant] = patternMatch;
          const uuid = firstImage.match(/transform\/([^\/]+)\//)?.[1];
          
          if (uuid) {
            // Generate 3-4 more variants
            for (let i = 1; i <= 4; i++) {
              if (i.toString() !== variant) {
                const variantUrl = `https://contentstore.triumph.com/transform/${uuid}/${prefix}_${prodId}_${viewType}_${i}.jpg?io=transform:fill,gravity:center,width:688,height:909&format=webp`;
                if (!imageUrls.includes(variantUrl)) {
                  imageUrls.push(variantUrl);
                  console.log(`Added fallback variant: ${variantUrl}`);
                }
              }
            }
          }
        }
      }
    }

  }
  
  console.log(`Basic extraction found ${imageUrls.length} image URLs (including generated variants)`);
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
