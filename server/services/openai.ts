import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export async function analyzeImage(base64Image: string, mimeType: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "You are an expert e-commerce product description writer. Analyze this product image and create a professional product description that includes:\n\n1. A compelling main description paragraph (2-3 sentences) highlighting key benefits, materials, and appeal\n2. A bulleted feature list with specific product attributes\n3. Use a tone that's elegant, sophisticated, and persuasive\n4. Focus on comfort, quality, materials, fit, and unique selling points\n5. Include technical details when relevant\n\nFormat the response as:\n- Main description paragraph\n- Bulleted features list (use HTML <ul class=\"pd\"><li> format)\n- Any certifications or standards if applicable\n\nWrite in a style similar to premium lingerie/fashion brands."
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
