import type { ClothingCategory, WardrobeItem } from "@/types/wardrobe";
import { daysSince } from "@/lib/utils";

const TOP_CATS: ClothingCategory[] = ["T-Shirts", "Shirts", "Tops", "Sweaters"];
const BOTTOM_CATS: ClothingCategory[] = ["Jeans", "Trousers", "Shorts", "Skirts"];
const OUTER_CATS: ClothingCategory[] = ["Jackets"];
const SHOE_CATS: ClothingCategory[] = ["Shoes"];
const ACCESSORY_CATS: ClothingCategory[] = ["Accessories"];

export interface WornItemInsight {
  item: WardrobeItem;
  detail: string;
}

export interface WardrobeGap {
  headline: string;
  recommendationCategory: ClothingCategory;
  recommendationText: string;
}

export interface WardrobeInsights {
  mostWorn: WornItemInsight[];
  forgotten: WornItemInsight[];
  mostVersatile: WornItemInsight[];
  gaps: WardrobeGap[];
  totalItems: number;
  neverWornCount: number;
}

function countIn(items: WardrobeItem[], cats: ClothingCategory[]): number {
  return items.filter((i) => cats.includes(i.category)).length;
}

function versatilityScore(item: WardrobeItem, all: WardrobeItem[]): number {
  const compatibleFormality = (other: WardrobeItem) =>
    Math.abs(rankFormality(item.formality) - rankFormality(other.formality)) <= 1;

  if (TOP_CATS.includes(item.category)) {
    return all.filter((i) => BOTTOM_CATS.includes(i.category) && compatibleFormality(i)).length +
      all.filter((i) => SHOE_CATS.includes(i.category) && compatibleFormality(i)).length;
  }
  if (BOTTOM_CATS.includes(item.category)) {
    return all.filter((i) => TOP_CATS.includes(i.category) && compatibleFormality(i)).length +
      all.filter((i) => SHOE_CATS.includes(i.category) && compatibleFormality(i)).length;
  }
  if (SHOE_CATS.includes(item.category)) {
    return all.filter((i) => TOP_CATS.includes(i.category) && compatibleFormality(i)).length +
      all.filter((i) => BOTTOM_CATS.includes(i.category) && compatibleFormality(i)).length;
  }
  return all.filter((i) => i.id !== item.id && compatibleFormality(i)).length;
}

function rankFormality(f: WardrobeItem["formality"]): number {
  return ["very casual", "casual", "smart casual", "semi-formal", "formal"].indexOf(f);
}

export function computeInsights(items: WardrobeItem[]): WardrobeInsights {
  const active = items.filter((i) => !i.archived);

  const mostWorn = [...active]
    .filter((i) => i.timesWorn > 0)
    .sort((a, b) => b.timesWorn - a.timesWorn)
    .slice(0, 3)
    .map((item) => ({ item, detail: `Worn ${item.timesWorn} time${item.timesWorn === 1 ? "" : "s"}` }));

  const forgotten = [...active]
    .filter((i) => i.timesWorn > 0 && i.lastWornAt && daysSince(i.lastWornAt) >= 21)
    .sort((a, b) => daysSince(a.lastWornAt!) > daysSince(b.lastWornAt!) ? -1 : 1)
    .slice(0, 3)
    .map((item) => ({
      item,
      detail: `Not worn for ${daysSince(item.lastWornAt!)} days`,
    }));

  const mostVersatile = [...active]
    .map((item) => ({ item, score: versatilityScore(item, active) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ item, score }) => ({ item, detail: `Works with ${score} items you own` }));

  const gaps: WardrobeGap[] = [];
  const tops = countIn(active, TOP_CATS);
  const bottoms = countIn(active, BOTTOM_CATS);
  const outer = countIn(active, OUTER_CATS);
  const shoes = countIn(active, SHOE_CATS);
  const accessories = countIn(active, ACCESSORY_CATS);

  if (tops >= 4 && outer <= 1) {
    gaps.push({
      headline: "You have plenty of tops but very few layering pieces.",
      recommendationCategory: "Jackets",
      recommendationText: `A versatile overshirt or jacket could create ${tops + bottoms}+ new combinations with your existing wardrobe.`,
    });
  }
  if (tops >= 3 && shoes <= 1) {
    gaps.push({
      headline: "Your shoe rotation is limited compared to your tops and bottoms.",
      recommendationCategory: "Shoes",
      recommendationText: "A second pair of versatile shoes would unlock a lot more outfit variety.",
    });
  }
  if (bottoms >= 3 && tops <= 2) {
    gaps.push({
      headline: "You have more bottoms than tops to pair them with.",
      recommendationCategory: "Shirts",
      recommendationText: "A couple more tops would let you get full use out of your bottoms.",
    });
  }
  if (accessories === 0 && active.length >= 4) {
    gaps.push({
      headline: "You don't have any accessories yet.",
      recommendationCategory: "Accessories",
      recommendationText: "A watch or belt is a small addition that elevates almost any outfit.",
    });
  }

  return {
    mostWorn,
    forgotten,
    mostVersatile,
    gaps,
    totalItems: active.length,
    neverWornCount: active.filter((i) => i.timesWorn === 0).length,
  };
}
