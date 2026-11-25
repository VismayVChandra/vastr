import "server-only";
import type { GenerationConfig } from "@google/generative-ai";
import { getAnthropicClient, getGeminiClient, extractJson } from "./client";
import { visionBatchPrompt } from "./prompts";
import { visionResultSchema } from "./schemas";
import { classifyAIError } from "./errors";
import { withGeminiFallback } from "./gemini-models";
import { activeAIProvider, hasAIProvider, VISION_MODEL } from "./config";
import { mockAnalyzeImage } from "./mock-vision";
import type { AIVisionResult } from "@/types/wardrobe";

export interface AnalyzeInput {
  base64: string;
  mediaType: string;
  fileName: string;
  fileSizeBytes: number;
}

export type BatchItemOutcome =
  | { ok: true; result: AIVisionResult; isMock: boolean }
  | { ok: false };

export interface BatchOutcome {
  provider: "gemini" | "anthropic" | "none";
  items: BatchItemOutcome[];
}

export function toAIVisionResult(payload: ReturnType<typeof visionResultSchema.parse>): AIVisionResult {
  return {
    category: payload.category,
    subcategory: payload.subcategory,
    primaryColor: payload.primary_color,
    secondaryColors: payload.secondary_colors,
    pattern: payload.pattern,
    material: payload.material,
    fit: payload.fit,
    formality: payload.formality,
    season: payload.season,
    styleTags: payload.style_tags,
    suggestedName: payload.suggested_name,
    confidence: payload.confidence,
  };
}

/** Maps the model's {"results":[{index,...}]} onto the inputs, tolerating
 *  missing or malformed entries (those come back as ok:false and get retried). */
function parseBatchResponse(json: unknown, count: number): BatchItemOutcome[] {
  const outcomes: BatchItemOutcome[] = Array.from({ length: count }, () => ({ ok: false }));
  const raw = (json as { results?: unknown })?.results;
  if (!Array.isArray(raw)) return outcomes;

  raw.forEach((entry, position) => {
    const declared = (entry as { index?: unknown })?.index;
    const index = typeof declared === "number" ? declared : position;
    if (!Number.isInteger(index) || index < 0 || index >= count) return;
    const parsed = visionResultSchema.safeParse(entry);
    if (parsed.success) {
      outcomes[index] = { ok: true, result: toAIVisionResult(parsed.data), isMock: false };
    }
  });
  return outcomes;
}

async function analyzeBatchWithGemini(inputs: AnalyzeInput[]): Promise<BatchItemOutcome[]> {
  const parts = inputs.flatMap((input, i) => [
    { text: `Image ${i}` },
    { inlineData: { mimeType: input.mediaType, data: input.base64 } },
  ]);

  const response = await withGeminiFallback((modelName) => {
    const model = getGeminiClient().getGenerativeModel({
      model: modelName,
      systemInstruction: visionBatchPrompt(inputs.length),
      generationConfig: {
        responseMimeType: "application/json",
        // Classification doesn't need "thinking"; switching it off is faster and
        // uses less quota. "Lite" models don't think by default (and may reject the setting).
        ...(modelName.includes("lite") ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
      } as GenerationConfig,
    });
    return model.generateContent(parts);
  });
  return parseBatchResponse(extractJson(response.response.text()), inputs.length);
}

async function analyzeBatchWithAnthropic(inputs: AnalyzeInput[]): Promise<BatchItemOutcome[]> {
  const message = await getAnthropicClient().messages.create({
    model: VISION_MODEL,
    max_tokens: 1024 * inputs.length,
    system: visionBatchPrompt(inputs.length),
    messages: [
      {
        role: "user",
        content: inputs.flatMap((input, i) => [
          { type: "text" as const, text: `Image ${i}` },
          {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: input.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              data: input.base64,
            },
          },
        ]),
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No text response from model");
  return parseBatchResponse(extractJson(textBlock.text), inputs.length);
}

/** Analyzes up to a handful of photos in a single provider request.
 *  Rate-limit / overload errors are re-thrown (classified) so the caller can
 *  schedule around them; other failures come back as ok:false per photo. */
export async function analyzeClothingBatch(inputs: AnalyzeInput[]): Promise<BatchOutcome> {
  if (!hasAIProvider) {
    return {
      provider: "none",
      items: inputs.map((input) => ({
        ok: true,
        result: mockAnalyzeImage(input.fileName, input.fileSizeBytes),
        isMock: true,
      })),
    };
  }

  try {
    const items =
      activeAIProvider === "gemini"
        ? await analyzeBatchWithGemini(inputs)
        : await analyzeBatchWithAnthropic(inputs);
    return { provider: activeAIProvider === "gemini" ? "gemini" : "anthropic", items };
  } catch (err) {
    const classified = classifyAIError(err);
    if (classified) throw classified;
    console.error(`[ai/vision] ${activeAIProvider} batch call failed:`, err);
    return {
      provider: activeAIProvider === "gemini" ? "gemini" : "anthropic",
      items: inputs.map(() => ({ ok: false })),
    };
  }
}
