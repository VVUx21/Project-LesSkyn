'use server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { findMatchingSkinProfile, extractKeyIngredients } from '../utils';
import { ProductData, SkincareData } from '../types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function* generateSkincareRoutineStream(
  products: ProductData[],
  skinType: string,
  skinConcern: string,
  commitmentLevel: string,
  preferredProducts: string
): AsyncGenerator<string, void, unknown> {
  try {
    console.log('🚀 Gemini Stream:', skinType, skinConcern, commitmentLevel, preferredProducts);
    
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

Return ONLY valid JSON following this exact schema:
{
  "routine": {
    "morning": [{"step": 1, "product_name": "...", "product_url": "...", "reasoning": "...", "how_to_use": "..."}],
    "evening": [{"step": 1, "product_name": "...", "product_url": "...", "reasoning": "...", "how_to_use": "..."}]
  },
  "weekly_treatments": [{"treatment_type": "...", "product_suggestion": "...", "reasoning": "...", "how_to_use": "..."}],
  "general_notes": ["..."]
}`;

    const model = genAI.getGenerativeModel({ 
      model:"gemini-2.5-flash",
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 16000,
        responseMimeType: "application/json"
      }
    });

    const result = await model.generateContentStream([
      "You are LesSkyn AI, a professional skincare consultant. Create personalized routines by matching product ingredients with user needs. Always prioritize ingredient compatibility and user constraints. Return only valid JSON.",
      userPrompt
    ]);

    let buffer = "";

    // Collect all chunks from the stream
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        buffer += chunkText;
      }
    }

    console.log("✅ Stream completed. Buffer size:", buffer.length);

    // Check if buffer is empty or incomplete
    if (!buffer || buffer.length < 100) {
      console.error("❌ Buffer too short or empty:", buffer.length);
      yield JSON.stringify({ 
        type: "error", 
        error: "Response incomplete. Please try again." 
      });
      return;
    }

    // Clean up the response
    let cleaned = buffer
      .replace(/```json\s*/g, "")
      .replace(/```/g, "")
      .trim();

    // Verify the response ends properly
    if (!cleaned.endsWith('}') && !cleaned.endsWith(']')) {
      console.error("❌ Response doesn't end with proper JSON closure");
      console.error("Last 100 chars:", cleaned.slice(-100));
    }

    // Remove any potential incomplete JSON at the end
    // Find the last complete closing brace
    const lastClosingBrace = cleaned.lastIndexOf('}');
    if (lastClosingBrace !== -1) {
      cleaned = cleaned.substring(0, lastClosingBrace + 1);
    }

    try {
      const finalData = JSON.parse(cleaned);
      
      // Validate the structure
      if (!finalData.routine || !finalData.routine.morning || !finalData.routine.evening) {
        throw new Error("Invalid routine structure");
      }
      
      yield JSON.stringify({ type: "complete", data: finalData });
    } catch (err) {
      console.error("❌ Failed to parse Gemini response:", err);
      console.error("Buffer length:", buffer.length);
      console.error("Cleaned response (first 500 chars):", cleaned.substring(0, 500));
      console.error("Cleaned response (last 200 chars):", cleaned.slice(-200));
      
      // Try to salvage partial data
      try {
        // Attempt to fix common JSON issues
        const fixedJson = cleaned
          .replace(/,\s*}/g, '}')  // Remove trailing commas
          .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
          .replace(/}\s*{/g, '},{') // Fix missing commas between objects
          .replace(/]\s*\[/g, '],['); // Fix missing commas between arrays
        
        const salvaged = JSON.parse(fixedJson);
        console.log("✅ Salvaged partial response");
        yield JSON.stringify({ type: "complete", data: salvaged });
      } catch (salvageErr) {
        yield JSON.stringify({ 
          type: "error", 
          error: "Failed to parse Gemini response. Please try again." 
        });
      }
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
