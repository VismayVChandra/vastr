import type { WardrobeFilters, WardrobeItem } from "@/types/wardrobe";

export function filterWardrobeItems(items: WardrobeItem[], filters: WardrobeFilters): WardrobeItem[] {
  let result = items;

  if (filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    result = result.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.brand?.toLowerCase().includes(q) ||
        i.primaryColor.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
    );
  }
  if (filters.category !== "All") {
    result = result.filter((i) => i.category === filters.category);
  }
  if (filters.color !== "All") {
    result = result.filter((i) => i.primaryColor === filters.color);
  }
  const style = filters.style;
  if (style !== "All") {
    result = result.filter((i) => (i.styleTags as string[]).includes(style));
  }
  const season = filters.season;
  if (season !== "All") {
    result = result.filter((i) => i.season.includes(season));
  }

  const sorted = [...result];
  switch (filters.sort) {
    case "most-worn":
      sorted.sort((a, b) => b.timesWorn - a.timesWorn);
      break;
    case "least-worn":
      sorted.sort((a, b) => a.timesWorn - b.timesWorn);
      break;
    case "never-worn":
      return sorted.filter((i) => i.timesWorn === 0);
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "recent":
    default:
      sorted.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  return sorted;
}
