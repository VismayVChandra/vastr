import "server-only";
import { getGeminiClient, extractJson } from "./client";
import { FIT_ANALYSIS_PROMPT } from "./prompts";
import { fitAnalysisSchema } from "./schemas";
import { fastJsonConfig, withGeminiFallback } from "./gemini-models";
import { activeAIProvider } from "./config";
import { COLOR_PALETTE, normalizeColor } from "@/lib/colors";
import type { FitProfile } from "@/types/fit";

export type FitPhotoKind = "face" | "body";

/** The traits the model reads from photos. Height and source come from the user and the app. */
export type AnalyzedFit = Omit<FitProfile, "heightCm" | "source" | "updatedAt">;

export type FitAnalysisOutcome =
  | { provider: "gemini"; usable: true; profile: AnalyzedFit }
  | { provider: "gemini"; usable: false; reason: string }
  | { provider: "none" }
  | { provider: "unsupported" };

const PHOTO_TIMEOUT_MS = 30_000;

/** Keeps only palette colours, mapping loose names ("navy blue") onto the palette. */
function paletteOnly(colors: string[]): string[] {
  const out = colors
    .map(normalizeColor)
    .filter((c) => (COLOR_PALETTE as readonly string[]).includes(c));
  return [...new Set(out)];
}

const tidy = (list: string[], max: number) =>
  [...new Set(list.map((s) => s.trim()).filter(Boolean))].slice(0, max);

/** Validates the model's JSON into a profile, or the reason the photos couldn't be used. */
export function parseFitAnalysis(json: unknown): FitAnalysisOutcome {
  const parsed = fitAnalysisSchema.safeParse(json);
  if (!parsed.success) throw new Error("The AI's fit analysis was malformed");
  const p = parsed.data;
  if (!p.usable) {
    return {
      provider: "gemini",
      usable: false,
      reason: p.reason?.trim() || "I couldn't make out enough in these photos. Try a clearer one in good light.",
    };
  }

  const bestColors = paletteOnly(p.best_colors).slice(0, 6);
  // A colour can't be both a favourite and one to avoid; the favourite wins.
  const avoidColors = paletteOnly(p.avoid_colors)
    .filter((c) => !bestColors.includes(c))
    .slice(0, 4);

  return {
    provider: "gemini",
    usable: true,
    profile: {
      build: p.build ?? null,
      shoulders: p.shoulders ?? null,
      torso: p.torso ?? null,
      legs: p.legs ?? null,
      undertone: p.undertone ?? null,
      contrast: p.contrast ?? null,
      suits: tidy(p.suits, 6),
      avoid: tidy(p.avoid, 4),
      bestColors,
      avoidColors,
      summary: p.summary.trim(),
    },
  };
}

/**
 * Reads colouring and proportions from one to three photos. The photos are only held in
 * memory for this call: nothing is stored. Rate-limit and overload errors propagate
 * (classified) so the caller can wait and retry.
 */
export async function analyzeFit(input: {
  photos: { base64: string; mediaType: string; kind: FitPhotoKind }[];
  heightCm: number | null;
}): Promise<FitAnalysisOutcome> {
  if (activeAIProvider === "mock") return { provider: "none" };
  if (activeAIProvider !== "gemini") return { provider: "unsupported" };

  const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [];
  input.photos.forEach((photo, i) => {
    parts.push({ text: `Photo ${i + 1} (${photo.kind === "face" ? "face" : "full body"})` });
    parts.push({ inlineData: { mimeType: photo.mediaType, data: photo.base64 } });
  });
  parts.push({
    text: input.heightCm
      ? `The person says they are ${Math.round(input.heightCm)} cm tall. Describe what suits them.`
      : "Describe what suits this person.",
  });

  const response = await withGeminiFallback((modelName) =>
    getGeminiClient()
      .getGenerativeModel(
        {
          model: modelName,
          systemInstruction: FIT_ANALYSIS_PROMPT,
          generationConfig: { ...fastJsonConfig(modelName), temperature: 0.3 },
        },
        { timeout: PHOTO_TIMEOUT_MS }
      )
      .generateContent(parts)
  );

  return parseFitAnalysis(extractJson(response.response.text()));
}
