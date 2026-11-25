import "server-only";
import type { GenerationConfig } from "@google/generative-ai";
import { GEMINI_MODELS } from "./config";
import { AIRateLimitError, AITransientError, classifyAIError } from "./errors";

const HOUR_MS = 60 * 60 * 1000;
const MAX_DAILY_COOLDOWN_MS = 6 * HOUR_MS;

/** Models that recently failed, and when to try them again. In-memory and
 *  per server instance: it's a hint that saves time, not a source of truth. */
const cooldownUntil = new Map<string, number>();

/** JSON output without the model's "thinking" phase. For the structured tasks here
 *  (outfits, chat replies) thinking added ~30s per answer without helping, and uses
 *  free-tier quota. "Lite" models don't think by default and may reject the setting. */
export function fastJsonConfig(modelName: string): GenerationConfig {
  return {
    responseMimeType: "application/json",
    ...(modelName.includes("lite") ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
  } as GenerationConfig;
}

/** Per-call network timeout, so a hung request doesn't hold a socket for the full ~20s. */
export const GEMINI_REQUEST_OPTIONS = { timeout: 12_000 };

/** Rejects if `work` takes longer than `ms`. Used so an overloaded model costs the user a few
 *  seconds before the rule-based stylist answers, not a minute of spinning. */
export function withDeadline<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}

/** Runs `run` against each configured Gemini model in turn until one works.
 *  A model that is rate-limited, overloaded, or retired is skipped (and
 *  remembered for a while). Real errors, like a malformed request, are thrown
 *  straight away instead of being retried on other models. */
export async function withGeminiFallback<T>(run: (model: string) => Promise<T>): Promise<T> {
  const now = Date.now();
  const ready = GEMINI_MODELS.filter((m) => (cooldownUntil.get(m) ?? 0) <= now);
  const order = ready.length > 0 ? ready : GEMINI_MODELS;

  const failures: (AIRateLimitError | AITransientError)[] = [];
  let lastError: unknown;

  for (const model of order) {
    try {
      return await run(model);
    } catch (err) {
      lastError = err;
      const classified = classifyAIError(err);
      if (classified) {
        failures.push(classified);
        const isDaily = classified instanceof AIRateLimitError && classified.scope === "day";
        const cooldownMs = isDaily
          ? Math.min(classified.retryAfterSeconds * 1000, MAX_DAILY_COOLDOWN_MS)
          : classified.retryAfterSeconds * 1000;
        cooldownUntil.set(model, Date.now() + cooldownMs);
        console.warn(`[gemini] ${model} unavailable (${classified.message}); trying next model`);
        continue;
      }
      if ((err as { status?: number })?.status === 404) {
        cooldownUntil.set(model, Date.now() + HOUR_MS);
        console.warn(`[gemini] ${model} not available for this key; trying next model`);
        continue;
      }
      throw err;
    }
  }

  // Everything failed. Surface the error that recovers soonest so the caller
  // can wait for it; only report a daily limit when no model can recover today.
  const recoverable = failures.filter(
    (f) => !(f instanceof AIRateLimitError && f.scope === "day")
  );
  const pool = recoverable.length > 0 ? recoverable : failures;
  if (pool.length > 0) throw [...pool].sort((a, b) => a.retryAfterSeconds - b.retryAfterSeconds)[0];
  throw lastError;
}
