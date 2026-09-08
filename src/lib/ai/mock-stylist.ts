import type { WardrobeItem, Formality } from "@/types/wardrobe";
import type { StylistContext, GeneratedOutfit, StylistResult } from "./stylist-context";

const FORMALITY_RANK: Record<Formality, number> = {
  "very casual": 0,
  casual: 1,
  "smart casual": 2,
  "semi-formal": 3,
  formal: 4,
};

const OCCASION_KEYWORDS: Array<{ keywords: string[]; formality: Formality }> = [
  { keywords: ["interview", "formal event", "wedding", "gala"], formality: "formal" },
  { keywords: ["office", "work", "presentation", "meeting", "client"], formality: "semi-formal" },
  { keywords: ["dinner", "date", "party", "night out", "birthday", "college"], formality: "smart casual" },
  { keywords: ["gym", "badminton", "sport", "run", "workout", "trek", "hike"], formality: "very casual" },
  { keywords: ["casual", "weekend", "errand", "hangout", "friend"], formality: "casual" },
];

const TOP_CATEGORIES = ["Shirts", "T-Shirts", "Tops", "Sweaters"];
const BOTTOM_CATEGORIES = ["Jeans", "Trousers", "Shorts", "Skirts"];
const OUTER_CATEGORIES = ["Jackets"];
const FULL_BODY_CATEGORIES = ["Dresses"];

function inferFormality(query: string, explicitConstraints: string[]): Formality | null {
  const text = `${query} ${explicitConstraints.join(" ")}`.toLowerCase();
  if (text.includes("formal")) return "formal";
  if (text.includes("casual") && !text.includes("smart casual")) return "casual";
  for (const entry of OCCASION_KEYWORDS) {
    if (entry.keywords.some((k) => text.includes(k))) return entry.formality;
  }
  return null;
}

function weatherWantsLayer(weather: StylistContext["weather"]): boolean {
  return !!weather && weather.tempC < 20;
}

function weatherIsHot(weather: StylistContext["weather"]): boolean {
  return !!weather && weather.tempC >= 30;
}

function weatherIsRainy(weather: StylistContext["weather"]): boolean {
  return !!weather && weather.isRain;
}

function scoreItem(
  item: WardrobeItem,
  ctx: StylistContext,
  targetFormality: Formality | null,
  avoidIds: Set<string>
): number {
  let score = 0;

  if (targetFormality) {
    const diff = Math.abs(FORMALITY_RANK[item.formality] - FORMALITY_RANK[targetFormality]);
    score += (2 - Math.min(diff, 2)) * 3;
  }

  const favColors = ctx.preferences.favoriteColors.map((c) => c.toLowerCase());
  const dislikedColors = ctx.preferences.dislikedColors.map((c) => c.toLowerCase());
  const color = item.primaryColor.toLowerCase();
  if (favColors.includes(color)) score += 3;
  if (dislikedColors.includes(color)) score -= 6;

  const preferredStyles = ctx.preferences.preferredStyles.map((s) => s.toLowerCase());
  const overlap = item.styleTags.filter((t) => preferredStyles.includes(t.toLowerCase())).length;
  score += overlap * 2;

  if (weatherIsHot(ctx.weather)) {
    if (["Jackets", "Sweaters"].includes(item.category)) score -= 8;
    if (item.season.includes("summer")) score += 2;
  }
  if (weatherWantsLayer(ctx.weather)) {
    if (["Jackets", "Sweaters"].includes(item.category)) score += 3;
    if (item.season.includes("winter") || item.season.includes("autumn")) score += 1;
  }
  if (weatherIsRainy(ctx.weather)) {
    if (item.material?.toLowerCase().includes("suede")) score -= 6;
    if (item.category === "Shoes") score += item.material?.toLowerCase().includes("leather") ? 1 : 0;
  }

  const query = ctx.query.toLowerCase();
  if (query.includes("comfortable") || query.includes("walking")) {
    if (item.fit === "relaxed" || item.fit === "regular") score += 1;
    if (item.category === "Shoes" && item.styleTags.includes("versatile")) score += 1;
  }
  if (query.includes("no jeans") && item.category === "Jeans") score -= 20;
  if (query.includes("no dress") && item.category === "Dresses") score -= 20;

  if (item.favorite) score += 1.5;

  const daysSinceWorn = item.lastWornAt
    ? (Date.now() - new Date(item.lastWornAt).getTime()) / 86400000
    : 999;
  score += Math.min(daysSinceWorn / 10, 3);

  if (avoidIds.has(item.id)) score -= 15;

  return score;
}

function topPicksForCategory(
  items: WardrobeItem[],
  categories: string[],
  ctx: StylistContext,
  targetFormality: Formality | null,
  avoidIds: Set<string>,
  n: number
): WardrobeItem[] {
  return items
    .filter((i) => categories.includes(i.category))
    .map((i) => ({ item: i, score: scoreItem(i, ctx, targetFormality, avoidIds) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.item);
}

function describeReason(
  name: string,
  targetFormality: Formality | null,
  ctx: StylistContext
): string {
  const bits: string[] = [];
  if (targetFormality) bits.push(`matches a ${targetFormality} dress code`);
  if (ctx.weather) {
    if (weatherIsHot(ctx.weather)) bits.push("stays breathable in the heat");
    else if (weatherWantsLayer(ctx.weather)) bits.push("keeps you warm at the current temperature");
    if (weatherIsRainy(ctx.weather)) bits.push("avoids materials that don't hold up in rain");
  }
  if (ctx.preferences.preferredStyles.length) {
    bits.push(`leans into your ${ctx.preferences.preferredStyles[0]} style`);
  }
  const detail = bits.length ? bits.join(", ") : "pulls together well from pieces you already own";
  return `The ${name} look ${detail}.`;
}

export function generateOutfitsMock(ctx: StylistContext): StylistResult {
  const targetFormality = inferFormality(ctx.query, ctx.constraints);
  const avoidIds = new Set(
    ctx.recentOutfits
      .slice(0, 2)
      .flatMap((o) => o.itemIds)
  );

  const active = ctx.wardrobe.filter((i) => !i.archived);
  const looks: { name: string; slot: number }[] = [
    { name: "Recommended", slot: 0 },
    { name: "Alternate", slot: 1 },
    { name: "Relaxed", slot: 2 },
  ].slice(0, Math.max(1, ctx.count));

  const outfits: GeneratedOutfit[] = [];
  const usedCombos = new Set<string>();

  for (const look of looks) {
    const missing: GeneratedOutfit["missingItems"] = [];
    const itemIds: string[] = [];

    const dresses = topPicksForCategory(active, FULL_BODY_CATEGORIES, ctx, targetFormality, avoidIds, 3);
    const useDress = dresses.length > 0 && look.slot % 2 === 1;

    if (useDress) {
      itemIds.push(dresses[Math.min(look.slot, dresses.length - 1)].id);
    } else {
      const tops = topPicksForCategory(active, TOP_CATEGORIES, ctx, targetFormality, avoidIds, 3);
      const bottoms = topPicksForCategory(active, BOTTOM_CATEGORIES, ctx, targetFormality, avoidIds, 3);

      if (tops.length === 0) {
        missing.push({
          category: "Tops",
          description: "A versatile top",
          reason: "Your wardrobe doesn't have a top that fits this look yet.",
        });
      } else {
        itemIds.push(tops[Math.min(look.slot, tops.length - 1)].id);
      }

      if (bottoms.length === 0) {
        missing.push({
          category: "Bottoms",
          description: "A pair of trousers or jeans",
          reason: "Your wardrobe doesn't have a bottom that fits this look yet.",
        });
      } else {
        itemIds.push(bottoms[Math.min(look.slot, bottoms.length - 1)].id);
      }
    }

    const shoes = topPicksForCategory(active, ["Shoes"], ctx, targetFormality, avoidIds, 3);
    if (shoes.length === 0) {
      missing.push({
        category: "Shoes",
        description: "A pair of shoes to match",
        reason: "No shoes in your wardrobe suit this occasion yet.",
      });
    } else {
      itemIds.push(shoes[Math.min(look.slot, shoes.length - 1)].id);
    }

    if (weatherWantsLayer(ctx.weather)) {
      const outer = topPicksForCategory(active, OUTER_CATEGORIES, ctx, targetFormality, avoidIds, 2);
      if (outer.length > 0) itemIds.push(outer[Math.min(look.slot, outer.length - 1)].id);
    }

    if (look.slot === 0) {
      const accessories = topPicksForCategory(active, ["Accessories"], ctx, targetFormality, avoidIds, 1);
      if (accessories.length > 0) itemIds.push(accessories[0].id);
    }

    const comboKey = [...itemIds].sort().join(",");
    if (itemIds.length === 0 || usedCombos.has(comboKey)) continue;
    usedCombos.add(comboKey);

    outfits.push({
      name: `${look.name}${targetFormality ? ` — ${targetFormality}` : ""}`,
      itemIds,
      reason: describeReason(look.name, targetFormality, ctx),
      missingItems: missing,
    });
  }

  if (outfits.length === 0) {
    outfits.push({
      name: "Getting started",
      itemIds: [],
      reason: "Add a few wardrobe items — tops, bottoms, and shoes — so I can start building outfits for you.",
      missingItems: [
        { category: "Wardrobe", description: "A few basics", reason: "Your wardrobe is still empty." },
      ],
    });
  }

  return {
    outfits,
    message: "Here's what I'd put together from your wardrobe.",
    isMock: true,
  };
}
