import "server-only";
import type { GenerationConfig } from "@google/generative-ai";
import { getGeminiClient, extractJson } from "./client";
import { OUTFIT_PHOTO_PROMPT } from "./prompts";
import { visionResultSchema } from "./schemas";
import { withGeminiFallback } from "./gemini-models";
import { toAIVisionResult } from "./vision";
import { activeAIProvider } from "./config";
import type { Box2D, DetectedItem, DetectedPerson } from "@/types/outfit-photo";

export type OutfitPhotoOutcome =
  | { provider: "gemini"; people: DetectedPerson[] }
  | { provider: "unsupported" | "none"; people: [] };

const MIN_BOX_SIDE = 20;

function parseBox(raw: unknown): Box2D | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const nums = raw.map((n) => (typeof n === "number" && Number.isFinite(n) ? n : NaN));
  if (nums.some(Number.isNaN)) return null;
  const [ymin, xmin, ymax, xmax] = nums.map((n) => Math.round(Math.min(1000, Math.max(0, n))));
  if (ymax - ymin < MIN_BOX_SIDE || xmax - xmin < MIN_BOX_SIDE) return null;
  return [ymin, xmin, ymax, xmax];
}

const area = (b: Box2D) => (b[2] - b[0]) * (b[3] - b[1]);

const unionBox = (boxes: Box2D[]): Box2D => [
  Math.min(...boxes.map((b) => b[0])),
  Math.min(...boxes.map((b) => b[1])),
  Math.max(...boxes.map((b) => b[2])),
  Math.max(...boxes.map((b) => b[3])),
];

/** Models sometimes return the left and right shoe separately. A pair is one wardrobe item. */
function mergeShoePairs(items: DetectedItem[]): DetectedItem[] {
  const shoes = items.filter((i) => i.result.category === "Shoes");
  if (shoes.length < 2) return items;
  const merged: DetectedItem = { box: unionBox(shoes.map((s) => s.box)), result: shoes[0].result };
  return [...items.filter((i) => i.result.category !== "Shoes"), merged];
}

/** Validates the model's JSON; anything malformed is dropped rather than shown. */
export function parseOutfitResponse(json: unknown): DetectedPerson[] {
  const rawPeople = (json as { people?: unknown })?.people;
  if (!Array.isArray(rawPeople)) return [];

  const people: DetectedPerson[] = [];
  for (const rawPerson of rawPeople) {
    const rawItems = (rawPerson as { items?: unknown })?.items;
    if (!Array.isArray(rawItems)) continue;

    const parsedItems: DetectedItem[] = [];
    for (const rawItem of rawItems) {
      const box = parseBox((rawItem as { box_2d?: unknown })?.box_2d);
      const parsed = visionResultSchema.safeParse(rawItem);
      if (box && parsed.success) parsedItems.push({ box, result: toAIVisionResult(parsed.data) });
    }
    const items = mergeShoePairs(parsedItems);
    if (items.length === 0) continue;

    // If the person's own box is missing, fall back to the union of their items.
    const personBox =
      parseBox((rawPerson as { box_2d?: unknown })?.box_2d) ?? unionBox(items.map((i) => i.box));
    people.push({ box: personBox, items });
  }

  // Main subject first: the biggest person in the frame.
  return people.sort((a, b) => area(b.box) - area(a.box));
}

/** Finds each person in a photo and the garments they are wearing. Rate-limit
 *  and overload errors propagate (classified) so callers can wait and retry. */
export async function detectOutfit(input: {
  base64: string;
  mediaType: string;
}): Promise<OutfitPhotoOutcome> {
  if (activeAIProvider === "mock") return { provider: "none", people: [] };
  // Reliable bounding boxes are a Gemini capability; Claude isn't used for this.
  if (activeAIProvider !== "gemini") return { provider: "unsupported", people: [] };

  const response = await withGeminiFallback((modelName) =>
    getGeminiClient()
      .getGenerativeModel({
        model: modelName,
        systemInstruction: OUTFIT_PHOTO_PROMPT,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
          ...(modelName.includes("lite") ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
        } as GenerationConfig,
      })
      .generateContent([
        { inlineData: { mimeType: input.mediaType, data: input.base64 } },
        { text: "Find the outfit(s) in this photo." },
      ])
  );

  return { provider: "gemini", people: parseOutfitResponse(extractJson(response.response.text())) };
}
