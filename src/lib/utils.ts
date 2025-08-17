import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { z } from "zod";
import data from "./data";
import { createAdminClient } from '@/lib/server/appwrite'; // Add your Appwrite config import
import { ID } from 'node-appwrite';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const authFormSchema = (type: string) => z.object({
  // sign up
  firstName: type === 'sign-in' ? z.string().optional() : z.string().min(3),
  lastName: type === 'sign-in' ? z.string().optional() : z.string().min(3),
  // both
  email: z.string().email(),
  password: z.string().min(8),
})

export const parseStringify = (value: unknown) => JSON.parse(JSON.stringify(value));

export function extractPrice(...elements: any[]) {
  for (const element of elements) {
    if (!element || typeof element.text !== 'function') continue;

    const priceText = element.first().text().trim(); // Safely get first match

    if (priceText) {
      const cleanPrice = priceText.replace(/[^\d.]/g, '');

      // Match decimal price if available
      const matched = cleanPrice.match(/\d+\.\d{2}/);
      return matched ? matched[0] : cleanPrice;
    }
  }

  return '';
}

export function extractCurrency(element: any) {
  const currencyText = element.text().trim().slice(0, 1);
  return currencyText ? currencyText : "";
}

export function extractDescription($: any) {
  const selectors = [
    ".a-unordered-list .a-list-item",
    ".a-expander-content p",
    // Add more selectors here if needed
  ];

  for (const selector of selectors) {
    const elements = $(selector);
    if (elements.length > 0) {
      const textContent = elements
        .map((_: any, element: any) => $(element).text().trim())
        .get()
        .join("\n");
      return textContent;
    }
  }

  return "";
}

import * as cheerio from 'cheerio';

export function extractIngredientsFromEmbeddedJson($: cheerio.CheerioAPI): string {
  let rawJson = '';
  
  $('script').each((_, el) => {
    const content = $(el).html();
    //console.log(content);
    if (content && content.includes('"ingredients"')) {
      rawJson = content;
    }
    //console.log(rawJson);
  });

  if (!rawJson) return '';

  try {
    const match = rawJson.match(/{.*}/s);
    //console.log(match);
    if (!match) return '';

    const jsonObj = JSON.parse(match[0]);
    const ingredients = jsonObj.productPage.product.ingredients || jsonObj.ingredients || '';
    //console.log(ingredients);

    const ingredientsText = cheerio.load(ingredients).text().trim();

    return ingredientsText;
  } catch (e) {
    console.error('Error parsing ingredients JSON:', e);
    return '';
  }
}

export const formatNumber = (num: number = 0) => {
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

/**
 * Helper function to safely parse JSON (keeping your existing function)
 */
export function cleanGeminiResponse(response: string): string {
  return response
    .replace(/```json\s*/g, "") // remove ```json
    .replace(/```/g, "")        // remove ```
    .replace(/\n/g, " ")        // normalize newlines
    .replace(/,\s*}/g, "}")     // remove trailing commas before }
    .replace(/,\s*]/g, "]")     // remove trailing commas before ]
    .trim();
}

export function findMatchingSkinProfile(skinType: string, skinConcern: string, commitmentLevel: string, preferredProducts: string) {
  return data.find(profile => 
    profile["Skin type"] === skinType &&
    profile["Concern"] === skinConcern &&
    profile["Commitment Level"] === commitmentLevel &&
    profile["Preferred Skincare Ingredients/Products"] === preferredProducts
  );
}

export function extractKeyIngredients(profile: any): string[] {
  if (!profile["Essential Ingredients to Look For"]) return [];
  
  return profile["Essential Ingredients to Look For"]
    .split('•')
    .map((ingredient: string) => ingredient.trim())
    .filter((ingredient: string) => ingredient.length > 0);
}
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID!;
const COLLECTION_ID = process.env.APPWRITE_USERPROFILE_COLLECTION_ID!; // Your routines collection ID
// Function to save routine to Appwrite
export async function saveRoutineToDatabase(
  skinType: string,
  skinConcern: string,
  routineType: string,
  generatedRoutine: string
) {
  try {
    const { database } = await createAdminClient();
    const document = await database.createDocument(
      DATABASE_ID!,
      COLLECTION_ID!,
      ID.unique(),
      {
        skinType,
        skinConcern,
        routineType,
        generatedRoutine,
        createdAt: new Date().toISOString()
      }
    );
    
    console.log('✅ Routine saved to database:', document.$id);
    return document;
  } catch (error) {
    console.error('❌ Failed to save routine to database:', error);
    throw error;
  }
}
