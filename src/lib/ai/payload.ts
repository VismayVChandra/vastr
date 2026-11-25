import { isDemoSession } from "@/lib/demo";
import type { WardrobeItem } from "@/types/wardrobe";
import type { Outfit } from "@/types/outfit";
import type { UserProfile } from "@/types/user";
import type { WeatherSnapshot } from "@/types/weather";

/** What every stylist request sends: the wardrobe, preferences, weather and the outfits worth learning from. */
export function buildStylistPayload({
  items,
  outfits,
  profile,
  weather,
}: {
  items: WardrobeItem[];
  outfits: Outfit[];
  profile: UserProfile | null;
  weather: WeatherSnapshot | null;
}) {
  // The server never looks at photos, and in demo mode they're inline data URLs
  // that can blow past the request size limit, so leave them out.
  const wardrobe = items.map((i) => ({ ...i, imageUrl: null }));

  // Newest few for variety, plus everything the user rated or wore so the stylist can learn from it.
  const withSignal = outfits.filter((o) => o.rating || o.wornAt.length > 0).slice(0, 80);
  const seen = new Set<string>();
  const recentOutfits = [...outfits.slice(0, 5), ...withSignal].filter((o) => {
    if (seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });

  return {
    wardrobe,
    preferences: profile?.preferences,
    weather,
    recentOutfits,
    // Guests get the rule-based stylist so the demo never spends AI quota.
    rulesOnly: isDemoSession(),
  };
}
