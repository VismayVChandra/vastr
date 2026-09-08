import type { WardrobeItem } from "@/types/wardrobe";

export function resolveItems(wardrobe: WardrobeItem[], itemIds: string[]): WardrobeItem[] {
  const byId = new Map(wardrobe.map((i) => [i.id, i]));
  return itemIds.map((id) => byId.get(id)).filter((i): i is WardrobeItem => Boolean(i));
}
