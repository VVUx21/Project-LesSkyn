'use server';
import { GoogleGenAI, Type } from "@google/genai";
import { safetySettings } from "../Aiconfig";
import { cleanGeminiResponse, findMatchingSkinProfile, extractKeyIngredients } from "../utils";
import { ProductData, SkincareData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function* generateSkincareRoutineStream(
  products: ProductData[],
  skinType: string,
  skinConcern: string,
  commitmentLevel: string,
  preferredProducts: string
): AsyncGenerator<string, void, unknown> {
  try {
    console.log(skinType, skinConcern, commitmentLevel, preferredProducts);
    const matchingProfile = findMatchingSkinProfile(skinType, skinConcern, commitmentLevel, preferredProducts);

    if (!matchingProfile) {
      yield JSON.stringify({ type: 'error', error: 'No matching skin profile found' });
      return;
    }

    const essentialIngredients = extractKeyIngredients(matchingProfile);
    const weeklyTreatments = matchingProfile["Weekly Treatments"] || "";
    const otherSuggestions = matchingProfile["Other Suggestion"] || "";
    const amRoutineSteps = matchingProfile["Product Suggestion AM"]?.split('<br>') || [];
    const pmRoutineSteps = matchingProfile["Product Suggestion PM"]?.split('<br>') || [];

    const productsForAnalysis = products.map(p => ({
      title: p.title,
      url: p.url,
      description: p.description,
      category: p.category,
      currentPrice: p.currentPrice,
      currency: p.currency,
      image: p.image,
      originalPrice: p.originalPrice,
      discountRate: p.discountRate
    }));

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are LesSkyn AI, an expert skincare routine creator. Analyze the available products and create a personalized 4-step morning and evening routine.

              **USER PROFILE:**
              - Skin Type: ${skinType}
              - Primary Concern: ${skinConcern}
              - Commitment Level: ${commitmentLevel}
              - Preferred Products: ${preferredProducts}

              **ESSENTIAL INGREDIENTS TO PRIORITIZE:**
              ${essentialIngredients.join('\n')}

              **ROUTINE STRUCTURE GUIDELINES:**
              Morning Steps: ${amRoutineSteps.join(' → ')}
              Evening Steps: ${pmRoutineSteps.join(' → ')}

              **WEEKLY TREATMENTS:** ${weeklyTreatments}

              **BUDGET/PREFERENCE CONSTRAINTS:** ${otherSuggestions}

              **AVAILABLE PRODUCTS:**
              ${JSON.stringify(productsForAnalysis)}

              **INSTRUCTIONS:**
              1. Create EXACTLY 4 steps for both AM and PM routines
              2. AM: Step 1 (Cleanser) → Step 2 (Serum/Treatment) → Step 3 (Facewash) → Step 4 (Moisturizer)
              3. PM: Step 1 (Cleanser) → Step 2 (Serum/Treatment) → Step 3 (Facewash) → Step 4 (Moisturizer)
              4. Match products based on their ingredients with the essential ingredients list
              5. For each step, explain WHY this specific product is chosen and HOW to use it
              6. Include weekly treatment recommendations if applicable
              7. Provide general routine notes and tips

              Return ONLY valid JSON following the exact schema provided.`
            }
          ]
        }
      ],
      config: {
        tools: [],
        thinkingConfig: { thinkingBudget: 0 },
        safetySettings,
        responseMimeType: "application/json",
        systemInstruction: {
          role: "system",
          parts: [
            {
              text: `You are LesSkyn AI, a professional skincare consultant. Create personalized routines by matching product ingredients with user needs. Always prioritize ingredient compatibility and user constraints. Return only valid JSON.`
            }
          ]
        },
        temperature: 0.2,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 5000,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            routine: {
              type: Type.OBJECT,
              properties: {
                morning: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      step: { type: Type.INTEGER },
                      product_name: { type: Type.STRING },
                      product_url: { type: Type.STRING },
                      reasoning: { type: Type.STRING },
                      how_to_use: { type: Type.STRING }
                    },
                    required: ["step", "product_name", "product_url", "reasoning", "how_to_use"]
                  }
                },
                evening: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      step: { type: Type.INTEGER },
                      product_name: { type: Type.STRING },
                      product_url: { type: Type.STRING },
                      reasoning: { type: Type.STRING },
                      how_to_use: { type: Type.STRING }
                    },
                    required: ["step", "product_name", "product_url", "reasoning", "how_to_use"]
                  }
                }
              },
              required: ["morning", "evening"]
            },
            weekly_treatments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  treatment_type: { type: Type.STRING },
                  product_suggestion: { type: Type.STRING },
                  reasoning: { type: Type.STRING },
                  how_to_use: { type: Type.STRING }
                },
                required: ["treatment_type", "product_suggestion", "reasoning", "how_to_use"]
              }
            },
            general_notes: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["routine", "general_notes"]
        }
      }
    });

    // ---- ACCUMULATE JSON RESPONSE ----
    let buffer = "";

    for await (const chunk of stream) {
      if (chunk?.text) {
        buffer += chunk.text;
      }
    }

    // Defensive cleanup (in case the model ever wraps with code-fences)
    const cleaned = buffer
      .replace(/```json\s*/g, "")
      .replace(/```/g, "")
      .trim();

    try {
      const finalData = JSON.parse(cleaned);
      yield JSON.stringify({ type: "complete", data: finalData });
    } catch (err) {
      console.error("❌ Failed to parse final response:", err);
      // If you want an extra guard, you could try a repair step here (jsonrepair)
      yield JSON.stringify({ type: "error", error: "Failed to parse complete response" });
    }
  } catch (err) {
    console.error("Gemini request failed:", err);
    yield JSON.stringify({ type: "error", error: "Request failed" });
  }
}

// Keep the original function for backward compatibility
async function generateSkincareRoutine(
  products: ProductData[],
  skinType: string,
  skinConcern: string,
  commitmentLevel: string,
  preferredProducts: string
): Promise<SkincareData | null> {
  
  let finalResult: SkincareData | null = null;
  
  try {
    const stream = generateSkincareRoutineStream(products, skinType, skinConcern, commitmentLevel, preferredProducts);
    
    for await (const chunk of stream) {
      const parsedChunk = JSON.parse(chunk);
      if (parsedChunk.type === 'complete') {
        finalResult = parsedChunk.data;
        break;
      } else if (parsedChunk.type === 'error') {
        console.error('Stream error:', parsedChunk.error);
        return null;
      }
    }
    
    return finalResult;
  } catch (err) {
    console.error("Stream processing failed:", err);
    return null;
  }
}

export default generateSkincareRoutine;
export { generateSkincareRoutineStream };