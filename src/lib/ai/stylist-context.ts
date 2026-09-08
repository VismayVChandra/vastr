import type { WardrobeItem } from "@/types/wardrobe";
import type { StylePreferences } from "@/types/user";
import type { WeatherSnapshot } from "@/types/weather";
import type { Outfit } from "@/types/outfit";

export interface StylistContext {
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
