import type { Formality, WardrobeItem } from "@/types/wardrobe";
import type { WeatherSnapshot } from "@/types/weather";
import type { ChatContext, ChatLook, ChatResult, ChatTurn } from "./chat-context";
import type { GeneratedOutfit } from "./stylist-context";
import { OCCASION_KEYWORDS, generateOutfitsMock, inferFormality } from "./mock-stylist";
import { FORMALITY_RANK } from "@/lib/taste/learn";

/**
 * Rule-based conversation for the stylist chat. It powers guests and the
 * fallback when the AI is unavailable, and mirrors what the AI path does:
 * greetings, follow-up tweaks ("more casual", "different shoes"), one look per
 * part of the day, and a clarifying question when a request is too vague.
 */

const STARTERS = [
  "What should I wear today?",
  "I have an interview tomorrow",
  "Dinner with friends tonight",
  "Something comfortable for a long day",
];

const TOP_CATS = ["Shirts", "T-Shirts", "Tops", "Sweaters"];
const BOTTOM_CATS = ["Jeans", "Trousers", "Shorts", "Skirts"];
const CLARIFY_MARKER = "dressy or casual";

const GREETING = /^(hi|hello|hey|yo|hiya|good (morning|afternoon|evening))\b[\s!.,]*$/i;
const THANKS = /^(thanks|thank you|thx|ty|great|perfect|awesome|love it|nice|cool|ok|okay)\b[\s!.,]*$/i;

const TIME_LABELS: [RegExp, string][] = [
  [/\b(morning|breakfast|early)\b/i, "Morning"],
  [/\b(afternoon|lunch|midday)\b/i, "Afternoon"],
  [/\b(evening|tonight|night|dinner|late)\b/i, "Evening"],
];

const ALL_OCCASION_WORDS = OCCASION_KEYWORDS.flatMap((e) => e.keywords);

function hasOccasion(text: string): boolean {
  const t = text.toLowerCase();
  return ALL_OCCASION_WORDS.some((k) => t.includes(k));
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function joinList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Understanding the message
// ---------------------------------------------------------------------------

interface Segment {
  text: string;
  label: string | null;
}

/** Splits "a presentation in the morning and a party at night" into its moments. */
export function splitSegments(text: string): Segment[] {
  const connectors =
    /\s*(?:,|;|\.|\band then\b|\band later\b|\bthen\b|\blater\b|\bafter that\b|\bafterwards\b|\bfollowed by\b)\s*/i;
  const isMoment = (s: string) => hasOccasion(s) || TIME_LABELS.some(([re]) => re.test(s));

  let parts = text.split(connectors).map((p) => p.trim()).filter(Boolean).filter(isMoment);
  if (parts.length < 2) {
    parts = text.split(/\s+and\s+/i).map((p) => p.trim()).filter(Boolean).filter(isMoment);
  }
  if (parts.length < 2) return [{ text, label: null }];

  return parts.slice(0, 4).map((part) => {
    const lower = part.toLowerCase();
    const time = TIME_LABELS.find(([re]) => re.test(part))?.[1] ?? null;
    // The most specific (longest) occasion word makes the best noun.
    const noun =
      ALL_OCCASION_WORDS.filter((k) => lower.includes(k)).sort((a, b) => b.length - a.length)[0] ?? null;
    const label = [time, noun ? titleCase(noun) : null].filter(Boolean).join(" · ") || null;
    return { text: part, label };
  });
}

interface Refinement {
  nudge: number;
  weather: "cold" | "hot" | null;
  /** Categories to swap, "all" for a fresh take, or null to leave pieces alone. */
  swap: string[] | "all" | null;
  phrases: string[];
}

const SWAP = "(?:different|another|other|change|swap|switch|new|replace)";
const swapRe = (what: string) => new RegExp(`${SWAP}\\s+(?:the\\s+|my\\s+|a\\s+|pair of\\s+)?(?:${what})`, "i");

export function detectRefinement(text: string): Refinement | null {
  const t = text.toLowerCase();
  const r: Refinement = { nudge: 0, weather: null, swap: null, phrases: [] };

  if (/(more casual|dress(ed)? (it )?down|less formal|tone (it )?down|more relaxed)/.test(t)) {
    r.nudge -= 1;
    r.phrases.push("dressed it down");
  }
  if (/(dress(ed)? (it )?up|dressier|more formal|smarter|fancier|more polished|step it up)/.test(t)) {
    r.nudge += 1;
    r.phrases.push("dressed it up");
  }
  if (/(warmer|something warm|chilly|too cold|add a layer)/.test(t)) {
    r.weather = "cold";
    r.phrases.push("added warmth");
  }
  if (/(lighter|cooler|too hot|too warm|more breathable)/.test(t)) {
    r.weather = "hot";
    r.phrases.push("kept it light");
  }

  const swaps: string[] = [];
  if (swapRe("shoes|sneakers|footwear|loafers").test(t)) {
    swaps.push("Shoes");
    r.phrases.push("swapped the shoes");
  }
  if (swapRe("top|shirt|tee|t-shirt").test(t)) {
    swaps.push(...TOP_CATS);
    r.phrases.push("swapped the top");
  }
  if (swapRe("jeans|trousers|pants|bottoms?|chinos").test(t)) {
    swaps.push(...BOTTOM_CATS);
    r.phrases.push("swapped the bottoms");
  }
  if (swapRe("jacket|coat|layer|outerwear").test(t)) {
    swaps.push("Jackets");
    r.phrases.push("swapped the layer");
  }
  if (swaps.length) r.swap = swaps;

  if (!r.swap && /^(another|something else|something different|different|again|try again|new options?|more options|show me more|next)\b/.test(t)) {
    r.swap = "all";
    r.phrases.push("gave you a fresh take");
  }

  return r.nudge !== 0 || r.weather || r.swap ? r : null;
}

function lastLooksTurn(history: ChatTurn[]): { turn: ChatTurn; index: number } | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.role === "assistant" && h.outfits && h.outfits.length > 0) return { turn: h, index: i };
  }
  return null;
}

/** The user's request that the given assistant turn answered. */
function requestBefore(history: ChatTurn[], index: number): string {
  for (let i = index - 1; i >= 0; i--) if (history[i].role === "user") return history[i].content;
  return "";
}

/** Preferences from earlier in the chat that should keep applying ("no jeans"). */
function carryOver(history: ChatTurn[]): string {
  return history
    .filter((h) => h.role === "user")
    .map((h) => h.content.match(/\bno (?:jeans|dress(?:es)?)\b|\bcomfortable\b|\bwalking\b/gi)?.join(" ") ?? "")
    .filter(Boolean)
    .join(" ");
}

function needsClarification(text: string, history: ChatTurn[]): boolean {
  if (history.length > 0) return false;
  const t = text.toLowerCase();
  if (t.split(/\s+/).filter(Boolean).length > 9) return false;
  const vague = /\b(event|function|occasion|gathering|plans?|do)\b/.test(t);
  const specific = hasOccasion(t) || /\b(formal|casual|dressy|smart|party|office)\b/.test(t);
  return vague && !specific;
}

const CLARIFY_ANSWERS: [RegExp, string][] = [
  [/\b(dressy|formal|fancy|smart)\b/i, "formal event"],
  [/\b(in between|somewhere|semi|smart casual|bit of both)\b/i, "smart casual"],
  [/\b(casual|relaxed|laid.?back|chill)\b/i, "casual"],
];

// ---------------------------------------------------------------------------
// Building looks
// ---------------------------------------------------------------------------

function nameFor(formality: Formality | null): string {
  switch (formality) {
    case "formal":
      return "Formal";
    case "semi-formal":
      return "Polished";
    case "smart casual":
      return "Smart Casual";
    case "casual":
      return "Easy Casual";
    case "very casual":
      return "Active";
    default:
      return "Everyday";
  }
}

function tweakWeather(base: WeatherSnapshot | null, mode: "cold" | "hot" | null): WeatherSnapshot | null {
  if (!mode) return base;
  const tempC = mode === "cold" ? 12 : 33;
  return {
    tempC,
    feelsLikeC: tempC,
    condition: mode === "cold" ? "Cool" : "Hot",
    conditionCode: 0,
    isRain: base?.isRain ?? false,
    isSnow: false,
    precipitationChance: base?.precipitationChance ?? 0,
    humidity: base?.humidity ?? 50,
    windKph: base?.windKph ?? 5,
    locationLabel: base?.locationLabel ?? "",
    isMock: true,
  };
}

function toLook(o: GeneratedOutfit, label: string | null, name: string): ChatLook {
  return { ...o, name, label };
}

function itemNames(ids: string[], byId: Map<string, WardrobeItem>): string[] {
  return ids.map((id) => byId.get(id)?.name).filter((n): n is string => Boolean(n));
}

function followUps(ctx: ChatContext): string[] {
  const t = ctx.weather?.tempC;
  return ["More casual", "Dress it up", "Different shoes", t !== undefined && t >= 26 ? "Something lighter" : "Something warmer"];
}

function weatherNote(w: WeatherSnapshot | null): string | null {
  if (!w) return null;
  if (w.isRain) return "Rain looks likely, so I steered away from suede.";
  if (w.tempC >= 30) return `It's ${Math.round(w.tempC)}°C, so I kept things breathable.`;
  if (w.tempC < 20) return `It's ${Math.round(w.tempC)}°C, so I added a layer where I could.`;
  return null;
}

function describe(looks: ChatLook[], byId: Map<string, WardrobeItem>): string {
  return looks.map((l) => `• ${l.label ?? l.name}: ${joinList(itemNames(l.itemIds, byId))}`).join("\n");
}

function missingNote(looks: ChatLook[]): string | null {
  const cats = [...new Set(looks.flatMap((l) => l.missingItems.map((m) => m.category.toLowerCase())))];
  return cats.length ? `Heads up: your wardrobe doesn't have a ${joinList(cats)} that fits yet.` : null;
}

// ---------------------------------------------------------------------------
// The conversation
// ---------------------------------------------------------------------------

function refine(ctx: ChatContext, prev: { turn: ChatTurn; index: number }, ref: Refinement): ChatResult {
  const byId = new Map(ctx.wardrobe.map((i) => [i.id, i]));
  const baseQuery = `${requestBefore(ctx.history, prev.index)} ${carryOver(ctx.history)}`.trim();
  const swapCats = Array.isArray(ref.swap) ? ref.swap : null;
  const looks: ChatLook[] = [];
  const used = new Set<string>();
  let unchanged = 0;

  prev.turn.outfits!.forEach((p) => {
    const prevItems = p.itemIds.map((id) => byId.get(id)).filter((i): i is WardrobeItem => Boolean(i));
    const avoid = new Set(used);
    if (ref.swap === "all") p.itemIds.forEach((id) => avoid.add(id));
    else if (swapCats) prevItems.filter((i) => swapCats.includes(i.category)).forEach((i) => avoid.add(i.id));

    const fresh = generateOutfitsMock({
      ...ctx,
      query: baseQuery || "What should I wear today?",
      constraints: [],
      count: 1,
      formalityNudge: (ctx.formalityNudge ?? 0) + ref.nudge,
      weather: tweakWeather(ctx.weather, ref.weather),
      avoidItemIds: [...avoid],
      recentOutfits: [],
    }).outfits[0];

    // A swap keeps everything the user didn't object to; other tweaks rebuild the look.
    let itemIds = fresh.itemIds;
    if (swapCats) {
      const kept = prevItems.filter((i) => !swapCats.includes(i.category)).map((i) => i.id);
      const replaced = fresh.itemIds.filter((id) => swapCats.includes(byId.get(id)?.category ?? ""));
      const stillThere = prevItems.filter((i) => swapCats.includes(i.category)).map((i) => i.id);
      itemIds = [...kept, ...(replaced.length ? replaced : stillThere)];
    }
    if (comboSame(itemIds, p.itemIds)) unchanged += 1;
    itemIds.forEach((id) => used.add(id));

    looks.push(toLook({ ...fresh, itemIds }, p.label, p.name));
  });

  const said = joinList(ref.phrases);
  const stuck = unchanged === looks.length && swapCats;
  const reply = stuck
    ? `I don't have another ${joinList(ref.phrases.map((p) => p.replace("swapped the ", "")))} that works with this, so I kept it as is. Adding one to your wardrobe would open up more options.\n${describe(looks, byId)}`
    : `Done, I ${said}.\n${describe(looks, byId)}`;

  return { reply, outfits: looks, followUps: followUps(ctx), isMock: true };
}

/** Whether a look's clothes (not accessories) sit within about a notch of the target dress code. */
function fitsFormality(ids: string[], target: Formality, byId: Map<string, WardrobeItem>): boolean {
  const pieces = ids
    .map((id) => byId.get(id))
    .filter((i): i is WardrobeItem => Boolean(i) && i!.category !== "Accessories");
  if (pieces.length === 0) return true;
  const avg =
    pieces.reduce((sum, p) => sum + Math.abs(FORMALITY_RANK[p.formality] - FORMALITY_RANK[target]), 0) /
    pieces.length;
  return avg <= 1.2;
}

function comboSame(a: string[], b: string[]): boolean {
  return [...a].sort().join() === [...b].sort().join();
}

function newRequest(ctx: ChatContext, query: string): ChatResult {
  const byId = new Map(ctx.wardrobe.map((i) => [i.id, i]));
  const carry = carryOver(ctx.history);
  const segments = splitSegments(query);
  const looks: ChatLook[] = [];

  if (segments.length >= 2) {
    const used = new Set<string>();
    for (const seg of segments) {
      const res = generateOutfitsMock({
        ...ctx,
        query: `${seg.text} ${carry}`.trim(),
        count: 1,
        avoidItemIds: [...used],
      });
      const o = res.outfits[0];
      if (!o || o.itemIds.length === 0) break;
      o.itemIds.forEach((id) => used.add(id));
      looks.push(toLook(o, seg.label, nameFor(inferFormality(seg.text, []))));
    }
  } else {
    const res = generateOutfitsMock({ ...ctx, query: `${query} ${carry}`.trim(), count: 2 });
    const stated = inferFormality(query, []);
    const base = nameFor(stated);
    res.outfits
      .filter((o) => o.itemIds.length > 0)
      // The scorer fills its second slot from lower-ranked pieces. For a stated dress
      // code, a poor-fitting alternate is worse than just offering one good look.
      .filter((o, i) => i === 0 || !stated || fitsFormality(o.itemIds, stated, byId))
      .forEach((o, i) => looks.push(toLook(o, null, i === 0 ? base : `${base} · Alternate`)));
  }

  if (looks.length === 0) {
    return {
      reply:
        "Your wardrobe is still empty, so I've nothing to build with yet. Add a few pieces (tops, bottoms and shoes are a great start) and I'll put outfits together.",
      outfits: [],
      followUps: [],
      isMock: true,
    };
  }

  const stated = inferFormality(query, []);
  const ways = looks.length >= 2 ? "Here are two ways to do it." : "Here's what I'd wear.";
  const intro =
    segments.length >= 2 && looks.length >= 2
      ? `You've got ${looks.length} different moments, so I made ${looks.length} looks and avoided repeating pieces where I could.`
      : stated
        ? `Going for a ${stated} feel. ${ways}`
        : looks.length >= 2
          ? "Here are two ways I'd put it together."
          : "Here's what I'd wear.";

  const reply = [intro, weatherNote(ctx.weather), describe(looks, byId), missingNote(looks)]
    .filter(Boolean)
    .join("\n");

  return { reply, outfits: looks, followUps: followUps(ctx), isMock: true };
}

export function planChatMock(ctx: ChatContext): ChatResult {
  const text = ctx.message.trim();

  if (GREETING.test(text)) {
    return {
      reply: "Hi! Tell me about your day or the occasion and I'll put outfits together from your wardrobe.",
      outfits: [],
      followUps: STARTERS,
      isMock: true,
    };
  }

  const prev = lastLooksTurn(ctx.history);

  if (THANKS.test(text)) {
    return {
      reply: "Anytime! Want me to tweak anything, or plan another day?",
      outfits: [],
      followUps: prev ? followUps(ctx) : STARTERS,
      isMock: true,
    };
  }

  // Answering my clarifying question: fold the answer into the original request.
  const lastTurn = ctx.history[ctx.history.length - 1];
  if (lastTurn?.role === "assistant" && !lastTurn.outfits?.length && lastTurn.content.includes(CLARIFY_MARKER)) {
    const answer = CLARIFY_ANSWERS.find(([re]) => re.test(text))?.[1];
    if (answer) {
      const original = requestBefore(ctx.history, ctx.history.length);
      return newRequest(ctx, `${original} ${answer}`);
    }
  }

  const refinement = prev ? detectRefinement(text) : null;
  if (prev && refinement) return refine(ctx, prev, refinement);

  if (needsClarification(text, ctx.history)) {
    return {
      reply: `Happy to help. Is it more on the ${CLARIFY_MARKER} side? And roughly when is it?`,
      outfits: [],
      followUps: ["Dressy", "Casual", "Somewhere in between"],
      isMock: true,
    };
  }

  return newRequest(ctx, text);
}
