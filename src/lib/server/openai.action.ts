'use server';
import OpenAI from 'openai';
import { findMatchingSkinProfile, extractKeyIngredients } from '../utils';
import { ProductData, SkincareData } from '../types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const SKINCARE_SCHEMA = {
  type: "object" as const,
  properties: {
    routine: {
      type: "object" as const,
      properties: {
        morning: {
          type: "array" as const,
          items: {
            type: "object" as const,
            properties: {
              step: { type: "integer" as const },
              product_name: { type: "string" as const },
              product_url: { type: "string" as const },
              reasoning: { type: "string" as const },
              how_to_use: { type: "string" as const }
            },
            required: ["step", "product_name", "product_url", "reasoning", "how_to_use"]
          }
        },
        evening: {
          type: "array" as const,
          items: {
            type: "object" as const,
            properties: {
              step: { type: "integer" as const },
              product_name: { type: "string" as const },
              product_url: { type: "string" as const },
              reasoning: { type: "string" as const },
              how_to_use: { type: "string" as const }
            },
            required: ["step", "product_name", "product_url", "reasoning", "how_to_use"]
          }
        }
      },
      required: ["morning", "evening"]
    },
    weekly_treatments: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          treatment_type: { type: "string" as const },
          product_suggestion: { type: "string" as const },
          reasoning: { type: "string" as const },
          how_to_use: { type: "string" as const }
        },
        required: ["treatment_type", "product_suggestion", "reasoning", "how_to_use"]
      }
    },
    general_notes: {
      type: "array" as const,
      items: { type: "string" as const }
    }
  },
  required: ["routine", "general_notes"]
};

async function* generateSkincareRoutineStream(
  products: ProductData[],
  skinType: string,
  skinConcern: string,
  commitmentLevel: string,
  preferredProducts: string
): AsyncGenerator<string, void, unknown> {
  try {
    console.log('🚀 OpenAI Stream:', skinType, skinConcern, commitmentLevel, preferredProducts);
    
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

    const userPrompt = `You are LesSkyn AI, an expert skincare routine creator. Analyze the available products and create a personalized 4-step morning and evening routine.

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

Return ONLY valid JSON following the exact schema provided.`;

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are LesSkyn AI, a professional skincare consultant. Create personalized routines by matching product ingredients with user needs. Always prioritize ingredient compatibility and user constraints. Return only valid JSON."
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      response_format: { 
        type: "json_schema",
        json_schema: {
          name: "skincare_routine",
          schema: SKINCARE_SCHEMA,
          strict: true
        }
      },
      temperature: 0.2,
      max_tokens: 5000,
      stream: true
    });

    let buffer = "";

    // Yield progress updates as we receive chunks
    let chunkCount = 0;
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        buffer += content;
        chunkCount++;
        
        // Emit progress updates every 10 chunks
        if (chunkCount % 10 === 0) {
          yield JSON.stringify({ 
            type: 'progress', 
            data: { 
              chunksReceived: chunkCount,
              bufferSize: buffer.length 
            } 
          });
        }
      }
    }

    const cleaned = buffer
      .replace(/```json\s*/g, "")
      .replace(/```/g, "")
      .trim();

    try {
      const finalData = JSON.parse(cleaned);
      yield JSON.stringify({ type: "complete", data: finalData });
    } catch (err) {
      console.error("❌ Failed to parse OpenAI response:", err);
      yield JSON.stringify({ type: "error", error: "Failed to parse complete response" });
    }
  } catch (err: any) {
    console.error("OpenAI request failed:", err);
    yield JSON.stringify({ type: "error", error: err.message || "Request failed" });
  }
}

// Non-streaming version for backward compatibility
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
