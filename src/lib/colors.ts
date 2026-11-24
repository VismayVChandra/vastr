export const COLOR_PALETTE = [
  "Black",
  "White",
  "Grey",
  "Beige",
  "Brown",
  "Navy",
  "Blue",
  "Light Blue",
  "Green",
  "Olive",
  "Red",
  "Burgundy",
  "Pink",
  "Purple",
  "Yellow",
  "Orange",
  "Cream",
  "Silver",
  "Gold",
] as const;

export const COLOR_SWATCH: Record<string, string> = {
  Black: "#1c1917",
  White: "#f5f5f4",
  Grey: "#9ca3af",
  Beige: "#d6cfc2",
  Brown: "#5b4636",
  Navy: "#1e293b",
  Blue: "#3b5f8a",
  "Light Blue": "#a7c7e7",
  Green: "#4b6b4a",
  Olive: "#6b6b3a",
  Red: "#a13a3a",
  Burgundy: "#6d2331",
  Pink: "#e0a5b0",
  Purple: "#6b4c7a",
  Yellow: "#d8b94b",
  Orange: "#c1663d",
  Cream: "#f0e9d8",
  Silver: "#c4c4c4",
  Gold: "#c9a24b",
};

export function swatchFor(color: string): string {
  return COLOR_SWATCH[color] ?? "#9ca3af";
}

/** Maps a free-form colour from AI ("navy blue", "off-white") onto the palette
 *  so selects show a value and swatches render. Unknown colours pass through. */
export function normalizeColor(raw: string): string {
  const lower = raw.trim().toLowerCase();
  const exact = COLOR_PALETTE.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;
  const contained = COLOR_PALETTE.filter((c) => lower.includes(c.toLowerCase())).sort(
    (a, b) => b.length - a.length
  );
  if (contained.length > 0) return contained[0];
  return raw.trim().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}
