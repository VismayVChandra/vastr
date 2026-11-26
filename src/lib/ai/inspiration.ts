import "server-only";
import { getGeminiClient, extractJson } from "./client";
import { INSPIRATION_PROMPT } from "./prompts";
import { inspirationSchema } from "./schemas";
import { fastJsonConfig, withGeminiFallback } from "./gemini-models";
import { activeAIProvider } from "./config";
import { hasFitSignal, type FitProfile } from "@/types/fit";
import type { WardrobeItem } from "@/types/wardrobe";
import type { MissingPiece } from "@/types/outfit";
import type { StylePreferences } from "@/types/user";

export type InspirationVerdict = "great" | "works_with_tweaks" | "not_ideal";

export interface InspirationResult {
  lookName: string;
  pieces: string[];
  verdict: InspirationVerdict;
  verdictReason: string;
  adjustments: string[];
  /** The closest version of the look from clothes the user owns, adapted to suit them. */
  fromWardrobe: { name: string; itemIds: string[]; reason: string; missingItems: MissingPiece[] } | null;
  /** Whether a fit profile informed the verdict. */
  usedFitProfile: boolean;
}

export type InspirationOutcome =
  | { provider: "gemini"; usable: true; result: InspirationResult }
  | { provider: "gemini"; usable: false; reason: string }
  | { provider: "none" }
  | { provider: "unsupported" };

const PHOTO_TIMEOUT_MS = 40_000;

/** Validates the model's JSON, dropping any wardrobe item that doesn't exist. */
export function parseInspiration(
  json: unknown,
  wardrobe: Pick<WardrobeItem, "id">[],
  usedFitProfile: boolean
): InspirationOutcome {
  const parsed = inspirationSchema.safeParse(json);
  if (!parsed.success) throw new Error("The AI's inspiration check was malformed");
  const p = parsed.data;

  if (!p.usable) {
    return {
      provider: "gemini",
      usable: false,
      reason: p.reason?.trim() || "I couldn't see an outfit in that image. Try a clearer screenshot of the look.",
    };
  }

  const validIds = new Set(wardrobe.map((i) => i.id));
  const fw = p.from_wardrobe;
  const itemIds = fw ? [...new Set(fw.item_ids.filter((id) => validIds.has(id)))] : [];

  return {
    provider: "gemini",
    usable: true,
    result: {
      lookName: p.look_name.trim() || "Inspiration look",
      pieces: p.pieces.map((s) => s.trim()).filter(Boolean),
      verdict: p.verdict,
      verdictReason: p.verdict_reason.trim(),
      adjustments: p.adjustments.map((s) => s.trim()).filter(Boolean),
      fromWardrobe:
        fw && itemIds.length > 0
          ? { name: fw.name, itemIds, reason: fw.reason, missingItems: fw.missing_items }
          : null,
      usedFitProfile,
    },
  };
}

/**
 * Judges a screenshot of an outfit for this particular person and rebuilds the closest
 * version from their own wardrobe. The image is held only in memory for the call.
 */
export async function checkInspiration(input: {
  base64: string;
  mediaType: string;
  fit: FitProfile | null;
  preferences: StylePreferences | null;
  wardrobe: WardrobeItem[];
}): Promise<InspirationOutcome> {
  if (activeAIProvider === "mock") return { provider: "none" };
  if (activeAIProvider !== "gemini") return { provider: "unsupported" };

  const usedFit = hasFitSignal(input.fit);
  const context = {
    fit_profile: usedFit ? input.fit : null,
    preferences: input.preferences ? { ...input.preferences, fitProfile: undefined } : null,
    wardrobe: input.wardrobe
      .filter((i) => !i.archived)
      .map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        primary_color: i.primaryColor,
        formality: i.formality,
        fit: i.fit,
        style_tags: i.styleTags,
      })),
  };

  const response = await withGeminiFallback((modelName) =>
    getGeminiClient()
      .getGenerativeModel(
        {
          model: modelName,
          systemInstruction: INSPIRATION_PROMPT,
          generationConfig: { ...fastJsonConfig(modelName), temperature: 0.4 },
        },
        { timeout: PHOTO_TIMEOUT_MS }
      )
      .generateContent([
        { inlineData: { mimeType: input.mediaType, data: input.base64 } },
        { text: `About the user:\n${JSON.stringify(context)}\n\nHow would the look in this screenshot work on them?` },
      ])
  );

  return parseInspiration(extractJson(response.response.text()), input.wardrobe, usedFit);
}
