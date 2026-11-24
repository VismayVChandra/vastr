export const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

export type AIProvider = "gemini" | "anthropic" | "mock";

/** Gemini is preferred when both keys are set (it has the more generous free
 *  tier); either can be configured independently. */
export const activeAIProvider: AIProvider = GEMINI_API_KEY
  ? "gemini"
  : ANTHROPIC_API_KEY
    ? "anthropic"
    : "mock";

export const hasAIProvider = activeAIProvider !== "mock";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

/** Free-tier quotas are enforced per model, so the server tries these in order,
 *  moving on when one is rate-limited or overloaded. Override with a
 *  comma-separated GEMINI_MODELS (Google retires model names over time). */
export const GEMINI_MODELS: string[] = [
  ...new Set(
    (process.env.GEMINI_MODELS
      ? process.env.GEMINI_MODELS.split(",").map((m) => m.trim()).filter(Boolean)
      : [GEMINI_MODEL, "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]),
  ),
];

export const VISION_MODEL = process.env.ANTHROPIC_VISION_MODEL || "claude-sonnet-5";
export const TEXT_MODEL = process.env.ANTHROPIC_TEXT_MODEL || "claude-sonnet-5";
