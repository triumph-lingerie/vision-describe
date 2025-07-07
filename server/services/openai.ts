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
              text: `You are a senior SEO content optimizer and linguistic stylist specialized in fashion and lingerie e-commerce. 

MANDATORY: You MUST look at and analyze the ${images.length} uploaded images. These are real product photos that require detailed visual analysis.

PRODUCT IDENTIFICATION: Examine the ${images.length} images and identify the exact product type. Look at:
- The specific style and design elements
- Construction details and features
- Any visible materials or textures
- The overall silhouette and shape

If the images show a different product than "${category}", use the actual product type you see. Be specific about what you observe.

Create a detailed product description based on your visual analysis of the images.

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
1. FIRST: Brief description of what you see in the images (1 sentence starting with "I can see...")
2. Start with grammatically correct demonstrative + actual product type (2-3 sentences introduction)
3. Add feature list in HTML format: <ul class="pd"><li>Feature</li><li>Feature</li></ul>
4. End ONLY with certifications if applicable (e.g., "OEKO-TEX® STANDARD 100, 22.0.22419 Hohenstein HTTI")
5. NO OTHER TEXT after the bullet points except certifications

QUALITY REQUIREMENTS:
- Unique, informative content (150-200 words)
- Professional e-commerce standard
- SEO-optimized without keyword stuffing
- Human-like writing with natural flow
- Premium brand positioning

Write with the confidence and refinement of premium fashion and lingerie brands.

IMPORTANT: You are receiving real product images. Examine them carefully and describe what you actually see. Do not provide generic responses.`
            },
            ...imageContents
          ],
        },
      ],
      max_tokens: 800,
    });

    let result = response.choices[0].message.content || "Unable to generate description for these images.";
    
    console.log("OpenAI response received:", result.substring(0, 100) + "...");
    
    // Append certifications if provided
    if (certifications && certifications.trim()) {
      result += `\n\n${certifications}`;
    }
    
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

MANDATORY VISUAL ANALYSIS: You MUST carefully examine this product image and identify what you see. Look at:
- The specific product type and style
- Construction details and design elements  
- Visible materials, textures, and finishes
- Unique features and selling points
- Overall silhouette and fit

If the image shows a different product than "${category}", use the actual product type you observe. Be specific about what you see in the image.

Create a detailed product description based on your visual analysis.

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
1. FIRST: Brief description of what you see in the image (1 sentence starting with "I can see...")
2. Start with grammatically correct demonstrative + actual product type (2-3 sentences introduction)
3. Add feature list in HTML format: <ul class="pd"><li>Feature</li><li>Feature</li></ul>
4. End ONLY with certifications if applicable (e.g., "OEKO-TEX® STANDARD 100, 22.0.22419 Hohenstein HTTI")
5. NO OTHER TEXT after the bullet points except certifications

QUALITY REQUIREMENTS:
- Unique, informative content (150-200 words)
- Professional e-commerce standard
- SEO-optimized without keyword stuffing
- Human-like writing with natural flow
- Premium brand positioning

Write with the confidence and refinement of premium fashion and lingerie brands.`
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
    
    // Append certifications if provided
    if (certifications && certifications.trim()) {
      result += `\n\n${certifications}`;
    }
    
    return result;
  } catch (error) {
    console.error("Error analyzing image with OpenAI:", error);
    throw new Error("Failed to analyze image. Please try again.");
  }
}
