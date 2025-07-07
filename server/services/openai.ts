import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export async function analyzeImages(images: Array<{base64: string, mimeType: string}>, language: string = "uk", category: string = "product"): Promise<string> {
  try {
    const imageContents = images.map(img => ({
      type: "image_url" as const,
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`
      }
    }));

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are an expert e-commerce product description writer. Analyze these ${images.length} ${category} images from different angles and create a comprehensive professional product description that includes:

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
1. Start with the appropriate demonstrative + ${category} in the target language (for SEO purposes):
   - English: "These ${category}"
   - German: "Diese ${category}" (or "Dieser" for masculine nouns)
   - French: "Ces ${category}" (or "Ce/Cette" for singular)
   - Italian: "Questi ${category}" (or "Questo/Questa" for singular depending on gender)
   - Spanish: "Estos ${category}" (or "Este/Esta" for singular)
   - Dutch: "Deze ${category}"
   - Portuguese: "Estes ${category}" (or "Este/Esta" for singular)
   - And so on for other languages - use proper grammar and gender agreement
2. Use ALL the images to create a comprehensive description that covers:
   - Overall design and aesthetics visible across all angles
   - Materials, textures, and construction details seen in the images
   - Fit, comfort features, and functional aspects
   - Design elements, patterns, and construction details
   - Any unique features or selling points visible in any of the images
   - IMPORTANT: Do NOT mention specific colors or sizes, as this description will be used for multiple variants of the same model
3. A bulleted feature list with specific product attributes from all views
4. Use a tone that's elegant, sophisticated, and persuasive
5. Focus on comfort, quality, materials, fit, and unique selling points
6. Include technical details when relevant
7. NEVER mention specific colors, sizes, or variants - focus on the design and features that apply to all variants of this model

FORMAT:
- Main description paragraph starting with the product category
- Bulleted features list (use HTML <ul class="pd"><li> format)
- Any certifications or standards if applicable

Example format:
These [product category] combine elegance with functionality...

<ul class="pd">
<li>Feature 1</li>
<li>Feature 2</li>
</ul>

Write in a style similar to premium lingerie/fashion brands.`
            },
            ...imageContents
          ],
        },
      ],
      max_tokens: 800,
    });

    return response.choices[0].message.content || "Unable to generate description for these images.";
  } catch (error) {
    console.error("Error analyzing images with OpenAI:", error);
    throw new Error("Failed to analyze images. Please try again.");
  }
}

export async function analyzeImage(base64Image: string, mimeType: string, language: string = "uk", category: string = "product"): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are an expert e-commerce product description writer. Analyze this ${category} image and create a professional product description that includes:

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
1. Start with the appropriate demonstrative + ${category} in the target language (for SEO purposes):
   - English: "These ${category}"
   - German: "Diese ${category}" (or "Dieser" for masculine nouns)
   - French: "Ces ${category}" (or "Ce/Cette" for singular)
   - Italian: "Questi ${category}" (or "Questo/Questa" for singular depending on gender)
   - Spanish: "Estos ${category}" (or "Este/Esta" for singular)
   - Dutch: "Deze ${category}"
   - Portuguese: "Estes ${category}" (or "Este/Esta" for singular)
   - And so on for other languages - use proper grammar and gender agreement
2. A compelling main description paragraph (2-3 sentences) highlighting key benefits, materials, and appeal
3. A bulleted feature list with specific product attributes
4. Use a tone that's elegant, sophisticated, and persuasive
5. Focus on comfort, quality, materials, fit, and unique selling points
6. Include technical details when relevant
7. NEVER mention specific colors, sizes, or variants - focus on the design and features that apply to all variants of this model

FORMAT:
- Main description paragraph starting with the product category
- Bulleted features list (use HTML <ul class="pd"><li> format)
- Any certifications or standards if applicable

Example format:
These [product category] combine elegance with functionality...

<ul class="pd">
<li>Feature 1</li>
<li>Feature 2</li>
</ul>

Write in a style similar to premium lingerie/fashion brands.`
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

    return response.choices[0].message.content || "Unable to generate description for this image.";
  } catch (error) {
    console.error("Error analyzing image with OpenAI:", error);
    throw new Error("Failed to analyze image. Please try again.");
  }
}
