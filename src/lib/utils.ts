import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { z } from "zod";
import data from "./data";
import { createAdminClient } from '@/lib/server/appwrite';
import { ID } from 'node-appwrite';
import { SkincareData, UserPreferences } from "@/lib/types";
import * as cheerio from 'cheerio';
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID!;
const COLLECTION_ID = process.env.APPWRITE_USERPROFILE_COLLECTION_ID!; // Your routines collection ID

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

export function exportRoutineReport(
  skincareData: SkincareData,
  userPreferences: UserPreferences,
  doTips: string[],
  dontTips: string[]
) {
  const date = new Date();
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString();

  const esc = (str?: string) =>
  (str ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const renderRoutine = (label: string, steps: any[]) => `
    <h2>${label} Routine</h2>
    <ol>
      ${steps
        .map(
          (s) => `
        <li>
          <strong>${esc(s.product_name)}</strong><br/>
          <em>Why this works:</em> ${esc(s.reasoning)}<br/>
          <em>How to use:</em> ${esc(s.how_to_use)}<br/>
          ${
            s.product_url && s.product_url !== "N/A"
              ? `<span>Link: ${esc(s.product_url)}</span>`
              : ""
          }
        </li>`
        )
        .join("")}
    </ol>
  `;

  // Weekly treatments
  const weekly = skincareData.weekly_treatments?.length
    ? `
    <h2>Weekly Treatments</h2>
    <ul>
      ${skincareData.weekly_treatments
        .map(
          (t) => `
        <li>
          <strong>${esc(t.treatment_type)}</strong><br/>
          ${esc(t.recommendation || "")}<br/>
          <em>How to use:</em> ${esc(t.how_to_use || "")}
        </li>`
        )
        .join("")}
    </ul>`
    : "";

  const tipsHTML = `
    <div class="tips">
      <div>
        <h3>✅ Do's</h3>
        <ul>${doTips.map((tip) => `<li>${esc(tip)}</li>`).join("")}</ul>
      </div>
      <div>
        <h3>❌ Don'ts</h3>
        <ul>${dontTips.map((tip) => `<li>${esc(tip)}</li>`).join("")}</ul>
      </div>
    </div>
  `;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>LesSkyn Routine Report</title>
  <style>
    body { font-family: Arial, sans-serif; color: #222; line-height: 1.6; margin: 20px; }
    h1, h2, h3 { color: #2C264C; }
    ol, ul { padding-left: 20px; }
    li { margin-bottom: 10px; }
    .tips { display: flex; gap: 40px; }
    .tips div { flex: 1; }
    @media print {
      a::after { content: " (" attr(href) ")"; }
      body { margin: 10mm; }
      h2, h3 { page-break-after: avoid; }
      li { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>LesSkyn Personalized Skincare Routine</h1>
  <p><strong>Date:</strong> ${dateStr} ${timeStr}</p>
  <p><strong>Skin Type:</strong> ${esc(userPreferences.skinType)} |
     <strong>Skin Concern:</strong> ${esc(userPreferences.skinConcern)}</p>

  ${renderRoutine("☀️ Morning", skincareData.routine.morning)}
  ${renderRoutine("🌙 Evening", skincareData.routine.evening)}
  ${weekly}
  ${tipsHTML}

  <footer style="margin-top:40px; font-size:0.9em; color:#666;">
    Generated by LesSkyn on ${dateStr} at ${timeStr}
  </footer>
</body>
</html>
`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  const fileName = `LesSkyn-Routine-${userPreferences.skinType}-${userPreferences.skinConcern}-${date.toISOString().split("T")[0]}.html`;

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const validateRequest = (body: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const required = ['skinType', 'skinConcern', 'commitmentLevel', 'preferredProducts'];
  for (const field of required) {
    if (!body[field] || typeof body[field] !== 'string' || body[field].trim() === '') {
      errors.push(`${field} is required and must be a non-empty string`);
    }
  }
  return { isValid: errors.length === 0, errors };
};
