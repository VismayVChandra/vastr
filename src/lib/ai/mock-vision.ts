import type { AIVisionResult, ClothingCategory, Fit, Formality, Season } from "@/types/wardrobe";
import { CLOTHING_CATEGORIES, FITS, FORMALITY_LEVELS } from "@/types/wardrobe";
import { COLOR_PALETTE } from "@/lib/colors";

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function pick<T>(arr: readonly T[], seed: number, salt: number): T {
  return arr[(seed + salt) % arr.length];
}

const SUBCATEGORY_BY_CATEGORY: Record<ClothingCategory, string[]> = {
  "T-Shirts": ["Crew neck tee", "V-neck tee", "Graphic tee"],
  Shirts: ["Oxford shirt", "Flannel shirt", "Linen shirt", "Denim shirt"],
  Tops: ["Blouse", "Tank top", "Bodysuit"],
  Jeans: ["Straight fit", "Slim fit", "Wide leg"],
  Trousers: ["Chinos", "Tailored trousers", "Cargo trousers"],
  Shorts: ["Chino shorts", "Denim shorts"],
  Jackets: ["Overshirt", "Bomber jacket", "Denim jacket", "Blazer"],
  Sweaters: ["Crew sweater", "Cardigan", "Turtleneck"],
  Dresses: ["Midi dress", "Wrap dress", "Slip dress"],
  Skirts: ["A-line skirt", "Pleated skirt"],
  Shoes: ["Low-top sneakers", "Loafers", "Boots", "Sandals"],
  Accessories: ["Watch", "Belt", "Cap", "Scarf"],
  Other: ["Item"],
};

const STYLE_BY_FORMALITY: Record<Formality, string[]> = {
  "very casual": ["casual", "sporty"],
  casual: ["casual", "streetwear", "versatile"],
  "smart casual": ["smart casual", "minimal", "versatile"],
  "semi-formal": ["office", "smart casual"],
  formal: ["formal", "office"],
};

/** Deterministic, offline stand-in for real vision analysis. Picks plausible
 *  attributes (optionally nudged by hints from the filename) so the app stays
 *  fully demoable without an AI API key configured. */
export function mockAnalyzeImage(fileName: string, fileSizeBytes: number): AIVisionResult {
  const seed = hashString(fileName) + fileSizeBytes;

  const lowerName = fileName.toLowerCase();
  const categoryFromName = CLOTHING_CATEGORIES.find((c) =>
    lowerName.includes(c.toLowerCase().replace(/s$/, ""))
  );
  const colorFromName = COLOR_PALETTE.find((c) => lowerName.includes(c.toLowerCase()));

  const category = categoryFromName ?? pick(CLOTHING_CATEGORIES, seed, 1);
  const primaryColor = colorFromName ?? pick(COLOR_PALETTE, seed, 3);
  const fit: Fit = pick(FITS, seed, 5);
  const formality: Formality = pick(FORMALITY_LEVELS, seed, 7);
  const subcategory = pick(SUBCATEGORY_BY_CATEGORY[category], seed, 9);
  const season: Season[] = ["all-season"];
  const styleTags = STYLE_BY_FORMALITY[formality];

  return {
    category,
    subcategory,
    primaryColor,
    secondaryColors: [],
    pattern: "solid",
    material: "Cotton blend",
    fit,
    formality,
    season,
    styleTags,
    suggestedName: `${primaryColor} ${subcategory}`,
    confidence: 0.35,
  };
}
