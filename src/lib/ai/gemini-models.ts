import "server-only";
import { GEMINI_MODELS } from "./config";
import { AIRateLimitError, AITransientError, classifyAIError } from "./errors";

const HOUR_MS = 60 * 60 * 1000;
const MAX_DAILY_COOLDOWN_MS = 6 * HOUR_MS;

/** Models that recently failed, and when to try them again. In-memory and
 *  per server instance: it's a hint that saves time, not a source of truth. */
const cooldownUntil = new Map<string, number>();

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
