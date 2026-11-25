import { NextResponse } from "next/server";
import { AIRateLimitError, AITransientError } from "./errors";

/** Maps rate-limit / overload errors to 429 / 503 responses carrying retry
 *  info, so clients can wait and retry. Returns null for any other error. */
export function aiErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof AIRateLimitError) {
    console.warn(`[api] rate limited: scope=${err.scope} retryAfter=${err.retryAfterSeconds}s`);
    return NextResponse.json(
      { error: "rate_limited", scope: err.scope, retryAfterSeconds: err.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(err.retryAfterSeconds) } }
    );
  }
  if (err instanceof AITransientError) {
    return NextResponse.json(
      { error: "busy", retryAfterSeconds: err.retryAfterSeconds },
      { status: 503, headers: { "Retry-After": String(err.retryAfterSeconds) } }
    );
  }
  return null;
}
