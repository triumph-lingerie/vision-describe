import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

export async function analyzeImages(images: Array<{base64: string, mimeType: string}>, language: string = "en", category: string = "product", certifications: string = ""): Promise<string> {
  try {
    console.log(`Analyzing ${images.length} images with language: ${language}, category: ${category}`);
    
    // Debug: Check image data quality
    images.forEach((img, index) => {
      console.log(`Image ${index + 1}:`, {
        mimeType: img.mimeType,
        base64Length: img.base64.length,
        base64Preview: img.base64.substring(0, 50) + "..."
      });
    });
    
    const imageContents = images.map(img => ({
      type: "image_url" as const,
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`
      }
    }));

    console.log("Sending request to OpenAI with image contents...");
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Create a professional product description for a ${category} based on the provided product images.

TASK: Write marketing copy for this lingerie product using the ${images.length} images provided.

Product category: ${category}
Language: ${language}

Please analyze the images and create an engaging product description.

VISUAL ANALYSIS - Examine the images for:
- Exact product type and style (bra, underwear, swimwear, etc.)
- Specific construction details visible (seams, bands, cups, straps)
- Materials and textures you can see (lace, mesh, cotton, satin, etc.)
- Hardware and closures visible (hooks, adjusters, wires, etc.)
- Design elements and patterns actually present
- Colors and color combinations visible
- Any logos, labels, or certifications shown

ACCURACY RULE: Only describe features you can actually see in the images. If you cannot see specific details, do not mention them.

LANGUAGE: Write in the appropriate language based on the code:
- uk: English (United Kingdom)
- de: German (Deutschland)  
- fr: French (France)
- it: Italian (Italia)
- es: Spanish (España)
- nl: Dutch (Nederland)
- pt: Portuguese (Portugal)
- pl: Polish (Polska)
- cz: Czech (Česká republika)
- hu: Hungarian (Magyarország)
- dk: Danish (Danmark)
- se: Swedish (Sverige)
- at: German (Österreich)
- ch-de: German (Schweiz)
- ch-fr: French (Suisse)
- ch-it: Italian (Svizzera)
- be-fr: French (Belgique)
- be-nl: Dutch (België)

Current language code: ${language}

CONTENT REQUIREMENTS:
1. Start with the appropriate demonstrative + ${category} in the target language with PERFECT GRAMMAR:
   CRITICAL RULE: Use the EXACT grammar that matches the ${category} text provided:
   - If category is written in SINGULAR form (e.g., "reggiseno imbottito", "non-wired bra") → ALWAYS USE SINGULAR articles
   - If category is written in PLURAL form (e.g., "reggiseni", "bras", "mutandine") → USE PLURAL articles  
   - DO NOT change singular to plural based on image content - match the category text exactly!
   
   GRAMMAR BY LANGUAGE:
   - English: "This ${category.toLowerCase()}" (singular) or "These ${category.toLowerCase()}" (plural)
   - German: "Dieser/Diese/Dieses ${category}" (singular, check gender) or "Diese ${category}" (plural)
   - French: "Ce/Cette ${category}" (singular, check gender) or "Ces ${category}" (plural)
   - Italian: "Questo/Questa ${category}" (singular, check gender) or "Questi/Queste ${category}" (plural, check gender)
   - Spanish: "Este/Esta ${category}" (singular, check gender) or "Estos/Estas ${category}" (plural, check gender)
   - Dutch: "Deze ${category}" (singular/plural)
   - Portuguese: "Este/Esta ${category}" (singular, check gender) or "Estes/Estas ${category}" (plural, check gender)
   
   ITALIAN EXAMPLES: 
   - "reggiseno imbottito" (singular) → "Questo reggiseno imbottito" (NOT "Questi reggiseni")
   - "mutandina" (singular) → "Questa mutandina"
   - "reggiseni" (plural) → "Questi reggiseni"
2. Use ALL images to create descriptions that answer:
   - What is this product and what problems does it solve?
   - What makes it different from other products?
   - What materials and construction details are visible?
   - How does the design provide comfort and functionality?
   - Any unique features or selling points across all views
   
3. STYLE GUIDELINES:
   - Use direct, intentional, and refined language (avoid "sexy", inappropriate terms)
   - Write 150-200 words with natural sentence variation
   - Avoid AI phrases like "Furthermore", "Moreover", "Delve into", "Realm", "Testament"
   - Focus on emotional benefits and practical features
   - Maintain elegant, sophisticated tone without sales language
   
4. CRITICAL RESTRICTIONS:
   - NEVER mention specific colors, sizes, or variants
   - Description must work for all product variants
   - No generic or formulaic transitions
   - No objectifying language

STRUCTURE (MANDATORY):
1. Start with grammatically correct demonstrative + actual product type (2-3 sentences introduction)
2. Add feature list in HTML format: <ul class="pd"><li>Feature</li><li>Feature</li></ul>
3. End ONLY with certifications if provided (no other text after bullet points)

IMPORTANT: DO NOT include "I can see..." statements in your response. Use your visual analysis to create the description, but don't show the analysis process.

EXAMPLE OF ACCURATE ANALYSIS:
✓ GOOD: "I can see a black wireless bra with wide shoulder straps and a front closure"
✗ BAD: "I can see a bra" (too generic)
✓ GOOD: "Featuring the visible wide under-band and front hook closure"  
✗ BAD: "Featuring advanced support technology" (not visible)

QUALITY REQUIREMENTS:
- Unique, informative content (150-200 words)
- Professional e-commerce standard
- SEO-optimized without keyword stuffing
- Human-like writing with natural flow
- Premium brand positioning

Write with the confidence and refinement of premium fashion and lingerie brands.

CERTIFICATIONS TO INCLUDE: ${certifications || "NONE - do not add any certification text"}

IMPORTANT RULES:
- You are receiving real product images. Examine them carefully and describe what you actually see. Do not provide generic responses.
- If no certifications provided above, end with the bullet points (no certification section)
- Do not invent or add generic certification text`
            },
            ...imageContents
          ],
        },
      ],
      max_tokens: 800,
    });

    let result = response.choices[0].message.content || "Unable to generate description for these images.";
    
    console.log("OpenAI response received:", result.substring(0, 100) + "...");
    
    return result;
  } catch (error) {
    console.error("Error analyzing images with OpenAI:", error);
    throw new Error("Failed to analyze images. Please try again.");
  }
}

export async function analyzeImage(base64Image: string, mimeType: string, language: string = "en", category: string = "product", certifications: string = ""): Promise<string> {
  try {
    console.log(`Analyzing single image with language: ${language}, category: ${category}`);
    console.log(`Image data:`, {
      mimeType,
      base64Length: base64Image.length,
      base64Preview: base64Image.substring(0, 50) + "..."
    });
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a senior SEO content optimizer and linguistic stylist specialized in fashion and lingerie e-commerce. 

MANDATORY VISUAL ANALYSIS: You MUST carefully examine this product image and identify what you see. 

CRITICAL REQUIREMENT: You MUST base your description ONLY on what you actually see in the image. Do NOT add generic features or assume anything not visible.

VISUAL ANALYSIS CHECKLIST - Look at the image and identify:
- Exact product type and style (bra, underwear, swimwear, etc.)
- Specific construction details visible (seams, bands, cups, straps)
- Materials and textures you can see (lace, mesh, cotton, satin, etc.)
- Hardware and closures visible (hooks, adjusters, wires, etc.)
- Design elements and patterns actually present
- Colors and color combinations visible
- Any logos, labels, or certifications shown

ACCURACY RULE: Only describe features you can actually see in the image. If you cannot see specific details, do not mention them.

LANGUAGE: Write in the appropriate language based on the code:
- uk: English (United Kingdom)
- de: German (Deutschland)  
- fr: French (France)
- it: Italian (Italia)
- es: Spanish (España)
- nl: Dutch (Nederland)
- pt: Portuguese (Portugal)
- pl: Polish (Polska)
- cz: Czech (Česká republika)
- hu: Hungarian (Magyarország)
- dk: Danish (Danmark)
- se: Swedish (Sverige)
- at: German (Österreich)
- ch-de: German (Schweiz)
- ch-fr: French (Suisse)
- ch-it: Italian (Svizzera)
- be-fr: French (Belgique)
- be-nl: Dutch (België)

Current language code: ${language}

CONTENT REQUIREMENTS:
1. Start with the appropriate demonstrative + ${category} in the target language with PERFECT GRAMMAR:
   CRITICAL RULE: Use the EXACT grammar that matches the ${category} text provided:
   - If category is written in SINGULAR form (e.g., "reggiseno imbottito", "non-wired bra") → ALWAYS USE SINGULAR articles
   - If category is written in PLURAL form (e.g., "reggiseni", "bras", "mutandine") → USE PLURAL articles  
   - DO NOT change singular to plural based on image content - match the category text exactly!
   
   GRAMMAR BY LANGUAGE:
   - English: "This ${category}" (singular) or "These ${category}" (plural)
   - German: "Dieser/Diese/Dieses ${category}" (singular, check gender) or "Diese ${category}" (plural)
   - French: "Ce/Cette ${category}" (singular, check gender) or "Ces ${category}" (plural)
   - Italian: "Questo/Questa ${category}" (singular, check gender) or "Questi/Queste ${category}" (plural, check gender)
   - Spanish: "Este/Esta ${category}" (singular, check gender) or "Estos/Estas ${category}" (plural, check gender)
   - Dutch: "Deze ${category}" (singular/plural)
   - Portuguese: "Este/Esta ${category}" (singular, check gender) or "Estes/Estas ${category}" (plural, check gender)
   
   ITALIAN EXAMPLES: 
   - "reggiseno imbottito" (singular) → "Questo reggiseno imbottito" (NOT "Questi reggiseni")
   - "mutandina" (singular) → "Questa mutandina"
   - "reggiseni" (plural) → "Questi reggiseni"
2. Analyze the image to create descriptions that answer:
   - What is this product and what problems does it solve?
   - What makes it different from other products?
   - What materials and construction details are visible?
   - How does the design provide comfort and functionality?
   
3. STYLE GUIDELINES:
   - Use direct, intentional, and refined language (avoid "sexy", inappropriate terms)
   - Write 150-200 words with natural sentence variation
   - Avoid AI phrases like "Furthermore", "Moreover", "Delve into", "Realm", "Testament"
   - Focus on emotional benefits and practical features
   - Maintain elegant, sophisticated tone without sales language
   
4. CRITICAL RESTRICTIONS:
   - NEVER mention specific colors, sizes, or variants
   - Description must work for all product variants
   - No generic or formulaic transitions
   - No objectifying language

STRUCTURE (MANDATORY):
1. Start with grammatically correct demonstrative + actual product type (2-3 sentences introduction)
2. Add feature list in HTML format: <ul class="pd"><li>Feature</li><li>Feature</li></ul>
3. End ONLY with certifications if provided (no other text after bullet points)

IMPORTANT: DO NOT include "I can see..." statements in your response. Use your visual analysis to create the description, but don't show the analysis process.

EXAMPLE OF ACCURATE ANALYSIS:
✓ GOOD: "I can see a black wireless bra with wide shoulder straps and a front closure"
✗ BAD: "I can see a bra" (too generic)
✓ GOOD: "Featuring the visible wide under-band and front hook closure"  
✗ BAD: "Featuring advanced support technology" (not visible)

QUALITY REQUIREMENTS:
- Unique, informative content (150-200 words)
- Professional e-commerce standard
- SEO-optimized without keyword stuffing
- Human-like writing with natural flow
- Premium brand positioning

Write with the confidence and refinement of premium fashion and lingerie brands.

CERTIFICATIONS TO INCLUDE: ${certifications || "NONE - do not add any certification text"}

IMPORTANT RULES:
- If no certifications provided above, end with the bullet points (no certification section)
- Do not invent or add generic certification text`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ],
        },
      ],
      max_tokens: 500,
    });

    let result = response.choices[0].message.content || "Unable to generate description for this image.";
    
    return result;
  } catch (error) {
    console.error("Error analyzing image with OpenAI:", error);
    throw new Error("Failed to analyze image. Please try again.");
  }
}
