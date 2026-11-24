import { normalizeColor } from "@/lib/colors";
import type { AIVisionResult, WardrobeItemInput } from "@/types/wardrobe";

export function visionToForm(result: AIVisionResult, imageUrl: string | null): WardrobeItemInput {
  return {
    imageUrl,
    name: result.suggestedName,
    category: result.category,
    subcategory: result.subcategory,
    primaryColor: normalizeColor(result.primaryColor),
    secondaryColors: result.secondaryColors.map(normalizeColor),
    pattern: result.pattern,
    material: result.material,
    brand: "",
    size: "",
    fit: result.fit,
    season: result.season,
    formality: result.formality,
    styleTags: result.styleTags,
    favorite: false,
  };
}
