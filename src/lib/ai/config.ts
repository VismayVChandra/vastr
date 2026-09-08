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

export const VISION_MODEL = process.env.ANTHROPIC_VISION_MODEL || "claude-sonnet-5";
export const TEXT_MODEL = process.env.ANTHROPIC_TEXT_MODEL || "claude-sonnet-5";
