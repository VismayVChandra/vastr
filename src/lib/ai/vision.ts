import "server-only";
import { getAnthropicClient, getGeminiClient, extractJson } from "./client";
import { VISION_SYSTEM_PROMPT } from "./prompts";
import { visionResultSchema } from "./schemas";
import { activeAIProvider, hasAIProvider, VISION_MODEL, GEMINI_MODEL } from "./config";
import { mockAnalyzeImage } from "./mock-vision";
import type { AIVisionResult } from "@/types/wardrobe";

interface AnalyzeInput {
  base64: string;
  mediaType: string;
  fileName: string;
  fileSizeBytes: number;
}

function toAIVisionResult(payload: ReturnType<typeof visionResultSchema.parse>): AIVisionResult {
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

async function analyzeWithGemini(input: AnalyzeInput): Promise<AIVisionResult> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: VISION_SYSTEM_PROMPT,
    generationConfig: { responseMimeType: "application/json" },
  });

  const result = await model.generateContent([
    { inlineData: { mimeType: input.mediaType, data: input.base64 } },
    { text: "Analyze this clothing item." },
  ]);

  const json = extractJson(result.response.text());
  return toAIVisionResult(visionResultSchema.parse(json));
}

async function analyzeWithAnthropic(input: AnalyzeInput): Promise<AIVisionResult> {
  const anthropic = getAnthropicClient();
  const message = await anthropic.messages.create({
    model: VISION_MODEL,
    max_tokens: 1024,
    system: VISION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: input.mediaType as
                | "image/jpeg"
                | "image/png"
                | "image/webp"
                | "image/gif",
              data: input.base64,
            },
          },
          { type: "text", text: "Analyze this clothing item." },
        ],
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No text response from model");

  const json = extractJson(textBlock.text);
  return toAIVisionResult(visionResultSchema.parse(json));
}

export async function analyzeClothingImage(input: AnalyzeInput): Promise<{
  result: AIVisionResult;
  isMock: boolean;
  mockReason?: "no-provider" | "provider-error";
}> {
  if (!hasAIProvider) {
    return {
      result: mockAnalyzeImage(input.fileName, input.fileSizeBytes),
      isMock: true,
      mockReason: "no-provider",
    };
  }

  try {
    const result =
      activeAIProvider === "gemini" ? await analyzeWithGemini(input) : await analyzeWithAnthropic(input);
    return { result, isMock: false };
  } catch (err) {
    console.error(`[ai/vision] ${activeAIProvider} call failed, falling back to mock analysis:`, err);
    return {
      result: mockAnalyzeImage(input.fileName, input.fileSizeBytes),
      isMock: true,
      mockReason: "provider-error",
    };
  }
}
