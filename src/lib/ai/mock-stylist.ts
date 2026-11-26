import type { WardrobeItem, Formality } from "@/types/wardrobe";
import type { StylistContext, GeneratedOutfit, StylistResult } from "./stylist-context";
import { FORMALITY_RANK, comboKey, pairKey } from "@/lib/taste/learn";

export const OCCASION_KEYWORDS: Array<{ keywords: string[]; formality: Formality }> = [
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

export function inferFormality(query: string, explicitConstraints: string[]): Formality | null {
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

/** The formality to aim for: the stated occasion, nudged by what the user has said was too formal/casual. */
function effectiveTargetRank(targetFormality: Formality | null, ctx: StylistContext): number | null {
  const shift = (ctx.taste?.formalityShift ?? 0) + (ctx.formalityNudge ?? 0);
  if (!targetFormality && Math.abs(shift) < 0.3) return null;
  const base = targetFormality ? FORMALITY_RANK[targetFormality] : 2;
  return Math.max(0, Math.min(4, base + shift));
}

function scoreItem(
  item: WardrobeItem,
  ctx: StylistContext,
  targetRank: number | null,
  avoidIds: Set<string>
): number {
  let score = 0;

  if (targetRank !== null) {
    const diff = Math.abs(FORMALITY_RANK[item.formality] - targetRank);
    score += (2 - Math.min(diff, 2)) * 3;
  }

  const taste = ctx.taste;
  if (taste) {
    score += (taste.itemAffinity[item.id] ?? 0) * 2;
    score += (taste.colorAffinity[item.primaryColor.toLowerCase()] ?? 0) * 1.5;
    for (const tag of item.styleTags as string[]) {
      score += (taste.styleAffinity[tag.toLowerCase()] ?? 0) * 0.8;
    }
  }

  const favColors = ctx.preferences.favoriteColors.map((c) => c.toLowerCase());
  const dislikedColors = ctx.preferences.dislikedColors.map((c) => c.toLowerCase());
  const color = item.primaryColor.toLowerCase();
  if (favColors.includes(color)) score += 3;
  if (dislikedColors.includes(color)) score -= 6;

  // What suits this person: flattering colours, and cuts they've been told to favour or avoid.
  const fit = ctx.preferences.fitProfile;
  if (fit) {
    if (fit.bestColors.map((c) => c.toLowerCase()).includes(color)) score += 2;
    if (fit.avoidColors.map((c) => c.toLowerCase()).includes(color)) score -= 3;
    const mentions = (list: string[]) => list.some((s) => s.toLowerCase().includes(item.fit));
    if (mentions(fit.suits)) score += 1.5;
    if (mentions(fit.avoid)) score -= 2;
  }

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
  targetRank: number | null,
  avoidIds: Set<string>,
  n: number,
  /** Extra score for an item given what's already in the look (e.g. pairings the user disliked). */
  bonus?: (item: WardrobeItem) => number
): WardrobeItem[] {
  return items
    .filter((i) => categories.includes(i.category))
    .map((i) => ({ item: i, score: scoreItem(i, ctx, targetRank, avoidIds) + (bonus?.(i) ?? 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.item);
}

/** How well a candidate goes with the pieces already chosen, from past ratings. */
function pairBonus(ctx: StylistContext, chosenIds: string[]) {
  return (item: WardrobeItem) => {
    const pairs = ctx.taste?.pairAffinity;
    if (!pairs || chosenIds.length === 0) return 0;
    return chosenIds.reduce((sum, id) => sum + (pairs[pairKey(id, item.id)] ?? 0), 0) * 2.5;
  };
}

function describeReason(
  name: string,
  targetFormality: Formality | null,
  ctx: StylistContext
): string {
  const bits: string[] = [];
  if (targetFormality) bits.push(`matches a ${targetFormality} dress code`);
  if ((ctx.taste?.signalCount ?? 0) > 0) bits.push("is tuned to the looks you've rated");
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
  const targetRank = effectiveTargetRank(targetFormality, ctx);
  // Variety: don't serve the last couple of looks again. Rated looks are exempt
  // (the taste profile already handles them, and a look you loved shouldn't be
  // pushed away) unless they were actually worn.
  const avoidIds = new Set([
    ...ctx.recentOutfits
      .slice(0, 2)
      .filter((o) => !o.rating || o.wornAt.length > 0)
      .flatMap((o) => o.itemIds),
    ...(ctx.avoidItemIds ?? []),
  ]);

  const active = ctx.wardrobe.filter((i) => !i.archived);
  const looks: { name: string; slot: number }[] = [
    { name: "Recommended", slot: 0 },
    { name: "Alternate", slot: 1 },
    { name: "Relaxed", slot: 2 },
  ].slice(0, Math.max(1, ctx.count));

  const outfits: GeneratedOutfit[] = [];
  // Looks the user already said "not for me" to are never served again.
  const usedCombos = new Set<string>(ctx.taste?.avoidCombos ?? []);

  for (const look of looks) {
    const missing: GeneratedOutfit["missingItems"] = [];
    const itemIds: string[] = [];

    const dresses = topPicksForCategory(active, FULL_BODY_CATEGORIES, ctx, targetRank, avoidIds, 3);
    const useDress = dresses.length > 0 && look.slot % 2 === 1;

    if (useDress) {
      itemIds.push(dresses[Math.min(look.slot, dresses.length - 1)].id);
    } else {
      const tops = topPicksForCategory(active, TOP_CATEGORIES, ctx, targetRank, avoidIds, 3);

      if (tops.length === 0) {
        missing.push({
          category: "Tops",
          description: "A versatile top",
          reason: "Your wardrobe doesn't have a top that fits this look yet.",
        });
      } else {
        itemIds.push(tops[Math.min(look.slot, tops.length - 1)].id);
      }

      // Bottoms are scored against the chosen top so disliked pairings drop out.
      const bottoms = topPicksForCategory(
        active,
        BOTTOM_CATEGORIES,
        ctx,
        targetRank,
        avoidIds,
        3,
        pairBonus(ctx, itemIds)
      );

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

    const shoes = topPicksForCategory(active, ["Shoes"], ctx, targetRank, avoidIds, 3, pairBonus(ctx, itemIds));
    if (shoes.length === 0) {
      missing.push({
        category: "Shoes",
        description: "A pair of shoes to match",
        reason: "No shoes in your wardrobe suit this occasion yet.",
      });
    } else {
      itemIds.push(shoes[Math.min(look.slot, shoes.length - 1)].id);
    }

    // A jacket for the cold, and for dressy occasions where a blazer finishes the look.
    const dressy = targetRank !== null && targetRank >= 3;
    if (weatherWantsLayer(ctx.weather) || dressy) {
      const outer = topPicksForCategory(active, OUTER_CATEGORIES, ctx, targetRank, avoidIds, 2, pairBonus(ctx, itemIds));
      if (outer.length > 0) itemIds.push(outer[Math.min(look.slot, outer.length - 1)].id);
    }

    if (look.slot === 0) {
      const accessories = topPicksForCategory(active, ["Accessories"], ctx, targetRank, avoidIds, 1, pairBonus(ctx, itemIds));
      if (accessories.length > 0) itemIds.push(accessories[0].id);
    }

    const key = comboKey(itemIds);
    if (itemIds.length === 0 || usedCombos.has(key)) continue;
    usedCombos.add(key);

    outfits.push({
      name: `${look.name}${targetFormality ? ` — ${targetFormality}` : ""}`,
      itemIds,
      reason: describeReason(look.name, targetFormality, ctx),
      missingItems: missing,
    });
  }

  // Every candidate was a look they'd rejected: better to repeat one than say the wardrobe is empty.
  if (outfits.length === 0 && active.length > 0 && ctx.taste?.avoidCombos.length) {
    return generateOutfitsMock({ ...ctx, taste: { ...ctx.taste, avoidCombos: [] } });
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
