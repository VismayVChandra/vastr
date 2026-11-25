import type { WardrobeItem } from "@/types/wardrobe";
import type { StylePreferences } from "@/types/user";
import type { WeatherSnapshot } from "@/types/weather";
import type { Outfit } from "@/types/outfit";
import type { TasteProfile } from "@/lib/taste/learn";

export interface StylistContext {
  /** Chat refinements: shift the target formality up (+) or down (-) for this request only. */
  formalityNudge?: number;
  /** Items to steer away from (for example the ones the user just asked to swap out). */
  avoidItemIds?: string[];
  /** Skip the AI model and use the built-in rule-based stylist (guest demo, no quota spent). */
  rulesOnly?: boolean;
  /** Learned from past ratings and wears; computed server-side from recentOutfits. */
  taste?: TasteProfile;
  wardrobe: WardrobeItem[];
  preferences: StylePreferences;
  weather: WeatherSnapshot | null;
  query: string;
  constraints: string[];
  recentOutfits: Outfit[];
  count: number;
}

export interface GeneratedOutfit {
  name: string;
  itemIds: string[];
  reason: string;
  missingItems: { category: string; description: string; reason: string }[];
}

export interface StylistResult {
  outfits: GeneratedOutfit[];
  message: string;
  isMock: boolean;
}
