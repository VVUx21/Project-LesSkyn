'use server';
import { GoogleGenAI, Type } from "@google/genai";
import { safetySettings } from "../Aiconfig";
import data from "../data"
import { ProductData,SkincareRoutine, RoutineStep } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

function findMatchingSkinProfile(skinType: string, skinConcern: string, commitmentLevel: string, preferredProducts: string) {
  return data.find(profile => 
    profile["Skin type"] === skinType &&
    profile["Concern"] === skinConcern &&
    profile["Commitment Level"] === commitmentLevel &&
    profile["Preferred Skincare Ingredients/Products"] === preferredProducts
  );
}

function extractKeyIngredients(profile: any): string[] {
  if (!profile["Essential Ingredients to Look For"]) return [];
  
  return profile["Essential Ingredients to Look For"]
    .split('•')
    .map((ingredient: string) => ingredient.trim())
    .filter((ingredient: string) => ingredient.length > 0);
}

async function generateSkincareRoutine(
  products: ProductData[],
  skinType: string,
  skinConcern: string,
  commitmentLevel: string,
  preferredProducts: string
): Promise<SkincareRoutine | null> {

  try {
    // Find matching skin profile from data
    const matchingProfile = findMatchingSkinProfile(skinType, skinConcern, commitmentLevel, preferredProducts);
    
    if (!matchingProfile) {
      console.error("No matching skin profile found");
      return null;
    }

    // Extract essential ingredients and routine information
    const essentialIngredients = extractKeyIngredients(matchingProfile);
    const weeklyTreatments = matchingProfile["Weekly Treatments"] || "";
    const otherSuggestions = matchingProfile["Other Suggestion"] || "";
    const amRoutineSteps = matchingProfile["Product Suggestion AM"]?.split('<br>') || [];
    const pmRoutineSteps = matchingProfile["Product Suggestion PM"]?.split('<br>') || [];

    // Prepare products data for AI analysis
    const productsForAnalysis = products.map(p => ({
      title: p.title,
      url: p.url,
      description: p.description,
      category: p.category,
      currentPrice: p.currentPrice,
      currency: p.currency,
      originalPrice: p.originalPrice,
      discountRate: p.discountRate
    }));

    const response = await ai.models.generateContent({
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
                ${JSON.stringify(productsForAnalysis, null, 2)}

                **INSTRUCTIONS:**
                1. Create EXACTLY 4 steps for both AM and PM routines
                2. AM: Step 1 (Cleanser) → Step 2 (Serum/Treatment) → Step 3 (Moisturizer) → Step 4 (Sunscreen)
                3. PM: Step 1 (Cleanser) → Step 2 (Active Treatment) → Step 3 (Moisturizer) → Step 4 (Night Care/Optional)
                4. Match products based on their ingredients with the essential ingredients list
                5. Consider price constraints from "Other Suggestion"
                6. For each step, explain WHY this specific product is chosen and HOW to use it
                7. Include weekly treatment recommendations if applicable
                8. Provide general routine notes and tips

                Return ONLY valid JSON following the exact schema provided.`
            }
          ]
        }
      ],
      config: {
        tools: [],
        thinkingConfig: { thinkingBudget: 0 },
        safetySettings,
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
        maxOutputTokens: 8000,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            morningRoutine: {
              type: Type.OBJECT,
              properties: {
                step1Cleanser: {
                  type: Type.OBJECT,
                  properties: {
                    stepNumber: { type: Type.INTEGER },
                    stepName: { type: Type.STRING },
                    product: {
                      type: Type.OBJECT,
                      properties: {
                        productName: { type: Type.STRING },
                        productLink: { type: Type.STRING },
                        description: { type: Type.STRING },
                        price: { type: Type.NUMBER },
                        currency: { type: Type.STRING },
                        rating: { type: Type.NUMBER },
                        source: { type: Type.STRING }
                      },
                      required: ["productName", "productLink", "description", "price", "currency", "source"]
                    },
                    whyThisProduct: { type: Type.STRING },
                    howToUse: { type: Type.STRING }
                  },
                  required: ["stepNumber", "stepName", "product", "whyThisProduct", "howToUse"]
                },
                step2Serum: {
                  type: Type.OBJECT,
                  properties: {
                    stepNumber: { type: Type.INTEGER },
                    stepName: { type: Type.STRING },
                    product: {
                      type: Type.OBJECT,
                      properties: {
                        productName: { type: Type.STRING },
                        productLink: { type: Type.STRING },
                        description: { type: Type.STRING },
                        price: { type: Type.NUMBER },
                        currency: { type: Type.STRING },
                        rating: { type: Type.NUMBER },
                        source: { type: Type.STRING }
                      },
                      required: ["productName", "productLink", "description", "price", "currency", "source"]
                    },
                    whyThisProduct: { type: Type.STRING },
                    howToUse: { type: Type.STRING }
                  },
                  required: ["stepNumber", "stepName", "product", "whyThisProduct", "howToUse"]
                },
                step3Moisturizer: {
                  type: Type.OBJECT,
                  properties: {
                    stepNumber: { type: Type.INTEGER },
                    stepName: { type: Type.STRING },
                    product: {
                      type: Type.OBJECT,
                      properties: {
                        productName: { type: Type.STRING },
                        productLink: { type: Type.STRING },
                        description: { type: Type.STRING },
                        price: { type: Type.NUMBER },
                        currency: { type: Type.STRING },
                        rating: { type: Type.NUMBER },
                        source: { type: Type.STRING }
                      },
                      required: ["productName", "productLink", "description", "price", "currency", "source"]
                    },
                    whyThisProduct: { type: Type.STRING },
                    howToUse: { type: Type.STRING }
                  },
                  required: ["stepNumber", "stepName", "product", "whyThisProduct", "howToUse"]
                },
                step4Sunscreen: {
                  type: Type.OBJECT,
                  properties: {
                    stepNumber: { type: Type.INTEGER },
                    stepName: { type: Type.STRING },
                    product: {
                      type: Type.OBJECT,
                      properties: {
                        productName: { type: Type.STRING },
                        productLink: { type: Type.STRING },
                        description: { type: Type.STRING },
                        price: { type: Type.NUMBER },
                        currency: { type: Type.STRING },
                        rating: { type: Type.NUMBER },
                        source: { type: Type.STRING }
                      },
                      required: ["productName", "productLink", "description", "price", "currency", "source"]
                    },
                    whyThisProduct: { type: Type.STRING },
                    howToUse: { type: Type.STRING }
                  },
                  required: ["stepNumber", "stepName", "product", "whyThisProduct", "howToUse"]
                }
              },
              required: ["step1Cleanser", "step3Moisturizer", "step4Sunscreen"]
            },
            eveningRoutine: {
              type: Type.OBJECT,
              properties: {
                step1Cleanser: {
                  type: Type.OBJECT,
                  properties: {
                    stepNumber: { type: Type.INTEGER },
                    stepName: { type: Type.STRING },
                    product: {
                      type: Type.OBJECT,
                      properties: {
                        productName: { type: Type.STRING },
                        productLink: { type: Type.STRING },
                        description: { type: Type.STRING },
                        price: { type: Type.NUMBER },
                        currency: { type: Type.STRING },
                        rating: { type: Type.NUMBER },
                        source: { type: Type.STRING }
                      },
                      required: ["productName", "productLink", "description", "price", "currency", "source"]
                    },
                    whyThisProduct: { type: Type.STRING },
                    howToUse: { type: Type.STRING }
                  },
                  required: ["stepNumber", "stepName", "product", "whyThisProduct", "howToUse"]
                },
                step2Treatment: {
                  type: Type.OBJECT,
                  properties: {
                    stepNumber: { type: Type.INTEGER },
                    stepName: { type: Type.STRING },
                    product: {
                      type: Type.OBJECT,
                      properties: {
                        productName: { type: Type.STRING },
                        productLink: { type: Type.STRING },
                        description: { type: Type.STRING },
                        price: { type: Type.NUMBER },
                        currency: { type: Type.STRING },
                        rating: { type: Type.NUMBER },
                        source: { type: Type.STRING }
                      },
                      required: ["productName", "productLink", "description", "price", "currency", "source"]
                    },
                    whyThisProduct: { type: Type.STRING },
                    howToUse: { type: Type.STRING }
                  },
                  required: ["stepNumber", "stepName", "product", "whyThisProduct", "howToUse"]
                },
                step3Moisturizer: {
                  type: Type.OBJECT,
                  properties: {
                    stepNumber: { type: Type.INTEGER },
                    stepName: { type: Type.STRING },
                    product: {
                      type: Type.OBJECT,
                      properties: {
                        productName: { type: Type.STRING },
                        productLink: { type: Type.STRING },
                        description: { type: Type.STRING },
                        price: { type: Type.NUMBER },
                        currency: { type: Type.STRING },
                        rating: { type: Type.NUMBER },
                        source: { type: Type.STRING }
                      },
                      required: ["productName", "productLink", "description", "price", "currency", "source"]
                    },
                    whyThisProduct: { type: Type.STRING },
                    howToUse: { type: Type.STRING }
                  },
                  required: ["stepNumber", "stepName", "product", "whyThisProduct", "howToUse"]
                },
                step4NightCare: {
                  type: Type.OBJECT,
                  properties: {
                    stepNumber: { type: Type.INTEGER },
                    stepName: { type: Type.STRING },
                    product: {
                      type: Type.OBJECT,
                      properties: {
                        productName: { type: Type.STRING },
                        productLink: { type: Type.STRING },
                        description: { type: Type.STRING },
                        price: { type: Type.NUMBER },
                        currency: { type: Type.STRING },
                        rating: { type: Type.NUMBER },
                        source: { type: Type.STRING }
                      },
                      required: ["productName", "productLink", "description", "price", "currency", "source"]
                    },
                    whyThisProduct: { type: Type.STRING },
                    howToUse: { type: Type.STRING }
                  },
                  required: ["stepNumber", "stepName", "product", "whyThisProduct", "howToUse"]
                }
              },
              required: ["step1Cleanser", "step2Treatment", "step3Moisturizer"]
            },
            weeklyTreatments: {
              type: Type.OBJECT,
              properties: {
                treatment: { type: Type.STRING },
                frequency: { type: Type.STRING },
                recommendedProducts: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      productName: { type: Type.STRING },
                      productLink: { type: Type.STRING },
                      description: { type: Type.STRING },
                      price: { type: Type.NUMBER },
                      whyRecommended: { type: Type.STRING }
                    },
                    required: ["productName", "productLink", "description", "price", "whyRecommended"]
                  }
                }
              },
              required: ["treatment", "frequency", "recommendedProducts"]
            },
            routineNotes: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["morningRoutine", "eveningRoutine", "routineNotes"]
        }
      }
    });

    const jsonResponse = response.text;
    if (!jsonResponse) {
      console.error("❌ Gemini response text is undefined.");
      return null;
    }

    let parsedRoutine = null;
    try {
      parsedRoutine = JSON.parse(jsonResponse);
    } catch (err) {
      console.error("❌ Failed to parse Gemini response:", err);
      console.error("Raw response:", jsonResponse);
      return null;
    }

    return parsedRoutine as SkincareRoutine;

  } catch (err) {
    console.error("Gemini request failed:", err);
    return null;
  }
}

export default generateSkincareRoutine;