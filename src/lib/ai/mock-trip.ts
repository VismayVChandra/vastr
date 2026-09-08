import type { WardrobeItem } from "@/types/wardrobe";
import type { TripItem, MissingTripItem } from "@/types/shop";

interface TripPackingInput {
  destination: string;
  durationDays: number;
  activities: string[];
  wardrobe: WardrobeItem[];
}

interface PackingRule {
  label: string;
  categories: string[];
  quantity: (days: number) => number;
  when?: (activities: string[]) => boolean;
}

const BASE_RULES: PackingRule[] = [
  { label: "Tops", categories: ["Shirts", "T-Shirts", "Tops"], quantity: (d) => Math.min(d, 6) },
  { label: "Bottoms", categories: ["Jeans", "Trousers", "Shorts", "Skirts"], quantity: (d) => Math.max(2, Math.ceil(d / 2)) },
  { label: "Shoes", categories: ["Shoes"], quantity: () => 2 },
  { label: "Accessories", categories: ["Accessories"], quantity: () => 1 },
];

function activitiesInclude(activities: string[], ...keywords: string[]): boolean {
  const text = activities.join(" ").toLowerCase();
  return keywords.some((k) => text.includes(k));
}

export function mockPlanTripPacking(input: TripPackingInput): {
  packingList: TripItem[];
  missingItems: MissingTripItem[];
} {
  const rules = [...BASE_RULES];

  if (activitiesInclude(input.activities, "party", "dinner", "wedding", "night out", "date")) {
    rules.push({
      label: "Evening outfit",
      categories: ["Dresses", "Shirts", "Jackets"],
      quantity: () => 1,
    });
  }
  if (activitiesInclude(input.activities, "beach", "pool", "swim", "goa")) {
    rules.push({ label: "Swimwear", categories: ["Other", "Shorts"], quantity: () => 1 });
  }
  if (activitiesInclude(input.activities, "hike", "trek", "sport", "gym", "workout")) {
    rules.push({ label: "Activewear", categories: ["T-Shirts", "Shorts", "Shoes"], quantity: () => 1 });
  }
  if (activitiesInclude(input.activities, "business", "meeting", "conference", "work")) {
    rules.push({ label: "Formal wear", categories: ["Shirts", "Trousers", "Jackets"], quantity: () => 1 });
  }
  if (input.durationDays >= 4) {
    rules.push({ label: "Jacket / layer", categories: ["Jackets", "Sweaters"], quantity: () => 1 });
  }

  const used = new Set<string>();
  const packingList: TripItem[] = [];
  const missingItems: MissingTripItem[] = [];

  for (const rule of rules) {
    const need = rule.quantity(input.durationDays);
    const candidates = input.wardrobe
      .filter((i) => rule.categories.includes(i.category) && !used.has(i.id))
      .sort((a, b) => a.timesWorn - b.timesWorn);

    const picked = candidates.slice(0, need);
    picked.forEach((i) => used.add(i.id));

    packingList.push({
      label: rule.label,
      quantity: need,
      fromWardrobeItemIds: picked.map((i) => i.id),
      fulfilled: picked.length >= need,
    });

    if (picked.length < need) {
      missingItems.push({
        label: rule.label,
        reason: `You only have ${picked.length} of the ${need} ${rule.label.toLowerCase()} recommended for this trip.`,
      });
    }
  }

  return { packingList, missingItems };
}
