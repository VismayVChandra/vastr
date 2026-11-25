import type { WardrobeItem, Formality } from "@/types/wardrobe";
import type { Outfit } from "@/types/outfit";

/**
 * Turns a user's outfit ratings and wears into a taste profile that the
 * stylist (rule-based and AI) uses on the next request. Pure and deterministic,
 * so it runs the same on the client (for the "What Vastr learned" card) and on
 * the server (when building recommendations).
 */

export const FORMALITY_RANK: Record<Formality, number> = {
  "very casual": 0,
  casual: 1,
  "smart casual": 2,
  "semi-formal": 3,
  formal: 4,
};

export interface TasteInsight {
  kind: "love" | "avoid" | "formality" | "combo";
  text: string;
}

export interface TasteProfile {
  /** Outfits that contributed (rated or worn). */
  signalCount: number;
  /** Outfits with an explicit rating. */
  ratedCount: number;
  itemAffinity: Record<string, number>;
  colorAffinity: Record<string, number>;
  styleAffinity: Record<string, number>;
  /** Keyed by pairKey(a, b). */
  pairAffinity: Record<string, number>;
  /** Negative: user wants things dressed down. Positive: dressed up. Roughly -1.5..1.5. */
  formalityShift: number;
  /** comboKey() of outfits the user said "not for me" to, so they're never repeated. */
  avoidCombos: string[];
  insights: TasteInsight[];
}

export const EMPTY_TASTE: TasteProfile = {
  signalCount: 0,
  ratedCount: 0,
  itemAffinity: {},
  colorAffinity: {},
  styleAffinity: {},
  pairAffinity: {},
  formalityShift: 0,
  avoidCombos: [],
  insights: [],
};

const NEUTRAL_COLORS = new Set([
  "black",
  "white",
  "grey",
  "gray",
  "beige",
  "cream",
  "ivory",
  "tan",
  "khaki",
  "brown",
  "charcoal",
  "off-white",
]);

const HALF_LIFE_DAYS = 60;
const CLAMP = 3;
const INSIGHT_THRESHOLD = 1.2;

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function comboKey(itemIds: string[]): string {
  return [...itemIds].sort().join(",");
}

function bump(map: Record<string, number>, key: string, amount: number) {
  map[key] = (map[key] ?? 0) + amount;
}

function clampAll(map: Record<string, number>) {
  for (const k of Object.keys(map)) {
    map[k] = Math.max(-CLAMP, Math.min(CLAMP, map[k]));
  }
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function joinList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function topBy(map: Record<string, number>, sign: 1 | -1, n: number): [string, number][] {
  return Object.entries(map)
    .filter(([, v]) => (sign === 1 ? v >= INSIGHT_THRESHOLD : v <= -INSIGHT_THRESHOLD))
    .sort((a, b) => (sign === 1 ? b[1] - a[1] : a[1] - b[1]))
    .slice(0, n);
}

export function learnTaste(
  outfits: Outfit[],
  items: WardrobeItem[],
  now: number = Date.now()
): TasteProfile {
  const byId = new Map(items.map((i) => [i.id, i]));

  const itemAffinity: Record<string, number> = {};
  const colorAffinity: Record<string, number> = {};
  const styleAffinity: Record<string, number> = {};
  const pairAffinity: Record<string, number> = {};
  const avoidCombos = new Set<string>();
  let formalitySignal = 0;
  let signalCount = 0;
  let ratedCount = 0;

  for (const outfit of outfits) {
    const rating = outfit.rating;
    const worn = outfit.wornAt.length > 0;
    if (!rating && !worn) continue;

    const pieces = outfit.itemIds
      .map((id) => byId.get(id))
      .filter((i): i is WardrobeItem => Boolean(i));
    if (pieces.length === 0) continue;

    signalCount += 1;
    if (rating) ratedCount += 1;

    const stamp = new Date(outfit.updatedAt || outfit.createdAt).getTime();
    const ageDays = Number.isFinite(stamp) ? Math.max(0, (now - stamp) / 86400000) : 0;
    const w = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);

    const addItems = (amount: number) => pieces.forEach((p) => bump(itemAffinity, p.id, amount * w));
    const addColors = (amount: number) =>
      pieces.forEach((p) => bump(colorAffinity, p.primaryColor.toLowerCase(), amount * w));
    const addStyles = (amount: number) =>
      pieces.forEach((p) =>
        (p.styleTags as string[]).forEach((t) => bump(styleAffinity, t.toLowerCase(), (amount * w) / 2))
      );
    const addPairs = (amount: number) => {
      for (let i = 0; i < pieces.length; i++) {
        for (let j = i + 1; j < pieces.length; j++) {
          bump(pairAffinity, pairKey(pieces[i].id, pieces[j].id), amount * w);
        }
      }
    };

    // Wearing an outfit is a quiet "yes", unless they then said it wasn't for them.
    if (worn && rating !== "not-for-me") {
      addItems(0.4);
      addPairs(0.4);
    }

    if (rating === "loved") {
      addItems(0.7);
      addColors(0.4);
      addStyles(0.4);
      addPairs(0.7);
    } else if (rating === "okay") {
      addItems(0.15);
    } else if (rating === "not-for-me") {
      avoidCombos.add(comboKey(outfit.itemIds));
      const reasons = outfit.feedbackReasons ?? [];
      const has = (r: string) => reasons.includes(r);
      const specific =
        has("Too formal") ||
        has("Too casual") ||
        has("Didn't like colours") ||
        has("Uncomfortable") ||
        has("Didn't like the combination");

      if (has("Too formal")) {
        formalitySignal -= w;
        // The most formal piece is the likeliest culprit.
        const formalest = [...pieces].sort(
          (a, b) => FORMALITY_RANK[b.formality] - FORMALITY_RANK[a.formality]
        )[0];
        bump(itemAffinity, formalest.id, -0.5 * w);
      }
      if (has("Too casual")) {
        formalitySignal += w;
        const casualest = [...pieces].sort(
          (a, b) => FORMALITY_RANK[a.formality] - FORMALITY_RANK[b.formality]
        )[0];
        bump(itemAffinity, casualest.id, -0.5 * w);
      }
      if (has("Didn't like colours")) {
        // Nobody means their white sneakers: blame the loud colours when there are any.
        const loud = pieces.filter((p) => !NEUTRAL_COLORS.has(p.primaryColor.toLowerCase()));
        (loud.length > 0 ? loud : pieces).forEach((p) =>
          bump(colorAffinity, p.primaryColor.toLowerCase(), -0.8 * w)
        );
      }
      if (has("Uncomfortable")) addItems(-0.7);
      if (has("Didn't like the combination")) addPairs(-1);
      if (!specific) {
        // Plain thumbs-down: spread the blame lightly across pieces and pairings.
        addItems(-0.5);
        addPairs(-0.6);
      }
    }
  }

  clampAll(itemAffinity);
  clampAll(colorAffinity);
  clampAll(styleAffinity);
  clampAll(pairAffinity);

  const formalityShift = Math.max(-1.5, Math.min(1.5, formalitySignal * 0.7));

  const insights: TasteInsight[] = [];

  const lovedColors = topBy(colorAffinity, 1, 3).map(([c]) => titleCase(c));
  if (lovedColors.length) {
    insights.push({ kind: "love", text: `You light up in ${joinList(lovedColors)}, so I'll lean on those.` });
  }
  const lovedStyles = topBy(styleAffinity, 1, 2).map(([s]) => s);
  if (lovedStyles.length) {
    insights.push({ kind: "love", text: `Your taste leans ${joinList(lovedStyles)}.` });
  }
  const lovedItems = topBy(itemAffinity, 1, 3)
    .map(([id]) => byId.get(id)?.name)
    .filter((n): n is string => Boolean(n));
  if (lovedItems.length) {
    insights.push({ kind: "love", text: `Go-to pieces: ${joinList(lovedItems)}.` });
  }

  const avoidedColors = topBy(colorAffinity, -1, 3).map(([c]) => c);
  if (avoidedColors.length) {
    insights.push({ kind: "avoid", text: `Colours that haven't landed: ${joinList(avoidedColors)}. I'll go easy on them.` });
  }
  const avoidedItems = topBy(itemAffinity, -1, 3)
    .map(([id]) => byId.get(id)?.name)
    .filter((n): n is string => Boolean(n));
  if (avoidedItems.length) {
    insights.push({ kind: "avoid", text: `Pieces I'll use less: ${joinList(avoidedItems)}.` });
  }

  const comboNotes = topBy(pairAffinity, -1, 2)
    .map(([key]) => key.split("|").map((id) => byId.get(id)?.name))
    .filter((p): p is string[] => p.every(Boolean));
  for (const [a, b] of comboNotes) {
    insights.push({ kind: "combo", text: `${a} with ${b} didn't work for you, so I won't pair them.` });
  }

  if (formalitySignal <= -0.9) {
    insights.push({ kind: "formality", text: "Outfits felt too formal, so I'm dressing things down a notch." });
  } else if (formalitySignal >= 0.9) {
    insights.push({ kind: "formality", text: "Outfits felt too casual, so I'm dressing things up a notch." });
  }

  return {
    signalCount,
    ratedCount,
    itemAffinity,
    colorAffinity,
    styleAffinity,
    pairAffinity,
    formalityShift,
    avoidCombos: [...avoidCombos],
    insights,
  };
}

/** Plain-language notes for the AI stylist prompt. Empty when nothing is learned yet. */
export function tasteNotesForPrompt(
  taste: TasteProfile,
  items: WardrobeItem[]
): {
  notes: string[];
  avoid_combinations: string[][];
  loved_item_ids: string[];
  disliked_item_ids: string[];
} {
  const byId = new Map(items.map((i) => [i.id, i]));
  const notes = taste.insights.map((i) => i.text);
  if (taste.formalityShift <= -0.5) notes.push("Aim a little more casual than the occasion alone suggests.");
  if (taste.formalityShift >= 0.5) notes.push("Aim a little dressier than the occasion alone suggests.");

  const avoid_combinations = taste.avoidCombos
    .map((key) => key.split(",").filter((id) => byId.has(id)))
    .filter((ids) => ids.length > 0)
    .slice(0, 8);

  const ids = (sign: 1 | -1) =>
    Object.entries(taste.itemAffinity)
      .filter(([id, v]) => byId.has(id) && (sign === 1 ? v >= 0.7 : v <= -0.7))
      .sort((a, b) => (sign === 1 ? b[1] - a[1] : a[1] - b[1]))
      .slice(0, 10)
      .map(([id]) => id);

  return {
    notes,
    avoid_combinations,
    loved_item_ids: ids(1),
    disliked_item_ids: ids(-1),
  };
}
