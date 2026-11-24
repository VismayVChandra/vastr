export type RateLimitScope = "minute" | "day" | "unknown";

export class AIRateLimitError extends Error {
  constructor(
    public scope: RateLimitScope,
    public retryAfterSeconds: number
  ) {
    super(`AI provider rate limit (${scope})`);
  }
}

/** Provider is overloaded (e.g. Gemini 503 "high demand"); worth retrying shortly. */
export class AITransientError extends Error {
  constructor(public retryAfterSeconds: number) {
    super("AI provider temporarily unavailable");
  }
}

interface ErrorDetail {
  "@type"?: string;
  retryDelay?: string;
  violations?: { quotaId?: string }[];
}

function readDetails(err: unknown): ErrorDetail[] {
  const details = (err as { errorDetails?: unknown })?.errorDetails;
  return Array.isArray(details) ? (details as ErrorDetail[]) : [];
}

function readRetryAfterHeader(err: unknown): number | null {
  const headers = (err as { headers?: unknown })?.headers as
    | { get?: (name: string) => string | null }
    | Record<string, string>
    | undefined;
  const raw =
    typeof (headers as { get?: unknown })?.get === "function"
      ? (headers as { get: (n: string) => string | null }).get("retry-after")
      : (headers as Record<string, string> | undefined)?.["retry-after"];
  const seconds = raw ? parseFloat(raw) : NaN;
  return Number.isFinite(seconds) ? seconds : null;
}

/** Turns provider SDK errors into rate-limit / transient errors the UI can
 *  schedule around. Returns null for everything else (real failures). */
export function classifyAIError(err: unknown): AIRateLimitError | AITransientError | null {
  if (err instanceof AIRateLimitError || err instanceof AITransientError) return err;

  const status = (err as { status?: number })?.status;
  if (typeof status !== "number") return null;

  const details = readDetails(err);
  const retryInfo = details.find((d) => d["@type"]?.endsWith("RetryInfo"));
  const fromDetails = retryInfo?.retryDelay ? parseFloat(retryInfo.retryDelay) : NaN;
  const retryAfter = Number.isFinite(fromDetails) ? fromDetails : readRetryAfterHeader(err);

  if (status === 429) {
    const quotaIds = details
      .filter((d) => d["@type"]?.endsWith("QuotaFailure"))
      .flatMap((d) => d.violations ?? [])
      .map((v) => v.quotaId ?? "");
    const scope: RateLimitScope = quotaIds.some((id) => /PerDay/i.test(id))
      ? "day"
      : quotaIds.some((id) => /PerMinute/i.test(id))
        ? "minute"
        : "unknown";
    return new AIRateLimitError(scope, Math.max(1, Math.ceil(retryAfter ?? 15)));
  }

  if (status === 503 || status === 504 || status === 529) {
    return new AITransientError(Math.max(2, Math.ceil(retryAfter ?? 4)));
  }

  return null;
}
