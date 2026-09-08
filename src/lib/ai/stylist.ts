import "server-only";
import { getAnthropicClient, getGeminiClient, extractJson } from "./client";
import { stylistSystemPrompt } from "./prompts";
import { outfitGenerationSchema } from "./schemas";
import { activeAIProvider, hasAIProvider, TEXT_MODEL, GEMINI_MODEL } from "./config";
import { generateOutfitsMock } from "./mock-stylist";
import type { StylistContext, StylistResult } from "./stylist-context";

function buildWardrobeContext(ctx: StylistContext) {
  return {
    user_preferences: ctx.preferences,
    weather: ctx.weather,
    request: ctx.query,
    constraints: ctx.constraints,
    wardrobe: ctx.wardrobe
      .filter((i) => !i.archived)
      .map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        subcategory: i.subcategory,
        primary_color: i.primaryColor,
        formality: i.formality,
        season: i.season,
        style_tags: i.styleTags,
        fit: i.fit,
        times_worn: i.timesWorn,
        last_worn_at: i.lastWornAt,
        favorite: i.favorite,
      })),
    recent_outfits: ctx.recentOutfits.slice(0, 5).map((o) => ({
      name: o.name,
      item_ids: o.itemIds,
      rating: o.rating,
      feedback_reasons: o.feedbackReasons,
    })),
  };
}

async function callGemini(ctx: StylistContext): Promise<unknown> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: stylistSystemPrompt(),
    generationConfig: { responseMimeType: "application/json" },
  });
  const result = await model.generateContent(JSON.stringify(buildWardrobeContext(ctx), null, 2));
  return extractJson(result.response.text());
}

async function callAnthropic(ctx: StylistContext): Promise<unknown> {
  const anthropic = getAnthropicClient();
  const message = await anthropic.messages.create({
    model: TEXT_MODEL,
    max_tokens: 2048,
    system: stylistSystemPrompt(),
    messages: [
      {
        role: "user",
        content: JSON.stringify(buildWardrobeContext(ctx), null, 2),
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No text response from model");
  return extractJson(textBlock.text);
}

export async function generateOutfits(ctx: StylistContext): Promise<StylistResult> {
  if (!hasAIProvider) return generateOutfitsMock(ctx);

  try {
    const validIds = new Set(ctx.wardrobe.map((i) => i.id));

    const json = activeAIProvider === "gemini" ? await callGemini(ctx) : await callAnthropic(ctx);
    const parsed = outfitGenerationSchema.parse(json);

    const outfits = parsed.outfits
      .map((o) => ({
        name: o.name,
        itemIds: o.item_ids.filter((id) => validIds.has(id)),
        reason: o.reason,
        missingItems: o.missing_items.map((m) => ({
          category: m.category,
          description: m.description,
          reason: m.reason,
        })),
      }))
      .filter((o) => o.itemIds.length > 0);

    if (outfits.length === 0) throw new Error("Model returned no valid outfits");

    return {
      outfits,
      message: parsed.message ?? "Here's what I'd put together from your wardrobe.",
      isMock: false,
    };
  } catch (err) {
    console.error(
      `[ai/stylist] ${activeAIProvider} call failed, falling back to rule-based recommendations:`,
      err
    );
    return generateOutfitsMock(ctx);
  }
}
